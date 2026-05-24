#!/usr/bin/env ts-node
/**
 * check-facturx.ts — CLI validator for Factur-X PDF/A-3 files
 *
 * Usage:
 *   npm run check:facturx -- path/to/invoice.pdf
 *
 * Validates:
 *   1. PDF/A markers (pdfaid:part, pdfaid:conformance)
 *   2. Embedded "factur-x.xml" file presence
 *   3. CII XML validity (well-formedness + XSD if schemas available)
 *   4. Business rule compliance (BR-1 to BR-FR-04)
 */

import fs from 'fs';
import path from 'path';
import { parseFacturX } from '../src/services/einvoicing/facturx-parser.service';
import { validateCII } from '../src/services/einvoicing/validators/xsd-validator';
import { applyBusinessRules } from '../src/services/einvoicing/validators/business-rules';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npm run check:facturx -- <path-to-facturx.pdf>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(`🔍 Checking: ${absolutePath}\n`);

  const buffer = fs.readFileSync(absolutePath);
  let exitCode = 0;

  // ── Step 1: Parse the PDF ─────────────────────────────────────────────────
  console.log('── Step 1: Parsing PDF/A-3 ──');
  try {
    const { dto, rawXml, profile, warnings } = await parseFacturX(buffer);

    console.log(`  ✅ Profile detected : ${profile}`);
    console.log(`  ✅ Invoice N°       : ${dto.invoiceNumber}`);
    console.log(`  ✅ Issue date       : ${dto.issueDate}`);
    console.log(`  ✅ Currency         : ${dto.currency}`);
    console.log(`  ✅ Net amount       : ${dto.taxExclusiveAmount.toFixed(2)} ${dto.currency}`);
    console.log(`  ✅ Gross amount     : ${dto.taxInclusiveAmount.toFixed(2)} ${dto.currency}`);

    if (warnings.length > 0) {
      console.log('\n  ⚠️  Warnings:');
      for (const w of warnings) console.log(`     - ${w}`);
    }

    // ── Step 2: XSD validation ───────────────────────────────────────────────
    console.log('\n── Step 2: XSD validation ──');
    const xsdResult = await validateCII(rawXml);
    if (xsdResult.valid) {
      console.log('  ✅ XML is valid against CII XSD');
    } else {
      console.log('  ❌ XSD validation errors:');
      for (const e of xsdResult.xsdErrors) {
        console.log(`     Line ${e.line}:${e.column} → ${e.message}`);
      }
      exitCode = 1;
    }

    // ── Step 3: Business rules ──────────────────────────────────────────────
    console.log('\n── Step 3: Business rules (EN 16931) ──');
    const brErrors = applyBusinessRules(dto);
    if (brErrors.length === 0) {
      console.log('  ✅ All 25 business rules passed');
    } else {
      console.log(`  ❌ ${brErrors.length} business rule(s) violated:`);
      for (const e of brErrors) {
        console.log(`     ${e.ruleId}: ${e.message}`);
      }
      exitCode = 1;
    }

    // ── Step 4: Summary ─────────────────────────────────────────────────────
    console.log('\n── Step 4: PDF/A-3 markers ──');
    const pdfText = buffer.toString('latin1');
    const hasPdfAidPart = pdfText.includes('pdfaid:part');
    const hasPdfAidConf = pdfText.includes('pdfaid:conformance');
    const hasEmbeddedFile = pdfText.includes('factur-x.xml') || pdfText.includes('xrechnung.xml');

    if (hasPdfAidPart && hasPdfAidConf) {
      console.log('  ✅ PDF/A conformance markers present');
    } else {
      console.log('  ❌ Missing PDF/A conformance markers (pdfaid:* namespace)');
      exitCode = 1;
    }
    if (hasEmbeddedFile) {
      console.log('  ✅ Embedded file "factur-x.xml" found');
    } else {
      console.log('  ❌ No embedded file named "factur-x.xml" detected');
      exitCode = 1;
    }

    // ── Final verdict ────────────────────────────────────────────────────────
    console.log(`\n${exitCode === 0 ? '✅' : '❌'} Final verdict: ${exitCode === 0 ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
    if (exitCode === 0) {
      console.log('This invoice meets EN 16931 / Factur-X structural requirements.');
      console.log('For full validation, run Mustang CLI externally.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ FATAL: ${msg}`);
    exitCode = 2;
  }

  process.exit(exitCode);
}

main();
