import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted() garantit que les mocks sont disponibles quand vi.mock() factories s'exécutent.
const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  signAccessToken: vi.fn().mockReturnValue('mock.access.token'),
  createRefreshToken: vi.fn().mockResolvedValue('mock_refresh'),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

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
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) },
  db: {},
}));

vi.mock('../services/auth.service', () => mocks);

import app from '../app';
import { AppError } from '../errors/AppError';

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => { mocks.register.mockReset(); });

  it('retourne 400 si le body est invalide (email mal formé)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'pas-un-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('retourne 400 si le mot de passe est trop court', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'ok@test.com', password: '123', organizationId: 1,
    });
    expect(res.status).toBe(400);
  });

  it('retourne 201 avec les données du nouvel utilisateur', async () => {
    mocks.register.mockResolvedValueOnce({ id: 1, email: 'new@test.com', role: 'viewer', organizationId: 1 });
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@test.com', password: 'Password1!', organizationId: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
  });

  it('retourne 409 si l\'email est déjà pris', async () => {
    mocks.register.mockRejectedValueOnce(new AppError(409, 'Email already in use'));
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'taken@test.com', password: 'Password1!', organizationId: 1,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => { mocks.login.mockReset(); mocks.signAccessToken.mockReturnValue('mock.access.token'); });

  it('retourne 400 si le body est vide', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('retourne 200 + accessToken + cookie refresh_token sur login valide', async () => {
    mocks.login.mockResolvedValueOnce({ id: 1, email: 'admin@demo.com', role: 'admin', organizationId: 1 });
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@demo.com', password: 'Admin1234!',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('mock.access.token');
    expect(res.body.user).toMatchObject({ id: 1, role: 'admin' });
    expect([res.headers['set-cookie']].flat().join()).toContain('refresh_token');
    expect([res.headers['set-cookie']].flat().join()).toContain('HttpOnly');
  });

  it('retourne 401 sur mauvais mot de passe', async () => {
    mocks.login.mockRejectedValueOnce(new AppError(401, 'Invalid credentials'));
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@demo.com', password: 'wrong',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  beforeEach(() => { mocks.verifyAccessToken.mockReset(); mocks.getUserById.mockReset(); });

  it('retourne 401 sans Authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Missing or malformed');
  });

  it('retourne 401 avec un token invalide', async () => {
    mocks.verifyAccessToken.mockImplementationOnce(() => { throw new Error('invalid'); });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer bad.jwt');
    expect(res.status).toBe(401);
  });

  it('retourne 200 avec les infos user sur token valide', async () => {
    mocks.verifyAccessToken.mockReturnValueOnce({ sub: 1, email: 'admin@demo.com', role: 'admin', orgId: 1 });
    mocks.getUserById.mockResolvedValueOnce({
      id: 1, email: 'admin@demo.com', role: 'admin', organizationId: 1, createdAt: new Date().toISOString(),
    });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer valid.jwt');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@demo.com');
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => { mocks.rotateRefreshToken.mockReset(); mocks.getUserById.mockReset(); });

  it('retourne 401 sans cookie refresh_token', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token');
  });

  it('retourne 401 si le token est invalide/expiré', async () => {
    mocks.rotateRefreshToken.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=expired');
    expect(res.status).toBe(401);
  });

  it('retourne 200 avec un nouveau accessToken sur token valide', async () => {
    mocks.rotateRefreshToken.mockResolvedValueOnce({ userId: 1, newRefreshToken: 'new_token' });
    mocks.getUserById.mockResolvedValueOnce({ id: 1, email: 'admin@demo.com', role: 'admin', organizationId: 1 });
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=valid_token');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('mock.access.token');
    expect([res.headers['set-cookie']].flat().join()).toContain('refresh_token');
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => { mocks.revokeRefreshToken.mockReset().mockResolvedValue(undefined); });

  it('retourne 204 et révoque le token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=some_token');
    expect(res.status).toBe(204);
    expect(mocks.revokeRefreshToken).toHaveBeenCalledWith('some_token');
  });

  it('retourne 204 même sans cookie (déjà déconnecté)', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});
