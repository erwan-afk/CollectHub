/**
 * Factur-X parser — ingestion pipeline
 *
 * 1. Extract "factur-x.xml" (or "xrechnung.xml") from the PDF's embedded files.
 * 2. Parse the CII XML with fast-xml-parser (namespace-aware).
 * 3. Map CII Business Terms → EInvoiceDto.
 * 4. Detect the Factur-X profile from GuidelineSpecifiedDocumentContextParameter.
 */

import { PDFDocument, PDFDict, PDFString, PDFName } from 'pdf-lib';
import { XMLParser } from 'fast-xml-parser';
import type {
  EInvoiceDto,
  EInvoiceParty,
  EInvoiceLine,
  EInvoiceTaxBreakdown,
  FacturXProfile,
} from '../../types/einvoice';
import { GUIDELINE_URN } from '../../types/einvoice';

// ─── Known attachment filenames (per spec + German XRechnung variant) ─────────
const KNOWN_XML_NAMES = ['factur-x.xml', 'xrechnung.xml', 'zugferd-invoice.xml'];

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ParseResult {
  dto: EInvoiceDto;
  rawXml: string;
  profile: FacturXProfile;
  warnings: string[];
}

export async function parseFacturX(pdfBuffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];

  const xml = await extractXmlFromPdf(pdfBuffer, warnings);
  const dto = parseCiiXml(xml, warnings);

  return { dto, rawXml: xml, profile: dto.profile, warnings };
}

/** Parse a raw CII XML string directly (used in round-trip tests). */
export function parseCiiXml(xml: string, warnings: string[] = []): EInvoiceDto {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Remove CII namespace prefixes so we can access nodes uniformly.
    // fast-xml-parser doesn't support namespace resolution natively; we strip them.
    transformTagName: (tag) => tag.replace(/^[a-zA-Z]+:/, ''),
  });

  const doc = parser.parse(xml);
  const root = doc['CrossIndustryInvoice'];
  if (!root) throw new Error('Invalid CII XML: missing CrossIndustryInvoice root element');

  return mapCiiToDto(root, warnings);
}

// ─── Extract embedded XML from PDF ────────────────────────────────────────────

/**
 * Extracts the CII XML attachment from a Factur-X PDF/A-3.
 *
 * Strategy A: pdf-lib object walk — finds the EmbeddedFile stream by scanning
 * all indirect objects for a filespec dict whose /F value matches a known name.
 *
 * Strategy B (fallback): raw byte scan — searches the PDF bytes directly for
 * the XML declaration + CrossIndustryInvoice root. Works even when Strategy A
 * fails due to pdf-lib version differences in object iteration.
 */
async function extractXmlFromPdf(pdfBuffer: Buffer, warnings: string[]): Promise<string> {
  // Strategy A: structured walk via pdf-lib
  try {
    const xml = await extractViaStructuredWalk(pdfBuffer);
    if (xml) return xml;
  } catch {
    warnings.push('Structured PDF walk failed, falling back to byte scan');
  }

  // Strategy B: raw scan for XML content in the PDF bytes
  const xml = extractViaRawScan(pdfBuffer);
  if (xml) return xml;

  warnings.push('No known Factur-X attachment found');
  throw new Error('Could not locate factur-x.xml in embedded files');
}

async function extractViaStructuredWalk(pdfBuffer: Buffer): Promise<string | null> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const context = pdfDoc.context;

  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;

    const fVal = obj.get(PDFName.of('F'));
    const ufVal = obj.get(PDFName.of('UF'));
    const nameVal = fVal ?? ufVal;
    if (!nameVal) continue;

    const fname = nameVal instanceof PDFString ? nameVal.decodeText() : nameVal.toString();
    if (!KNOWN_XML_NAMES.some((n) => fname.toLowerCase().endsWith(n))) continue;

    const efDict = obj.get(PDFName.of('EF'));
    if (!(efDict instanceof PDFDict)) continue;

    const streamRef = efDict.get(PDFName.of('F')) ?? efDict.get(PDFName.of('UF'));
    if (!streamRef) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamObj = context.lookup(streamRef as any) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bytes: Uint8Array | undefined = streamObj?.contents ?? streamObj?.getContents?.();
    if (bytes) return Buffer.from(bytes).toString('utf-8');
  }
  return null;
}

function extractViaRawScan(pdfBuffer: Buffer): string | null {
  // CII XML always starts with <?xml and contains CrossIndustryInvoice
  const pdfText = pdfBuffer.toString('latin1'); // latin1 preserves raw bytes
  const xmlStart = pdfText.indexOf('<?xml');
  if (xmlStart === -1) return null;

  // Find the closing tag of the CII root element
  const endTag = '</rsm:CrossIndustryInvoice>';
  const xmlEnd = pdfText.indexOf(endTag, xmlStart);
  if (xmlEnd === -1) return null;

  return pdfText.slice(xmlStart, xmlEnd + endTag.length);
}

