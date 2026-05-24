// ─── Messages ─────────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-encoded arguments */
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Populated when role='assistant' and LLM requested tool calls */
  tool_calls?: ToolCall[];
  /** Populated when role='tool' — must match the originating tool_call id */
  tool_call_id?: string;
  /** Human-readable label shown in the SSE stream (not sent to LLM) */
  name?: string;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type ChatEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'done'; stop_reason: string; total_tokens: number; duration_ms: number }
  | { type: 'error'; message: string };

// ─── Tool system ──────────────────────────────────────────────────────────────

export interface AgentContext {
  orgId: number;
  userId: number;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON Schema for the input object */
  parameters: Record<string, unknown>;
  handler: (input: TInput, ctx: AgentContext) => Promise<TOutput>;
}

// ─── Traces ───────────────────────────────────────────────────────────────────

export interface AgentTrace {
  id: string;
  orgId: number;
  userId: number;
  question: string;
  messages: ChatMessage[];
  totalTokens: number;
  durationMs: number;
  finalAnswer: string;
  provider: string;
  model: string;
  createdAt: string;
}

// ─── Ollama raw response types ────────────────────────────────────────────────
// Used internally by OllamaProvider to parse the NDJSON stream

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}
