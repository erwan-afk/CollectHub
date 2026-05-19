import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Env must be mocked before app imports
vi.mock('../../config/env', () => ({
  env: { DATABASE_URL: 'postgresql://test', PORT: 3000, NODE_ENV: 'test' },
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

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});

describe('GET /api/v1/collections', () => {
  it('returns paginated empty list', async () => {
    const res = await request(app).get('/api/v1/collections');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it('rejects invalid limit', async () => {
    const res = await request(app).get('/api/v1/collections?limit=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('POST /api/v1/collections', () => {
  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/v1/collections').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.title).toBeDefined();
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/api/v1/collections').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 201 with valid title', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .send({ title: 'My Collection' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: 'Test', items: [] });
  });
});

describe('GET /api/v1/collections/:id', () => {
  it('returns 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/v1/collections/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 404 when collection not found', async () => {
    const res = await request(app).get('/api/v1/collections/999');
    expect(res.status).toBe(404);
  });
});
