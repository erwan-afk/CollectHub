import { Queue, type JobsOptions } from 'bullmq';
import { env } from '../config/env';

// ─── Connection ───────────────────────────────────────────────────────────────

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // Redis AOF activé dans docker-compose → persistance garantie.
  // enableOfflineQueue: false → rejette immédiatement les commandes si Redis est absent
  // au lieu de les mettre en file et de bloquer indéfiniment.
  enableOfflineQueue: false,
  // Pas de reconnexion infinie en dev (réduit le bruit dans les logs).
  maxRetriesPerRequest: null,
};

// ─── Queues ───────────────────────────────────────────────────────────────────

/** Queue principale de traitement OCR asynchrone */
export const ocrQueue = new Queue<OcrJobData>('ocr-processing', { connection });

/** File d'échecs définitifs (dead-letter) */
export const ocrFailedQueue = new Queue<OcrJobData>('ocr-failed', { connection });

/** Queue de livraison des webhooks sortants */
export const webhookQueue = new Queue<WebhookJobData>('webhook-delivery', { connection });

/** Queue d'envoi d'emails */
export const emailQueue = new Queue<EmailJobData>('email-send', { connection });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OcrJobData {
  invoiceId: number;
  filePath: string;
  orgId: number;
}

export interface WebhookJobData {
  webhookId: number;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}

export interface EmailJobData {
  to: string;
  template: 'invoice-validated' | 'invoice-rejected' | 'password-reset';
  data: Record<string, unknown>;
}

// ─── Options par défaut ───────────────────────────────────────────────────────

/** Retry OCR : 3 essais avec backoff exponentiel (1s, 5s, 30s) */
export const ocrJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

/** Retry webhook : 5 essais, backoff plus long car dépend d'un service externe */
export const webhookJobOpts: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

/** Email : 3 essais, pas critique */
export const emailJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function closeQueues(): Promise<void> {
  await ocrQueue.close();
  await ocrFailedQueue.close();
  await webhookQueue.close();
  await emailQueue.close();
}
