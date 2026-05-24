/**
 * Factur-X generator — profil EN 16931
 *
 * Pipeline:
 *   1. Invoice DB → EInvoiceDto (cii-mapper)
 *   2. EInvoiceDto → XML CII via Mustache template
 *   3. PDF visuel via pdfkit
 *   4. PDF + PDF/A-3 conformance markers via pdf-lib (pdf-a3-builder)
 *   5. Embed XML as EmbeddedFile named "factur-x.xml"
 *
 * Output: Buffer containing a PDF/A-3b file with embedded Factur-X XML.
 */

import Mustache from 'mustache';
import fs from 'fs';
import path from 'path';
import type { Invoice } from '../../types/invoice';
import type { EInvoiceParty, EInvoiceDto, FacturXProfile } from '../../types/einvoice';
import { GUIDELINE_URN } from '../../types/einvoice';
import { invoiceToDto } from './cii-mapper';
import { buildPdfA3 } from './pdf-a3-builder';

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'cii-en16931.xml.mustache');

// ─── Public API ────────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  buyer: EInvoiceParty;
  profile?: FacturXProfile;
}

/**
 * Returns a Buffer containing a PDF/A-3b Factur-X file.
 * The embedded XML is named "factur-x.xml" per the FNFE-MPE specification.
 */
export async function generateFacturX(
  invoice: Invoice,
  options: GeneratorOptions,
): Promise<Buffer> {
  const { buyer, profile = 'EN16931' } = options;

  const dto = invoiceToDto(invoice, buyer, profile);
  const xml = renderCiiXml(dto);
  const pdfBuffer = await buildPdfA3(invoice, xml);

  return pdfBuffer;
}

/** Expose the raw XML generation for testing and the XSD validation step. */
export function generateCiiXml(
  invoice: Invoice,
  buyer: EInvoiceParty,
  profile?: FacturXProfile,
): string {
  const dto = invoiceToDto(invoice, buyer, profile);
  return renderCiiXml(dto);
}

// ─── XML rendering ─────────────────────────────────────────────────────────────

function renderCiiXml(dto: EInvoiceDto): string {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const view = dtoToMustacheView(dto);
  // HTML escaping is unnecessary for XML values (numbers, dates, controlled names).
  return Mustache.render(template, view);
}

// ─── Mustache view builder ─────────────────────────────────────────────────────

/**
 * Flattens an EInvoiceDto into a plain object compatible with the Mustache template.
 * Amounts use EN 16931 §7.1 decimal format: point separator, no thousands, 2 or 4 places.
 */
function dtoToMustacheView(dto: EInvoiceDto): Record<string, unknown> {
  const guidelineUrn =
    Object.entries(GUIDELINE_URN).find(([, v]) => v === dto.profile)?.[0] ??
    'urn:cen.eu:en16931:2017';

  return {
    guidelineUrn,
    invoiceNumber: dto.invoiceNumber,
    typeCode: dto.typeCode,
    issueDateFormatted: toFormat102(dto.issueDate),
    dueDateFormatted: dto.dueDate ? toFormat102(dto.dueDate) : undefined,
    dueDate: dto.dueDate,
    currency: dto.currency,
    note: dto.note,
    buyerReference: dto.buyerReference,
    purchaseOrderRef: dto.purchaseOrderRef,
    contractRef: dto.contractRef,
    paymentTerms: dto.paymentTerms,

    seller: dto.seller,
    buyer: dto.buyer,

    lines: dto.lines.map((l) => ({
      ...l,
      unitPriceFormatted: fmt4(l.unitPrice),
      quantityFormatted: fmt4(l.quantity),
      lineNetAmountFormatted: fmt2(l.lineNetAmount),
      taxCategoryCode: l.taxCategoryCode ?? 'S',
      taxRate: l.taxRate ?? 20,
    })),

    taxBreakdowns: dto.taxBreakdowns.map((t) => ({
      ...t,
      taxAmountFormatted: fmt2(t.taxAmount),
      taxableAmountFormatted: fmt2(t.taxableAmount),
    })),

    paymentMeans: dto.paymentMeans,

    // Monetary totals
    sumOfLinesFormatted: fmt2(dto.sumOfLines),
    totalAllowancesFormatted: fmt2(dto.totalAllowances),
    totalChargesFormatted: fmt2(dto.totalCharges),
    taxExclusiveAmountFormatted: fmt2(dto.taxExclusiveAmount),
    taxAmountTotalFormatted: fmt2(dto.taxAmount),
    taxInclusiveAmountFormatted: fmt2(dto.taxInclusiveAmount),
    prepaidAmount: dto.prepaidAmount,
    prepaidAmountFormatted: dto.prepaidAmount != null ? fmt2(dto.prepaidAmount) : undefined,
    duePayableAmountFormatted: fmt2(dto.duePayableAmount),
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** EN 16931 date format 102 = YYYYMMDD */
function toFormat102(iso: string): string {
  return iso.replace(/-/g, '');
}

/** 2 decimal places, point separator — amounts */
function fmt2(n: number): string {
  return n.toFixed(2);
}

/** 4 decimal places — unit prices & quantities */
function fmt4(n: number): string {
  return n.toFixed(4);
}
