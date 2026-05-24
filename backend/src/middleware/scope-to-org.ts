import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

/**
 * Doit être appliqué après requireAuth.
 * Injecte res.locals.orgId depuis req.user pour que toutes les
 * queries de la requête soient automatiquement scopées au tenant.
 */
export function scopeToOrg(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, 'Not authenticated'));
    return;
  }
  res.locals.orgId = req.user.organizationId;
  next();
}
