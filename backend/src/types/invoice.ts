export type InvoiceStatus =
  | 'PROCESSING'
  | 'DRAFT'
  | 'PENDING_VALIDATION'
  | 'VALIDATED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface RiskAssessment {
  score: number;
  flags: string[];
}

export interface Supplier {
  id: number;
  name: string;
  siret: string | null;
  vatNumber: string | null;
  iban: string | null;
  address: string | null;
  createdAt: string;
}

export interface SupplierRow {
  id: number;
  name: string;
  siret: string | null;
  vat_number: string | null;
  iban: string | null;
  address: string | null;
  created_at: Date | string;
}

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceLineRow {
  id: number;
  invoice_id: number;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  total: string | number;
  position: number;
}

export interface InvoiceStatusHistoryEntry {
  id: number;
  fromStatus: InvoiceStatus | null;
  toStatus: InvoiceStatus;
  reason: string | null;
  actor: string;
  createdAt: string;
}

export interface InvoiceStatusHistoryRow {
  id: number;
  invoice_id: number;
  from_status: InvoiceStatus | null;
  to_status: InvoiceStatus;
  reason: string | null;
  actor: string;
  created_at: Date | string;
}

export type ConfidenceMap = Partial<
  Record<
    | 'invoice_number'
    | 'issue_date'
    | 'due_date'
    | 'amount_ht'
    | 'amount_tva'
    | 'amount_ttc'
    | 'supplier'
    | 'siret'
    | 'iban',
    number
  >
>;

export interface Invoice {
  id: number;
  supplierId: number | null;
  supplier?: Supplier | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTva: number | null;
  amountTtc: number | null;
  currency: string;
  status: InvoiceStatus;
  filePath: string;
  fileMime: string | null;
  fileHash?: string | null;
  ocrConfidence: ConfidenceMap | null;
  riskAssessment: RiskAssessment | null;
  lines: InvoiceLine[];
  history?: InvoiceStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRow {
  id: number;
  supplier_id: number | null;
  invoice_number: string | null;
  issue_date: Date | string | null;
  due_date: Date | string | null;
  amount_ht: string | number | null;
  amount_tva: string | number | null;
  amount_ttc: string | number | null;
  currency: string;
  status: InvoiceStatus;
  file_path: string;
  file_mime: string | null;
  ocr_raw_text: string | null;
  ocr_confidence: ConfidenceMap | null;
  risk_assessment: RiskAssessment | null;
  file_hash: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
