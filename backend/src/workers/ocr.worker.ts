/**
 * Worker BullMQ — consomme la queue `ocr-processing`.
 * Sprint 3 : pipeline hybride regex+LLM + détection de fraude.
 */
import { Worker } from 'bullmq';
import { env } from '../config/env';
import { ocrQueue, ocrFailedQueue, ocrJobOpts, type OcrJobData } from '../services/queue';
import { extractTextFromFile } from '../services/ocr/ocr.service';
import { runExtractionPipeline } from '../services/ai/pipeline';
import { scoreRisk } from '../services/fraud/risk-scorer';
import { publishInvoiceStatus } from '../services/realtime/redis-publisher';
import { pool } from '../db/database';
import { logger } from '../config/logger';

/** Supprime les octets nuls et caractères invalides pour PostgreSQL */
const sanitize = (s: string): string => s.replace(/\x00/g, '').replace(/[\uD800-\uDFFF]/g, '');

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const CONFIDENCE_THRESHOLD = 0.7;
const WORKER_CONCURRENCY = 3;

function computeOverallConfidence(conf: Record<string, number> | null): number | undefined {
  if (!conf) return undefined;
  const values = Object.values(conf).filter((v) => typeof v === 'number');
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const worker = new Worker<OcrJobData>(
  'ocr-processing',
  async (job) => {
    const { invoiceId, filePath, orgId } = job.data;

    logger.info('ocr.worker.started', { jobId: job.id, invoiceId, orgId });
    await job.updateProgress(10);
    await publishInvoiceStatus(orgId, { invoiceId, status: 'PROCESSING', progress: 10 });

    // ─── 1. Extraction texte brut ────────────────────────────────────────────
    const { rawText, ocrConfidence, source } = await extractTextFromFile(
      filePath,
      'application/pdf',
    );
    await job.updateProgress(30);
    await publishInvoiceStatus(orgId, { invoiceId, status: 'PROCESSING', progress: 30 });

    // ─── 2. Lookup supplier (avant pipeline pour les corrections few-shot) ───
    let supplierId: number | null = null;
    if (rawText.length > 0) {
      // On tente d'identifier le supplier via SIRET/IBAN détectés rapidement par regex
      const { parseFields } = await import('../services/ocr/field-parser');
      const quickParse = parseFields(rawText, ocrConfidence);
      if (quickParse.fields.siret || quickParse.fields.iban) {
        const { rows } = await pool.query(
          `SELECT id FROM suppliers
           WHERE organization_id = $1
             AND ((siret IS NOT NULL AND siret = $2) OR (iban IS NOT NULL AND iban = $3))
           LIMIT 1`,
          [orgId, quickParse.fields.siret ?? null, quickParse.fields.iban ?? null],
        );
        if (rows.length) supplierId = rows[0].id as number;
      }
    }

    // ─── 3. Pipeline hybride ─────────────────────────────────────────────────
    const pipeline = await runExtractionPipeline(rawText, ocrConfidence, supplierId);
    await job.updateProgress(70);
    await publishInvoiceStatus(orgId, { invoiceId, status: 'PROCESSING', progress: 70 });

    // ─── 4. Fraud scoring ────────────────────────────────────────────────────
    const risk = await scoreRisk({
      orgId,
      supplierId,
      invoiceId,
      invoiceNumber: pipeline.invoiceNumber,
      issueDate: pipeline.issueDate,
      amountTtc: pipeline.amountTtc,
      iban: pipeline.iban,
    });

    const overall = computeOverallConfidence(pipeline.confidence);
    const newStatus = overall && overall >= CONFIDENCE_THRESHOLD ? 'PENDING_VALIDATION' : 'DRAFT';

    // ─── 5. Mise à jour BDD ──────────────────────────────────────────────────
    await pool.query(
      `UPDATE invoices
       SET ocr_raw_text    = $1,
           ocr_confidence  = $2,
           risk_assessment = $3,
           supplier_id     = COALESCE(supplier_id, $4),
           invoice_number  = COALESCE(invoice_number, $5),
           issue_date      = COALESCE(issue_date, $6),
           due_date        = COALESCE(due_date, $7),
           amount_ht       = COALESCE(amount_ht, $8),
           amount_tva      = COALESCE(amount_tva, $9),
           amount_ttc      = COALESCE(amount_ttc, $10),
           status          = $11,
           updated_at      = now()
       WHERE id = $12 AND organization_id = $13`,
      [
        sanitize(rawText.slice(0, 20000)),
        sanitize(JSON.stringify(pipeline.confidence)),
        sanitize(JSON.stringify(risk)),
        supplierId,
        pipeline.invoiceNumber,
        pipeline.issueDate,
        pipeline.dueDate,
        pipeline.amountHt,
        pipeline.amountTva,
        pipeline.amountTtc,
        newStatus,
        invoiceId,
        orgId,
      ],
    );

    await job.updateProgress(100);
    await publishInvoiceStatus(orgId, {
      invoiceId,
      status: newStatus,
      progress: 100,
      confidence: overall,
      source,
      pipelineMode: pipeline.mode,
      riskScore: risk.score,
    });

    logger.info('ocr.worker.completed', {
      jobId: job.id,
      invoiceId,
      confidence: overall,
      source,
      pipelineMode: pipeline.mode,
      riskScore: risk.score,
      riskFlags: risk.flags,
      costUsd: pipeline.costUsd,
    });

    return {
      invoiceId,
      confidence: overall,
      source,
      pipelineMode: pipeline.mode,
      riskScore: risk.score,
    };
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
  },
);

worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (ocrJobOpts.attempts ?? 3)) {
    logger.error('ocr.worker.dead_letter', {
      jobId: job.id,
      invoiceId: (job.data as OcrJobData).invoiceId,
      attempts: job.attemptsMade,
      error: (err as Error).message,
    });
    await ocrFailedQueue.add(`ocr-failed-${job.id}`, job.data);
  }
});

async function shutdown(): Promise<void> {
  console.log('[ocr.worker] Shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[ocr.worker] Started — listening on ocr-processing queue (hybrid AI pipeline)');