// ─── CII → EInvoiceDto mapping ─────────────────────────────────────────────────

/** Extract a text value from a fast-xml-parser node (string or {#text, @_attr} object). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getText(v: any): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && v !== null) {
    if ('#text' in v) return String(v['#text']);
  }
  return String(v ?? '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCiiToDto(root: any, warnings: string[]): EInvoiceDto {
  const ctx = root['ExchangedDocumentContext'];
  const hdr = root['ExchangedDocument'];
  const tx = root['SupplyChainTradeTransaction'];

  // Profile detection (BT-24)
  const guidelineUrn = ctx?.['GuidelineSpecifiedDocumentContextParameter']?.['ID'] ?? '';
  const profile: FacturXProfile = GUIDELINE_URN[guidelineUrn] ?? 'EN16931';
  if (!GUIDELINE_URN[guidelineUrn]) {
    warnings.push(`Unknown guideline URN: "${guidelineUrn}" — defaulting to EN16931`);
  }

  // Header (BT-1, BT-2, BT-3)
  const invoiceNumber = getText(hdr?.['ID']);
  const issueDateRaw = getText(hdr?.['IssueDateTime']?.['DateTimeString']);
  const issueDate = parseFormat102(issueDateRaw);
  const typeCode = getText(hdr?.['TypeCode']) || '380';
  const note = hdr?.['IncludedNote']?.['Content'] ?? undefined;

  const agreement = tx?.['ApplicableHeaderTradeAgreement'];
  const settlement = tx?.['ApplicableHeaderTradeSettlement'];

  // Currency (BT-5)
  const currency = getText(settlement?.['InvoiceCurrencyCode']) || 'EUR';

  // Buyer reference (BT-10)
  const buyerReference = agreement?.['BuyerReference'] ?? undefined;
  const purchaseOrderRef =
    agreement?.['BuyerOrderReferencedDocument']?.['IssuerAssignedID'] ?? undefined;
  const contractRef = agreement?.['ContractReferencedDocument']?.['IssuerAssignedID'] ?? undefined;

  // Due date (BT-9) — inside SpecifiedTradePaymentTerms
  const paymentTermsNode = settlement?.['SpecifiedTradePaymentTerms'];
  const dueDateRaw = paymentTermsNode?.['DueDateDateTime']?.['DateTimeString'];
  const dueDate = dueDateRaw ? parseFormat102(getText(dueDateRaw)) : undefined;
  const paymentTerms = paymentTermsNode?.['Description'] ?? undefined;

  // Parties
  const seller = mapParty(agreement?.['SellerTradeParty'], warnings);
  const buyer = mapParty(agreement?.['BuyerTradeParty'], warnings);

  // Lines
  const rawLines = tx?.['IncludedSupplyChainTradeLineItem'];
  const linesArray = rawLines == null ? [] : Array.isArray(rawLines) ? rawLines : [rawLines];
  const lines: EInvoiceLine[] = linesArray.map(mapLine);

  // Tax breakdowns
  const rawTax = settlement?.['ApplicableTradeTax'];
  const taxArray = rawTax == null ? [] : Array.isArray(rawTax) ? rawTax : [rawTax];
  const taxBreakdowns: EInvoiceTaxBreakdown[] = taxArray.map(mapTaxBreakdown);

  // Monetary totals
  const totals = settlement?.['SpecifiedTradeSettlementHeaderMonetarySummation'];
  const sumOfLines = parseDecimal(totals?.['LineTotalAmount']);
  const totalAllowances = parseDecimal(totals?.['AllowanceTotalAmount']);
  const totalCharges = parseDecimal(totals?.['ChargeTotalAmount']);
  const taxExclusiveAmount = parseDecimal(totals?.['TaxBasisTotalAmount']);
  const taxAmount = parseDecimal(totals?.['TaxTotalAmount']);
  const taxInclusiveAmount = parseDecimal(totals?.['GrandTotalAmount']);
  const prepaidAmount =
    totals?.['TotalPrepaidAmount'] != null
      ? parseDecimal(totals?.['TotalPrepaidAmount'])
      : undefined;
  const duePayableAmount = parseDecimal(totals?.['DuePayableAmount']);

  // Payment means
  const pmNode = settlement?.['SpecifiedTradeSettlementPaymentMeans'];
  const paymentMeans = pmNode
    ? {
        typeCode: getText(pmNode['TypeCode']),
        iban: pmNode?.['PayeePartyCreditorFinancialAccount']?.['IBANID'] ?? undefined,
        bic: pmNode?.['PayeeSpecifiedCreditorFinancialInstitution']?.['BICID'] ?? undefined,
      }
    : undefined;

  return {
    profile,
    invoiceNumber,
    issueDate,
    dueDate,
    typeCode,
    currency,
    note: note ? getText(note) : undefined,
    buyerReference: buyerReference ? getText(buyerReference) : undefined,
    purchaseOrderRef: purchaseOrderRef ? getText(purchaseOrderRef) : undefined,
    contractRef: contractRef ? getText(contractRef) : undefined,
    paymentTerms: paymentTerms ? getText(paymentTerms) : undefined,
    seller,
    buyer,
    lines,
    taxBreakdowns,
    sumOfLines,
    totalAllowances,
    totalCharges,
    taxExclusiveAmount,
    taxInclusiveAmount,
    taxAmount,
    prepaidAmount,
    duePayableAmount,
    paymentMeans,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapParty(node: any, warnings: string[]): EInvoiceParty {
  if (!node) {
    warnings.push('Missing party node in CII XML');
    return { name: 'Unknown', address: { countryCode: 'FR' } };
  }

  const legalOrg = node['SpecifiedLegalOrganization'];
  const taxReg = node['SpecifiedTaxRegistration'];
  const addr = node['PostalTradeAddress'];

  return {
    name: getText(node['Name']),
    tradingName: node['TradingName'] ? String(node['TradingName']) : undefined,
    vatNumber: taxReg?.['ID'] ? String(taxReg['ID']['#text'] ?? taxReg['ID']) : undefined,
    legalId: legalOrg?.['ID'] ? String(legalOrg['ID']['#text'] ?? legalOrg['ID']) : undefined,
    legalIdScheme: legalOrg?.['ID']?.['@_schemeID'] ?? undefined,
    address: {
      line1: addr?.['LineOne'] ? String(addr['LineOne']) : undefined,
      line2: addr?.['LineTwo'] ? String(addr['LineTwo']) : undefined,
      city: addr?.['CityName'] ? String(addr['CityName']) : undefined,
      postCode: addr?.['PostcodeCode'] ? String(addr['PostcodeCode']) : undefined,
      countryCode: String(addr?.['CountryID'] ?? 'FR'),
    },
    contactName: node['DefinedTradeContact']?.['PersonName']
      ? String(node['DefinedTradeContact']['PersonName'])
      : undefined,
    contactEmail: node['DefinedTradeContact']?.['EmailURIUniversalCommunication']?.['URIID']
      ? String(node['DefinedTradeContact']['EmailURIUniversalCommunication']['URIID'])
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLine(node: any): EInvoiceLine {
  const docLine = node['AssociatedDocumentLineDocument'];
  const product = node['SpecifiedTradeProduct'];
  const delivery = node['SpecifiedLineTradeDelivery'];
  const agreement = node['SpecifiedLineTradeAgreement'];
  const lineSett = node['SpecifiedLineTradeSettlement'];

  const quantityNode = delivery?.['BilledQuantity'];
  const quantity = parseDecimal(
    typeof quantityNode === 'object' ? quantityNode?.['#text'] : quantityNode,
  );
  const unitCode =
    typeof quantityNode === 'object' ? (quantityNode?.['@_unitCode'] ?? 'C62') : 'C62';

  const unitPrice = parseDecimal(agreement?.['NetPriceProductTradePrice']?.['ChargeAmount']);
  const lineNetAmount = parseDecimal(
    lineSett?.['SpecifiedTradeSettlementLineMonetarySummation']?.['LineTotalAmount'],
  );

  const taxNode = lineSett?.['ApplicableTradeTax'];

  return {
    id: String(docLine?.['LineID'] ?? ''),
    description: String(product?.['Name'] ?? ''),
    note: docLine?.['IncludedNote']?.['Content']
      ? String(docLine['IncludedNote']['Content'])
      : undefined,
    quantity,
    unitCode: String(unitCode),
    unitPrice,
    lineNetAmount,
    sellerItemId: product?.['SellerAssignedID'] ? String(product['SellerAssignedID']) : undefined,
    buyerItemId: product?.['BuyerAssignedID'] ? String(product['BuyerAssignedID']) : undefined,
    taxRate:
      taxNode?.['RateApplicablePercent'] != null
        ? parseDecimal(taxNode['RateApplicablePercent'])
        : undefined,
    taxCategoryCode: taxNode?.['CategoryCode'] ? String(taxNode['CategoryCode']) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTaxBreakdown(node: any): EInvoiceTaxBreakdown {
  return {
    taxableAmount: parseDecimal(node?.['BasisAmount']),
    taxAmount: parseDecimal(node?.['CalculatedAmount']),
    rate: parseDecimal(node?.['RateApplicablePercent']),
    categoryCode: String(node?.['CategoryCode'] ?? 'S'),
    exemptionReason: node?.['ExemptionReason'] ? String(node['ExemptionReason']) : undefined,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Parse CII date format 102 (YYYYMMDD) → ISO YYYY-MM-DD */
function parseFormat102(s: string): string {
  if (!s || s.length < 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDecimal(v: any): number {
  const n = parseFloat(getText(v) || '0');
  return isNaN(n) ? 0 : n;
}
