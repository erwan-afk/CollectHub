/**
 * Maps between the DB Invoice type and the canonical EInvoiceDto.
 *
 * Direction A (toDto):   Invoice (DB) → EInvoiceDto  (used by the generator)
 * Direction B (fromDto): EInvoiceDto  → Partial<Invoice> (used by the parser to hydrate DB rows)
 *
 * Every field reference includes the EN 16931 Business Term (BT-XX) so the mapping
 * stays auditable against the official spec.
 */

import type { Invoice, InvoiceLine, Supplier } from '../../types/invoice';
import type {
  EInvoiceDto,
  EInvoiceLine,
  EInvoiceParty,
  EInvoiceAddress,
  EInvoiceTaxBreakdown,
  FacturXProfile,
} from '../../types/einvoice';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: FacturXProfile = 'EN16931';
const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_TYPE_CODE = '380'; // UNTDID 1001: 380 = commercial invoice

// Standard French VAT rate — used as fallback when lines have no explicit rate.
// Real production code would fetch rate from the line or an external ref table.
const DEFAULT_VAT_RATE = 20;

// ─── Direction A : Invoice (DB) → EInvoiceDto ─────────────────────────────────

export function invoiceToDto(
  invoice: Invoice,
  buyer: EInvoiceParty,
  profile: FacturXProfile = DEFAULT_PROFILE,
): EInvoiceDto {
  const seller = supplierToParty(invoice.supplier ?? null);
  const lines = invoice.lines.map((l, i) => lineToEInvoiceLine(l, i));

  const sumOfLines = lines.reduce((s, l) => s + l.lineNetAmount, 0);
  // For this sprint we keep it simple: one VAT breakdown at the default rate.
  const taxBreakdowns = computeTaxBreakdowns(lines);
  const taxAmount = taxBreakdowns.reduce((s, t) => s + t.taxAmount, 0);

  const taxExclusiveAmount = invoice.amountHt ?? sumOfLines;
  const taxInclusiveAmount = invoice.amountTtc ?? taxExclusiveAmount + taxAmount;
  const duePayableAmount = taxInclusiveAmount;

  return {
    profile,
    invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id}`,  // BT-1
    issueDate: toIsoDate(invoice.issueDate),                       // BT-2
    dueDate: invoice.dueDate ? toIsoDate(invoice.dueDate) : undefined, // BT-9
    typeCode: DEFAULT_TYPE_CODE,                                   // BT-3
    currency: invoice.currency ?? DEFAULT_CURRENCY,                // BT-5
    seller,
    buyer,
    lines,
    taxBreakdowns,
    sumOfLines: round2(sumOfLines),
    totalAllowances: 0,
    totalCharges: 0,
    taxExclusiveAmount: round2(taxExclusiveAmount),
    taxInclusiveAmount: round2(taxInclusiveAmount),
    taxAmount: round2(taxAmount),
    duePayableAmount: round2(duePayableAmount),
  };
}

// ─── Direction B : EInvoiceDto → Partial<Invoice> ────────────────────────────

export function dtoToInvoiceFields(dto: EInvoiceDto): Partial<Invoice> {
  return {
    invoiceNumber: dto.invoiceNumber,             // BT-1
    issueDate: dto.issueDate,                     // BT-2
    dueDate: dto.dueDate ?? null,                 // BT-9
    currency: dto.currency,                       // BT-5
    amountHt: dto.taxExclusiveAmount,             // BT-109
    amountTva: dto.taxAmount,                     // BT-110
    amountTtc: dto.taxInclusiveAmount,            // BT-112
    // Supplier hydration is handled separately by the import service
    // (it may need to upsert a supplier row first).
  };
}

/** Extract supplier fields from EInvoiceDto seller for DB upsert. */
export function dtoSellerToSupplierFields(dto: EInvoiceDto): Partial<Supplier> {
  const s = dto.seller;
  return {
    name: s.name,
    vatNumber: s.vatNumber ?? null,
    siret: s.legalIdScheme === '0009' ? s.legalId ?? null : null,
    address: formatAddress(s.address),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function supplierToParty(supplier: Supplier | null): EInvoiceParty {
  const address: EInvoiceAddress = {
    line1: supplier?.address ?? undefined,
    countryCode: 'FR',
  };

  return {
    name: supplier?.name ?? 'Unknown Seller',   // BT-27
    vatNumber: supplier?.vatNumber ?? undefined, // BT-31
    legalId: supplier?.siret ?? undefined,       // BT-30 (SIRET)
    legalIdScheme: supplier?.siret ? '0009' : undefined,
    address,
  };
}

function lineToEInvoiceLine(line: InvoiceLine, index: number): EInvoiceLine {
  const qty = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const lineNetAmount = round4(qty * unitPrice);

  return {
    id: String((line.id ?? index) + 1), // BT-126 — 1-based per spec
    description: line.description,       // BT-153
    quantity: qty,                        // BT-129
    unitCode: 'C62',                      // BT-130 — C62 = unit (no physical unit)
    unitPrice: round4(unitPrice),         // BT-146 — 4 decimals per EN 16931
    lineNetAmount: round2(lineNetAmount), // BT-131 — 2 decimals
    taxRate: DEFAULT_VAT_RATE,            // BT-152
    taxCategoryCode: 'S',                 // BT-151 — S = standard rate
  };
}

function computeTaxBreakdowns(lines: EInvoiceLine[]): EInvoiceTaxBreakdown[] {
  // Group lines by tax rate (BT-119). One breakdown per rate.
  const map = new Map<number, { taxable: number; tax: number }>();

  for (const line of lines) {
    const rate = line.taxRate ?? DEFAULT_VAT_RATE;
    const entry = map.get(rate) ?? { taxable: 0, tax: 0 };
    entry.taxable += line.lineNetAmount;
    entry.tax += round2(line.lineNetAmount * rate / 100);
    map.set(rate, entry);
  }

  return Array.from(map.entries()).map(([rate, { taxable, tax }]) => ({
    taxableAmount: round2(taxable),  // BT-116
    taxAmount: round2(tax),          // BT-117
    rate,                            // BT-119
    categoryCode: 'S',               // BT-118
  }));
}

function toIsoDate(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // Already YYYY-MM-DD or ISO string
  return d.slice(0, 10);
}

function formatAddress(addr: EInvoiceAddress): string {
  return [addr.line1, addr.postCode, addr.city, addr.countryCode]
    .filter(Boolean)
    .join(', ');
}

// EN 16931 §7.1: amounts use 2 decimal places, unit prices use 4.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
