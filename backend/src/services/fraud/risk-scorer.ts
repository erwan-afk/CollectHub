/**
 * Détection de fraude — heuristiques v1.
 * Inspiré des features Yooz : IBAN changé, doublon, montant aberrant, séquence non-cohérente.
 */
import { pool } from '../../db/database';
import { logger } from '../../config/logger';

export interface RiskInput {
  orgId: number;
  supplierId: number | null;
  invoiceId: number;
  invoiceNumber: string | null;
  issueDate: string | null;
  amountTtc: number | null;
  iban: string | null;
}

export interface RiskResult {
  score: number;      // 0–100
  flags: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Heuristiques ─────────────────────────────────────────────────────────────

async function checkAberrantAmount(
  orgId: number,
  supplierId: number,
  amountTtc: number,
): Promise<string | null> {
  const { rows } = await pool.query<{ amount_ttc: string }>(
    `SELECT amount_ttc
     FROM invoices
     WHERE organization_id = $1
       AND supplier_id = $2
       AND amount_ttc IS NOT NULL
       AND issue_date >= NOW() - INTERVAL '90 days'
       AND status NOT IN ('REJECTED')
     ORDER BY created_at DESC
     LIMIT 50`,
    [orgId, supplierId],
  );
  if (rows.length < 3) return null;

  const values = rows.map((r) => parseFloat(r.amount_ttc));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = stddev(values);
  if (sd === 0) return null;

  const zScore = Math.abs((amountTtc - mean) / sd);
  if (zScore > 3) {
    return `montant_aberrant: ${amountTtc}€ (z-score=${zScore.toFixed(1)}, moyenne=${mean.toFixed(0)}€, σ=${sd.toFixed(0)}€)`;
  }
  return null;
}

async function checkIbanChanged(
  orgId: number,
  supplierId: number,
  iban: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ iban: string }>(
    `SELECT iban FROM suppliers WHERE id = $1 AND organization_id = $2`,
    [supplierId, orgId],
  );
  if (!rows.length || !rows[0].iban) return null;
  const knownIban = rows[0].iban.replace(/\s/g, '');
  const newIban = iban.replace(/\s/g, '');
  if (knownIban !== newIban) {
    return `iban_change: IBAN connu=${knownIban} → nouveau=${newIban}`;
  }
  return null;
}

async function checkDuplicate(
  orgId: number,
  supplierId: number,
  invoiceId: number,
  amountTtc: number,
  issueDate: string,
): Promise<string | null> {
  const month = issueDate.slice(0, 7); // YYYY-MM
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM invoices
     WHERE organization_id = $1
       AND supplier_id = $2
       AND id != $3
       AND amount_ttc = $4
       AND TO_CHAR(issue_date, 'YYYY-MM') = $5
       AND status NOT IN ('REJECTED')
     LIMIT 1`,
    [orgId, supplierId, invoiceId, amountTtc, month],
  );
  if (rows.length) {
    return `doublon_proche: facture #${rows[0].id} même montant (${amountTtc}€) ce mois`;
  }
  return null;
}

async function checkNonSequentialNumber(
  orgId: number,
  supplierId: number,
  invoiceNumber: string,
): Promise<string | null> {
  const numMatch = invoiceNumber.match(/(\d+)$/);
  if (!numMatch) return null;
  const currentNum = parseInt(numMatch[1], 10);

  const { rows } = await pool.query<{ invoice_number: string }>(
    `SELECT invoice_number
     FROM invoices
     WHERE organization_id = $1
       AND supplier_id = $2
       AND invoice_number IS NOT NULL
       AND status NOT IN ('REJECTED')
     ORDER BY created_at DESC
     LIMIT 10`,
    [orgId, supplierId],
  );
  const nums = rows
    .map((r) => {
      const m = r.invoice_number.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  if (!nums.length) return null;
  const maxKnown = Math.max(...nums);
  if (currentNum > maxKnown + 100) {
    return `numero_non_sequentiel: N°${invoiceNumber} (saut de ${currentNum - maxKnown} depuis le dernier connu)`;
  }
  return null;
}

function checkInconsistentDate(issueDate: string): string | null {
  const date = new Date(issueDate);
  const now = new Date();
  if (isNaN(date.getTime())) return null;

  if (date > now) {
    return `date_future: émission le ${issueDate} (dans le futur)`;
  }
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  if (date < oneYearAgo) {
    return `date_ancienne: émission le ${issueDate} (> 1 an)`;
  }
  return null;
}

// ─── Scorer principal ─────────────────────────────────────────────────────────

export async function scoreRisk(input: RiskInput): Promise<RiskResult> {
  const flags: string[] = [];

  if (!input.supplierId || !input.amountTtc) {
    return { score: 0, flags };
  }

  const checks = await Promise.allSettled([
    checkAberrantAmount(input.orgId, input.supplierId, input.amountTtc),
    input.iban
      ? checkIbanChanged(input.orgId, input.supplierId, input.iban)
      : Promise.resolve(null),
    input.issueDate && input.invoiceNumber
      ? checkDuplicate(input.orgId, input.supplierId, input.invoiceId, input.amountTtc, input.issueDate)
      : Promise.resolve(null),
    input.invoiceNumber
      ? checkNonSequentialNumber(input.orgId, input.supplierId, input.invoiceNumber)
      : Promise.resolve(null),
  ]);

  for (const r of checks) {
    if (r.status === 'fulfilled' && r.value) flags.push(r.value);
  }
  if (input.issueDate) {
    const dateFlag = checkInconsistentDate(input.issueDate);
    if (dateFlag) flags.push(dateFlag);
  }

  // IBAN changé = flag critique (+50), autres = +20 chacun
  let score = 0;
  for (const f of flags) {
    if (f.startsWith('iban_change')) score += 50;
    else score += 20;
  }
  score = Math.min(100, score);

  logger.info('fraud.risk_scored', {
    invoiceId: input.invoiceId,
    score,
    flags,
  });

  return { score, flags };
}
