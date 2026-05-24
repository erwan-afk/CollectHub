import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import http from 'http';
import { env } from './config/env';
import { logger } from './config/logger';
import app from './app';
import { pool } from './db/database';
import { initSocketServer, getSocketServer } from './services/realtime/socket';
import { startRedisRelay } from './services/realtime/redis-relay';
import { closeQueues } from './services/queue';

async function start() {
  // Serveur HTTP sous-jacent — nécessaire pour monter Socket.io dessus
  const httpServer = http.createServer(app);

  const io = initSocketServer(httpServer);
  startRedisRelay(io);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
  });

  async function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully`);

    // 1. Ferme Socket.io en premier : coupe les WebSockets pour que
    //    httpServer.close() ne bloque pas indéfiniment sur les connexions ouvertes.
    const io = getSocketServer();
    if (io) await io.close();

    // 2. Force la fermeture des connexions HTTP restantes (Node 18+).
    if ('closeAllConnections' in httpServer) {
      (httpServer as http.Server & { closeAllConnections(): void }).closeAllConnections();
    }

    httpServer.close(async () => {
      await Promise.all([pool.end(), closeQueues()]);
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Dernier recours si le shutdown traîne (ex: queues Redis lentes).
    setTimeout(() => process.exit(1), 5_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
