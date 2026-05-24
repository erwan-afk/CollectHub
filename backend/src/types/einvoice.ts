// EN 16931 Business Terms (BT-XX) — canonical DTO for Factur-X and UBL parsers/generators.
// Field comments cite the BT number so the mapping stays traceable.

// ─── Profiles ────────────────────────────────────────────────────────────────

/** 5 Factur-X profiles ordered by richness. EN16931 (COMFORT) is the legal FR target. */
export type FacturXProfile =
  | 'MINIMUM'
  | 'BASIC_WL'
  | 'BASIC'
  | 'EN16931'   // alias COMFORT — DGFiP B2B obligation
  | 'EXTENDED';

/** Maps GuidelineSpecifiedDocumentContextParameter URN → FacturXProfile */
export const GUIDELINE_URN: Record<string, FacturXProfile> = {
  'urn:factur-x.eu:1p0:minimum':   'MINIMUM',
  'urn:factur-x.eu:1p0:basicwl':   'BASIC_WL',
  'urn:factur-x.eu:1p0:basic':     'BASIC',
  'urn:cen.eu:en16931:2017':        'EN16931',
  'urn:factur-x.eu:1p0:extended':  'EXTENDED',
};

// ─── Regulatory lifecycle ─────────────────────────────────────────────────────

/**
 * 4 mandatory statuses between PDP issuer ↔ receiver (réforme DGFiP).
 * Internal workflow statuses live in InvoiceStatus (invoice.ts).
 */
export type LifecycleStatus =
  | 'DEPOSITED'        // Déposée — sent on the network
  | 'REFUSED'          // Refusée — rejected by recipient
  | 'MADE_AVAILABLE'   // Mise à disposition — received by recipient
  | 'SETTLED';         // Encaissée — payment confirmed

export interface LifecycleEvent {
  id: number;
  invoiceId: number;
  status: LifecycleStatus;
  occurredAt: string;   // ISO-8601
  actor: string;
  comment: string | null;
}

export interface LifecycleEventRow {
  id: number;
  invoice_id: number;
  status: LifecycleStatus;
  occurred_at: Date | string;
  actor: string;
  comment: string | null;
}

// ─── Parties ─────────────────────────────────────────────────────────────────

/** BT-27 to BT-44 — seller / buyer postal address */
export interface EInvoiceAddress {
  line1?: string;        // BT-35 / BT-50
  line2?: string;        // BT-36 / BT-51
  city?: string;         // BT-37 / BT-52
  postCode?: string;     // BT-38 / BT-53
  countrySubdivision?: string; // BT-39 / BT-54
  countryCode: string;   // BT-40 / BT-55 — ISO 3166-1 alpha-2
}

/** Seller (BT-27..BT-44) or Buyer (BT-44..BT-56) */
export interface EInvoiceParty {
  name: string;              // BT-27 seller name / BT-44 buyer name
  tradingName?: string;      // BT-28 / BT-45
  vatNumber?: string;        // BT-31 / BT-48 — e.g. FR12345678901
  legalId?: string;          // BT-30 / BT-47 — SIREN (schemeID 0002) or SIRET (0009)
  legalIdScheme?: '0002' | '0009' | string; // 0002=SIREN, 0009=SIRET
  address: EInvoiceAddress;  // BT-35..BT-40 / BT-50..BT-55
  contactName?: string;      // BT-41 / BT-56
  contactEmail?: string;     // BT-43
  contactPhone?: string;     // BT-42
}

// ─── Tax ─────────────────────────────────────────────────────────────────────

/** BT-95..BT-101 — one entry per VAT rate (GROUP level) */
export interface EInvoiceTaxBreakdown {
  taxableAmount: number;   // BT-116 — net amount subject to this rate
  taxAmount: number;       // BT-117 — VAT amount
  rate: number;            // BT-119 — e.g. 20 for 20%
  categoryCode: string;    // BT-118 — S=standard, Z=zero, E=exempt, AE=reverse charge
  exemptionReason?: string; // BT-120
}

// ─── Lines ────────────────────────────────────────────────────────────────────

