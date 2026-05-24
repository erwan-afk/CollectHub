import { UserRole } from '../db/schema';

// Augmentation du type Request d'Express pour transporter req.user
// hydraté par le middleware requireAuth.
declare global {
  namespace Express {
    interface Request {
      /** UUID v4 posé par le middleware requestId — tracé dans X-Request-Id. */
      id?: string;
      user?: {
        id: number;
        email: string;
        role: UserRole;
        organizationId: number;
      };
    }
  }
}
