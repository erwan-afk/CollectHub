/**
 * Queries pour la table extraction_corrections (Sprint 3).
 * Multi-tenant : orgId obligatoire en premier paramètre.
 */
import { pool } from './database';

export interface CorrectionRow {
  id: number;
  org_id: number;
  supplier_id: number | null;
  invoice_id: number | null;
  field: string;
  raw_text_snippet: string;
  ai_value: string;
  corrected_value: string;
  cost_usd: string;
  created_at: Date;
}

export interface CorrectionInsert {
  orgId: number;
  supplierId?: number | null;
  invoiceId?: number | null;
  field: string;
  rawTextSnippet?: string;
  aiValue?: string;
  correctedValue: string;
  costUsd?: number;
}

export interface Correction {
  id: number;
  supplierId: number | null;
  invoiceId: number | null;
  field: string;
  rawTextSnippet: string;
  aiValue: string;
  correctedValue: string;
  costUsd: number;
  createdAt: string;
}

function mapCorrection(r: CorrectionRow): Correction {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    invoiceId: r.invoice_id,
    field: r.field,
    rawTextSnippet: r.raw_text_snippet,
    aiValue: r.ai_value,
    correctedValue: r.corrected_value,
    costUsd: parseFloat(r.cost_usd ?? '0'),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/** Enregistre une correction utilisateur pour apprentissage continu */
export async function insertCorrection(input: CorrectionInsert): Promise<Correction> {
  const { rows } = await pool.query<CorrectionRow>(
    `INSERT INTO extraction_corrections (org_id, supplier_id, invoice_id, field, raw_text_snippet, ai_value, corrected_value, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.orgId,
      input.supplierId ?? null,
      input.invoiceId ?? null,
      input.field,
      input.rawTextSnippet ?? '',
      input.aiValue ?? '',
      input.correctedValue,
      (input.costUsd ?? 0).toFixed(8),
    ],
  );
  return mapCorrection(rows[0]);
}

/** Liste les corrections d'un supplier (pour few-shot) */
export async function getCorrectionsBySupplier(
  orgId: number,
  supplierId: number,
  limit = 10,
): Promise<Correction[]> {
  const { rows } = await pool.query<CorrectionRow>(
    `SELECT * FROM extraction_corrections
     WHERE org_id = $1 AND supplier_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [orgId, supplierId, limit],
  );
  return rows.map(mapCorrection);
}

/** Liste les corrections d'une facture spécifique */
export async function getCorrectionsByInvoice(
  orgId: number,
  invoiceId: number,
): Promise<Correction[]> {
  const { rows } = await pool.query<CorrectionRow>(
    `SELECT * FROM extraction_corrections
     WHERE org_id = $1 AND invoice_id = $2
     ORDER BY created_at ASC`,
    [orgId, invoiceId],
  );
  return rows.map(mapCorrection);
}
