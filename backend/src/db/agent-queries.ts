import { pool } from './database';

// ─── Types retournés par les outils ──────────────────────────────────────────

export interface InvoiceSummary {
  id: number;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTtc: number | null;
  currency: string;
  status: string;
  supplierName: string | null;
  supplierId: number | null;
  riskScore: number | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  amountTva: number | null;
  siret: string | null;
  iban: string | null;
  ocrConfidence: Record<string, number> | null;
  riskFlags: string[];
  lines: Array<{
    id: number;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

export interface AggregateRow {
  group: string;
  count: number;
  sumTotal: number | null;
  avgTotal: number | null;
}

export interface PeriodComparison {
  metric: string;
  periodA: { label: string; value: number | null };
  periodB: { label: string; value: number | null };
  deltaAbsolute: number | null;
  deltaPercent: number | null;
}

export interface SemanticResult {
  id: number;
  invoiceId: number;
  description: string;
  similarity: number;
  invoiceNumber: string | null;
  supplierName: string | null;
}

// ─── Filtres communs ──────────────────────────────────────────────────────────

export interface InvoiceFilters {
  supplierId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  limit?: number;
}

// ─── search_invoices ──────────────────────────────────────────────────────────

export async function agentSearchInvoices(
  orgId: number,
  filters: InvoiceFilters,
): Promise<InvoiceSummary[]> {
  const conditions: string[] = ['i.organization_id = $1'];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters.supplierId) {
    conditions.push(`i.supplier_id = $${idx++}`);
    params.push(filters.supplierId);
  }
  if (filters.status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(filters.status.toUpperCase());
  }
  if (filters.dateFrom) {
    conditions.push(`i.issue_date >= $${idx++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`i.issue_date <= $${idx++}`);
    params.push(filters.dateTo);
  }
  if (filters.amountMin != null) {
    conditions.push(`i.amount_ttc >= $${idx++}`);
    params.push(filters.amountMin);
  }
  if (filters.amountMax != null) {
    conditions.push(`i.amount_ttc <= $${idx++}`);
    params.push(filters.amountMax);
  }

  const limit = Math.min(filters.limit ?? 20, 50);
  const where = conditions.join(' AND ');

  const { rows } = await pool.query<{
    id: number; invoice_number: string | null; issue_date: string | null;
    due_date: string | null; amount_ht: string | null; amount_ttc: string | null;
    currency: string; status: string; supplier_name: string | null;
    supplier_id: number | null; risk_score: number | null;
  }>(
    `SELECT
       i.id, i.invoice_number, i.issue_date::text, i.due_date::text,
       i.amount_ht::float, i.amount_ttc::float, i.currency, i.status,
       s.name AS supplier_name, i.supplier_id,
       (i.risk_assessment->>'score')::int AS risk_score
     FROM invoices i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE ${where}
     ORDER BY i.issue_date DESC NULLS LAST
     LIMIT $${idx}`,
    [...params, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    amountHt: r.amount_ht != null ? Number(r.amount_ht) : null,
    amountTtc: r.amount_ttc != null ? Number(r.amount_ttc) : null,
    currency: r.currency,
    status: r.status,
    supplierName: r.supplier_name,
    supplierId: r.supplier_id,
    riskScore: r.risk_score,
  }));
}

// ─── get_invoice_details ──────────────────────────────────────────────────────

export async function agentGetInvoiceDetail(
  orgId: number,
  invoiceId: number,
): Promise<InvoiceDetail | null> {
  const { rows: iRows } = await pool.query<{
    id: number; invoice_number: string | null; issue_date: string | null;
    due_date: string | null; amount_ht: string | null; amount_tva: string | null;
    amount_ttc: string | null; currency: string; status: string;
    supplier_name: string | null; supplier_id: number | null;
    siret: string | null; iban: string | null;
    ocr_confidence: Record<string, number> | null;
    risk_assessment: { score: number; flags: string[] } | null;
  }>(
    `SELECT
       i.id, i.invoice_number, i.issue_date::text, i.due_date::text,
       i.amount_ht::float, i.amount_tva::float, i.amount_ttc::float,
       i.currency, i.status,
       s.name AS supplier_name, i.supplier_id, s.siret, s.iban,
       i.ocr_confidence, i.risk_assessment
     FROM invoices i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE i.id = $1 AND i.organization_id = $2`,
    [invoiceId, orgId],
  );

  if (!iRows.length) return null;
  const inv = iRows[0];

  const { rows: lines } = await pool.query<{
    id: number; description: string;
    quantity: string; unit_price: string; total: string;
  }>(
    `SELECT id, description, quantity::float, unit_price::float, total::float
     FROM invoice_lines WHERE invoice_id = $1 ORDER BY position`,
    [invoiceId],
  );

  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    amountHt: inv.amount_ht != null ? Number(inv.amount_ht) : null,
    amountTva: inv.amount_tva != null ? Number(inv.amount_tva) : null,
    amountTtc: inv.amount_ttc != null ? Number(inv.amount_ttc) : null,
    currency: inv.currency,
    status: inv.status,
    supplierName: inv.supplier_name,
    supplierId: inv.supplier_id,
    siret: inv.siret,
    iban: inv.iban,
    ocrConfidence: inv.ocr_confidence,
    riskScore: inv.risk_assessment?.score ?? null,
    riskFlags: inv.risk_assessment?.flags ?? [],
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      total: Number(l.total),
    })),
  };
}

// ─── aggregate_invoices ───────────────────────────────────────────────────────

type GroupBy = 'supplier' | 'month' | 'status';
type Metric = 'count' | 'sum_total' | 'avg_total';

export async function agentAggregateInvoices(
  orgId: number,
  groupBy: GroupBy,
  metric: Metric,
  filters: InvoiceFilters,
): Promise<AggregateRow[]> {
  const conditions: string[] = ['i.organization_id = $1'];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters.supplierId) { conditions.push(`i.supplier_id = $${idx++}`); params.push(filters.supplierId); }
  if (filters.status) { conditions.push(`i.status = $${idx++}`); params.push(filters.status.toUpperCase()); }
  if (filters.dateFrom) { conditions.push(`i.issue_date >= $${idx++}`); params.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`i.issue_date <= $${idx++}`); params.push(filters.dateTo); }

  const groupExpr: Record<GroupBy, string> = {
    supplier: 'COALESCE(s.name, \'Sans fournisseur\')',
    month: "TO_CHAR(i.issue_date, 'YYYY-MM')",
    status: 'i.status',
  };

  const metricExpr: Record<Metric, string> = {
    count: 'COUNT(*)::int',
    sum_total: 'SUM(i.amount_ttc)::float',
    avg_total: 'AVG(i.amount_ttc)::float',
  };

  const where = conditions.join(' AND ');
  const grp = groupExpr[groupBy];

  const { rows } = await pool.query<{
    grp: string; count: number; sum_total: number | null; avg_total: number | null;
  }>(
    `SELECT
       ${grp} AS grp,
       COUNT(*)::int AS count,
       SUM(i.amount_ttc)::float AS sum_total,
       AVG(i.amount_ttc)::float AS avg_total
     FROM invoices i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE ${where}
     GROUP BY ${grp}
     ORDER BY ${metricExpr[metric]} DESC NULLS LAST
     LIMIT 20`,
    params,
  );

  return rows.map((r) => ({
    group: r.grp,
    count: r.count,
    sumTotal: r.sum_total != null ? Number(r.sum_total) : null,
    avgTotal: r.avg_total != null ? Number(r.avg_total) : null,
  }));
}

// ─── compare_periods ──────────────────────────────────────────────────────────

export async function agentComparePeriods(
  orgId: number,
  supplierId: number | null,
  periodA: { from: string; to: string; label: string },
  periodB: { from: string; to: string; label: string },
  metric: Metric,
): Promise<PeriodComparison> {
  const baseConditions = supplierId
    ? 'organization_id = $1 AND supplier_id = $2'
    : 'organization_id = $1';
  const baseParams: unknown[] = supplierId ? [orgId, supplierId] : [orgId];

  const metricExpr: Record<Metric, string> = {
    count: 'COUNT(*)::float',
    sum_total: 'SUM(amount_ttc)::float',
    avg_total: 'AVG(amount_ttc)::float',
  };

  const query = `
    SELECT
      SUM(CASE WHEN issue_date BETWEEN $${baseParams.length + 1} AND $${baseParams.length + 2}
               THEN 1 ELSE 0 END)::float AS count_a,
      SUM(CASE WHEN issue_date BETWEEN $${baseParams.length + 3} AND $${baseParams.length + 4}
               THEN 1 ELSE 0 END)::float AS count_b,
      SUM(CASE WHEN issue_date BETWEEN $${baseParams.length + 1} AND $${baseParams.length + 2}
               THEN amount_ttc::float ELSE 0 END) AS sum_a,
      SUM(CASE WHEN issue_date BETWEEN $${baseParams.length + 3} AND $${baseParams.length + 4}
               THEN amount_ttc::float ELSE 0 END) AS sum_b,
      AVG(CASE WHEN issue_date BETWEEN $${baseParams.length + 1} AND $${baseParams.length + 2}
               THEN amount_ttc::float END) AS avg_a,
      AVG(CASE WHEN issue_date BETWEEN $${baseParams.length + 3} AND $${baseParams.length + 4}
               THEN amount_ttc::float END) AS avg_b
    FROM invoices
    WHERE ${baseConditions}
      AND (
        issue_date BETWEEN $${baseParams.length + 1} AND $${baseParams.length + 2}
        OR issue_date BETWEEN $${baseParams.length + 3} AND $${baseParams.length + 4}
      )
  `;

  const params = [
    ...baseParams,
    periodA.from, periodA.to,
    periodB.from, periodB.to,
  ];

  const { rows } = await pool.query<{
    count_a: number | null; count_b: number | null;
    sum_a: number | null; sum_b: number | null;
    avg_a: number | null; avg_b: number | null;
  }>(query, params);

  const r = rows[0];
  const valA = metric === 'count' ? r.count_a : metric === 'sum_total' ? r.sum_a : r.avg_a;
  const valB = metric === 'count' ? r.count_b : metric === 'sum_total' ? r.sum_b : r.avg_b;

  const deltaAbs = valA != null && valB != null ? valB - valA : null;
  const deltaPercent =
    deltaAbs != null && valA != null && valA !== 0
      ? Math.round((deltaAbs / valA) * 10000) / 100
      : null;

  return {
    metric,
    periodA: { label: periodA.label, value: valA != null ? Number(valA) : null },
    periodB: { label: periodB.label, value: valB != null ? Number(valB) : null },
    deltaAbsolute: deltaAbs != null ? Math.round(deltaAbs * 100) / 100 : null,
    deltaPercent,
  };
}

// ─── semantic_search_invoices ─────────────────────────────────────────────────
// Utilise pgvector si les embeddings sont disponibles, sinon fallback ILIKE.

export async function agentSemanticSearch(
  orgId: number,
  queryEmbedding: number[] | null,
  queryText: string,
  topK: number,
): Promise<SemanticResult[]> {
  // Si les embeddings ne sont pas disponibles, fallback texte
  if (!queryEmbedding) {
    const { rows } = await pool.query<{
      id: number; invoice_id: number; description: string;
      invoice_number: string | null; supplier_name: string | null;
    }>(
      `SELECT
         il.id, il.invoice_id, il.description,
         i.invoice_number,
         s.name AS supplier_name
       FROM invoice_lines il
       JOIN invoices i ON i.id = il.invoice_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.organization_id = $1
         AND il.description ILIKE $2
       LIMIT $3`,
      [orgId, `%${queryText}%`, topK],
    );
    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      description: r.description,
      invoiceNumber: r.invoice_number,
      supplierName: r.supplier_name,
      similarity: 1,
    }));
  }

  // Recherche vectorielle cosinus
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const { rows } = await pool.query<{
    id: number; invoice_id: number; description: string;
    similarity: number; invoice_number: string | null; supplier_name: string | null;
  }>(
    `SELECT
       il.id, il.invoice_id, il.description,
       1 - (il.description_embedding <=> $2::vector) AS similarity,
       i.invoice_number,
       s.name AS supplier_name
     FROM invoice_lines il
     JOIN invoices i ON i.id = il.invoice_id
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE i.organization_id = $1
       AND il.description_embedding IS NOT NULL
     ORDER BY il.description_embedding <=> $2::vector
     LIMIT $3`,
    [orgId, vectorLiteral, topK],
  );

  return rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    description: r.description,
    invoiceNumber: r.invoice_number,
    supplierName: r.supplier_name,
    similarity: Number(r.similarity),
  }));
}

// ─── save_agent_trace ─────────────────────────────────────────────────────────

export async function saveAgentTrace(trace: {
  orgId: number;
  userId: number;
  question: string;
  messages: unknown[];
  totalTokens: number;
  durationMs: number;
  finalAnswer: string;
  provider: string;
  model: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO ai_agent_traces
       (organization_id, user_id, question, messages, total_tokens, duration_ms, final_answer, provider, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      trace.orgId, trace.userId, trace.question, JSON.stringify(trace.messages),
      trace.totalTokens, trace.durationMs, trace.finalAnswer, trace.provider, trace.model,
    ],
  );
}
