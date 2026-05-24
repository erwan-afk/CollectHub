/**
 * Worker BullMQ — livraison des webhooks sortants.
 *
 * Pour chaque job `webhook-delivery` :
 *  1. Charge le webhook (url + secret) depuis la DB.
 *  2. Signe le payload avec HMAC-SHA256 (header X-Yooz-Signature).
 *  3. POST vers l'URL cible.
 *  4. Log la tentative dans webhook_deliveries.
 *  5. En cas d'échec, BullMQ retente avec backoff (configuré dans queue.ts).
 */
import crypto from 'crypto';
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { type WebhookJobData } from '../services/queue';
import { db } from '../db/database';
import { webhooks, webhookDeliveries } from '../db/schema';
import { logger } from '../config/logger';

const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };

function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const worker = new Worker<WebhookJobData>(
  'webhook-delivery',
  async (job) => {
    const { webhookId, event, payload, attempt } = job.data;

    const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);
    if (!hook || !hook.active) {
      logger.info('webhook.skipped', { webhookId, reason: 'not found or inactive' });
      return;
    }

    const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString() });
    const signature = sign(hook.secret, body);

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Yooz-Signature': signature,
          'X-Yooz-Event': event,
          'X-Yooz-Delivery': job.id ?? '',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => null);
      success = response.ok;
    } catch (err) {
      logger.warn('webhook.delivery.failed', { webhookId, event, attempt, error: (err as Error).message });
      throw err; // laisse BullMQ retenter
    }

    await db.insert(webhookDeliveries).values({
      webhookId,
      event,
      payload,
      status: success ? 'delivered' : 'failed',
      statusCode,
      responseBody,
      attempt,
      deliveredAt: success ? new Date() : null,
    });

    if (!success) {
      throw new Error(`Webhook returned ${statusCode}`);
    }

    logger.info('webhook.delivered', { webhookId, event, statusCode });
  },
  { connection, concurrency: 5 },
);

worker.on('failed', (job, err) => {
  logger.error('webhook.worker.failed', {
    jobId: job?.id,
    webhookId: (job?.data as WebhookJobData)?.webhookId,
    error: (err as Error).message,
  });
});

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[webhook.worker] Started — listening on webhook-delivery queue');
