import { Supplier } from './supplier';

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

export interface Correction {
  id: number;
  supplierId: number | null;
  invoiceId: number | null;
  field: string;
  rawTextSnippet: string;
  aiValue: string;
  correctedValue: string;
  costUsd: number;
  createdAt: string;
}

export interface CorrectionInput {
  field: string;
  rawTextSnippet?: string;
  aiValue?: string;
  correctedValue: string;
  costUsd?: number;
}

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type ConfidenceField =
  | 'invoice_number'
  | 'issue_date'
  | 'due_date'
  | 'amount_ht'
  | 'amount_tva'
  | 'amount_ttc'
  | 'supplier'
  | 'siret'
  | 'iban';

export type ConfidenceMap = Partial<Record<ConfidenceField, number>>;

export interface InvoiceStatusHistoryEntry {
  id: number;
  fromStatus: InvoiceStatus | null;
  toStatus: InvoiceStatus;
  reason: string | null;
  actor: string;
  createdAt: string;
}

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
  ocrConfidence: ConfidenceMap | null;
  riskAssessment: RiskAssessment | null;
  lines: InvoiceLine[];
  history?: InvoiceStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceUpdate {
  supplierId: number | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amountHt: number | null;
  amountTva: number | null;
  amountTtc: number | null;
  currency: string;
  lines?: InvoiceLine[];
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  supplierId?: number;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface TopSupplier {
  supplierId: number;
  name: string;
  invoiceCount: number;
  totalTtc: number;
}

export interface DashboardSummary {
  countsByStatus: Record<InvoiceStatus, number>;
  monthlyTtcValidated: number;
  topSuppliers: TopSupplier[];
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PROCESSING: 'En traitement',
  DRAFT: 'Brouillon',
  PENDING_VALIDATION: 'À valider',
  VALIDATED: 'Validée',
  REJECTED: 'Rejetée',
  ARCHIVED: 'Archivée',
};

export function confidenceLevel(c: number | undefined): 'high' | 'medium' | 'low' | 'none' {
  if (c === undefined || c === null) return 'none';
  if (c >= 0.9) return 'high';
  if (c >= 0.6) return 'medium';
  return 'low';
}
