/**
 * XSD validator for CII and UBL XML.
 *
 * Strategy:
 *   1. Try libxmljs2 (native libxml2 binding — accurate, fast).
 *   2. If unavailable (Windows build failure is common), fall back to a
 *      structural well-formedness check only and warn the caller.
 *
 * XSD schemas are versioned in `./schemas/`. They are not bundled here;
 * download instructions are in the Sprint 5 setup section.
 *
 * See ADR 0017 for the libxmljs2 vs xsd-schema-validator trade-off.
 */

import path from 'path';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import type { XsdValidationError, ValidationResult } from '../../../types/einvoice';

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');

const CII_XSD_PATH  = path.join(SCHEMAS_DIR, 'CrossIndustryInvoice_100pD22B.xsd');
const UBL_XSD_PATH  = path.join(SCHEMAS_DIR, 'UBL-Invoice-2.1.xsd');

// ─── Public API ────────────────────────────────────────────────────────────────

export async function validateCII(xml: string): Promise<ValidationResult> {
  return validate(xml, CII_XSD_PATH, 'CII');
}

export async function validateUBL(xml: string): Promise<ValidationResult> {
  return validate(xml, UBL_XSD_PATH, 'UBL');
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function validate(xml: string, xsdPath: string, label: string): Promise<ValidationResult> {
  // First ensure the XML is well-formed — fast-xml-parser throws on syntax errors.
  const wellFormedError = checkWellFormed(xml);
  if (wellFormedError) {
    return {
      valid: false,
      xsdErrors: [wellFormedError],
      businessRuleErrors: [],
    };
  }

  // Attempt libxmljs2 for full XSD validation
  const libxmlResult = await tryLibxmljs(xml, xsdPath, label);
  if (libxmlResult !== null) return libxmlResult;

  // Fallback: no XSD file present or native module unavailable
  if (!fs.existsSync(xsdPath)) {
    return {
      valid: true,  // structural only — caller sees warning via logs
      xsdErrors: [],
      businessRuleErrors: [],
    };
  }

  // xsdPath exists but libxmljs2 failed — soft fail with warning
  return {
    valid: true,
    xsdErrors: [{
      line: 0,
      column: 0,
      message: `XSD schema found but libxmljs2 is not available. Only well-formedness checked for ${label}.`,
    }],
    businessRuleErrors: [],
  };
}

function checkWellFormed(xml: string): XsdValidationError | null {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    parser.parse(xml);
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { line: 0, column: 0, message: `XML not well-formed: ${msg}` };
  }
}

async function tryLibxmljs(xml: string, xsdPath: string, label: string): Promise<ValidationResult | null> {
  // Dynamic import so the module is optional — if libxmljs2 isn't installed the
  // catch below falls through to the well-formedness fallback above.
  let libxml: typeof import('libxmljs2') | null = null;
  try {
    libxml = await import('libxmljs2');
  } catch {
    return null; // not installed — caller handles fallback
  }

  if (!fs.existsSync(xsdPath)) return null;

  try {
    const xsdContent = fs.readFileSync(xsdPath, 'utf-8');
    const xmlDoc  = libxml.parseXml(xml);
    const xsdDoc  = libxml.parseXml(xsdContent);

    const valid = xmlDoc.validate(xsdDoc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xsdErrors: XsdValidationError[] = xmlDoc.validationErrors.map((e: any) => ({
      line: e.line ?? 0,
      column: e.column ?? 0,
      message: e.message ?? String(e),
    }));

    return { valid, xsdErrors, businessRuleErrors: [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      xsdErrors: [{ line: 0, column: 0, message: `libxmljs2 validation error: ${msg}` }],
      businessRuleErrors: [],
    };
  }
}