/** BT-126..BT-162 — one invoice line */
export interface EInvoiceLine {
  id: string;                  // BT-126 — line identifier
  description: string;         // BT-153
  quantity: number;            // BT-129
  unitCode?: string;           // BT-130 — UN/ECE Rec 20 (e.g. C62=unit, KGM=kg)
  unitPrice: number;           // BT-146 — net price per unit (4 decimal places per EN 16931)
  lineNetAmount: number;       // BT-131 — quantity × unit price
  itemName?: string;           // BT-153 (same as description in simple cases)
  sellerItemId?: string;       // BT-155
  buyerItemId?: string;        // BT-156
  taxRate?: number;            // BT-152 — VAT rate on this line
  taxCategoryCode?: string;    // BT-151
  note?: string;               // BT-127
}

// ─── Allowances / Charges ─────────────────────────────────────────────────────

export interface EInvoiceAllowanceCharge {
  isCharge: boolean;           // true=charge, false=allowance
  amount: number;              // BT-92 / BT-99
  baseAmount?: number;         // BT-93 / BT-100
  percentage?: number;         // BT-94 / BT-101
  reason?: string;             // BT-97 / BT-104
  taxRate?: number;
  taxCategoryCode?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface EInvoicePaymentMeans {
  typeCode: string;    // BT-81 — UNTDID 4461 (30=transfer, 58=SEPA)
  iban?: string;       // BT-84
  bic?: string;        // BT-86
  mandate?: string;    // BT-89 — SEPA direct debit mandate reference
  cardLast4?: string;  // BT-87
}

// ─── Main DTO ─────────────────────────────────────────────────────────────────

/**
 * Canonical e-invoice DTO. Output of CII/UBL parsers, input of CII/UBL generators.
 * Every field is optional unless required by the MINIMUM profile.
 */
export interface EInvoiceDto {
  // ── Document level ──────────────────────────────────────────────────────────
  profile: FacturXProfile;          // detected from GuidelineURN
  invoiceNumber: string;            // BT-1
  issueDate: string;                // BT-2 — YYYY-MM-DD
  dueDate?: string;                 // BT-9
  typeCode: string;                 // BT-3 — UNTDID 1001: 380=invoice, 381=credit note
  currency: string;                 // BT-5 — ISO 4217 (EUR, USD…)
  buyerReference?: string;          // BT-10 — PO number / accounting reference
  purchaseOrderRef?: string;        // BT-13
  contractRef?: string;             // BT-12
  note?: string;                    // BT-22

  // ── Parties ─────────────────────────────────────────────────────────────────
  seller: EInvoiceParty;            // BT-27..BT-44
  buyer: EInvoiceParty;             // BT-44..BT-56

  // ── Lines ───────────────────────────────────────────────────────────────────
  lines: EInvoiceLine[];            // BT-126..BT-162

  // ── Allowances / charges (document level) ────────────────────────────────────
  allowancesCharges?: EInvoiceAllowanceCharge[];

  // ── Tax ─────────────────────────────────────────────────────────────────────
  taxBreakdowns: EInvoiceTaxBreakdown[]; // BT-116..BT-121

  // ── Monetary totals (BT-106..BT-115) ────────────────────────────────────────
  sumOfLines: number;       // BT-106 — Σ line net amounts
  totalAllowances: number;  // BT-107
  totalCharges: number;     // BT-108
  taxExclusiveAmount: number; // BT-109 — net total (HT)
  taxInclusiveAmount: number; // BT-112 — gross total (TTC)
  taxAmount: number;          // BT-110 — total VAT
  prepaidAmount?: number;     // BT-113
  roundingAmount?: number;    // BT-114
  duePayableAmount: number;   // BT-115 — amount due

  // ── Payment ─────────────────────────────────────────────────────────────────
  paymentMeans?: EInvoicePaymentMeans; // BT-81..BT-89
  paymentTerms?: string;              // BT-20 — free-text payment terms
}

// ─── Validation result ────────────────────────────────────────────────────────

export interface XsdValidationError {
  line: number;
  column: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  xsdErrors: XsdValidationError[];
  businessRuleErrors: BusinessRuleError[];
}

export interface BusinessRuleError {
  ruleId: string;   // e.g. "BR-CO-10"
  message: string;
}

// ─── Import result ────────────────────────────────────────────────────────────

export interface EInvoiceImportResult {
  invoiceId: number;
  profile: FacturXProfile;
  validation: ValidationResult;
  warnings: string[];
}
