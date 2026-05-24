import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { runAgent } from '../services/ai/agent.service';
import type { ChatEvent } from '../types/agent';

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────────────

const ChatBody = z.object({
  question: z.string().min(1).max(2000),
});

// ─── POST /api/v1/ai/chat ─────────────────────────────────────────────────────
// Réponse en Server-Sent Events (SSE).
// Le client doit utiliser fetch + ReadableStream (pas EventSource qui ne supporte pas POST).

router.post('/chat', requireAuth, (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'question is required (1-2000 chars)' });
    return;
  }

  const { question } = parsed.data;
  const { id: userId, organizationId: orgId } = req.user!;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering Nginx
  res.flushHeaders();

  const send = (event: ChatEvent) => {
    // Format SSE : "event: <type>\ndata: <json>\n\n"
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  runAgent({ question, ctx: { orgId, userId }, onEvent: send })
    .catch((err) => {
      send({ type: 'error', message: String(err) });
    })
    .finally(() => {
      res.end();
    });
});

export default router;
