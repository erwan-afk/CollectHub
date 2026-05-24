/**
 * PDF Splitter — détection et découpage de PDF multi-factures.
 * Sprint 3 : YoozSmartSplit-like.
 *
 * Algo de détection de séparateurs entre factures :
 *   1. Page avec très peu de texte (quasi blanche)
 *   2. Apparition de "FACTURE N°" / "INVOICE #" / "FACTURE Nº"
 *   3. Changement de SIRET émetteur entre deux pages
 *   4. Changement net de densité texte (layout shift)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PDFDocument } from 'pdf-lib';
import { extractPdfText } from './pdf-extractor';
import { matchField } from './patterns';
import { logger } from '../../config/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParseMod = require('pdf-parse');
const PDFParseClass = pdfParseMod.PDFParse ?? pdfParseMod.default?.PDFParse;

export interface SplitResult {
  /** Chemin du PDF complet original */
  originalPath: string;
  /** Tableau des PDFs individuels extraits */
  parts: SplitPart[];
  /** Nombre total de pages du PDF original */
  totalPages: number;
  /** Nombre de factures détectées */
  count: number;
}

export interface SplitPart {
  /** Chemin temporaire du PDF d'une seule facture */
  filePath: string;
  /** Pages incluses dans cette facture (1-based) */
  pages: [number, number];
  /** SIRET détecté dans cette facture, ou null */
  siret: string | null;
  /** Préfixe du numéro de facture détecté dans cette partie, ou null */
  invoiceNumberPrefix: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PageText {
  pageNum: number; // 1-based
  text: string;
  charCount: number;
}

async function extractPagesText(filePath: string): Promise<PageText[]> {
  if (!PDFParseClass) return [];

  const buf = fs.readFileSync(filePath);
  try {
    const parser = new PDFParseClass({ data: new Uint8Array(buf) });
    // pdf-parse 2.x retourne `getText()` qui donne tout le texte.
    // Pour le texte par page, on parse d'abord via getText() (tout le doc)
    // puis on utilise la propriété `pages` si disponible (v1) ou on lit page par page.
    const fullResult = await parser.getText();
    const text = (fullResult.text ?? '').replace(/\r/g, '');

    // pdf-parse v1 stockait `pages` dans le résultat ; v2 expose `getText()` seulement.
    // On reconstruit les pages en découpant par le séparateur interne.
    // Fallback : si on n'a qu'un bloc de texte, on le met page 1.
    const pageBreaks = text.split(/\n\s*\n\s*\n\s*\n/); // heuristique : 3+ sauts de ligne = séparateur de page
    // Alternative : tenter d'accéder à `parser.pages` (non documenté mais présent en v1)
    const pages = (parser as Record<string, unknown>).pages as
      | Array<{ getTextContent?: () => Promise<unknown> }>
      | undefined;

    if (pages && Array.isArray(pages)) {
      const results: PageText[] = [];
      for (let i = 0; i < pages.length; i++) {
        const content = await pages[i].getTextContent?.();
        const pageText = typeof content === 'string' ? content : '';
        results.push({
          pageNum: i + 1,
          text: pageText.replace(/\r/g, ''),
          charCount: pageText.length,
        });
      }
      await parser.destroy();
      return results;
    }

    await parser.destroy();

    // Fallback : on suppose qu'on a au moins la page 1 avec tout le texte
    if (pageBreaks.length > 1) {
      return pageBreaks.map((t: string, i: number) => ({
        pageNum: i + 1,
        text: t.trim(),
        charCount: t.trim().length,
      }));
    }

    return [{ pageNum: 1, text: text.trim(), charCount: text.trim().length }];
  } catch {
    return [];
  }
}

/** Détecte la réapparition d'un en-tête de facture (nouveau document) */
function isNewInvoiceHeader(text: string): boolean {
  const patterns = [
    /(?:FACTURE|INVOICE|AVOIR)\s*(?:N[°o]|Nº|num[ée]ro|#)\s*:?\s*[A-Z0-9]/i,
    /\bFACTURE\b.{0,20}\bN[°o]\b/i,
    /\bInvoice\s*#/i,
  ];
  return patterns.some((p) => p.test(text));
}

/** Détecte un SIRET dans une page */
function detectSiret(text: string): string | null {
  const match = matchField('siret', text);
  return match ? match.value.replace(/\s/g, '') : null;
}

/** Détecte un préfixe de numéro de facture (ex: "FA-2024-" depuis "FA-2024-0156") */
function detectInvoiceNumberPrefix(text: string): string | null {
  const match = matchField('invoice_number', text);
  if (!match) return null;
  // Garde le préfixe (tout sauf la partie numérique finale)
  const m = match.value.match(/^(.+?)(\d+)$/);
  return m ? m[1] : match.value;
}

/** Vérifie si une page est quasi blanche (séparateur visuel) */
function isNearBlankPage(page: PageText, threshold = 30): boolean {
  return page.charCount < threshold;
}

/** Densité de texte normalisée (caractères / ligne) pour détecter un layout shift */
function textDensity(text: string): number {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (!lines.length) return 0;
  return text.length / lines.length;
}

// ─── Détection des points de split ───────────────────────────────────────────

/**
 * Analyse les pages et retourne les indices de pages (1-based) où commence
 * une nouvelle facture. Retourne toujours la page 1 comme premier point.
 */
function findSplitPoints(pages: PageText[]): number[] {
  if (pages.length <= 1) return [1];

  const splitPoints: number[] = [1];

  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1];
    const curr = pages[i];

    let shouldSplit = false;

    // 1. Page quasi blanche avant la page courante
    if (isNearBlankPage(prev)) {
      shouldSplit = true;
    }

    // 2. Nouvel en-tête de facture sur la page courante
    if (isNewInvoiceHeader(curr.text)) {
      shouldSplit = true;
    }

    // 3. Changement de SIRET
    const prevSiret = detectSiret(prev.text);
    const currSiret = detectSiret(curr.text);
    if (prevSiret && currSiret && prevSiret !== currSiret) {
      shouldSplit = true;
    }

    // 4. Layout shift : densité de texte change radicalement (> 40%)
    const prevDensity = textDensity(prev.text);
    const currDensity = textDensity(curr.text);
    // On ne déclenche pas le split sur le layout shift si un autre signal est présent
    if (!shouldSplit && prevDensity > 0 && currDensity > 0) {
      const ratio =
        prevDensity > currDensity ? currDensity / prevDensity : prevDensity / currDensity;
      if (ratio < 0.4) {
        // Layout shift détecté, mais on ne split que si la page courante a
        // aussi un en-tête de document (numéro, SIRET, ou mot "FACTURE")
        if (
          detectSiret(curr.text) ||
          detectInvoiceNumberPrefix(curr.text) ||
          /\bFACTURE\b/i.test(curr.text)
        ) {
          shouldSplit = true;
        }
      }
    }

    if (shouldSplit) {
      splitPoints.push(curr.pageNum);
    }
  }

