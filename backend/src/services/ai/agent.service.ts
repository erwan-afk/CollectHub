import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getLLM } from './llm-factory';
import { AGENT_TOOLS } from './agent-tools';
import { AGENT_SYSTEM_PROMPT } from './prompts/agent-system';
import { saveAgentTrace } from '../../db/agent-queries';
import type { ChatMessage, ChatEvent, ToolCall, ToolDefinition, AgentContext } from '../../types/agent';

// ─── Config ────────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentRunOptions {
  question: string;
  ctx: AgentContext;
  onEvent: (event: ChatEvent) => void;
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

export async function runAgent(options: AgentRunOptions): Promise<void> {
  const { question, ctx, onEvent } = options;
  const llm = getLLM();
  const startAt = Date.now();

  const messages: ChatMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  let totalTokens = 0;
  let finalAnswer = '';

  // Timeout hard — on ferme le stream si l'agent prend trop longtemps
  const timeoutId = setTimeout(() => {
    onEvent({ type: 'error', message: 'Timeout : la requête a dépassé la limite de temps.' });
  }, env.AGENT_TIMEOUT_MS);

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const pendingToolCalls: Array<{ call: ToolCall; name: string; input: Record<string, unknown> }> = [];
      let accumulatedText = '';
      let gotDone = false;

      for await (const event of llm.chat(messages, AGENT_TOOLS)) {
        if (event.type === 'text_delta') {
          accumulatedText += event.content;
          onEvent(event);
          continue;
        }

        if (event.type === 'tool_use') {
          const toolCallId = randomUUID();
          const call: ToolCall = {
            id: toolCallId,
            type: 'function',
            function: { name: event.name, arguments: JSON.stringify(event.input) },
          };
          pendingToolCalls.push({ call, name: event.name, input: event.input });
          onEvent({ type: 'tool_use', name: event.name, input: event.input });
          continue;
        }

        if (event.type === 'done') {
          totalTokens += event.total_tokens;
          gotDone = true;
          continue;
        }

        if (event.type === 'error') {
          onEvent(event);
          return;
        }
      }

      // Pas d'appel d'outil → réponse finale
      if (pendingToolCalls.length === 0) {
        finalAnswer = accumulatedText;
        if (!gotDone) {
          onEvent({ type: 'done', stop_reason: 'end_turn', total_tokens: totalTokens, duration_ms: Date.now() - startAt });
        } else {
          onEvent({ type: 'done', stop_reason: 'end_turn', total_tokens: totalTokens, duration_ms: Date.now() - startAt });
        }
        break;
      }

      // Ajouter le message assistant avec les tool_calls
      messages.push({
        role: 'assistant',
        content: accumulatedText,
        tool_calls: pendingToolCalls.map((p) => p.call),
      });

      // Exécuter les outils et ajouter les résultats
      for (const { call, name, input } of pendingToolCalls) {
        const tool = AGENT_TOOLS.find((t) => t.name === name);
        let resultContent: string;

        if (!tool) {
          resultContent = JSON.stringify({ error: `Outil inconnu: ${name}` });
          logger.warn('agent.unknown_tool', { orgId: ctx.orgId, tool: name });
        } else {
          try {
            // Le handler reçoit toujours input filtré par orgId dans le contexte
            const result = await (tool as ToolDefinition<unknown, unknown>).handler(input, ctx);
            resultContent = JSON.stringify(result);
          } catch (err) {
            logger.error('agent.tool_error', { orgId: ctx.orgId, tool: name, error: String(err) });
            resultContent = JSON.stringify({ error: `Erreur lors de l'exécution de ${name}: ${String(err)}` });
          }
        }

        const summary = resultContent.length > 200 ? resultContent.slice(0, 200) + '…' : resultContent;
        onEvent({ type: 'tool_result', name, summary });

        messages.push({
          role: 'tool',
          content: resultContent,
          tool_call_id: call.id,
          name,
        });
      }

      // Garde-fou : si on arrive à MAX_ITERATIONS, forcer une réponse finale
      if (iter === MAX_ITERATIONS - 1) {
        logger.warn('agent.max_iterations_reached', { orgId: ctx.orgId, iter });
        // Relancer sans outils pour forcer une synthèse
        messages.push({
          role: 'user',
          content: "Synthétise les informations obtenues et réponds à ma question initiale.",
        });
        let finalText = '';
        for await (const event of llm.chat(messages, [])) {
          if (event.type === 'text_delta') {
            finalText += event.content;
            onEvent(event);
          }
          if (event.type === 'done') totalTokens += event.total_tokens;
        }
        finalAnswer = finalText;
        onEvent({ type: 'done', stop_reason: 'max_iterations', total_tokens: totalTokens, duration_ms: Date.now() - startAt });
      }
    }
  } finally {
    clearTimeout(timeoutId);

    // Persister la trace (best-effort, sans bloquer la réponse)
    saveAgentTrace({
      orgId: ctx.orgId,
      userId: ctx.userId,
      question,
      messages,
      totalTokens,
      durationMs: Date.now() - startAt,
      finalAnswer,
      provider: llm.provider,
      model: llm.model,
    }).catch((err) => logger.error('agent.trace_save_error', { error: String(err) }));
  }
}
