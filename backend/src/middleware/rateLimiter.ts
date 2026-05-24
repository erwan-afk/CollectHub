import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * En dev/test, pas de rate-limit pour faciliter le développement.
 * En prod, 100 req / 15 min par IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 100 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => env.NODE_ENV !== 'production',
});

/** Upload : 10 req / min en prod, illimité en dev. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === 'production' ? 10 : 10_000,
  message: { error: 'Upload rate limit exceeded.' },
  skip: () => env.NODE_ENV !== 'production',
});
