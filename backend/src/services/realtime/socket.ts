/**
 * Serveur Socket.io — progression temps réel des traitements OCR.
 *
 * Architecture :
 *  - Namespace  : /invoices
 *  - Rooms      : `org:{organizationId}` — isolation multi-tenant
 *  - Auth       : JWT Bearer dans le handshake (socket.handshake.auth.token)
 *
 * Usage depuis un worker :
 *   import { emitInvoiceStatus } from './realtime/socket';
 *   emitInvoiceStatus(orgId, { invoiceId, status, progress, confidence });
 */
import { Server as SocketServer, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../auth.service';
import { logger } from '../../config/logger';

export interface InvoiceStatusPayload {
  invoiceId: number;
  status: string;
  progress: number;
  confidence?: number;
  source?: string;
  pipelineMode?: string;
  riskScore?: number;
}

export const CHANNEL = 'invoice:status';

let io: SocketServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: ['http://localhost:4200', 'http://localhost:4300'],
      credentials: true,
    },
  });

  const invoicesNs = io.of('/invoices');

  // Auth middleware : vérifie le JWT transmis dans le handshake
  invoicesNs.use((socket: Socket, next) => {
    const token: string | undefined = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      // Attache les infos user au socket pour les utiliser dans les handlers
      (socket as Socket & { orgId: number; userId: number }).orgId = payload.orgId;
      (socket as Socket & { orgId: number; userId: number }).userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  invoicesNs.on('connection', (socket) => {
    const orgId = (socket as Socket & { orgId: number }).orgId;
    const room = `org:${orgId}`;
    socket.join(room);
    logger.info('socket.connected', { socketId: socket.id, orgId });

    socket.on('disconnect', (reason) => {
      logger.info('socket.disconnected', { socketId: socket.id, orgId, reason });
    });
  });

  logger.info('Socket.io initialized on namespace /invoices');
  return io;
}

/**
 * Émet un événement `invoice:status` à tous les sockets de l'organisation.
 * Appelable depuis n'importe quel worker sans importer le serveur HTTP.
 */
export function emitInvoiceStatus(orgId: number, payload: InvoiceStatusPayload): void {
  if (!io) {
    // Worker démarré sans serveur HTTP — on ignore silencieusement
    return;
  }
  const room = `org:${orgId}`;
  io.of('/invoices').to(room).emit('invoice:status', payload);
}

export function getSocketServer(): SocketServer | null {
  return io;
}
