import { Request, Response, NextFunction } from 'express';
import { asyncContext } from '../context/async-context';

/**
 * Génère un UUID v4 par requête, l'expose sur req.id et dans le header
 * X-Request-Id (utile pour corréler les logs côté client).
 * Lance aussi le AsyncLocalStorage — tous les logs émis dans cette
 * requête auront automatiquement le requestId sans le passer manuellement.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  asyncContext.run({ requestId: id }, next);
}
