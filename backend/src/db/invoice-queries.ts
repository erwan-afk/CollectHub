import { pool } from './database';
import {
  Supplier,
  SupplierRow,
  Invoice,
  InvoiceRow,
  InvoiceLine,
  InvoiceLineRow,
  InvoiceStatus,
  InvoiceStatusHistoryEntry,
  InvoiceStatusHistoryRow,
  ConfidenceMap,
} from '../types/invoice';
import { SupplierBody, InvoiceUpdateBody } from '../validation/invoice-schemas';
import type { LifecycleEvent, LifecycleEventRow, LifecycleStatus } from '../types/einvoice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    siret: row.siret,
    vatNumber: row.vat_number,
    iban: row.iban,
    address: row.address,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function dateStr(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function mapInvoiceLine(row: InvoiceLineRow): InvoiceLine {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

function mapHistory(row: InvoiceStatusHistoryRow): InvoiceStatusHistoryEntry {
  return {
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    actor: row.actor,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapInvoice(
  row: InvoiceRow,
  lines: InvoiceLine[] = [],
  history?: InvoiceStatusHistoryEntry[],
  supplier?: Supplier | null,
): Invoice {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplier: supplier ?? null,
    invoiceNumber: row.invoice_number,
    issueDate: dateStr(row.issue_date),
    dueDate: dateStr(row.due_date),
    amountHt: n(row.amount_ht),
    amountTva: n(row.amount_tva),
    amountTtc: n(row.amount_ttc),
    currency: row.currency,
    status: row.status,
    filePath: row.file_path,
    fileMime: row.file_mime,
    fileHash: row.file_hash,
    ocrConfidence: row.ocr_confidence,
    riskAssessment: (row.risk_assessment as { score: number; flags: string[] }) ?? null,
    lines,
    history,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function listSuppliers(orgId: number, limit = 100, offset = 0): Promise<Supplier[]> {
  const { rows } = await pool.query<SupplierRow>(
    `SELECT id, name, siret, vat_number, iban, address, created_at
       FROM suppliers
      WHERE organization_id = $1
      ORDER BY name ASC LIMIT $2 OFFSET $3`,
    [orgId, limit, offset],
  );
  return rows.map(mapSupplier);
}

export async function countSuppliers(orgId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM suppliers WHERE organization_id = $1',
    [orgId],
  );
  return Number(rows[0].count);
}

export async function getSupplierById(id: number, orgId: number): Promise<Supplier | null> {
  const { rows } = await pool.query<SupplierRow>(
    `SELECT id, name, siret, vat_number, iban, address, created_at
       FROM suppliers WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  return rows.length ? mapSupplier(rows[0]) : null;
}

export async function createSupplier(orgId: number, body: SupplierBody): Promise<Supplier> {
  const { rows } = await pool.query<SupplierRow>(
    `INSERT INTO suppliers (organization_id, name, siret, vat_number, iban, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, siret, vat_number, iban, address, created_at`,
    [
      orgId,
      body.name,
      body.siret ?? null,
      body.vatNumber ?? null,
      body.iban ?? null,
      body.address ?? null,
    ],
  );
  return mapSupplier(rows[0]);
}

export async function updateSupplier(
  id: number,
  orgId: number,
  body: SupplierBody,
): Promise<Supplier | null> {
  const { rows } = await pool.query<SupplierRow>(
    `UPDATE suppliers
        SET name = $1, siret = $2, vat_number = $3, iban = $4, address = $5
      WHERE id = $6 AND organization_id = $7
      RETURNING id, name, siret, vat_number, iban, address, created_at`,
    [
      body.name,
      body.siret ?? null,
      body.vatNumber ?? null,
      body.iban ?? null,
      body.address ?? null,
      id,
      orgId,
    ],
  );
  return rows.length ? mapSupplier(rows[0]) : null;
}

export async function deleteSupplier(id: number, orgId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM suppliers WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  return (rowCount ?? 0) > 0;
}

export interface SupplierMatch {
  supplier: Supplier;
  matchedBy: 'siret' | 'iban';
}

export async function findSupplierByIdentifier(
  orgId: number,
  siret: string | null,
  iban: string | null,
): Promise<SupplierMatch | null> {
  if (siret) {
    const { rows } = await pool.query<SupplierRow>(
      `SELECT id, name, siret, vat_number, iban, address, created_at
         FROM suppliers WHERE siret = $1 AND organization_id = $2 LIMIT 1`,
      [siret, orgId],
    );
    if (rows.length) return { supplier: mapSupplier(rows[0]), matchedBy: 'siret' };
  }
  if (iban) {
    const { rows } = await pool.query<SupplierRow>(
      `SELECT id, name, siret, vat_number, iban, address, created_at
         FROM suppliers WHERE iban = $1 AND organization_id = $2 LIMIT 1`,
      [iban, orgId],
    );
    if (rows.length) return { supplier: mapSupplier(rows[0]), matchedBy: 'iban' };
  }
  return null;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoiceFilters {
  status?: InvoiceStatus;
  supplierId?: number;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  limit: number;
  offset: number;
}

export async function listInvoices(
  orgId: number,
  filters: InvoiceFilters,
): Promise<{ data: Invoice[]; total: number }> {
  const where: string[] = ['organization_id = $1'];
  const params: unknown[] = [orgId];

  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters.supplierId) {
    params.push(filters.supplierId);
    where.push(`supplier_id = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    where.push(`issue_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    where.push(`issue_date <= $${params.length}`);
  }
  if (filters.amountMin !== undefined) {
    params.push(filters.amountMin);
    where.push(`amount_ttc >= $${params.length}`);
  }
  if (filters.amountMax !== undefined) {
    params.push(filters.amountMax);
    where.push(`amount_ttc <= $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countQ = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM invoices ${whereSql}`,
    params,
  );
  const total = Number(countQ.rows[0].count);

  const listParams = [...params, filters.limit, filters.offset];
  const { rows } = await pool.query<InvoiceRow>(
    `SELECT id, supplier_id, invoice_number, issue_date, due_date,
            amount_ht, amount_tva, amount_ttc, currency, status,
            file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash,
            created_at, updated_at
       FROM invoices
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  return { data: rows.map((r) => mapInvoice(r)), total };
}

export async function getInvoiceById(id: number, orgId: number): Promise<Invoice | null> {
  const { rows } = await pool.query<InvoiceRow>(
    `SELECT id, supplier_id, invoice_number, issue_date, due_date,
            amount_ht, amount_tva, amount_ttc, currency, status,
            file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash,
            risk_assessment,
            created_at, updated_at
       FROM invoices WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  if (!rows.length) return null;
  const row = rows[0];

  const linesQ = await pool.query<InvoiceLineRow>(
    `SELECT id, invoice_id, description, quantity, unit_price, total, position
       FROM invoice_lines WHERE invoice_id = $1 ORDER BY position, id`,
    [id],
  );
  const historyQ = await pool.query<InvoiceStatusHistoryRow>(
    `SELECT id, invoice_id, from_status, to_status, reason, actor, created_at
       FROM invoice_status_history WHERE invoice_id = $1 ORDER BY created_at ASC, id ASC`,
    [id],
  );

  const supplier = row.supplier_id ? await getSupplierById(row.supplier_id, orgId) : null;

  return mapInvoice(row, linesQ.rows.map(mapInvoiceLine), historyQ.rows.map(mapHistory), supplier);
}

export interface CreateInvoiceInput {
  organizationId: number;
  supplierId: number | null;
  status?: string;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  amountHt?: number | null;
  amountTva?: number | null;
  amountTtc?: number | null;
  currency: string;
  filePath: string;
  fileMime: string | null;
  ocrRawText?: string | null;
  ocrConfidence?: ConfidenceMap | null;
  fileHash: string | null;
}

export async function insertInvoiceLines(invoiceId: number, lines: InvoiceLine[]): Promise<void> {
  if (!lines.length) return;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await pool.query(
      `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [invoiceId, l.description, l.quantity, l.unitPrice, l.total, i],
    );
  }
}

export async function findInvoiceByHash(orgId: number, hash: string): Promise<Invoice | null> {
  const { rows } = await pool.query<InvoiceRow>(
    `SELECT id, supplier_id, invoice_number, issue_date, due_date,
            amount_ht, amount_tva, amount_ttc, currency, status,
            file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash,
            created_at, updated_at
       FROM invoices WHERE file_hash = $1 AND organization_id = $2 LIMIT 1`,
    [hash, orgId],
  );
  return rows.length ? mapInvoice(rows[0]) : null;
}

export async function findInvoiceBySupplierAndNumber(
  orgId: number,
  supplierId: number,
  invoiceNumber: string,
): Promise<Invoice | null> {
  const { rows } = await pool.query<InvoiceRow>(
    `SELECT id, supplier_id, invoice_number, issue_date, due_date,
            amount_ht, amount_tva, amount_ttc, currency, status,
            file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash,
            created_at, updated_at
       FROM invoices
      WHERE supplier_id = $1 AND invoice_number = $2 AND organization_id = $3
      LIMIT 1`,
    [supplierId, invoiceNumber, orgId],
  );
  return rows.length ? mapInvoice(rows[0]) : null;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { rows } = await pool.query<InvoiceRow>(
    `INSERT INTO invoices
       (organization_id, supplier_id, status, invoice_number, issue_date, due_date,
        amount_ht, amount_tva, amount_ttc, currency,
        file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash)
     VALUES ($1,$2,$3::invoice_status,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, supplier_id, invoice_number, issue_date, due_date,
               amount_ht, amount_tva, amount_ttc, currency, status,
               file_path, file_mime, ocr_raw_text, ocr_confidence, file_hash,
               created_at, updated_at`,
    [
      input.organizationId,
      input.supplierId,
      input.status ?? 'DRAFT',
      input.invoiceNumber ?? null,
      input.issueDate ?? null,
      input.dueDate ?? null,
      input.amountHt ?? null,
      input.amountTva ?? null,
      input.amountTtc ?? null,
      input.currency,
      input.filePath,
      input.fileMime,
      input.ocrRawText ?? null,
      input.ocrConfidence ? JSON.stringify(input.ocrConfidence) : null,
      input.fileHash,
    ],
  );
  return mapInvoice(rows[0]);
}

export async function updateInvoice(
  id: number,
  orgId: number,
  body: InvoiceUpdateBody,
): Promise<Invoice | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<InvoiceRow>(
      `UPDATE invoices SET
         supplier_id    = $1,
         invoice_number = $2,
         issue_date     = $3,
         due_date       = $4,
         amount_ht      = $5,
         amount_tva     = $6,
         amount_ttc     = $7,
         currency       = $8,
         updated_at     = now()
       WHERE id = $9 AND organization_id = $10
       RETURNING id`,
      [
        body.supplierId ?? null,
        body.invoiceNumber ?? null,
        body.issueDate ?? null,
        body.dueDate ?? null,
        body.amountHt ?? null,
        body.amountTva ?? null,
        body.amountTtc ?? null,
        body.currency ?? 'EUR',
        id,
        orgId,
      ],
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    if (body.lines) {
      await client.query(`DELETE FROM invoice_lines WHERE invoice_id = $1`, [id]);
      for (let i = 0; i < body.lines.length; i++) {
        const l = body.lines[i];
        await client.query(
          `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total, position)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, l.description, l.quantity, l.unitPrice, l.total, i],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getInvoiceById(id, orgId);
}

export async function transitionInvoiceStatus(
  id: number,
  orgId: number,
  to: InvoiceStatus,
  reason: string | undefined,
  actor = 'system',
): Promise<{ invoice: Invoice; from: InvoiceStatus } | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query<{ status: InvoiceStatus }>(
      `SELECT status FROM invoices WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [id, orgId],
    );
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }
    const from = cur.rows[0].status;
    await client.query(`UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2`, [
      to,
      id,
    ]);
    await client.query(
      `INSERT INTO invoice_status_history (invoice_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, from, to, reason ?? null, actor],
    );
    await client.query('COMMIT');
    const invoice = await getInvoiceById(id, orgId);
    return invoice ? { invoice, from } : null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface InvoiceExportRow {
  id: number;
  supplierName: string | null;
  supplierSiret: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTva: number | null;
  amountTtc: number | null;
  currency: string;
  status: InvoiceStatus;
}

export async function exportInvoices(
  orgId: number,
  filters: { status?: InvoiceStatus; dateFrom?: string; dateTo?: string },
): Promise<InvoiceExportRow[]> {
  const where: string[] = ['i.organization_id = $1'];
  const params: unknown[] = [orgId];

  if (filters.status) {
    params.push(filters.status);
    where.push(`i.status = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    where.push(`i.issue_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    where.push(`i.issue_date <= $${params.length}`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const { rows } = await pool.query<{
    id: number;
    supplier_name: string | null;
    supplier_siret: string | null;
    invoice_number: string | null;
    issue_date: Date | null;
    due_date: Date | null;
    amount_ht: string | null;
    amount_tva: string | null;
    amount_ttc: string | null;
    currency: string;
    status: InvoiceStatus;
  }>(
    `SELECT i.id, s.name AS supplier_name, s.siret AS supplier_siret,
            i.invoice_number, i.issue_date, i.due_date,
            i.amount_ht, i.amount_tva, i.amount_ttc, i.currency, i.status
       FROM invoices i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       ${whereSql}
       ORDER BY i.issue_date ASC NULLS LAST, i.id ASC`,
    params,
  );
  return rows.map((r) => ({
    id: r.id,
    supplierName: r.supplier_name,
    supplierSiret: r.supplier_siret,
    invoiceNumber: r.invoice_number,
    issueDate: dateStr(r.issue_date),
    dueDate: dateStr(r.due_date),
    amountHt: n(r.amount_ht),
    amountTva: n(r.amount_tva),
    amountTtc: n(r.amount_ttc),
    currency: r.currency,
    status: r.status,
  }));
}

export interface TopSupplier {
  supplierId: number;
  name: string;
  invoiceCount: number;
  totalTtc: number;
}

export async function topSuppliers(
  orgId: number,
  limit = 5,
  sinceDays = 90,
): Promise<TopSupplier[]> {
  const { rows } = await pool.query<{
    supplier_id: number;
    name: string;
    invoice_count: string;
    total_ttc: string | null;
  }>(
    `SELECT i.supplier_id, s.name,
            COUNT(*)::int AS invoice_count,
            COALESCE(SUM(i.amount_ttc), 0)::text AS total_ttc
       FROM invoices i
       JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.organization_id = $1
        AND i.status = 'VALIDATED'
        AND i.updated_at >= now() - ($3::int || ' days')::interval
      GROUP BY i.supplier_id, s.name
      ORDER BY total_ttc DESC
      LIMIT $2`,
    [orgId, limit, sinceDays],
  );
  return rows.map((r) => ({
    supplierId: r.supplier_id,
    name: r.name,
    invoiceCount: Number(r.invoice_count),
    totalTtc: Number(r.total_ttc ?? 0),
  }));
}

// ─── Lifecycle events (Sprint 5 — réforme DGFiP) ─────────────────────────────

function mapLifecycleEvent(row: LifecycleEventRow): LifecycleEvent {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    status: row.status,
    occurredAt: new Date(row.occurred_at).toISOString(),
    actor: row.actor,
    comment: row.comment,
  };
}

export async function getLifecycleEvents(
  orgId: number,
  invoiceId: number,
): Promise<LifecycleEvent[]> {
  const { rows } = await pool.query<LifecycleEventRow>(
    `SELECT le.id, le.invoice_id, le.status, le.occurred_at, le.actor, le.comment
       FROM invoice_lifecycle_events le
       JOIN invoices i ON i.id = le.invoice_id
      WHERE le.invoice_id = $1 AND i.organization_id = $2
      ORDER BY le.occurred_at ASC, le.id ASC`,
    [invoiceId, orgId],
  );
  return rows.map(mapLifecycleEvent);
}

export async function createLifecycleEvent(
  orgId: number,
  invoiceId: number,
  event: { status: LifecycleStatus; actor: string; comment: string | null },
): Promise<LifecycleEvent> {
  // Verify the invoice belongs to the org (multi-tenant guard)
  const check = await pool.query<{ id: number }>(
    `SELECT id FROM invoices WHERE id = $1 AND organization_id = $2`,
    [invoiceId, orgId],
  );
  if (!check.rows.length) throw new Error(`Invoice ${invoiceId} not found for org ${orgId}`);

  const { rows } = await pool.query<LifecycleEventRow>(
    `INSERT INTO invoice_lifecycle_events (invoice_id, status, actor, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING id, invoice_id, status, occurred_at, actor, comment`,
    [invoiceId, event.status, event.actor, event.comment],
  );
  return mapLifecycleEvent(rows[0]);
}

export async function dashboardSummary(orgId: number): Promise<{
  countsByStatus: Record<InvoiceStatus, number>;
  monthlyTtcValidated: number;
  topSuppliers: TopSupplier[];
}> {
  const counts = await pool.query<{ status: InvoiceStatus; count: string }>(
    `SELECT status, COUNT(*)::int AS count
       FROM invoices
      WHERE organization_id = $1
      GROUP BY status`,
    [orgId],
  );
  const countsByStatus = {
    PROCESSING: 0,
    DRAFT: 0,
    PENDING_VALIDATION: 0,
    VALIDATED: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  } as Record<InvoiceStatus, number>;
  for (const r of counts.rows) countsByStatus[r.status] = Number(r.count);

  const monthly = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(amount_ttc), 0)::text AS total
       FROM invoices
      WHERE organization_id = $1
        AND status = 'VALIDATED'
        AND date_trunc('month', updated_at) = date_trunc('month', now())`,
    [orgId],
  );
  const top = await topSuppliers(orgId, 5, 90);

  return {
    countsByStatus,
    monthlyTtcValidated: Number(monthly.rows[0].total ?? 0),
    topSuppliers: top,
  };
}
