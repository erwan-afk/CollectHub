import { Router, Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as q from '../db/invoice-queries';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { scopeToOrg } from '../middleware/scope-to-org';
import { logger } from '../config/logger';
import { invoiceUpload } from '../middleware/invoice-upload';
import {
  InvoiceListQuerySchema,
  InvoiceUpdateSchema,
  StatusTransitionSchema,
  SupplierIdParamSchema,
  CorrectionBodySchema,
} from '../validation/invoice-schemas';
import { extractTextFromFile } from '../services/ocr/ocr.service';
import { ocrQueue, ocrJobOpts } from '../services/queue';
import { dispatch as dispatchWebhook } from '../services/webhooks/dispatcher';
import { InvoiceStatus } from '../types/invoice';

const router = Router();
router.use(requireAuth, scopeToOrg);

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  PROCESSING: ['DRAFT', 'PENDING_VALIDATION', 'REJECTED'],
  DRAFT: ['PENDING_VALIDATION', 'REJECTED'],
  PENDING_VALIDATION: ['VALIDATED', 'REJECTED', 'DRAFT'],
  VALIDATED: ['ARCHIVED'],
  REJECTED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: [],
};

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const status = req.query.status as InvoiceStatus | undefined;
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const rows = await q.exportInvoices(orgId, { status, dateFrom, dateTo });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    );

    const header = [
      'id',
      'supplier_name',
      'supplier_siret',
      'invoice_number',
      'issue_date',
      'due_date',
      'amount_ht',
      'amount_tva',
      'amount_ttc',
      'currency',
      'status',
    ].join(',');
    res.write('﻿' + header + '\r\n');
    for (const r of rows) {
      res.write(
        [
          csvEscape(r.id),
          csvEscape(r.supplierName),
          csvEscape(r.supplierSiret),
          csvEscape(r.invoiceNumber),
          csvEscape(r.issueDate),
          csvEscape(r.dueDate),
          csvEscape(r.amountHt),
          csvEscape(r.amountTva),
          csvEscape(r.amountTtc),
          csvEscape(r.currency),
          csvEscape(r.status),
        ].join(',') + '\r\n',
      );
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    res.json(await q.dashboardSummary(orgId));
  } catch (err) {
    next(err);
  }
});

router.get(
  '/',
  validate(InvoiceListQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const filters = req.query as unknown as q.InvoiceFilters;
      const { data, total } = await q.listInvoices(orgId, filters);
      res.json({ data, total, limit: filters.limit, offset: filters.offset });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  validate(SupplierIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const inv = await q.getInvoiceById(id, orgId);
      if (!inv) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      res.json(inv);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id/file',
  validate(SupplierIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const inv = await q.getInvoiceById(id, orgId);
      if (!inv) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      if (!fs.existsSync(inv.filePath)) {
        res.status(404).json({ error: 'File missing' });
        return;
      }
      res.removeHeader('X-Frame-Options');
      res.setHeader(
        'Content-Security-Policy',
        "frame-ancestors 'self' http://localhost:4200 http://localhost:4300",
      );
      if (inv.fileMime) res.type(inv.fileMime);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(inv.filePath)}"`);
      fs.createReadStream(inv.filePath).pipe(res);
    } catch (err) {
      next(err);
    }
  },
);

const NULL_BYTE_RE = new RegExp(String.fromCharCode(0), 'g');
function sanitizeForPg(s: string): string {
  if (!s) return '';
  return s.replace(NULL_BYTE_RE, '').replace(/[\uD800-\uDFFF]/g, '');
}

