import Redis from 'ioredis';
import { env } from '../../config/env';
import type { InvoiceStatusPayload } from './socket';

const CHANNEL = 'invoice:status';

let pub: Redis | null = null;

function getPublisher(): Redis {
  if (!pub) {
    pub = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, maxRetriesPerRequest: null });
  }
  return pub;
}

/** Publie un événement de statut dans Redis pour que le serveur HTTP le relaie via Socket.io. */
export async function publishInvoiceStatus(
  orgId: number,
  payload: InvoiceStatusPayload,
): Promise<void> {
  await getPublisher().publish(CHANNEL, JSON.stringify({ orgId, ...payload }));
}

export { CHANNEL };
