import { matchField } from './patterns';
import { ConfidenceMap } from '../../types/invoice';

export interface ExtractedFields {
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTva: number | null;
  amountTtc: number | null;
  siret: string | null;
  iban: string | null;
}

export interface ParseResult {
  fields: ExtractedFields;
  confidence: ConfidenceMap;
}

function parseFrenchNumber(s: string): number | null {
  if (!s) return null;
  const cleaned = s
    .replace(/[\s ]/g, '')
    .replace(/€/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,(\d{1,2})$/, '.$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
  const dd = d.padStart(2, '0');
  const mm = mo.padStart(2, '0');
  const date = new Date(`${y}-${mm}-${dd}`);
  if (Number.isNaN(date.getTime())) return null;
  return `${y}-${mm}-${dd}`;
}

export function parseFields(text: string, ocrConfidence = 1): ParseResult {
  const fields: ExtractedFields = {
    invoiceNumber: null,
    issueDate: null,
    dueDate: null,
    amountHt: null,
    amountTva: null,
    amountTtc: null,
    siret: null,
    iban: null,
  };
  const confidence: ConfidenceMap = {};

  if (!text || text.trim().length === 0) return { fields, confidence };

  const computeConf = (specificity: number) =>
    Math.min(1, 0.5 * specificity + 0.3 * ocrConfidence + 0.2);

  const inv = matchField('invoice_number', text);
  if (inv) {
    fields.invoiceNumber = inv.value;
    confidence.invoice_number = computeConf(inv.specificity);
  }

  const issueRaw = matchField('issue_date', text);
  if (issueRaw) {
    const parsed = parseDate(issueRaw.value);
    if (parsed) {
      fields.issueDate = parsed;
      confidence.issue_date = computeConf(issueRaw.specificity);
    }
  }
  const dueRaw = matchField('due_date', text);
  if (dueRaw) {
    const parsed = parseDate(dueRaw.value);
    if (parsed) {
      fields.dueDate = parsed;
      confidence.due_date = computeConf(dueRaw.specificity);
    }
  }

  const ht = matchField('amount_ht', text);
  if (ht) {
    fields.amountHt = parseFrenchNumber(ht.value);
    if (fields.amountHt !== null) confidence.amount_ht = computeConf(ht.specificity);
  }
  const tva = matchField('amount_tva', text);
  if (tva) {
    fields.amountTva = parseFrenchNumber(tva.value);
    if (fields.amountTva !== null) confidence.amount_tva = computeConf(tva.specificity);
  }
  const ttc = matchField('amount_ttc', text);
  if (ttc) {
    fields.amountTtc = parseFrenchNumber(ttc.value);
    if (fields.amountTtc !== null) confidence.amount_ttc = computeConf(ttc.specificity);
  }

  if (
    fields.amountHt !== null &&
    fields.amountTva !== null &&
    fields.amountTtc !== null
  ) {
    const sum = fields.amountHt + fields.amountTva;
    if (Math.abs(sum - fields.amountTtc) < 0.05) {
      confidence.amount_ht = Math.min(1, (confidence.amount_ht ?? 0) + 0.1);
      confidence.amount_tva = Math.min(1, (confidence.amount_tva ?? 0) + 0.1);
      confidence.amount_ttc = Math.min(1, (confidence.amount_ttc ?? 0) + 0.1);
    }
  }

  const siret = matchField('siret', text);
  if (siret) {
    fields.siret = siret.value.replace(/\s/g, '');
    confidence.siret = computeConf(siret.specificity);
  }
  const iban = matchField('iban', text);
  if (iban) {
    fields.iban = iban.value.replace(/\s/g, '');
    confidence.iban = computeConf(iban.specificity);
  }

  return { fields, confidence };
}
