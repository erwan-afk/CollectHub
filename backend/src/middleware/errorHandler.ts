import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn('Operational error', { status: err.statusCode, message: err.message });
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
}
