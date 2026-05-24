import type { ChatMessage, ChatEvent, ToolDefinition } from '../../types/agent';

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ILLMProvider {
  readonly provider: string;
  readonly model: string;

  /**
   * Send a conversation to the LLM and receive a stream of events.
   * The caller is responsible for the full message loop:
   * accumulate tool_use events, execute them, append tool_result messages, reboucler.
   */
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: ChatOptions,
  ): AsyncIterable<ChatEvent>;
}
