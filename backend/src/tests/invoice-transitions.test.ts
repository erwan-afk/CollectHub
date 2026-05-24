/**
 * Tests de la machine à états des factures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetInvoiceById, mockTransition } = vi.hoisted(() => ({
  mockGetInvoiceById: vi.fn(),
  mockTransition: vi.fn(),
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
  pool: { query: vi.fn() },
  db: {},
}));

vi.mock('../db/invoice-queries', async (importOriginal) => {
  const real = await importOriginal<typeof import('../db/invoice-queries')>();
  return { ...real, getInvoiceById: mockGetInvoiceById, transitionInvoiceStatus: mockTransition };
});

vi.mock('../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../services/auth.service')>();
  return { ...real };
});

import app from '../app';
import { signAccessToken } from '../services/auth.service';
import type { Invoice } from '../types/invoice';

const TOKEN = signAccessToken({
  sub: 1,
  email: 'comptable@demo.com',
  role: 'accountant',
  orgId: 1,
});

function makeInvoice(status: Invoice['status']): Invoice {
  return {
    id: 1,
    supplierId: null,
    supplier: null,
    invoiceNumber: 'F-001',
    issueDate: '2025-01-01',
    dueDate: '2025-02-01',
    amountHt: 100,
    amountTva: 20,
    amountTtc: 120,
    currency: 'EUR',
    status,
    filePath: '/tmp/test.pdf',
    fileMime: 'application/pdf',
    fileHash: 'abc',
    ocrConfidence: null,
    lines: [],
    riskAssessment: null,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Transitions valides ───────────────────────────────────────────────────────

describe('Transitions valides', () => {
  beforeEach(() => {
    mockGetInvoiceById.mockReset();
    mockTransition.mockReset();
  });

  const validCases: Array<[Invoice['status'], Invoice['status']]> = [
    ['DRAFT', 'PENDING_VALIDATION'],
    ['DRAFT', 'REJECTED'],
    ['PENDING_VALIDATION', 'VALIDATED'],
    ['PENDING_VALIDATION', 'REJECTED'],
    ['PENDING_VALIDATION', 'DRAFT'],
    ['VALIDATED', 'ARCHIVED'],
    ['REJECTED', 'DRAFT'],
    ['REJECTED', 'ARCHIVED'],
  ];

  it.each(validCases)('%s → %s retourne 200', async (from, to) => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice(from));
    mockTransition.mockResolvedValue({ invoice: makeInvoice(to), from });
    const res = await request(app)
      .post('/api/v1/invoices/1/transition')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ to });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(to);
  });
});

// ── Transitions invalides ─────────────────────────────────────────────────────

describe('Transitions invalides', () => {
  beforeEach(() => {
    mockGetInvoiceById.mockReset();
    mockTransition.mockReset();
  });

  const invalidCases: Array<[Invoice['status'], Invoice['status']]> = [
    ['DRAFT', 'VALIDATED'],
    ['DRAFT', 'ARCHIVED'],
    ['VALIDATED', 'DRAFT'],
    ['VALIDATED', 'PENDING_VALIDATION'],
    ['ARCHIVED', 'DRAFT'],
    ['ARCHIVED', 'VALIDATED'],
  ];

  it.each(invalidCases)('%s → %s retourne 409', async (from, to) => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice(from));
    const res = await request(app)
      .post('/api/v1/invoices/1/transition')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ to });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Illegal transition');
    expect(res.body.details).toMatchObject({ from, to });
  });
});

// ── Cas limites ───────────────────────────────────────────────────────────────

describe('Cas limites', () => {
  beforeEach(() => {
    mockGetInvoiceById.mockReset();
    mockTransition.mockReset();
  });

  it("retourne 404 si la facture n'existe pas", async () => {
    mockGetInvoiceById.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/invoices/999/transition')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ to: 'PENDING_VALIDATION' });
    expect(res.status).toBe(404);
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/1/transition')
      .send({ to: 'PENDING_VALIDATION' });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si le statut cible est inconnu', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/1/transition')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ to: 'STATUT_INEXISTANT' });
    expect(res.status).toBe(400);
  });
});
