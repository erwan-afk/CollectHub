import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  parseFields: vi.fn(),
  extractWithClaude: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock('../../../services/ocr/field-parser', () => ({
  parseFields: (...args: unknown[]) => mocks.parseFields(...args),
}));

vi.mock('../../../services/ai/extractor-factory', () => ({
  getExtractor: () => ({
    extract: (...args: unknown[]) => mocks.extractWithClaude(...args),
  }),
}));

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../config/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'sk-test',
    AI_MODEL: 'claude-haiku-4-5-20251001',
    AI_MAX_TOKENS: 1024,
  },
}));

vi.mock('../../../db/database', () => ({
  pool: { query: (...args: unknown[]) => mocks.poolQuery(...args) },
}));

import { runExtractionPipeline } from '../../../services/ai/pipeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGEX_CONFIDENT = {
  fields: {
    invoiceNumber: 'FA-2024-001',
    issueDate: '2024-03-15',
    dueDate: '2024-04-15',
    amountHt: 8000,
    amountTva: 1600,
    amountTtc: 9600,
    siret: '12345678900012',
    iban: 'FR7630006000011234567890189',
  },
  confidence: {
    invoice_number: 0.95,
    issue_date: 0.95,
    due_date: 0.95,
    amount_ht: 0.95,
    amount_tva: 0.95,
    amount_ttc: 0.95,
    siret: 0.95,
    iban: 0.95,
  },
};

const REGEX_WEAK = {
  fields: {
    invoiceNumber: 'F24-001',
    issueDate: null,
    dueDate: null,
    amountHt: null,
    amountTva: null,
    amountTtc: 1234.56,
    siret: null,
    iban: null,
  },
  confidence: {
    invoice_number: 0.6, // en dessous du seuil 0.8 → LLM fallback déclenché
    amount_ttc: 0.5,
  },
};

const LLM_RESULT = {
  fields: {
    invoice_number: 'FAC-2024-001',
    issue_date: '2024-01-15',
    due_date: '2024-02-15',
    amount_ht: 7500,
    amount_tva: 1500,
    amount_ttc: 9000,
    siret: '12345678900012',
    iban: 'FR7630006000011234567890189',
    confidence: {
      invoice_number: 0.9,
      issue_date: 0.9,
      due_date: 0.9,
      amount_ht: 0.9,
      amount_tva: 0.9,
      amount_ttc: 0.9,
      siret: 0.9,
      iban: 0.9,
    },
  },
  promptTokens: 500,
  cacheReadTokens: 400,
  cacheWriteTokens: 100,
  outputTokens: 100,
  costUsd: 0.0005,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runExtractionPipeline', () => {
  beforeEach(() => {
    mocks.parseFields.mockReset();
    mocks.extractWithClaude.mockReset();
    mocks.poolQuery.mockReset();
  });

  it('mode regex_only quand tous les champs critiques sont confiants', async () => {
    mocks.parseFields.mockReturnValue(REGEX_CONFIDENT);

    const result = await runExtractionPipeline('texte de facture', 1, null);

    expect(result.mode).toBe('regex_only');
    expect(result.costUsd).toBe(0);
    expect(mocks.extractWithClaude).not.toHaveBeenCalled();
    expect(result.invoiceNumber).toBe('FA-2024-001');
  });

  it('mode llm_full quand le regex ne trouve aucun champ', async () => {
    mocks.parseFields.mockReturnValue({
      fields: {
        invoiceNumber: null,
        issueDate: null,
        dueDate: null,
        amountHt: null,
        amountTva: null,
        amountTtc: null,
        siret: null,
        iban: null,
      },
      confidence: {},
    });
    mocks.extractWithClaude.mockResolvedValue(LLM_RESULT);

    const result = await runExtractionPipeline('texte de facture dégradé', 0.3, null);

    expect(result.mode).toBe('llm_full');
    expect(mocks.extractWithClaude).toHaveBeenCalledTimes(1);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('mode llm_fallback quand un champ critique est en dessous du seuil', async () => {
    mocks.parseFields.mockReturnValue(REGEX_WEAK);
    mocks.extractWithClaude.mockResolvedValue(LLM_RESULT);

    const result = await runExtractionPipeline('texte partiel', 0.5, null);

    expect(result.mode).toBe('llm_fallback');
    expect(mocks.extractWithClaude).toHaveBeenCalledTimes(1);
  });

  it('merge les champs : garde la meilleure confiance par champ', async () => {
    // Regex a un bon invoice_number (0.95) mais pas de date
    // LLM a tout à 0.9
    mocks.parseFields.mockReturnValue({
      fields: {
        invoiceNumber: 'REGEX-INV-001',
        issueDate: null,
        dueDate: null,
        amountHt: null,
        amountTva: null,
        amountTtc: null,
        siret: null,
        iban: null,
      },
      confidence: { invoice_number: 0.95 },
    });
    mocks.extractWithClaude.mockResolvedValue(LLM_RESULT);

    const result = await runExtractionPipeline('texte', 0.5, null);

    // invoice_number: regex (0.95) > llm (0.9) → on garde le regex
    expect(result.invoiceNumber).toBe('REGEX-INV-001');
    // issue_date: llm (0.9) > regex (absent) → on garde le LLM
    expect(result.issueDate).toBe('2024-01-15');
    expect(result.mode).toBe('llm_fallback');
  });

  it('charge les corrections few-shot quand un supplierId est fourni', async () => {
    mocks.parseFields.mockReturnValue(REGEX_WEAK);
    mocks.extractWithClaude.mockResolvedValue(LLM_RESULT);
    mocks.poolQuery.mockResolvedValue({
      rows: [
        {
          field: 'invoice_number',
          raw_text_snippet: 'Réf. F24-001',
          ai_value: 'F24-001',
          corrected_value: 'FAC-2024-001',
        },
      ],
    });

    const result = await runExtractionPipeline('texte', 0.5, 42);

    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('extraction_corrections'),
      [42],
    );
    expect(mocks.extractWithClaude).toHaveBeenCalledWith(
      'texte',
      expect.objectContaining({ corrections: expect.arrayContaining([expect.any(Object)]) }),
    );
    expect(result.mode).toBe('llm_fallback');
  });
});
