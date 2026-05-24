import { randomUUID } from 'crypto';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import type { ILLMProvider, ChatOptions } from '../llm-provider.interface';
import type {
  ChatMessage,
  ChatEvent,
  ToolDefinition,
  OllamaStreamChunk,
} from '../../../types/agent';

// ─── ReAct fallback parser ────────────────────────────────────────────────────
// Quand le modèle renvoie du texte au lieu de tool_calls structurés,
// on tente de parser un bloc Action: / Action Input: (format ReAct classique).

interface ReActCall {
  name: string;
  input: Record<string, unknown>;
}

function parseReActFallback(text: string): ReActCall | null {
  const actionMatch = text.match(/Action:\s*([a-z_]+)/i);
  const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\})/i);
  if (!actionMatch) return null;
  try {
    const input = inputMatch ? (JSON.parse(inputMatch[1]) as Record<string, unknown>) : {};
    return { name: actionMatch[1].trim(), input };
  } catch {
    return null;
  }
}

// ─── OllamaProvider ───────────────────────────────────────────────────────────

export class OllamaProvider implements ILLMProvider {
  readonly provider = 'ollama';
  readonly model: string;

  private readonly baseUrl: string;

  constructor(model?: string) {
    this.model = model ?? env.OLLAMA_AGENT_MODEL;
    this.baseUrl = env.OLLAMA_BASE_URL;
  }

  async *chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: ChatOptions,
  ): AsyncIterable<ChatEvent> {
    const body = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls.map((tc) => ({
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
          },
        })) } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      })),
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      stream: true,
      options: {
        temperature: options?.temperature ?? 0,
        num_predict: options?.maxTokens ?? 2048,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      logger.error('ollama.chat.error', { status: response.status, body: errorText });
      yield { type: 'error', message: `Ollama error ${response.status}: ${errorText}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let totalTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        let chunk: OllamaStreamChunk;
        try {
          chunk = JSON.parse(line) as OllamaStreamChunk;
        } catch {
          logger.warn('ollama.stream.parse_error', { line });
          continue;
        }

        if (chunk.done) {
          totalTokens = (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0);
          continue;
        }

        const msg = chunk.message;

        // Tool calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            yield {
              type: 'tool_use',
              name: tc.function.name,
              input: tc.function.arguments,
            };
          }
          continue;
        }

        // Text delta
        if (msg.content) {
          accumulatedText += msg.content;
          yield { type: 'text_delta', content: msg.content };
        }
      }
    }

    // ReAct fallback : si le modèle a écrit du texte au lieu de tool_calls
    if (accumulatedText) {
      const reactCall = parseReActFallback(accumulatedText);
      if (reactCall) {
        logger.info('ollama.react_fallback', { tool: reactCall.name });
        // Annuler les text_delta déjà émis n'est pas possible en SSE,
        // mais on émet quand même le tool_use pour que la boucle continue.
        yield { type: 'tool_use', name: reactCall.name, input: reactCall.input };
        return;
      }
    }

    yield { type: 'done', stop_reason: 'stop', total_tokens: totalTokens, duration_ms: 0 };
  }
}

// ─── Embedding helper ─────────────────────────────────────────────────────────

export async function ollamaEmbed(text: string): Promise<number[]> {
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OLLAMA_EMBED_MODEL, input: text }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embed error ${response.status}`);
  }

  const data = (await response.json()) as { embeddings: number[][] };
  return data.embeddings[0];
}
