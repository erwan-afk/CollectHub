/**
 * Tests unitaires purs pour auth.service.ts.
 * Couverture : signAccessToken, verifyAccessToken (pas de DB, pas de bcrypt).
 * Les tests qui nécessitent la DB (register, login) passent par auth.routes.test.ts
 * qui mocke le service layer — séparer les niveaux est le bon pattern.
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_chars_ok',
    JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_chars_ok',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

vi.mock('../db/database', () => ({
  pool: { query: vi.fn() },
  db: {},
}));

import { signAccessToken, verifyAccessToken } from '../services/auth.service';

const PAYLOAD = { sub: 1, email: 'test@test.com', role: 'admin' as const, orgId: 1 };
const SECRET = 'test_access_secret_at_least_32_chars_ok';

describe('signAccessToken', () => {
  it('produit un JWT en 3 parties', () => {
    const token = signAccessToken(PAYLOAD);
    expect(token.split('.')).toHaveLength(3);
  });

  it('encode bien sub, email, role, orgId dans le payload', () => {
    const token = signAccessToken(PAYLOAD);
    const raw = jwt.decode(token) as Record<string, unknown>;
    expect(raw.sub).toBe(1);
    expect(raw.email).toBe('test@test.com');
    expect(raw.role).toBe('admin');
    expect(raw.orgId).toBe(1);
  });
});

describe('verifyAccessToken', () => {
  it('round-trip : le payload décodé correspond au payload signé', () => {
    const token = signAccessToken(PAYLOAD);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(1);
    expect(decoded.email).toBe('test@test.com');
    expect(decoded.role).toBe('admin');
    expect(decoded.orgId).toBe(1);
  });

  it('lève une erreur sur un token malformé', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });

  it('lève une erreur sur un token signé avec un autre secret', () => {
    const fakeToken = jwt.sign(PAYLOAD, 'wrong_secret_that_is_at_least_32_chars!');
    expect(() => verifyAccessToken(fakeToken)).toThrow();
  });

  it('lève une erreur sur un token expiré', () => {
    // backdate l'iat/exp pour simuler l'expiration
    const expired = jwt.sign(PAYLOAD, SECRET, { expiresIn: -1 });
    expect(() => verifyAccessToken(expired)).toThrow(/expired|invalid/i);
  });

  it('lève une erreur si la signature a été altérée', () => {
    const token = signAccessToken(PAYLOAD);
    const [h, p] = token.split('.');
    const tampered = `${h}.${p}.invalidsignature`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
