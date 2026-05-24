/**
 * Round-trip test: Invoice DB → CII XML → parse → EInvoiceDto ≈ original DTO
 *
 * This test proves the CII mapper and parser are symmetric: no data is lost
 * or corrupted through the generate → serialize → parse cycle.
 *
 * Why this matters for the Yooz interview:
 *   "If the round-trip test passes, the mapping is non-destructive. If it fails,
 *   a field was silently dropped or mangled — exactly the kind of bug that makes
 *   a PDP non-compliant."
 */

import { describe, it, expect } from 'vitest';
import { generateCiiXml } from '../../services/einvoicing/facturx-generator.service';
import { parseCiiXml } from '../../services/einvoicing/facturx-parser.service';
import { invoiceToDto } from '../../services/einvoicing/cii-mapper';
import { applyBusinessRules } from '../../services/einvoicing/validators/business-rules';
import type { Invoice } from '../../types/invoice';
import type { EInvoiceParty } from '../../types/einvoice';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER: EInvoiceParty = {
  name: 'Acme Corp SAS',
  vatNumber: 'FR55444333222',
  legalId: '44433322200019',
  legalIdScheme: '0009',
  address: {
    line1: '12 rue de la Paix',
    city: 'Paris',
    postCode: '75001',
    countryCode: 'FR',
  },
};

