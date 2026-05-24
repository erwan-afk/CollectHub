/**
 * PDF round-trip test: Invoice → Factur-X PDF → parse → verify
 */
import { buildPdfA3 } from '../src/services/einvoicing/pdf-a3-builder';
import { generateCiiXml } from '../src/services/einvoicing/facturx-generator.service';
import { parseFacturX } from '../src/services/einvoicing/facturx-parser.service';
import { applyBusinessRules } from '../src/services/einvoicing/validators/business-rules';
import type { Invoice } from '../src/types/invoice';
import type { EInvoiceParty } from '../src/types/einvoice';

const BUYER: EInvoiceParty = {
  name: 'Acme Corp',
  address: { countryCode: 'FR' },
};

const INVOICE: Invoice = {
  id: 1,
  supplierId: 1,
  supplier: {
    id: 1,
    name: 'Tech SARL',
    siret: '12345678900017',
    vatNumber: 'FR12345678900',
    iban: 'FR7630006000011234567890189',
    address: 'Lyon',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  invoiceNumber: 'T-001',
  issueDate: '2026-05-15',
  dueDate: '2026-06-15',
  amountHt: 1000,
  amountTva: 200,
  amountTtc: 1200,
  currency: 'EUR',
  status: 'VALIDATED',
  filePath: 'x',
  fileMime: 'pdf',
  fileHash: null,
  ocrConfidence: null,
  riskAssessment: null,
  lines: [
    { id: 1, description: 'Dev', quantity: 5, unitPrice: 150, total: 750 },
    { id: 2, description: 'Consult', quantity: 2.5, unitPrice: 100, total: 250 },
  ],
  createdAt: '2026-05-15T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z',
};

async function main() {
  const xml = generateCiiXml(INVOICE, BUYER);
  const pdf = await buildPdfA3(INVOICE, xml);
  console.log('PDF généré :', pdf.length, 'bytes');

  const result = await parseFacturX(pdf);
  console.log('Profil  :', result.profile);
  console.log('N°      :', result.dto.invoiceNumber);
  console.log('TTC     :', result.dto.taxInclusiveAmount);
  console.log('Lignes  :', result.dto.lines.length);
  console.log(
    'Warnings:',
    result.warnings.length,
    result.warnings.length ? '(' + result.warnings.join(', ') + ')' : '',
  );

  const errors = applyBusinessRules(result.dto);
  console.log('Règles  :', errors.length === 0 ? 'OK' : errors.length + ' erreurs');

  // Expected: Strategy A (pdf-lib) may warn about non-standard xref.
  // The raw byte fallback (Strategy B) extracts the XML correctly.
  const unexpectedWarnings = result.warnings.filter(
    (w) => !w.includes('falling back to byte scan'),
  );

  const ok =
    result.dto.invoiceNumber === 'T-001' &&
    result.dto.taxInclusiveAmount === 1200 &&
    result.dto.lines.length === 2 &&
    result.dto.profile === 'EN16931' &&
    errors.length === 0 &&
    unexpectedWarnings.length === 0;

  console.log(ok ? '✅ PDF ROUND-TRIP OK' : '❌ ÉCHEC');
  process.exit(ok ? 0 : 1);
}

main();
