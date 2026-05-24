import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Env must be mocked before app imports
vi.mock('../../config/env', () => ({
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

vi.mock('../../db/queries', () => ({
  getAllCollections: vi.fn().mockResolvedValue([]),
  getCollectionsCount: vi.fn().mockResolvedValue(0),
  getCollectionById: vi.fn().mockResolvedValue(null),
  createCollection: vi.fn().mockResolvedValue({ id: 1, title: 'Test', items: [] }),
  updateCollection: vi.fn().mockResolvedValue(null),
  deleteCollection: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../db/database', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) },
  initDatabase: vi.fn(),
}));

import app from '../../app';

// Token JWT valide avec la clé mockée
const SECRET = 'test_access_secret_at_least_32_chars_ok';
const VALID_TOKEN = jwt.sign({ sub: 1, email: 'admin@demo.com', role: 'admin', orgId: 1 }, SECRET, {
  expiresIn: '15m',
});

describe('GET /health', () => {
  it('returns 200 with ok status (health check is exempt from auth)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});

describe('Auth guard — collections', () => {
  it('GET /collections returns 401 sans Authorization header', async () => {
    const res = await request(app).get('/api/v1/collections');
    expect(res.status).toBe(401);
  });

  it('POST /collections returns 401 sans token', async () => {
    const res = await request(app).post('/api/v1/collections').send({});
    expect(res.status).toBe(401);
  });

  it('GET /collections/:id returns 401 sans token', async () => {
    const res = await request(app).get('/api/v1/collections/1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/collections (authenticated)', () => {
  it('returns 200 avec un token valide', async () => {
    const res = await request(app)
      .get('/api/v1/collections')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it('rejects invalid limit', async () => {
    const res = await request(app)
      .get('/api/v1/collections?limit=0')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('POST /api/v1/collections (authenticated)', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.title).toBeDefined();
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 201 with valid title', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ title: 'My Collection' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: 'Test', items: [] });
  });
});

describe('GET /api/v1/collections/:id (authenticated)', () => {
  it('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .get('/api/v1/collections/abc')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 404 when collection not found', async () => {
    const res = await request(app)
      .get('/api/v1/collections/999')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(404);
  });
});
