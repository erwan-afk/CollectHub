import { Request, Response, NextFunction } from 'express';

export function requestTimeout(ms: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(ms, () => {
      res.status(503).json({ error: 'Request timeout' });
    });
    next();
  };
}