async function sha256OfFile(p: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(p)
      .on('data', (chunk) => h.update(chunk))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

router.post(
  '/upload',
  invoiceUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      if (!req.file) {
        res.status(400).json({ error: 'file is required' });
        return;
      }
      const filePath = req.file.path;
      const mime = req.file.mimetype;

      const fileHash = await sha256OfFile(filePath);

      const existingByHash = await q.findInvoiceByHash(orgId, fileHash);
      if (existingByHash) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        res
          .status(409)
          .json({ error: 'Duplicate file', reason: 'file-hash', existing: existingByHash });
        return;
      }

      // Crée la facture en statut PROCESSING, l'OCR se fera en arrière-plan via BullMQ.
      let invoice;
      try {
        invoice = await q.createInvoice({
          organizationId: orgId,
          supplierId: null,
          status: 'PROCESSING',
          currency: 'EUR',
          filePath,
          fileMime: mime,
          fileHash,
        });
      } catch (e: unknown) {
        if (
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          (e as { code?: string }).code === '23505'
        ) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            /* ignore */
          }
          res.status(409).json({ error: 'Duplicate invoice', reason: 'db-unique' });
          return;
        }
        throw e;
      }

      await ocrQueue.add(
        `ocr-${invoice.id}`,
        { invoiceId: invoice.id, filePath, orgId },
        ocrJobOpts,
      );

      logger.info('invoice.uploaded', { invoiceId: invoice.id, orgId, fileHash });

      // 202 Accepted — le traitement OCR est en cours
      res.status(202).json({ invoiceId: invoice.id, status: 'PROCESSING' });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  validate(SupplierIdParamSchema, 'params'),
  validate(InvoiceUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const invoice = await q.updateInvoice(id, orgId, req.body);
      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/reprocess-ocr',
  validate(SupplierIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const inv = await q.getInvoiceById(id, orgId);
      if (!inv) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      if (!fs.existsSync(inv.filePath)) {
        res.status(404).json({ error: 'File missing on disk' });
        return;
      }

      // Sprint 3 : le traitement passe par la queue + worker hybride
      await ocrQueue.add(
        `ocr-reprocess-${id}`,
        { invoiceId: id, filePath: inv.filePath, orgId },
        ocrJobOpts,
      );

      logger.info('invoice.reprocess_queued', { invoiceId: id, orgId });
      res.status(202).json({ invoiceId: id, status: 'PROCESSING' });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/transition',
  validate(SupplierIdParamSchema, 'params'),
  validate(StatusTransitionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const { to, reason } = req.body as { to: InvoiceStatus; reason?: string };

      const current = await q.getInvoiceById(id, orgId);
      if (!current) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const allowed = TRANSITIONS[current.status];
      if (!allowed.includes(to)) {
        res
          .status(409)
          .json({ error: 'Illegal transition', details: { from: current.status, to, allowed } });
        return;
      }

      // On utilise l'email de l'utilisateur authentifié comme acteur de la transition.
      const actor = req.user!.email;
      const result = await q.transitionInvoiceStatus(id, orgId, to, reason, actor);
      if (!result) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      logger.info('invoice.transitioned', {
        invoiceId: id,
        from: result.from,
        to,
        actor,
        orgId,
      });

      // Webhooks pour les événements métier clés
      if (to === 'VALIDATED' || to === 'REJECTED') {
        const event = to === 'VALIDATED' ? 'invoice.validated' : 'invoice.rejected';
        dispatchWebhook(orgId, event, { invoiceId: id, status: to, actor }).catch(() => {
          /* non-bloquant */
        });
      }

      res.json(result.invoice);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Sprint 3 : Split PDF multi-factures ─────────────────────────────────────

router.post(
  '/split',
  invoiceUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      if (!req.file) {
        res.status(400).json({ error: 'file is required' });
        return;
      }

      const { splitMultiInvoicePdf } = await import('../services/ocr/pdf-splitter');
      const splitResult = await splitMultiInvoicePdf(req.file.path);

      if (splitResult.count <= 1) {
        // Pas de split détecté → on traite comme un upload normal
        const filePath = req.file.path;
        const mime = req.file.mimetype;
        const fileHash = await sha256OfFile(filePath);

        const invoice = await q.createInvoice({
          organizationId: orgId,
          supplierId: null,
          status: 'PROCESSING',
          currency: 'EUR',
          filePath,
          fileMime: mime,
          fileHash,
        });

        await ocrQueue.add(
          `ocr-${invoice.id}`,
          { invoiceId: invoice.id, filePath, orgId },
          ocrJobOpts,
        );

        res.status(202).json({
          splitCount: 1,
          invoices: [{ invoiceId: invoice.id, filePath, status: 'PROCESSING' }],
        });
        return;
      }

      // Split détecté → créer N factures
      const created: Array<{ invoiceId: number; filePath: string; status: string }> = [];

      for (const part of splitResult.parts) {
        const fileHash = await sha256OfFile(part.filePath);
        const invoice = await q.createInvoice({
          organizationId: orgId,
          supplierId: null,
          status: 'PROCESSING',
          currency: 'EUR',
          filePath: part.filePath,
          fileMime: 'application/pdf',
          fileHash,
        });

        await ocrQueue.add(
          `ocr-${invoice.id}`,
          {
            invoiceId: invoice.id,
            filePath: part.filePath,
            orgId,
          },
          ocrJobOpts,
        );

        created.push({ invoiceId: invoice.id, filePath: part.filePath, status: 'PROCESSING' });
      }

      // Nettoyer le PDF original (on garde les splités)
      try {
        fs.unlinkSync(splitResult.originalPath);
      } catch {
        /* ignore */
      }

      logger.info('invoice.split_completed', {
        orgId,
        originalPages: splitResult.totalPages,
        splitCount: splitResult.count,
      });

      res.status(202).json({
        splitCount: splitResult.count,
        totalPages: splitResult.totalPages,
        invoices: created,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Sprint 3 : Enregistrer une correction utilisateur ───────────────────────

router.patch(
  '/:id/corrections',
  validate(SupplierIdParamSchema, 'params'),
  validate(CorrectionBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const body = req.body as {
        field: string;
        rawTextSnippet?: string;
        aiValue?: string;
        correctedValue: string;
        costUsd?: number;
      };

      const inv = await q.getInvoiceById(id, orgId);
      if (!inv) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const { insertCorrection } = await import('../db/extraction-corrections-queries');
      const correction = await insertCorrection({
        orgId,
        supplierId: inv.supplierId,
        invoiceId: id,
        field: body.field,
        rawTextSnippet: body.rawTextSnippet ?? '',
        aiValue: body.aiValue ?? '',
        correctedValue: body.correctedValue,
        costUsd: body.costUsd ?? 0,
      });

      logger.info('invoice.correction_saved', {
        invoiceId: id,
        supplierId: inv.supplierId,
        field: body.field,
        orgId,
      });

      res.status(201).json(correction);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id/corrections',
  validate(SupplierIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const { getCorrectionsByInvoice } = await import('../db/extraction-corrections-queries');
      const corrections = await getCorrectionsByInvoice(orgId, id);
      res.json(corrections);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  validate(SupplierIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { id } = req.params as unknown as { id: number };
      const inv = await q.getInvoiceById(id, orgId);
      if (!inv) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      try {
        if (inv.filePath && fs.existsSync(inv.filePath)) fs.unlinkSync(inv.filePath);
      } catch {
        /* ignore */
      }
      const { pool } = await import('../db/database');
      const r = await pool.query('DELETE FROM invoices WHERE id = $1 AND organization_id = $2', [
        id,
        orgId,
      ]);
      if ((r.rowCount ?? 0) === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