  return splitPoints;
}

// ─── Création des PDFs splités ───────────────────────────────────────────────

async function extractPageRange(
  srcPdfBytes: Uint8Array,
  startPage: number,
  endPage: number,
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(srcPdfBytes);
  const newDoc = await PDFDocument.create();

  // pdf-lib : pages sont 0-indexed
  const pages = await newDoc.copyPages(
    srcDoc,
    Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage - 1 + i),
  );
  for (const p of pages) {
    newDoc.addPage(p);
  }

  return await newDoc.save();
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Détecte et découpe un PDF multi-factures en PDFs individuels.
 * Retourne la liste des chemins temporaires des PDFs splités.
 */
export async function splitMultiInvoicePdf(filePath: string): Promise<SplitResult> {
  const pages = await extractPagesText(filePath);

  if (pages.length <= 1) {
    // Une seule page → pas de split
    const prefix = detectInvoiceNumberPrefix(pages[0]?.text ?? '');
    const siret = detectSiret(pages[0]?.text ?? '');
    return {
      originalPath: filePath,
      parts: [{ filePath, pages: [1, 1], siret, invoiceNumberPrefix: prefix }],
      totalPages: 1,
      count: 1,
    };
  }

  const splitPoints = findSplitPoints(pages);

  if (splitPoints.length <= 1) {
    // Pas de split détecté
    const prefix = detectInvoiceNumberPrefix(pages[0]?.text ?? '');
    const siret = detectSiret(pages[0]?.text ?? '');
    return {
      originalPath: filePath,
      parts: [{ filePath, pages: [1, pages.length], siret, invoiceNumberPrefix: prefix }],
      totalPages: pages.length,
      count: 1,
    };
  }

  // Découpage effectif
  const srcBytes = fs.readFileSync(filePath);
  const tmpDir = os.tmpdir();
  const parts: SplitPart[] = [];

  for (let i = 0; i < splitPoints.length; i++) {
    const startPage = splitPoints[i];
    const endPage = i < splitPoints.length - 1 ? splitPoints[i + 1] - 1 : pages.length;

    const pdfBytes = await extractPageRange(new Uint8Array(srcBytes), startPage, endPage);

    const tmpPath = path.join(tmpDir, `invoice-split-${Date.now()}-${i + 1}.pdf`);
    fs.writeFileSync(tmpPath, Buffer.from(pdfBytes));

    // Texte combiné des pages de cette partie
    const partText = pages
      .filter((p) => p.pageNum >= startPage && p.pageNum <= endPage)
      .map((p) => p.text)
      .join('\n');

    parts.push({
      filePath: tmpPath,
      pages: [startPage, endPage],
      siret: detectSiret(partText),
      invoiceNumberPrefix: detectInvoiceNumberPrefix(partText),
    });
  }

  logger.info('pdf_splitter.split', {
    originalPath: filePath,
    totalPages: pages.length,
    splitCount: parts.length,
    splitPoints,
  });

  return {
    originalPath: filePath,
    parts,
    totalPages: pages.length,
    count: parts.length,
  };
}
