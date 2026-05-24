import { z } from 'zod';

export const InvoiceStatusEnum = z.enum([
  'PROCESSING',
  'DRAFT',
  'PENDING_VALIDATION',
  'VALIDATED',
  'REJECTED',
  'ARCHIVED',
]);

/**
 * Accepte une string non vide (trimée) ou undefined/null/''.
 * z.preprocess() + .optional() en dernière position garantit que
 * z.infer produit un champ optionnel (field?: string | undefined),
 * pas un champ obligatoire union undefined.
 */
const optionalString = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined),
    z.string().max(max).optional(),
  );

export const SupplierBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(255),
  siret: z.preprocess(
    (v) => (typeof v === 'string' && v.length > 0 ? v.replace(/\s/g, '') : undefined),
    z
      .string()
      .trim()
      .regex(/^\d{9}$|^\d{14}$|^$/, 'siret must be 9 (SIREN) or 14 (SIRET) digits')
      .max(14)
      .optional(),
  ),
  vatNumber: optionalString(20),
  iban: optionalString(34),
  address: optionalString(500),
});

export const SupplierIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const InvoiceListQuerySchema = z.object({
  status: InvoiceStatusEnum.optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const numericNullable = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().nullable().optional());

const dateNullable = z.preprocess(
  (v) => (typeof v === 'string' && v.length > 0 ? v : null),
  z.string().nullable().optional(),
);

export const InvoiceLineSchema = z.object({
  description: z.string().trim().max(500).default(''),
  quantity: z.coerce.number().default(1),
  unitPrice: z.coerce.number().default(0),
  total: z.coerce.number().default(0),
});

export const InvoiceUpdateSchema = z.object({
  supplierId: z.coerce.number().int().positive().nullable().optional(),
  invoiceNumber: z.string().trim().max(100).nullable().optional(),
  issueDate: dateNullable,
  dueDate: dateNullable,
  amountHt: numericNullable,
  amountTva: numericNullable,
  amountTtc: numericNullable,
  currency: z.string().length(3).default('EUR'),
  lines: z.array(InvoiceLineSchema).optional(),
});

export const StatusTransitionSchema = z.object({
  to: InvoiceStatusEnum,
  reason: z.string().trim().max(500).optional(),
});

// ─── Sprint 3 : Correction utilisateur (auto-apprentissage) ──────────────────

export const CorrectionBodySchema = z.object({
  field: z.string().trim().min(1).max(50),
  rawTextSnippet: z.string().trim().default(''),
  aiValue: z.string().trim().default(''),
  correctedValue: z.string().trim().min(1, 'correctedValue is required'),
  costUsd: z.coerce.number().min(0).default(0),
});

export type SupplierBody = z.infer<typeof SupplierBodySchema>;
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;
export type InvoiceUpdateBody = z.infer<typeof InvoiceUpdateSchema>;
export type StatusTransitionBody = z.infer<typeof StatusTransitionSchema>;
export type CorrectionBody = z.infer<typeof CorrectionBodySchema>;
