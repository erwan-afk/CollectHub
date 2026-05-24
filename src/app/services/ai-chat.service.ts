import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type ChatStreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'done'; stop_reason: string; total_tokens: number; duration_ms: number }
  | { type: 'error'; message: string };

const API = 'http://localhost:3000/api/v1';

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private auth = inject(AuthService);

  async *stream(question: string): AsyncGenerator<ChatStreamEvent> {
    const token = this.auth.getToken();

    let res: Response;
    try {
      res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });
    } catch (err) {
      yield { type: 'error', message: `Connexion impossible : ${String(err)}` };
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      yield { type: 'error', message: (body as { error?: string }).error ?? `HTTP ${res.status}` };
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          try {
            yield JSON.parse(dataLine.slice(6)) as ChatStreamEvent;
          } catch {
            // SSE block malformé — ignoré
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
