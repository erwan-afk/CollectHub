import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  register,
  login,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  getUserById,
  signAccessToken,
} from '../services/auth.service';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

const router = Router();

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  // maxAge en ms — 7 jours
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationId: z.number().int().positive(),
  role: z.enum(['admin', 'accountant', 'viewer']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post(
  '/register',
  validate(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as z.infer<typeof RegisterSchema>;
      const user = await register(body);
      logger.info('auth.register', { userId: user.id, email: user.email });
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post(
  '/login',
  validate(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as z.infer<typeof LoginSchema>;
      const user = await login(email, password);

      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        orgId: user.organizationId,
      });
      const refreshToken = await createRefreshToken(user.id);

      res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
      logger.info('auth.login', { userId: user.id });

      res.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      throw new AppError(401, 'No refresh token');
    }

    const result = await rotateRefreshToken(rawToken);
    if (!result) {
      res.clearCookie(REFRESH_COOKIE);
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const user = await getUserById(result.userId);
    if (!user) {
      throw new AppError(401, 'User not found');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.organizationId,
    });

    res.cookie(REFRESH_COOKIE, result.newRefreshToken, cookieOptions);
    logger.info('auth.refresh', { userId: user.id });

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      await revokeRefreshToken(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserById(req.user!.id);
    if (!user) throw new AppError(404, 'User not found');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
