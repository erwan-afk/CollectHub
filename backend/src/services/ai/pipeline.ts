/**
 * Pipeline hybride : regex rapide → LLM fallback si champs manquants/incertains.
 *
 * Stratégie :
 *   1. Regex pass (field-parser) — gratuit, < 1 ms
 *   2. Si tous les champs critiques ont confiance > REGEX_CONFIDENCE_THRESHOLD → DONE
 *   3. Sinon → LLM pass pour les champs manquants/incertains
 *   4. Merge : on garde la valeur avec la meilleure confiance
 */
import { parseFields } from '../ocr/field-parser';
import { getExtractor } from './extractor-factory';
import { logger } from '../../config/logger';
import type { ConfidenceMap } from '../../types/invoice';
import type { CorrectionExample } from './prompts/few-shot';
import { pool } from '../../db/database';

const REGEX_CONFIDENCE_THRESHOLD = 0.8;
const CRITICAL_FIELDS = ['invoice_number', 'issue_date', 'amount_ht', 'amount_ttc'] as const;

export type PipelineMode = 'regex_only' | 'llm_fallback' | 'llm_full';

export interface PipelineResult {
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTva: number | null;
  amountTtc: number | null;
  siret: string | null;
  iban: string | null;
  confidence: ConfidenceMap;
  mode: PipelineMode;
  costUsd: number;
}

async function loadCorrections(supplierId: number): Promise<CorrectionExample[]> {
  const { rows } = await pool.query<{
    field: string;
    raw_text_snippet: string;
    ai_value: string;
    corrected_value: string;
  }>(
    `SELECT field, raw_text_snippet, ai_value, corrected_value
     FROM extraction_corrections
     WHERE supplier_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [supplierId],
  );
  return rows.map((r) => ({
    field: r.field,
    rawTextSnippet: r.raw_text_snippet,
    aiValue: r.ai_value,
    correctedValue: r.corrected_value,
  }));
}

function allCriticalFieldsConfident(confidence: ConfidenceMap): boolean {
  return CRITICAL_FIELDS.every((f) => (confidence[f] ?? 0) >= REGEX_CONFIDENCE_THRESHOLD);
}

export async function runExtractionPipeline(
  ocrText: string,
  ocrConfidenceBase: number,
  supplierId: number | null,
): Promise<PipelineResult> {
  // ─── 1. Regex pass ──────────────────────────────────────────────────────────
  const { fields: regexFields, confidence: regexConf } = parseFields(ocrText, ocrConfidenceBase);

  if (allCriticalFieldsConfident(regexConf)) {
    logger.info('ai.pipeline.regex_only', { supplierId });
    return {
      invoiceNumber: regexFields.invoiceNumber,
      issueDate: regexFields.issueDate,
      dueDate: regexFields.dueDate,
      amountHt: regexFields.amountHt,
      amountTva: regexFields.amountTva,
      amountTtc: regexFields.amountTtc,
      siret: regexFields.siret,
      iban: regexFields.iban,
      confidence: regexConf,
      mode: 'regex_only',
      costUsd: 0,
    };
  }

  // ─── 2. LLM pass ────────────────────────────────────────────────────────────
  const corrections = supplierId ? await loadCorrections(supplierId) : [];
  const mode: PipelineMode = Object.keys(regexConf).length === 0 ? 'llm_full' : 'llm_fallback';
  logger.info('ai.pipeline.llm_pass', { mode, supplierId, corrections: corrections.length });

  const llmResult = await getExtractor().extract(ocrText, { supplierId, corrections });
  const llmFields = llmResult.fields;
  const llmConf = llmFields.confidence as ConfidenceMap;

  // ─── 3. Merge : keep highest confidence per field ───────────────────────────
  function pickBest<T>(field: keyof ConfidenceMap, regexVal: T, llmVal: T): T {
    const rc = regexConf[field] ?? 0;
    const lc = llmConf[field] ?? 0;
    return lc > rc ? llmVal : regexVal;
  }

  function mergeConf(field: keyof ConfidenceMap): number {
    return Math.max(regexConf[field] ?? 0, llmConf[field] ?? 0);
  }

  const mergedConf: ConfidenceMap = {};
  for (const f of Object.keys({ ...regexConf, ...llmConf }) as (keyof ConfidenceMap)[]) {
    const v = mergeConf(f);
    if (v > 0) mergedConf[f] = v;
  }

  return {
    invoiceNumber: pickBest('invoice_number', regexFields.invoiceNumber, llmFields.invoice_number),
    issueDate: pickBest('issue_date', regexFields.issueDate, llmFields.issue_date),
    dueDate: pickBest('due_date', regexFields.dueDate, llmFields.due_date),
    amountHt: pickBest('amount_ht', regexFields.amountHt, llmFields.amount_ht),
    amountTva: pickBest('amount_tva', regexFields.amountTva, llmFields.amount_tva),
    amountTtc: pickBest('amount_ttc', regexFields.amountTtc, llmFields.amount_ttc),
    siret: pickBest('siret', regexFields.siret, llmFields.siret),
    iban: pickBest('iban', regexFields.iban, llmFields.iban),
    confidence: mergedConf,
    mode,
    costUsd: llmResult.costUsd,
  };
}
