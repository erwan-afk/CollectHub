/**
 * AnthropicExtractor — extrait les champs de facture via Claude API (tool_use + prompt caching).
 */
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { EXTRACT_INVOICE_TOOL, ExtractedInvoiceSchema } from './tools';
import { SYSTEM_PROMPT } from './prompts/system';
import { buildFewShotBlock } from './prompts/few-shot';
import type { IInvoiceExtractor, ExtractorOptions, ExtractorResult } from './extractor.interface';

// Haiku 4.5 pricing (per million tokens, 2025)
const PRICE_INPUT_PER_M = 0.8;
const PRICE_CACHE_READ_PER_M = 0.08;
const PRICE_OUTPUT_PER_M = 4.0;

function estimateCost(inputTokens: number, cacheReadTokens: number, outputTokens: number): number {
  const uncachedInput = inputTokens - cacheReadTokens;
  return (
    (uncachedInput * PRICE_INPUT_PER_M +
      cacheReadTokens * PRICE_CACHE_READ_PER_M +
      outputTokens * PRICE_OUTPUT_PER_M) /
    1_000_000
  );
}

export class AnthropicExtractor implements IInvoiceExtractor {
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async extract(ocrText: string, options: ExtractorOptions = {}): Promise<ExtractorResult> {
    const fewShot = buildFewShotBlock(options.corrections ?? []);
    const userContent = `Extrais les champs de cette facture.\n\n## Texte OCR brut\n\`\`\`\n${ocrText.slice(0, 12000)}\n\`\`\`${fewShot}`;

    const response = await this.client.messages.create({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [EXTRACT_INVOICE_TOOL],
      tool_choice: { type: 'tool', name: 'extract_invoice' },
      messages: [{ role: 'user', content: userContent }],
    });

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    const costUsd = estimateCost(inputTokens, cacheRead, outputTokens);

    const hitRate = inputTokens > 0 ? ((cacheRead / inputTokens) * 100).toFixed(1) : '0';
    logger.info('ai.extractor.anthropic', {
      model: env.AI_MODEL,
      inputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      outputTokens,
      cacheHitRate: `${hitRate}%`,
      costUsd: costUsd.toFixed(6),
      supplierId: options.supplierId ?? null,
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not call extract_invoice tool');
    }

    const parsed = ExtractedInvoiceSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      logger.warn('ai.extractor.schema_mismatch', { errors: parsed.error.flatten() });
      throw new Error(`Claude tool output failed schema validation: ${parsed.error.message}`);
    }

    return {
      fields: parsed.data,
      promptTokens: inputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      outputTokens,
      costUsd,
    };
  }
}

/**
 * Export legacy — gardé pour rétrocompatibilité avec les tests existants.
 * Utilise l'instance singleton de AnthropicExtractor.
 */
const defaultExtractor = new AnthropicExtractor();
export const extractWithClaude = (
  ocrText: string,
  options?: ExtractorOptions,
): Promise<ExtractorResult> => defaultExtractor.extract(ocrText, options);
