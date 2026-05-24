import Redis from 'ioredis';
import type { Server as SocketServer } from 'socket.io';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { CHANNEL, type InvoiceStatusPayload } from './socket';

/**
 * Démarre un subscriber Redis dans le process serveur.
 * Chaque message publié sur CHANNEL par un worker est relayé
 * aux clients Socket.io de la bonne org.
 */
export function startRedisRelay(io: SocketServer): void {
  const sub = new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT, maxRetriesPerRequest: null });

  sub.subscribe(CHANNEL, (err) => {
    if (err) {
      logger.error('redis-relay.subscribe_error', { error: (err as Error).message });
      return;
    }
    logger.info('redis-relay.ready', { channel: CHANNEL });
  });

  sub.on('message', (_channel, message) => {
    try {
      const { orgId, ...payload } = JSON.parse(message) as InvoiceStatusPayload & { orgId: number };
      io.of('/invoices').to(`org:${orgId}`).emit('invoice:status', payload);
    } catch (err) {
      logger.error('redis-relay.parse_error', { error: (err as Error).message });
    }
  });
}
