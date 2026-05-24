/**
 * Worker BullMQ — envoi d'emails transactionnels.
 *
 * Consomme la queue `email-send`. En dev, les emails atterrissent dans Mailhog.
 */
import { Worker } from 'bullmq';
import { env } from '../config/env';
import { type EmailJobData } from '../services/queue';
import { sendEmail } from '../services/email/mailer';
import { logger } from '../config/logger';

const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };

const worker = new Worker<EmailJobData>(
  'email-send',
  async (job) => {
    const { to, template, data } = job.data;
    await sendEmail(to, template, data);
  },
  { connection, concurrency: 3 },
);

worker.on('failed', (job, err) => {
  logger.error('email.worker.failed', {
    jobId: job?.id,
    to: (job?.data as EmailJobData)?.to,
    template: (job?.data as EmailJobData)?.template,
    error: (err as Error).message,
  });
});

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[email.worker] Started — listening on email-send queue');
