/**
 * EN 16931 business rules — hand-written subset (~25 rules).
 *
 * The full spec has ~150 Schematron rules; we implement the critical ones:
 * totals, VAT coherence, mandatory identifiers, date ordering.
 *
 * Format mirrors the EN 16931 spec: each rule has an ID (BR-XX or BR-CO-XX),
 * a human-readable description, and a check function that returns null if OK
 * or an error string including the offending values.
 *
 * Why hand-written instead of a Schematron engine?
 * → See ADR 0019. A XSLT-based engine adds 20MB+ of Java/XSLT deps with no
 * type safety. 25 typed TS rules cover the mandatory checks and are trivially
 * testable.
 */

import type { EInvoiceDto, BusinessRuleError } from '../../../types/einvoice';

type RuleCheck = (inv: EInvoiceDto) => string | null;

interface BusinessRule {
  id: string;
  description: string;
  check: RuleCheck;
}

// Tolerance for floating-point comparisons (0.01 EUR)
const EPSILON = 0.01;

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

// ─── Rules ────────────────────────────────────────────────────────────────────

const RULES: BusinessRule[] = [
  // ── Mandatory fields ──────────────────────────────────────────────────────

  {
    id: 'BR-1',
    description: 'An Invoice shall have a Specification identifier (BT-24).',
    check: (inv) => inv.profile ? null : 'Missing profile (BT-24)',
  },
  {
    id: 'BR-2',
    description: 'An Invoice shall have an Invoice number (BT-1).',
    check: (inv) => inv.invoiceNumber?.trim() ? null : 'Missing invoice number (BT-1)',
  },
  {
    id: 'BR-3',
    description: 'An Invoice shall have an Invoice issue date (BT-2).',
    check: (inv) => inv.issueDate ? null : 'Missing issue date (BT-2)',
  },
  {
    id: 'BR-4',
    description: 'An Invoice shall have an Invoice type code (BT-3).',
    check: (inv) => inv.typeCode ? null : 'Missing type code (BT-3)',
  },
  {
    id: 'BR-5',
    description: 'An Invoice shall have an Invoice currency code (BT-5).',
    check: (inv) => inv.currency ? null : 'Missing currency (BT-5)',
  },
  {
    id: 'BR-6',
    description: 'An Invoice shall have a Seller name (BT-27).',
    check: (inv) => inv.seller?.name?.trim() ? null : 'Missing seller name (BT-27)',
  },
  {
    id: 'BR-7',
    description: 'An Invoice shall have a Buyer name (BT-44).',
    check: (inv) => inv.buyer?.name?.trim() ? null : 'Missing buyer name (BT-44)',
  },
  {
    id: 'BR-8',
    description: 'An Invoice shall have a Seller country code (BT-40).',
    check: (inv) =>
      inv.seller?.address?.countryCode?.trim()
        ? null
        : 'Missing seller country code (BT-40)',
  },
  {
    id: 'BR-9',
    description: 'Due date shall not be before issue date.',
    check: (inv) => {
      if (!inv.dueDate || !inv.issueDate) return null;
      return inv.dueDate >= inv.issueDate
        ? null
        : `Due date (${inv.dueDate}) is before issue date (${inv.issueDate})`;
    },
  },

  // ── Invoice lines ─────────────────────────────────────────────────────────

  {
    id: 'BR-16',
    description: 'An Invoice shall have at least one Invoice line.',
    check: (inv) => inv.lines.length > 0 ? null : 'Invoice must contain at least one line (BT-126)',
  },
  {
    id: 'BR-21',
    description: 'Each Invoice line shall have an Invoice line identifier (BT-126).',
    check: (inv) => {
      const bad = inv.lines.find((l) => !l.id?.trim());
      return bad ? `Line missing identifier (BT-126): "${bad.description}"` : null;
    },
  },
  {
    id: 'BR-25',
    description: 'Each Invoice line shall have an Invoice line net amount (BT-131).',
    check: (inv) => {
      const bad = inv.lines.find((l) => l.lineNetAmount == null || isNaN(l.lineNetAmount));
      return bad ? `Line "${bad.id}" missing net amount (BT-131)` : null;
    },
  },
  {
    id: 'BR-26',
    description: 'Each line billed quantity shall be positive.',
    check: (inv) => {
      const bad = inv.lines.find((l) => l.quantity <= 0);
      return bad ? `Line "${bad.id}" has non-positive quantity: ${bad.quantity}` : null;
    },
  },
  {
    id: 'BR-27',
    description: 'Each line unit price (BT-146) shall not be negative.',
    check: (inv) => {
      const bad = inv.lines.find((l) => l.unitPrice < 0);
      return bad ? `Line "${bad.id}" has negative unit price: ${bad.unitPrice}` : null;
    },
  },

  // ── Monetary totals ───────────────────────────────────────────────────────

  {
    id: 'BR-CO-10',
    description: 'Sum of Invoice line net amounts (BT-106) = Σ BT-131.',
    check: (inv) => {
      const computed = inv.lines.reduce((s, l) => s + l.lineNetAmount, 0);
      return near(computed, inv.sumOfLines)
        ? null
        : `Sum of line net amounts (${computed.toFixed(2)}) ≠ document sumOfLines (${inv.sumOfLines.toFixed(2)}) — BR-CO-10`;
    },
  },
  {
    id: 'BR-CO-11',
    description: 'Net total (BT-109) = BT-106 - BT-107 + BT-108.',
    check: (inv) => {
      const expected = inv.sumOfLines - inv.totalAllowances + inv.totalCharges;
      return near(expected, inv.taxExclusiveAmount)
        ? null
        : `taxExclusiveAmount (${inv.taxExclusiveAmount}) ≠ sumOfLines - allowances + charges (${expected.toFixed(2)}) — BR-CO-11`;
    },
  },
  {
    id: 'BR-CO-12',
    description: 'Gross total (BT-112) = BT-109 + BT-110.',
    check: (inv) => {
      const expected = inv.taxExclusiveAmount + inv.taxAmount;
      return near(expected, inv.taxInclusiveAmount)
        ? null
        : `taxInclusiveAmount (${inv.taxInclusiveAmount}) ≠ taxExclusiveAmount + taxAmount (${expected.toFixed(2)}) — BR-CO-12`;
    },
  },
  {
    id: 'BR-CO-13',
    description: 'Amount due (BT-115) = BT-112 - BT-113 + BT-114.',
    check: (inv) => {
      const expected = inv.taxInclusiveAmount - (inv.prepaidAmount ?? 0) + (inv.roundingAmount ?? 0);
      return near(expected, inv.duePayableAmount)
        ? null
        : `duePayableAmount (${inv.duePayableAmount}) ≠ taxInclusiveAmount - prepaid + rounding (${expected.toFixed(2)}) — BR-CO-13`;
    },
  },
  {
    id: 'BR-CO-14',
    description: 'Total VAT (BT-110) = Σ BT-117 (tax breakdown amounts).',
    check: (inv) => {
      const computed = inv.taxBreakdowns.reduce((s, t) => s + t.taxAmount, 0);
      return near(computed, inv.taxAmount)
        ? null
        : `Total VAT (${inv.taxAmount}) ≠ sum of breakdown tax amounts (${computed.toFixed(2)}) — BR-CO-14`;
    },
  },
  {
    id: 'BR-CO-15',
    description: 'Net total (BT-109) = Σ BT-116 (taxable amounts in breakdowns).',
    check: (inv) => {
      const computed = inv.taxBreakdowns.reduce((s, t) => s + t.taxableAmount, 0);
      return near(computed, inv.taxExclusiveAmount)
        ? null
        : `taxExclusiveAmount (${inv.taxExclusiveAmount}) ≠ sum of breakdown taxable amounts (${computed.toFixed(2)}) — BR-CO-15`;
    },
  },

  // ── VAT coherence ─────────────────────────────────────────────────────────

  {
    id: 'BR-CO-17',
    description: 'Each VAT breakdown: taxAmount ≈ taxableAmount × rate / 100.',
    check: (inv) => {
      for (const t of inv.taxBreakdowns) {
        if (t.categoryCode === 'E' || t.categoryCode === 'Z') continue; // exempt / zero
        const expected = t.taxableAmount * t.rate / 100;
        if (!near(expected, t.taxAmount)) {
          return `VAT breakdown rate=${t.rate}%: computed tax (${expected.toFixed(2)}) ≠ declared tax (${t.taxAmount.toFixed(2)}) — BR-CO-17`;
        }
      }
      return null;
    },
  },
  {
    id: 'BR-45',
    description: 'Each VAT breakdown shall have a category code (BT-118).',
    check: (inv) => {
      const bad = inv.taxBreakdowns.find((t) => !t.categoryCode?.trim());
      return bad ? `VAT breakdown missing category code (BT-118)` : null;
    },
  },

  // ── Identifiers ───────────────────────────────────────────────────────────

  {
    id: 'BR-FR-01',
    description: '[FR] Seller VAT number (BT-31) should be present for standard-rated B2B.',
    check: (inv) => {
      const hasStandardRate = inv.taxBreakdowns.some((t) => t.categoryCode === 'S' && t.rate > 0);
      if (!hasStandardRate) return null;
      return inv.seller.vatNumber
        ? null
        : 'FR rule: seller VAT number (BT-31) required for standard-rate invoice';
    },
  },
  {
    id: 'BR-FR-02',
    description: '[FR] Seller VAT number must start with "FR" for a French entity.',
    check: (inv) => {
      if (!inv.seller.vatNumber) return null;
      if (inv.seller.address.countryCode !== 'FR') return null;
      return inv.seller.vatNumber.startsWith('FR')
        ? null
        : `Seller country is FR but VAT number "${inv.seller.vatNumber}" does not start with "FR"`;
    },
  },
  {
    id: 'BR-FR-03',
    description: '[FR] SIREN (BT-30 schemeID=0002) must be 9 digits.',
    check: (inv) => {
      if (inv.seller.legalIdScheme !== '0002' || !inv.seller.legalId) return null;
      return /^\d{9}$/.test(inv.seller.legalId)
        ? null
        : `Seller SIREN "${inv.seller.legalId}" is not 9 digits (schemeID 0002)`;
    },
  },
  {
    id: 'BR-FR-04',
    description: '[FR] SIRET (BT-30 schemeID=0009) must be 14 digits.',
    check: (inv) => {
      if (inv.seller.legalIdScheme !== '0009' || !inv.seller.legalId) return null;
      return /^\d{14}$/.test(inv.seller.legalId)
        ? null
        : `Seller SIRET "${inv.seller.legalId}" is not 14 digits (schemeID 0009)`;
    },
  },

  // ── Line net amount coherence ─────────────────────────────────────────────

  {
    id: 'BR-CO-25',
    description: 'Invoice line net amount (BT-131) = BT-129 × BT-146 (rounded 2 decimals).',
    check: (inv) => {
      for (const line of inv.lines) {
        const expected = Math.round(line.quantity * line.unitPrice * 100) / 100;
        if (!near(expected, line.lineNetAmount)) {
          return `Line "${line.id}": quantity × unitPrice (${expected.toFixed(2)}) ≠ lineNetAmount (${line.lineNetAmount.toFixed(2)}) — BR-CO-25`;
        }
      }
      return null;
    },
  },
];

// ─── Public API ────────────────────────────────────────────────────────────────

export function applyBusinessRules(dto: EInvoiceDto): BusinessRuleError[] {
  const errors: BusinessRuleError[] = [];
  for (const rule of RULES) {
    const msg = rule.check(dto);
    if (msg) errors.push({ ruleId: rule.id, message: msg });
  }
  return errors;
}

/** Expose rule list for documentation / testing */
export const BUSINESS_RULES: ReadonlyArray<{ id: string; description: string }> = RULES.map(
  ({ id, description }) => ({ id, description }),
);
