import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { ILLMProvider } from './llm-provider.interface';
import { OllamaProvider } from './providers/ollama-provider';

let instance: ILLMProvider | null = null;

export function getLLM(): ILLMProvider {
  if (instance) return instance;

  if (env.AI_PROVIDER === 'ollama') {
    instance = new OllamaProvider();
    logger.info('ai.agent.factory', { provider: 'ollama', model: env.OLLAMA_AGENT_MODEL });
  } else {
    // Fallback Ollama tant que l'AnthropicProvider agent n'est pas implémenté
    // (le sprint 3 utilise @anthropic-ai/sdk directement pour l'extraction)
    logger.warn('ai.agent.factory', {
      msg: 'AnthropicProvider for agent not yet implemented, falling back to Ollama',
    });
    instance = new OllamaProvider();
  }

  return instance;
}

/** Réinitialise le singleton (utile en tests) */
export function resetLLMFactory(): void {
  instance = null;
}
