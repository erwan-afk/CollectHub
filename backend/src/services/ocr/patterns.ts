export interface PatternMatch {
  value: string;
  rawMatch: string;
  specificity: number;
}

type FieldPattern = { regex: RegExp; specificity: number; group?: number };

// Espace horizontal seul (espaces, tabs) — empêche les regex de traverser les sauts de ligne.
const H = '[ \\t]';
const NUM = '[0-9][0-9\\s.,]*'; // nombre français, capté entièrement jusqu'à un non-chiffre/sépa

const PATTERNS: Record<string, FieldPattern[]> = {
  invoice_number: [
    { regex: new RegExp(`Facture${H}*(?:N[°o]|num[ée]ro)${H}*:?${H}*([A-Z0-9][A-Z0-9\\-_/]{0,30})`, 'i'), specificity: 0.95 },
    { regex: new RegExp(`Invoice${H}*(?:No\\.?|number)${H}*:?${H}*([A-Z0-9][A-Z0-9\\-_/]{0,30})`, 'i'), specificity: 0.9 },
    { regex: new RegExp(`N[°o]${H}*(?:de${H}*)?facture${H}*:?${H}*([A-Z0-9][A-Z0-9\\-_/]{0,30})`, 'i'), specificity: 0.9 },
  ],
  issue_date: [
    { regex: new RegExp(`(?:Date${H}*(?:de${H}*)?(?:facture|émission|d['’]émission)?|émise?${H}*le)${H}*:?${H}*(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})`, 'i'), specificity: 0.95 },
    { regex: new RegExp(`(?:Date|Le)${H}*:?${H}*(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})`, 'i'), specificity: 0.7 },
    { regex: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/, specificity: 0.5 },
  ],
  due_date: [
    { regex: new RegExp(`(?:Date${H}*d['’]?${H}*échéance|Échéance|Due${H}*date)${H}*:?${H}*(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})`, 'i'), specificity: 0.95 },
  ],
  amount_ht: [
    { regex: new RegExp(`Total${H}*(?:H\\.?T\\.?|hors${H}*taxes?)${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.95 },
    { regex: new RegExp(`Montant${H}*H\\.?T\\.?${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.9 },
    { regex: new RegExp(`\\bH\\.?T\\.?${H}*:?${H}*(${NUM})${H}*€`, 'i'), specificity: 0.75 },
  ],
  amount_tva: [
    { regex: new RegExp(`(?:Total${H}*)?T\\.?V\\.?A\\.?(?:${H}*\\(?\\d{1,2}[.,]?\\d*${H}*%?\\)?)?${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.9 },
    { regex: new RegExp(`Montant${H}*T\\.?V\\.?A\\.?${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.9 },
  ],
  amount_ttc: [
    { regex: new RegExp(`Total${H}*(?:T\\.?T\\.?C\\.?|toutes?${H}*taxes?${H}*comprises?|à${H}*payer)${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.95 },
    { regex: new RegExp(`Net${H}*à${H}*payer${H}*:?${H}*(${NUM})${H}*€?`, 'i'), specificity: 0.95 },
    { regex: new RegExp(`\\bT\\.?T\\.?C\\.?${H}*:?${H}*(${NUM})${H}*€`, 'i'), specificity: 0.75 },
    // Fallback : "Total <montant> €" tout seul (ni HT, ni TVA, ni hors taxes derrière).
    // Utile sur les factures auto-entrepreneur sans TVA où il n'y a qu'un "Total".
    { regex: new RegExp(`\\bTotal${H}+(?!H\\.?T\\.?\\b|T\\.?V\\.?A\\.?\\b|hors\\b|taxes?\\b|brut\\b|net\\b)(${NUM})${H}*€`, 'i'), specificity: 0.7 },
  ],
  siret: [
    { regex: /\bSIRET\s*:?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i, specificity: 0.98 },
    { regex: /\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/, specificity: 0.7 },
  ],
  iban: [
    { regex: /\bIBAN\s*:?\s*(FR\d{2}(?:\s?\d{4}){5}\s?\d{3})\b/i, specificity: 0.98 },
    { regex: /\b(FR\d{2}(?:\s?[A-Z0-9]{4}){5}\s?[A-Z0-9]{3})\b/i, specificity: 0.85 },
  ],
};

export function matchField(field: keyof typeof PATTERNS | string, text: string): PatternMatch | null {
  const patterns = PATTERNS[field];
  if (!patterns) return null;
  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m && m[1]) {
      return { value: m[1].trim(), rawMatch: m[0], specificity: p.specificity };
    }
  }
  return null;
}

export const FIELD_KEYS = Object.keys(PATTERNS);
