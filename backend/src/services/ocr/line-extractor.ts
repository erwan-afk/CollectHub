/**
 * Extraction des lignes de facture depuis le texte OCR/PDF.
 *
 * On reste sur du parsing par ligne (pas de reconstruction de tableau par
 * positionnement spatial — ce serait un autre problème). On essaie quelques
 * formats répandus en facturation française :
 *
 *   1) "<qté> x <désignation> @ <PU> = <total>"
 *   2) "<qté>  <désignation>  <PU>  <total>"        (colonnes séparées par espaces)
 *   3) "<désignation> ............... <total>"      (forfait à 1 ligne)
 *
 * On filtre les lignes "totaux" (HT, TVA, TTC) pour ne pas les compter comme
 * des items.
 */

import { InvoiceLine } from '../../types/invoice';

const TOTAL_KEYWORDS = /\b(?:total|montant|sous[\s-]?total|net\s+à\s+payer|tva|h\.?t\.?|t\.?t\.?c\.?|échéance|date|siret|iban|facture)\b/i;

function parseFrNum(s: string): number | null {
  if (!s) return null;
  const cleaned = s
    .replace(/\s+/g, '')
    .replace(/€/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,(\d{1,2})$/, '.$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function tryQtyDescAtPriceTotal(line: string): InvoiceLine | null {
  // ex: "3 x Prestation conseil @ 250,00 = 750,00 €"
  const m = line.match(
    /^\s*(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(.+?)\s*[@à]\s*([\d.,\s]+?)\s*(?:€\s*)?=\s*([\d.,\s]+?)\s*€?\s*$/,
  );
  if (!m) return null;
  const quantity = parseFrNum(m[1]) ?? 1;
  const unitPrice = parseFrNum(m[3]) ?? 0;
  const total = parseFrNum(m[4]) ?? unitPrice * quantity;
  return { description: m[2].trim(), quantity, unitPrice, total };
}

function tryColumnFormat(line: string): InvoiceLine | null {
  // ex: "3   Prestation conseil   250,00   750,00 €"
  // — au moins 2 nombres en fin de ligne séparés par au moins 2 espaces
  const m = line.match(
    /^\s*(\d+(?:[.,]\d+)?)\s{2,}(.+?)\s{2,}([\d][\d.,\s]*)\s{2,}([\d][\d.,\s]*)\s*€?\s*$/,
  );
  if (!m) return null;
  const quantity = parseFrNum(m[1]) ?? 1;
  const unitPrice = parseFrNum(m[3]) ?? 0;
  const total = parseFrNum(m[4]) ?? unitPrice * quantity;
  return { description: m[2].trim(), quantity, unitPrice, total };
}

function tryForfait(line: string): InvoiceLine | null {
  // ex: "Prestation forfaitaire ................... 1 200,00 €"
  const m = line.match(/^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 ,'’\-/]{2,})\s*[\.…]{3,}\s*([\d][\d.,\s]*)\s*€\s*$/);
  if (!m) return null;
  const total = parseFrNum(m[2]);
  if (total === null) return null;
  return { description: m[1].trim(), quantity: 1, unitPrice: total, total };
}

export function extractLines(text: string): InvoiceLine[] {
  if (!text) return [];
  const lines: InvoiceLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 4) continue;
    if (TOTAL_KEYWORDS.test(line)) continue;

    const parsed =
      tryQtyDescAtPriceTotal(line) ??
      tryColumnFormat(line) ??
      tryForfait(line);

    if (parsed && parsed.description && parsed.total > 0) {
      lines.push(parsed);
    }
  }
  return lines;
}
