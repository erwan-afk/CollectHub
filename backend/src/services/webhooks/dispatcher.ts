/**
 * WebhookDispatcher — enqueue un job webhook pour chaque abonné de l'organisation.
 *
 * Usage :
 *   await dispatch(orgId, 'invoice.validated', { invoiceId: 42 });
 *
 * La signature HMAC-SHA256 est calculée dans le worker au moment de la livraison,
 * pas ici, pour éviter de stocker des secrets dans la queue Redis.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/database';
import { webhooks } from '../../db/schema';
import { webhookQueue, webhookJobOpts } from '../queue';
import { logger } from '../../config/logger';

export async function dispatch(
  orgId: number,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const subs = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.orgId, orgId), eq(webhooks.active, 1)));

  const matching = subs.filter((w) => {
    const events = w.events as string[];
    return events.includes(event) || events.includes('*');
  });

  if (!matching.length) return;

  await Promise.all(
    matching.map((w) =>
      webhookQueue.add(
        `webhook-${w.id}-${event}`,
        { webhookId: w.id, event, payload, attempt: 1 },
        webhookJobOpts,
      ),
    ),
  );

  logger.info('webhook.dispatched', { orgId, event, count: matching.length });
}
