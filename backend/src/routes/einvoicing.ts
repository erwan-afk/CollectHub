import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { generateFacturX, generateCiiXml } from '../services/einvoicing/facturx-generator.service';
import { parseFacturX } from '../services/einvoicing/facturx-parser.service';
import { parseUblXml } from '../services/einvoicing/ubl-parser.service';
import { validateCII, validateUBL } from '../services/einvoicing/validators/xsd-validator';
import { applyBusinessRules } from '../services/einvoicing/validators/business-rules';
import { dtoToInvoiceFields } from '../services/einvoicing/cii-mapper';
import {
  getInvoiceById,
  createInvoice,
  getLifecycleEvents,
  createLifecycleEvent,
} from '../db/invoice-queries';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { scopeToOrg } from '../middleware/scope-to-org';
import type { EInvoiceParty, LifecycleStatus } from '../types/einvoice';
import { AppError } from '../errors/AppError';

const router = Router();

router.use(requireAuth, scopeToOrg);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── GET /invoices/:id/facturx.pdf ───────────────────────────────────────────

router.get('/invoices/:id/facturx.pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = Number(res.locals.orgId);
    const id = Number(req.params.id);
    const invoice = await getInvoiceById(id, orgId);
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const buyer: EInvoiceParty = {
      name: (req.query.buyerName as string) ?? 'Buyer',
      address: { countryCode: (req.query.buyerCountry as string) ?? 'FR' },
    };

    const pdfBuffer = await generateFacturX(invoice, { buyer });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="facturx-${invoice.invoiceNumber ?? invoice.id}.pdf"`,
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// ─── GET /invoices/:id/facturx.xml ───────────────────────────────────────────

router.get('/invoices/:id/facturx.xml', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = Number(res.locals.orgId);
    const id = Number(req.params.id);
    const invoice = await getInvoiceById(id, orgId);
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const buyer: EInvoiceParty = {
      name: (req.query.buyerName as string) ?? 'Buyer',
      address: { countryCode: 'FR' },
    };

    const xml = generateCiiXml(invoice, buyer);
    const validation = await validateCII(xml);

    if (!validation.valid) {
      res.status(422).json({ error: 'XML failed XSD validation', xsdErrors: validation.xsdErrors });
      return;
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="facturx-${invoice.invoiceNumber ?? invoice.id}.xml"`,
    );
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

// ─── POST /invoices/import/facturx ───────────────────────────────────────────

router.post(
  '/invoices/import/facturx',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded');
      const orgId = Number(res.locals.orgId);

      const { dto, rawXml, profile, warnings } = await parseFacturX(req.file.buffer);
      const brErrors = applyBusinessRules(dto);
      const xsdResult = await validateCII(rawXml);
      const allValid = xsdResult.valid && brErrors.length === 0;

      const fields = dtoToInvoiceFields(dto);
      const created = await createInvoice({
        organizationId: orgId,
        supplierId: null,
        status: 'DRAFT',
        invoiceNumber: fields.invoiceNumber ?? null,
        issueDate: fields.issueDate ?? null,
        dueDate: fields.dueDate ?? null,
        amountHt: fields.amountHt ?? null,
        amountTva: fields.amountTva ?? null,
        amountTtc: fields.amountTtc ?? null,
        currency: fields.currency ?? 'EUR',
        filePath: `imported/${Date.now()}.pdf`,
        fileMime: 'application/pdf',
        fileHash: null,
      });

      res.status(201).json({
        invoiceId: created.id,
        profile,
        validation: {
          valid: allValid,
          xsdErrors: xsdResult.xsdErrors,
          businessRuleErrors: brErrors,
        },
        warnings,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /invoices/import/ubl ────────────────────────────────────────────────

router.post(
  '/invoices/import/ubl',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'No file uploaded');
      const orgId = Number(res.locals.orgId);

      const xml = req.file.buffer.toString('utf-8');
      const dto = parseUblXml(xml);
      const brErrors = applyBusinessRules(dto);
      const xsdResult = await validateUBL(xml);
      const allValid = xsdResult.valid && brErrors.length === 0;

      const fields = dtoToInvoiceFields(dto);
      const created = await createInvoice({
        organizationId: orgId,
        supplierId: null,
        status: 'DRAFT',
        invoiceNumber: fields.invoiceNumber ?? null,
        issueDate: fields.issueDate ?? null,
        dueDate: fields.dueDate ?? null,
        amountHt: fields.amountHt ?? null,
        amountTva: fields.amountTva ?? null,
        amountTtc: fields.amountTtc ?? null,
        currency: fields.currency ?? 'EUR',
        filePath: `imported/${Date.now()}.xml`,
        fileMime: 'application/xml',
        fileHash: null,
      });

      res.status(201).json({
        invoiceId: created.id,
        profile: dto.profile,
        validation: {
          valid: allValid,
          xsdErrors: xsdResult.xsdErrors,
          businessRuleErrors: brErrors,
        },
        warnings: [],
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /invoices/:id/lifecycle-event ──────────────────────────────────────

const lifecycleSchema = z.object({
  status: z.enum(['DEPOSITED', 'REFUSED', 'MADE_AVAILABLE', 'SETTLED']),
  comment: z.string().max(500).optional(),
});

router.post(
  '/invoices/:id/lifecycle-event',
  validate(lifecycleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = Number(res.locals.orgId);
      const invoiceId = Number(req.params.id);

      const invoice = await getInvoiceById(invoiceId, orgId);
      if (!invoice) throw new AppError(404, 'Invoice not found');

      const { status, comment } = req.body as { status: LifecycleStatus; comment?: string };
      const actor = (res.locals.user as { email?: string })?.email ?? 'system';

      const event = await createLifecycleEvent(orgId, invoiceId, {
        status,
        actor,
        comment: comment ?? null,
      });

      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /invoices/:id/lifecycle ─────────────────────────────────────────────

router.get('/invoices/:id/lifecycle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = Number(res.locals.orgId);
    const invoiceId = Number(req.params.id);

    const invoice = await getInvoiceById(invoiceId, orgId);
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const events = await getLifecycleEvents(orgId, invoiceId);
    res.json({ invoiceId, events });
  } catch (err) {
    next(err);
  }
});

export default router;
