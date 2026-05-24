/**
 * OllamaExtractor — extrait les champs de facture via Ollama local (JSON mode).
 *
 * Prérequis :
 *   1. Installer Ollama : https://ollama.com
 *   2. Pull un modèle : ollama pull qwen2.5:3b
 *   3. Configurer .env : AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:3b
 *
 * Différences avec Anthropic :
 *   - Pas de tool_use → on utilise format: "json" + prompt qui décrit le schema
 *   - Pas de prompt caching → on envoie tout à chaque appel
 *   - Coût = 0 (local)
 *   - Latence dépend de la machine (GPU recommandé)
 */
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ExtractedInvoiceSchema } from './tools';
import { SYSTEM_PROMPT } from './prompts/system';
import { buildFewShotBlock } from './prompts/few-shot';
import type { IInvoiceExtractor, ExtractorOptions, ExtractorResult } from './extractor.interface';

const OLLAMA_BASE_URL = env.OLLAMA_BASE_URL || 'http://localhost:11434';

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  format: 'json';
  stream: false;
  options: {
    temperature: number;
    num_predict: number;
  };
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  total_duration: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

function buildJsonPrompt(): string {
  // Ajoute une instruction explicite pour le format JSON (nécessaire car Ollama n'a pas de tool_use)
  return [
    SYSTEM_PROMPT,
    '',
    '---',
    '',
    '## Format de sortie OBLIGATOIRE',
    'Tu dois répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaire.',
    'Le JSON doit contenir EXACTEMENT ces clés :',
    '',
    '{',
    '  "invoice_number": "string ou null",',
    '  "issue_date": "YYYY-MM-DD ou null",',
    '  "due_date": "YYYY-MM-DD ou null",',
    '  "amount_ht": number ou null,',
    '  "amount_tva": number ou null,',
    '  "amount_ttc": number ou null,',
    '  "siret": "string ou null",',
    '  "iban": "string ou null",',
    '  "confidence": {',
    '    "invoice_number": 0.0-1.0,',
    '    "issue_date": 0.0-1.0,',
    '    "due_date": 0.0-1.0,',
    '    "amount_ht": 0.0-1.0,',
    '    "amount_tva": 0.0-1.0,',
    '    "amount_ttc": 0.0-1.0,',
    '    "siret": 0.0-1.0,',
    '    "iban": 0.0-1.0',
    '  }',
    '}',
    '',
    'Pas de texte avant ou après le JSON. Juste le JSON brut.',
  ].join('\n');
}

/** Extrait le premier objet JSON valide d'une chaîne (tolérant aux markdown code blocks LLM) */
function extractJsonFromText(text: string): string {
  const trimmed = text.trim();

  // Tente de trouver un bloc ```json ... ```
  const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlock) {
    return codeBlock[1].trim();
  }

  // Tente de trouver la première accolade et la dernière
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export class OllamaExtractor implements IInvoiceExtractor {
  private readonly model: string;
  private readonly jsonPrompt: string;
  private readonly baseUrl: string;

  constructor() {
    this.model = env.OLLAMA_MODEL || 'qwen2.5:3b';
    this.jsonPrompt = buildJsonPrompt();
    this.baseUrl = OLLAMA_BASE_URL;
  }

  async extract(ocrText: string, options: ExtractorOptions = {}): Promise<ExtractorResult> {
    const fewShot = buildFewShotBlock(options.corrections ?? []);
    const userContent = `Extrais les champs de cette facture.\n\n## Texte OCR brut\n\`\`\`\n${ocrText.slice(0, 12000)}\n\`\`\`${fewShot}\n\nRappel : réponds UNIQUEMENT avec l'objet JSON demandé.`;

    const t0 = Date.now();

    const requestBody: OllamaChatRequest = {
      model: this.model,
      messages: [
        { role: 'system', content: this.jsonPrompt },
        { role: 'user', content: userContent },
      ],
      format: 'json',
      stream: false,
      options: {
        temperature: 0,
        num_predict: env.AI_MAX_TOKENS,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const elapsedMs = Date.now() - t0;
    const content = (data.message?.content ?? '').replace(/\x00/g, '');

    // Extraction du JSON (tolérant aux artefacts LLM)
    const jsonStr = extractJsonFromText(content);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonStr);
    } catch {
      logger.warn('ai.extractor.ollama_json_parse', { rawContent: content.slice(0, 500) });
      throw new Error('Ollama response is not valid JSON');
    }

    const parsed = ExtractedInvoiceSchema.safeParse(parsedJson);
    if (!parsed.success) {
      logger.warn('ai.extractor.ollama_schema_mismatch', {
        errors: parsed.error.flatten(),
        rawContent: content.slice(0, 300),
      });
      throw new Error(`Ollama output failed schema validation: ${parsed.error.message}`);
    }

    const promptTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;

    logger.info('ai.extractor.ollama', {
      model: this.model,
      promptTokens,
      outputTokens,
      elapsedMs,
      supplierId: options.supplierId ?? null,
    });

    return {
      fields: parsed.data,
      promptTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens,
      costUsd: 0,
    };
  }
}
