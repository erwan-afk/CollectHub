import type { ExtractedInvoice } from './tools';
import type { CorrectionExample } from './prompts/few-shot';

export interface ExtractorOptions {
  supplierId?: number | null;
  corrections?: CorrectionExample[];
}

export interface ExtractorResult {
  fields: ExtractedInvoice;
  promptTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * Interface commune pour tous les extracteurs IA (Anthropic, Ollama, futur OpenAI...).
 * Chaque implémentation gère son propre client et son propre format d'appel.
 */
export interface IInvoiceExtractor {
  extract(ocrText: string, options?: ExtractorOptions): Promise<ExtractorResult>;
}
