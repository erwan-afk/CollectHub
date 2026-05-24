import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/database';
import { users, refreshTokens } from '../db/schema';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { UserRole } from '../db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: UserRole;
  orgId: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Convertit '15m', '7d', '2h' en millisecondes. */
function parseDurationMs(d: string): number {
  const m = d.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid duration: ${d}`);
  const v = parseInt(m[1], 10);
  const units: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return v * units[m[2]];
}

// ─── Token generation ─────────────────────────────────────────────────────────

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
}

// ─── Auth operations ──────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  organizationId: number;
  role?: UserRole;
}

export async function register(input: RegisterInput) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length) {
    throw new AppError(409, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      role: input.role ?? 'viewer',
      organizationId: input.organizationId,
    })
    .returning({ id: users.id, email: users.email, role: users.role, organizationId: users.organizationId });

  return user;
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Timing-safe : on hash même si l'user n'existe pas pour éviter l'énumération.
  const fakeHash = '$2b$12$invalidhashtopreventtimingattacks.invalidhash';
  const valid = await bcrypt.compare(password, user?.passwordHash ?? fakeHash);

  if (!user || !valid) {
    throw new AppError(401, 'Invalid credentials');
  }

  return user;
}

export async function createRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  return token;
}

export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ userId: number; newRefreshToken: string } | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, now)))
    .limit(1);

  if (!stored) return null;

  // Rotation : on supprime l'ancien et on en crée un nouveau.
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
  const newRefreshToken = await createRefreshToken(stored.userId);

  return { userId: stored.userId, newRefreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function getUserById(id: number) {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role, organizationId: users.organizationId, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}