const INVOICE: Invoice = {
  id: 42,
  supplierId: 1,
  supplier: {
    id: 1,
    name: 'Tech Solutions SARL',
    siret: '12345678900017',
    vatNumber: 'FR12345678900',
    iban: 'FR7630006000011234567890189',
    address: '8 avenue de la République, 69001 Lyon',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  invoiceNumber: 'TECH-2026-042',
  issueDate: '2026-05-01',
  dueDate: '2026-06-01',
  amountHt: 1000.00,
  amountTva: 200.00,
  amountTtc: 1200.00,
  currency: 'EUR',
  status: 'VALIDATED',
  filePath: 'uploads/test.pdf',
  fileMime: 'application/pdf',
  fileHash: null,
  ocrConfidence: null,
  riskAssessment: null,
  lines: [
    { id: 1, description: 'Développement logiciel', quantity: 5, unitPrice: 150.00, total: 750.00 },
    { id: 2, description: 'Consultation technique', quantity: 2.5, unitPrice: 100.00, total: 250.00 },
  ],
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-05-01T09:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Factur-X round-trip', () => {
  it('generates valid CII XML from an Invoice', () => {
    const xml = generateCiiXml(INVOICE, BUYER);

    expect(xml).toContain('CrossIndustryInvoice');
    expect(xml).toContain('TECH-2026-042');                    // BT-1
    expect(xml).toContain('20260501');                         // BT-2 format 102
    expect(xml).toContain('Tech Solutions SARL');              // BT-27
    expect(xml).toContain('Acme Corp SAS');                    // BT-44
    expect(xml).toContain('FR12345678900');                    // BT-31
    expect(xml).toContain('urn:cen.eu:en16931:2017');          // BT-24 EN16931
    expect(xml).toContain('1000.00');                          // BT-109
    expect(xml).toContain('1200.00');                          // BT-112
  });

  it('parses generated CII XML back to a matching DTO', () => {
    const xml = generateCiiXml(INVOICE, BUYER);
    const originalDto = invoiceToDto(INVOICE, BUYER);
    const parsedDto = parseCiiXml(xml);

    // ── Core identity ───────────────────────────────────────────────────────
    expect(parsedDto.invoiceNumber).toBe(originalDto.invoiceNumber);
    expect(parsedDto.issueDate).toBe(originalDto.issueDate);
    expect(parsedDto.dueDate).toBe(originalDto.dueDate);
    expect(parsedDto.currency).toBe(originalDto.currency);
    expect(parsedDto.typeCode).toBe(originalDto.typeCode);
    expect(parsedDto.profile).toBe(originalDto.profile);

    // ── Seller ───────────────────────────────────────────────────────────────
    expect(parsedDto.seller.name).toBe(originalDto.seller.name);
    expect(parsedDto.seller.vatNumber).toBe(originalDto.seller.vatNumber);

    // ── Buyer ────────────────────────────────────────────────────────────────
    expect(parsedDto.buyer.name).toBe(originalDto.buyer.name);

    // ── Lines ────────────────────────────────────────────────────────────────
    expect(parsedDto.lines).toHaveLength(originalDto.lines.length);
    for (let i = 0; i < originalDto.lines.length; i++) {
      const orig = originalDto.lines[i];
      const parsed = parsedDto.lines[i];
      expect(parsed.description).toBe(orig.description);
      expect(parsed.quantity).toBeCloseTo(orig.quantity, 2);
      expect(parsed.unitPrice).toBeCloseTo(orig.unitPrice, 2);
      expect(parsed.lineNetAmount).toBeCloseTo(orig.lineNetAmount, 2);
    }

    // ── Monetary totals ───────────────────────────────────────────────────────
    expect(parsedDto.sumOfLines).toBeCloseTo(originalDto.sumOfLines, 2);
    expect(parsedDto.taxExclusiveAmount).toBeCloseTo(originalDto.taxExclusiveAmount, 2);
    expect(parsedDto.taxAmount).toBeCloseTo(originalDto.taxAmount, 2);
    expect(parsedDto.taxInclusiveAmount).toBeCloseTo(originalDto.taxInclusiveAmount, 2);
    expect(parsedDto.duePayableAmount).toBeCloseTo(originalDto.duePayableAmount, 2);
  });

  it('parsed DTO passes all business rules', () => {
    const xml = generateCiiXml(INVOICE, BUYER);
    const parsedDto = parseCiiXml(xml);
    const errors = applyBusinessRules(parsedDto);

    // Expect no business rule violations on a well-formed invoice
    expect(errors).toEqual([]);
  });

  it('detects business rule violations on a corrupted invoice', () => {
    const xml = generateCiiXml(INVOICE, BUYER);
    const parsedDto = parseCiiXml(xml);

    // Corrupt the net total so BR-CO-10 fires
    const corrupted = {
      ...parsedDto,
      sumOfLines: parsedDto.sumOfLines + 99.99,
    };

    const errors = applyBusinessRules(corrupted);
    const brCo10 = errors.find((e) => e.ruleId === 'BR-CO-10');
    expect(brCo10).toBeDefined();
    expect(brCo10!.message).toContain('BR-CO-10');
  });

  it('detects invalid SIREN (BR-FR-03)', () => {
    const xml = generateCiiXml(INVOICE, BUYER);
    const parsedDto = parseCiiXml(xml);

    const corrupted = {
      ...parsedDto,
      seller: {
        ...parsedDto.seller,
        legalId: '12345',        // not 9 digits
        legalIdScheme: '0002',   // SIREN
      },
    };

    const errors = applyBusinessRules(corrupted);
    const brFr03 = errors.find((e) => e.ruleId === 'BR-FR-03');
    expect(brFr03).toBeDefined();
  });

  it('XML contains all mandatory EN 16931 namespaces', () => {
    const xml = generateCiiXml(INVOICE, BUYER);

    expect(xml).toContain('xmlns:rsm=');
    expect(xml).toContain('xmlns:ram=');
    expect(xml).toContain('xmlns:udt=');
    expect(xml).toContain('xmlns:qdt=');
  });

  it('date format 102 is YYYYMMDD (no dashes)', () => {
    const xml = generateCiiXml(INVOICE, BUYER);

    // Format 102 dates must NOT contain dashes
    const dateMatches = xml.match(/DateTimeString format="102">([^<]+)</g) ?? [];
    for (const match of dateMatches) {
      const date = match.replace(/.*>/, '').replace(/<.*/, '');
      expect(date).toMatch(/^\d{8}$/);
    }
  });

  it('amounts use dot decimal separator and 2 decimal places', () => {
    const xml = generateCiiXml(INVOICE, BUYER);

    // EN 16931 §7.1: no thousands separator, dot decimal
    expect(xml).not.toContain('1,000');  // thousands separator would break validation
    expect(xml).toContain('1000.00');
    expect(xml).toContain('1200.00');
  });
});
