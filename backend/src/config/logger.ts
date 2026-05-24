import winston from 'winston';
import { env } from './env';
import { asyncContext } from '../context/async-context';

// Format custom : injecte le requestId depuis l'AsyncLocalStorage courant.
// Pas besoin de le passer manuellement — chaque log l'a automatiquement.
const injectRequestId = winston.format((info) => {
  const ctx = asyncContext.getStore();
  if (ctx?.requestId) info.requestId = ctx.requestId;
  return info;
});

const baseFormats: winston.Logform.Format[] = [
  injectRequestId(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
];

// En dev : lisible humainement avec le requestId abrégé en préfixe
const devFormat = winston.format.combine(
  ...baseFormats,
  winston.format.colorize(),
  winston.format.printf(({ level, message, requestId, timestamp, ...meta }) => {
    const rid = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    const keys = Object.keys(meta).filter((k) => k !== 'level' && k !== 'timestamp');
    const metaStr = keys.length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}${rid}: ${message}${metaStr}`;
  }),
);

// En prod : JSON newline-delimited (compatible Datadog, Loki, CloudWatch…)
const prodFormat = winston.format.combine(
  ...baseFormats,
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});
