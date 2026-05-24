/**
 * Tests d'isolation multi-tenant.
 *
 * Deux axes de test :
 * 1. SQL — chaque query contient organization_id dans ses paramètres.
 * 2. HTTP — un user de l'orga A reçoit 404 sur une ressource de l'orga B.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

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
  pool: { query: mockQuery },
  db: {},
}));

// On garde les vrais signAccessToken / verifyAccessToken pour que requireAuth fonctionne.
vi.mock('../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/auth.service')>();
  return { ...real };
});

import app from '../app';
import { signAccessToken } from '../services/auth.service';

const TOKEN_ORG1 = signAccessToken({ sub: 1, email: 'admin@demo.com', role: 'admin', orgId: 1 });
const TOKEN_ORG2 = signAccessToken({ sub: 2, email: 'user@org2.com', role: 'admin', orgId: 2 });

// ── Tests SQL ─────────────────────────────────────────────────────────────────

describe('Chaque query passe organization_id', () => {
  beforeEach(() => mockQuery.mockReset());

  it('listSuppliers inclut organization_id dans le SQL', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { listSuppliers } = await import('../db/invoice-queries');
    await listSuppliers(1);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('organization_id');
    expect(mockQuery.mock.calls[0][1]).toContain(1);
  });

  it('getSupplierById filtre par org ET par id (pas d\'accès cross-tenant)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const { getSupplierById } = await import('../db/invoice-queries');
    await getSupplierById(99, 7);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(99);
    expect(params).toContain(7);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('organization_id');
  });

  it('listInvoices démarre avec organization_id = $1', async () => {
    // Première requête = COUNT, deuxième = SELECT (rows vides pour ne pas mapper)
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // COUNT
      .mockResolvedValueOnce({ rows: [] });               // SELECT
    const { listInvoices } = await import('../db/invoice-queries');
    await listInvoices(3, { limit: 10, offset: 0 });
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.every((sql) => sql.includes('organization_id'))).toBe(true);
    expect(mockQuery.mock.calls[0][1][0]).toBe(3);
  });

  it('exportInvoices filtre par org', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const { exportInvoices } = await import('../db/invoice-queries');
    await exportInvoices(5, {});
    expect(String(mockQuery.mock.calls[0][0])).toContain('organization_id');
    expect(mockQuery.mock.calls[0][1]).toContain(5);
  });

  it('dashboardSummary filtre toutes ses requêtes par org', async () => {
    // 3 requêtes : countsByStatus, monthly (doit avoir rows[0]), topSuppliers
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                       // countsByStatus
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })         // monthly
      .mockResolvedValueOnce({ rows: [] });                      // topSuppliers
    const { dashboardSummary } = await import('../db/invoice-queries');
    await dashboardSummary(9);
    const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.every((sql) => sql.includes('organization_id'))).toBe(true);
    mockQuery.mock.calls.forEach((call) => {
      expect(call[1]).toContain(9);
    });
  });
});

// ── Tests HTTP : isolation inter-tenant ───────────────────────────────────────

describe('Isolation HTTP entre tenants', () => {
  beforeEach(() => mockQuery.mockReset());

  it('GET /suppliers retourne 401 sans token', async () => {
    const res = await request(app).get('/api/v1/suppliers');
    expect(res.status).toBe(401);
  });

  it('un user de l\'orga 1 reçoit 404 sur un supplier de l\'orga 2', async () => {
    // Pool retourne 0 rows → le supplier n'appartient pas à orgId 1
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .get('/api/v1/suppliers/999')
      .set('Authorization', `Bearer ${TOKEN_ORG1}`);
    expect(res.status).toBe(404);
  });

  it('un user de l\'orga 1 reçoit 404 sur une facture de l\'orga 2', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .get('/api/v1/invoices/999')
      .set('Authorization', `Bearer ${TOKEN_ORG1}`);
    expect(res.status).toBe(404);
  });

  it('DELETE d\'un supplier cross-tenant retourne 404', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app)
      .delete('/api/v1/suppliers/999')
      .set('Authorization', `Bearer ${TOKEN_ORG1}`);
    expect(res.status).toBe(404);
  });

  it('l\'orga 1 voit ses 2 suppliers, l\'orga 2 voit les siens (0)', async () => {
    const supplier = (id: number, name: string) => ({
      id, name, siret: null, vat_number: null, iban: null, address: null,
      created_at: new Date(),
    });

    // Orga 1 → 2 suppliers
    mockQuery
      .mockResolvedValueOnce({ rows: [supplier(1, 'Acme'), supplier(2, 'Beta')] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const res1 = await request(app).get('/api/v1/suppliers').set('Authorization', `Bearer ${TOKEN_ORG1}`);

    // Orga 2 → 0 suppliers
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const res2 = await request(app).get('/api/v1/suppliers').set('Authorization', `Bearer ${TOKEN_ORG2}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res2.status).toBe(200);
    expect(res2.body.data).toHaveLength(0);
  });
});
