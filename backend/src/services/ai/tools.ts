import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

// ─── Zod schema (pour valider la sortie du LLM) ──────────────────────────────

export const ExtractedInvoiceSchema = z.object({
  invoice_number: z.string().nullable().describe('Numéro de facture'),
  issue_date: z.string().nullable().describe("Date d'émission ISO 8601 YYYY-MM-DD"),
  due_date: z.string().nullable().describe("Date d'échéance ISO 8601 YYYY-MM-DD"),
  amount_ht: z.number().nullable().describe('Montant HT en euros'),
  amount_tva: z.number().nullable().describe('Montant TVA en euros'),
  amount_ttc: z.number().nullable().describe('Montant TTC en euros'),
  siret: z.string().nullable().describe('SIRET émetteur (14 chiffres, sans espaces)'),
  iban: z.string().nullable().describe('IBAN (sans espaces)'),
  confidence: z
    .record(z.string(), z.number().min(0).max(1))
    .describe('Score de confiance par champ (0-1)'),
});

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

// ─── Tool definition Anthropic (JSON Schema) ─────────────────────────────────

export const EXTRACT_INVOICE_TOOL: Anthropic.Tool = {
  name: 'extract_invoice',
  description: "Extrait les champs structurés d'une facture à partir du texte OCR brut.",
  input_schema: {
    type: 'object',
    properties: {
      invoice_number: { type: ['string', 'null'], description: 'Numéro de facture' },
      issue_date: { type: ['string', 'null'], description: "Date d'émission ISO 8601 YYYY-MM-DD" },
      due_date: { type: ['string', 'null'], description: "Date d'échéance ISO 8601 YYYY-MM-DD" },
      amount_ht: { type: ['number', 'null'], description: 'Montant HT en euros' },
      amount_tva: { type: ['number', 'null'], description: 'Montant TVA en euros' },
      amount_ttc: { type: ['number', 'null'], description: 'Montant TTC en euros' },
      siret: {
        type: ['string', 'null'],
        description: 'SIRET émetteur (14 chiffres, sans espaces)',
      },
      iban: { type: ['string', 'null'], description: 'IBAN (sans espaces)' },
      confidence: {
        type: 'object',
        description: 'Score de confiance 0-1 par champ extrait',
        additionalProperties: { type: 'number' },
      },
    },
    required: [
      'invoice_number',
      'issue_date',
      'due_date',
      'amount_ht',
      'amount_tva',
      'amount_ttc',
      'siret',
      'iban',
      'confidence',
    ],
  },
};
