import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks SDK Anthropic (hoistés avant les imports) ─────────────────────────

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'sk-test',
    AI_MODEL: 'claude-haiku-4-5-20251001',
    AI_MAX_TOKENS: 1024,
  },
}));

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { extractWithClaude } from '../../../services/ai/extractor.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToolUseResponse(input: Record<string, unknown>) {
  return {
    content: [{ type: 'tool_use', name: 'extract_invoice', input }],
    usage: {
      input_tokens: 500,
      output_tokens: 100,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 100,
    },
  };
}

const SAMPLE_INVOICE_FIELDS = {
  invoice_number: 'FA-2024-0156',
  issue_date: '2024-03-15',
  due_date: '2024-04-15',
  amount_ht: 8000.0,
  amount_tva: 1600.0,
  amount_ttc: 9600.0,
  siret: '12345678900012',
  iban: 'FR7630006000011234567890189',
  confidence: {
    invoice_number: 0.95,
    issue_date: 0.95,
    due_date: 0.9,
    amount_ht: 0.98,
    amount_tva: 0.98,
    amount_ttc: 0.98,
    siret: 0.95,
    iban: 0.9,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('extractWithClaude', () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it('appelle le modèle avec tool_choice forcé sur extract_invoice', async () => {
    mocks.create.mockResolvedValue(makeToolUseResponse(SAMPLE_INVOICE_FIELDS));

    await extractWithClaude('texte de facture test');

    const callArgs = mocks.create.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'extract_invoice' });
    expect(callArgs.tools[0].name).toBe('extract_invoice');
  });

  it('envoie le system prompt avec cache_control ephemeral', async () => {
    mocks.create.mockResolvedValue(makeToolUseResponse(SAMPLE_INVOICE_FIELDS));

    await extractWithClaude('texte test');

    const callArgs = mocks.create.mock.calls[0][0];
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('retourne les champs extraits et les métriques de cache', async () => {
    mocks.create.mockResolvedValue(makeToolUseResponse(SAMPLE_INVOICE_FIELDS));

    const result = await extractWithClaude('texte test');

    expect(result.fields.invoice_number).toBe('FA-2024-0156');
    expect(result.fields.amount_ttc).toBe(9600.0);
    expect(result.cacheReadTokens).toBe(400);
    expect(result.promptTokens).toBe(500);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it('calcule un coût réduit quand le cache est chaud (80% cache hit)', async () => {
    // 400 tokens cache read sur 500 input = 80% hit rate → coût réduit
    mocks.create.mockResolvedValue(makeToolUseResponse(SAMPLE_INVOICE_FIELDS));
    const result = await extractWithClaude('texte test');

    // 100 input non-cached × 0.80/M + 400 cached × 0.08/M + 100 output × 4.00/M
    const expected = (100 * 0.8 + 400 * 0.08 + 100 * 4.0) / 1_000_000;
    expect(result.costUsd).toBeCloseTo(expected, 8);
  });

  it('lève une erreur si Claude ne retourne pas le tool_use', async () => {
    mocks.create.mockResolvedValue({
      content: [{ type: 'text', text: 'je ne sais pas' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    });

    await expect(extractWithClaude('texte test')).rejects.toThrow('extract_invoice tool');
  });

  it('lève une erreur si la sortie du tool ne passe pas le schema Zod', async () => {
    mocks.create.mockResolvedValue(
      makeToolUseResponse({ invoice_number: 123, amount_ttc: 'not-a-number' }),
    );

    await expect(extractWithClaude('texte test')).rejects.toThrow('schema validation');
  });

  it('injecte les corrections few-shot dans le user message', async () => {
    mocks.create.mockResolvedValue(makeToolUseResponse(SAMPLE_INVOICE_FIELDS));

    await extractWithClaude('texte test', {
      corrections: [
        {
          field: 'invoice_number',
          rawTextSnippet: 'Réf. F24-001',
          aiValue: 'F24-001',
          correctedValue: 'FAC-2024-001',
        },
      ],
    });

    const callArgs = mocks.create.mock.calls[0][0];
    const userContent: string = callArgs.messages[0].content;
    expect(userContent).toContain('Corrections passées');
    expect(userContent).toContain('FAC-2024-001');
  });
});
