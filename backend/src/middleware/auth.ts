import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service';
import { AppError } from '../errors/AppError';
import type { UserRole } from '../db/schema';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role, organizationId: payload.orgId };
  } catch {
    next(new AppError(401, 'Invalid or expired access token'));
    return;
  }

  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, `Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
