/**
 * UBL 2.1 parser — same output contract as the Factur-X parser: EInvoiceDto.
 *
 * UBL uses cbc: (common basic component) and cac: (common aggregate component)
 * namespaces instead of CII's ram:/udt:/rsm:.
 * The root element is <Invoice> (or <CreditNote> for BT-3=381).
 *
 * Used for Peppol B2B flows — see Sprint 5 roadmap §3.
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  EInvoiceDto,
  EInvoiceParty,
  EInvoiceLine,
  EInvoiceTaxBreakdown,
  FacturXProfile,
} from '../../types/einvoice';

// ─── Public API ────────────────────────────────────────────────────────────────

export function parseUblXml(xml: string): EInvoiceDto {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    transformTagName: (tag) => tag.replace(/^[a-zA-Z]+:/, ''),
  });

  const doc = parser.parse(xml);
  // Support both <Invoice> and <CreditNote> root elements
  const root = doc['Invoice'] ?? doc['CreditNote'];
  if (!root) throw new Error('Invalid UBL XML: missing Invoice or CreditNote root element');

  return mapUblToDto(root);
}

// ─── UBL → EInvoiceDto mapping ────────────────────────────────────────────────

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
function mapUblToDto(root: any): EInvoiceDto {
  // Profile — UBL uses CustomizationID (equivalent to CII's GuidelineURN)
  const customizationId = String(root['CustomizationID'] ?? '');
  const profile: FacturXProfile = customizationId.includes('en16931') ? 'EN16931' : 'BASIC';

  const invoiceNumber = String(root['ID'] ?? '');
  const issueDate = String(root['IssueDate'] ?? '');
  const dueDate = root['DueDate'] ? String(root['DueDate']) : undefined;
  const typeCode = String(root['InvoiceTypeCode'] ?? '380');
  const currency = String(root['DocumentCurrencyCode'] ?? 'EUR');
  const buyerReference = root['BuyerReference'] ? String(root['BuyerReference']) : undefined;
  const purchaseOrderRef = root['OrderReference']?.['ID']
    ? String(root['OrderReference']['ID'])
    : undefined;
  const contractRef = root['ContractDocumentReference']?.['ID']
    ? String(root['ContractDocumentReference']['ID'])
    : undefined;
  const note = root['Note'] ? String(root['Note']) : undefined;
  const paymentTerms = root['PaymentTerms']?.['Note']
    ? String(root['PaymentTerms']['Note'])
    : undefined;

  const seller = mapUblParty(root['AccountingSupplierParty']?.['Party']);
  const buyer = mapUblParty(root['AccountingCustomerParty']?.['Party']);

  // Lines
  const rawLines = root['InvoiceLine'] ?? root['CreditNoteLine'];
  const linesArray = rawLines == null ? [] : Array.isArray(rawLines) ? rawLines : [rawLines];
  const lines: EInvoiceLine[] = linesArray.map(mapUblLine);

  // Tax breakdowns
  const rawTax = root['TaxTotal']?.['TaxSubtotal'];
  const taxArray = rawTax == null ? [] : Array.isArray(rawTax) ? rawTax : [rawTax];
  const taxBreakdowns: EInvoiceTaxBreakdown[] = taxArray.map(mapUblTaxSubtotal);

  // Monetary totals — UBL uses LegalMonetaryTotal
  const lmt = root['LegalMonetaryTotal'];
  const sumOfLines = parseDecimal(lmt?.['LineExtensionAmount']);
  const totalAllowances = parseDecimal(lmt?.['AllowanceTotalAmount']);
  const totalCharges = parseDecimal(lmt?.['ChargeTotalAmount']);
  const taxExclusiveAmount = parseDecimal(lmt?.['TaxExclusiveAmount']);
  const taxInclusiveAmount = parseDecimal(lmt?.['TaxInclusiveAmount']);
  const taxAmount = parseDecimal(root['TaxTotal']?.['TaxAmount']);
  const prepaidAmount =
    lmt?.['PrepaidAmount'] != null ? parseDecimal(lmt['PrepaidAmount']) : undefined;
  const duePayableAmount = parseDecimal(lmt?.['PayableAmount']);

  // Payment means
  const pmNode = root['PaymentMeans'];
  const paymentMeans = pmNode
    ? {
        typeCode: String(pmNode['PaymentMeansCode'] ?? ''),
        iban: pmNode?.['PayeeFinancialAccount']?.['ID']
          ? String(pmNode['PayeeFinancialAccount']['ID'])
          : undefined,
        bic: pmNode?.['PayeeFinancialAccount']?.['FinancialInstitutionBranch']?.['ID']
          ? String(pmNode['PayeeFinancialAccount']['FinancialInstitutionBranch']['ID'])
          : undefined,
      }
    : undefined;

  return {
    profile,
    invoiceNumber,
    issueDate,
    dueDate,
    typeCode,
    currency,
    note,
    buyerReference,
    purchaseOrderRef,
    contractRef,
    paymentTerms,
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
function mapUblParty(node: any): EInvoiceParty {
  if (!node) return { name: 'Unknown', address: { countryCode: 'FR' } };

  const addr = node['PostalAddress'];
  const taxScheme = node['PartyTaxScheme'];
  const legalEntity = node['PartyLegalEntity'];

  return {
    name: String(node['PartyName']?.['Name'] ?? legalEntity?.['RegistrationName'] ?? ''),
    vatNumber: taxScheme?.['CompanyID'] ? String(taxScheme['CompanyID']) : undefined,
    legalId: legalEntity?.['CompanyID'] ? String(legalEntity['CompanyID']) : undefined,
    address: {
      line1: addr?.['StreetName'] ? String(addr['StreetName']) : undefined,
      line2: addr?.['AdditionalStreetName'] ? String(addr['AdditionalStreetName']) : undefined,
      city: addr?.['CityName'] ? String(addr['CityName']) : undefined,
      postCode: addr?.['PostalZone'] ? String(addr['PostalZone']) : undefined,
      countryCode: String(addr?.['Country']?.['IdentificationCode'] ?? 'FR'),
    },
    contactName: node['Contact']?.['Name'] ? String(node['Contact']['Name']) : undefined,
    contactEmail: node['Contact']?.['ElectronicMail']
      ? String(node['Contact']['ElectronicMail'])
      : undefined,
    contactPhone: node['Contact']?.['Telephone'] ? String(node['Contact']['Telephone']) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUblLine(node: any): EInvoiceLine {
  const quantity = parseDecimal(
    typeof node['InvoicedQuantity'] === 'object'
      ? node['InvoicedQuantity']['#text']
      : (node['InvoicedQuantity'] ?? node['CreditedQuantity']),
  );
  const unitCode = String(
    (typeof node['InvoicedQuantity'] === 'object'
      ? node['InvoicedQuantity']['@_unitCode']
      : undefined) ?? 'C62',
  );

  const item = node['Item'];
  const price = node['Price'];
  const taxCategory = item?.['ClassifiedTaxCategory'];

  return {
    id: String(node['ID'] ?? ''),
    description: String(item?.['Description'] ?? item?.['Name'] ?? ''),
    quantity,
    unitCode,
    unitPrice: parseDecimal(price?.['PriceAmount']),
    lineNetAmount: parseDecimal(node['LineExtensionAmount']),
    sellerItemId: item?.['SellersItemIdentification']?.['ID']
      ? String(item['SellersItemIdentification']['ID'])
      : undefined,
    buyerItemId: item?.['BuyersItemIdentification']?.['ID']
      ? String(item['BuyersItemIdentification']['ID'])
      : undefined,
    taxRate: taxCategory?.['Percent'] != null ? parseDecimal(taxCategory['Percent']) : undefined,
    taxCategoryCode: taxCategory?.['ID'] ? String(taxCategory['ID']) : undefined,
    note: node['Note'] ? String(node['Note']) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUblTaxSubtotal(node: any): EInvoiceTaxBreakdown {
  const cat = node['TaxCategory'];
  return {
    taxableAmount: parseDecimal(node['TaxableAmount']),
    taxAmount: parseDecimal(node['TaxAmount']),
    rate: parseDecimal(cat?.['Percent']),
    categoryCode: String(cat?.['ID'] ?? 'S'),
    exemptionReason: cat?.['TaxExemptionReason'] ? String(cat['TaxExemptionReason']) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDecimal(v: any): number {
  const n = parseFloat(getText(v) || '0');
  return isNaN(n) ? 0 : n;
}
