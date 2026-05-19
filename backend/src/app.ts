import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as path from 'path';
import collectionsRouter from './routes/collections';
import itemsRouter from './routes/items';
import healthRouter from './routes/health';
import { apiLimiter } from './middleware/rateLimiter';
import { requestTimeout } from './middleware/timeout';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(requestLogger);
app.use(requestTimeout(30_000));
app.use(cors({ origin: ['http://localhost:4200', 'http://localhost:4300'] }));
app.use(express.json());
app.use('/img', express.static(path.resolve(__dirname, '../../public/img')));

app.use('/health', healthRouter);
app.use('/api/v1', apiLimiter);
app.use('/api/v1/collections', collectionsRouter);
app.use('/api/v1/collections/:collectionId/items', itemsRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
