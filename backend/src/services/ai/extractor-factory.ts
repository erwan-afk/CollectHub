/**
 * Factory d'extracteur IA — choisit l'implémentation selon AI_PROVIDER.
 *
 * Providers supportés :
 *   - anthropic : Claude API (tool_use + prompt caching + coût réel)
 *   - ollama    : Ollama local (JSON mode, gratuit, pas de tool_use)
 *
 * Usage :
 *   import { getExtractor } from './extractor-factory';
 *   const extractor = getExtractor();
 *   const result = await extractor.extract(ocrText, options);
 */
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AnthropicExtractor } from './extractor.service';
import { OllamaExtractor } from './local-extractor.service';
import type { IInvoiceExtractor } from './extractor.interface';

let cachedExtractor: IInvoiceExtractor | null = null;

export function getExtractor(): IInvoiceExtractor {
  if (cachedExtractor) return cachedExtractor;

  const provider = env.AI_PROVIDER || 'anthropic';

  switch (provider) {
    case 'ollama':
      logger.info('ai.factory.using_ollama', { model: env.OLLAMA_MODEL || 'qwen2.5:3b' });
      cachedExtractor = new OllamaExtractor();
      break;
    case 'anthropic':
    default:
      logger.info('ai.factory.using_anthropic', { model: env.AI_MODEL });
      cachedExtractor = new AnthropicExtractor();
      break;
  }

  return cachedExtractor;
}
