import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import collectionsRouter from './routes/collections';
import itemsRouter from './routes/items';
import healthRouter from './routes/health';
import suppliersRouter from './routes/suppliers';
import invoicesRouter from './routes/invoices';
import einvoicingRouter from './routes/einvoicing';
import authRouter from './routes/auth';
import webhooksRouter from './routes/webhooks';
import aiRouter from './routes/ai';
import { apiLimiter } from './middleware/rateLimiter';
import { requestTimeout } from './middleware/timeout';
import { requestLogger } from './middleware/requestLogger';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, requireRole } from './middleware/auth';
import { ocrQueue, ocrFailedQueue, webhookQueue, emailQueue } from './services/queue';

const app = express();

// ─── Global middlewares ───────────────────────────────────────────────────────

app.use(helmet());
// requestId doit être AVANT requestLogger pour que le requestId
// soit dans l'AsyncLocalStorage quand le log http.request est émis.
app.use(requestId);
app.use(requestLogger);
app.use(requestTimeout(30_000));
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://localhost:4300'],
    credentials: true, // nécessaire pour que le navigateur envoie les cookies httpOnly
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use('/img', express.static(path.resolve(__dirname, '../../public/img')));

// ─── Bull Board (admin dashboard for queues) ──────────────────────────────────

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(ocrQueue),
    new BullMQAdapter(ocrFailedQueue),
    new BullMQAdapter(webhookQueue),
    new BullMQAdapter(emailQueue),
  ],
  serverAdapter: bullBoardAdapter,
});

// Route protégée — admin uniquement
app.use(
  '/admin/queues',
  (req, res, next) => requireAuth(req, res, next),
  (req, res, next) => requireRole('admin')(req, res, next),
  bullBoardAdapter.getRouter(),
);

app.use('/health', healthRouter);
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/collections', collectionsRouter);
app.use('/api/v1/collections/:collectionId/items', itemsRouter);
app.use('/api/v1/suppliers', suppliersRouter);
app.use('/api/v1/invoices', einvoicingRouter); // Factur-X / lifecycle — before generic CRUD
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/ai', aiRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
