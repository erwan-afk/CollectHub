/**
 * Quick test: generate a Factur-X PDF directly (bypasses HTTP server).
 * Usage: npx ts-node --transpile-only scripts/test-facturx-direct.ts
 */
import { buildPdfA3 } from '../src/services/einvoicing/pdf-a3-builder';
import { generateCiiXml } from '../src/services/einvoicing/facturx-generator.service';
import { parseCiiXml } from '../src/services/einvoicing/facturx-parser.service';
import { applyBusinessRules } from '../src/services/einvoicing/validators/business-rules';
import fs from 'fs';
import path from 'path';
import type { Invoice } from '../src/types/invoice';
import type { EInvoiceParty } from '../src/types/einvoice';

const BUYER: EInvoiceParty = {
  name: 'Acme Corp SAS',
  vatNumber: 'FR55444333222',
  address: { countryCode: 'FR' },
};

const INVOICE: Invoice = {
  id: 1,
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
  invoiceNumber: 'FACT-2026-001',
  issueDate: '2026-05-15',
  dueDate: '2026-06-15',
  amountHt: 1000.00,
  amountTva: 200.00,
  amountTtc: 1200.00,
  currency: 'EUR',
  status: 'VALIDATED',
  filePath: 'test.pdf',
  fileMime: 'application/pdf',
  fileHash: null,
  ocrConfidence: null,
  riskAssessment: null,
  lines: [
    { id: 1, description: 'Développement logiciel', quantity: 5, unitPrice: 150.00, total: 750.00 },
    { id: 2, description: 'Consultation technique', quantity: 2.5, unitPrice: 100.00, total: 250.00 },
  ],
  createdAt: '2026-05-15T09:00:00.000Z',
  updatedAt: '2026-05-15T09:00:00.000Z',
};

async function main() {
  console.log('1. Generating CII XML...');
  const xml = generateCiiXml(INVOICE, BUYER);
  console.log(`   XML size: ${xml.length} chars`);

  console.log('2. Validating XML against business rules...');
  const dto = parseCiiXml(xml);
  const errors = applyBusinessRules(dto);
  if (errors.length > 0) {
    console.log('   ❌ Business rule violations:');
    for (const e of errors) console.log(`      ${e.ruleId}: ${e.message}`);
  } else {
    console.log('   ✅ All business rules passed');
  }

  console.log('3. Building PDF/A-3...');
  const pdf = await buildPdfA3(INVOICE, xml);
  console.log(`   PDF size: ${pdf.length} bytes`);

  // Check PDF header
  const header = pdf.slice(0, 5).toString('ascii');
  console.log(`   Header: "${header}"`);

  if (header !== '%PDF-') {
    console.log('   ❌ Not a valid PDF header');
  } else {
    console.log('   ✅ Valid PDF header');
  }

  // Check for embedded XML
  const hasXml = pdf.toString('latin1').includes('factur-x.xml');
  console.log(`   factur-x.xml embedded: ${hasXml ? '✅' : '❌'}`);

  const outDir = path.resolve(__dirname, '..', 'test-invoices');
  const outPath = path.join(outDir, '06-facturx-genere.pdf');
  fs.writeFileSync(outPath, pdf);
  console.log(`\n✅ Saved to: ${outPath}`);
  console.log(`   Open with: start "${outPath}"`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
