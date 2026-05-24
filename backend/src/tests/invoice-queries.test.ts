/**
 * Tests unitaires pour db/invoice-queries.ts.
 * On mock pool.query pour isoler la logique de mapping et de construction SQL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  pool: { query: mockQuery, connect: vi.fn() },
  db: {},
}));

import { pool } from '../db/database';
import {
  getInvoiceById,
  createInvoice,
  findInvoiceByHash,
  findInvoiceBySupplierAndNumber,
  insertInvoiceLines,
  updateInvoice,
  transitionInvoiceStatus,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  topSuppliers,
  countSuppliers,
} from '../db/invoice-queries';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date();

const invoiceRow = {
  id: 1,
  supplier_id: null,
  invoice_number: 'F-001',
  issue_date: NOW,
  due_date: NOW,
  amount_ht: '100.00',
  amount_tva: '20.00',
  amount_ttc: '120.00',
  currency: 'EUR',
  status: 'DRAFT',
  file_path: '/tmp/test.pdf',
  file_mime: 'application/pdf',
  ocr_raw_text: null,
  ocr_confidence: null,
  file_hash: 'abc123',
  created_at: NOW,
  updated_at: NOW,
};

// ── getInvoiceById ────────────────────────────────────────────────────────────

describe('getInvoiceById', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne null quand la facture n\'existe pas', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getInvoiceById(99, 1);
    expect(result).toBeNull();
  });

  it('retourne la facture avec ses lignes et son historique', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [invoiceRow] })          // invoice
      .mockResolvedValueOnce({ rows: [] })                    // lines
      .mockResolvedValueOnce({ rows: [] });                   // history (pas de supplier car supplier_id null)

    const result = await getInvoiceById(1, 1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.currency).toBe('EUR');
    expect(result!.status).toBe('DRAFT');
    expect(result!.lines).toEqual([]);
    expect(result!.history).toEqual([]);
  });

  it('hydrate le fournisseur quand supplier_id est défini', async () => {
    const rowWithSupplier = { ...invoiceRow, supplier_id: 5 };
    mockQuery
      .mockResolvedValueOnce({ rows: [rowWithSupplier] })     // invoice
      .mockResolvedValueOnce({ rows: [] })                    // lines
      .mockResolvedValueOnce({ rows: [] })                    // history
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Acme', siret: null, vat_number: null, iban: null, address: null, created_at: NOW }] }); // supplier

    const result = await getInvoiceById(1, 1);
    expect(result!.supplierId).toBe(5);
    expect(result!.supplier?.name).toBe('Acme');
  });
});

// ── findInvoiceByHash ─────────────────────────────────────────────────────────

describe('findInvoiceByHash', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne null si aucune facture avec ce hash', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await findInvoiceByHash(1, 'unknown')).toBeNull();
  });

  it('retourne la facture si le hash correspond', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [invoiceRow] });
    const result = await findInvoiceByHash(1, 'abc123');
    expect(result!.fileHash).toBe('abc123');
  });
});

// ── findInvoiceBySupplierAndNumber ────────────────────────────────────────────

describe('findInvoiceBySupplierAndNumber', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne null si pas de doublon', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await findInvoiceBySupplierAndNumber(1, 5, 'F-999')).toBeNull();
  });

  it('retourne la facture si le couple fournisseur/numéro existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [invoiceRow] });
    const result = await findInvoiceBySupplierAndNumber(1, 5, 'F-001');
    expect(result!.invoiceNumber).toBe('F-001');
  });
});

// ── createInvoice ─────────────────────────────────────────────────────────────

describe('createInvoice', () => {
  beforeEach(() => mockQuery.mockReset());

  it('insère la facture et retourne le résultat mappé', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [invoiceRow] });
    const result = await createInvoice({
      organizationId: 1,
      supplierId: null,
      invoiceNumber: 'F-001',
      issueDate: '2025-01-01',
      dueDate: '2025-02-01',
      amountHt: 100,
      amountTva: 20,
      amountTtc: 120,
      currency: 'EUR',
      filePath: '/tmp/test.pdf',
      fileMime: 'application/pdf',
      ocrRawText: null,
      ocrConfidence: null,
      fileHash: 'abc123',
    });
    expect(result.id).toBe(1);
    expect(result.status).toBe('DRAFT');
    // Vérifie que organization_id est dans les paramètres
    expect(mockQuery.mock.calls[0][1]).toContain(1); // organizationId
  });
});

// ── insertInvoiceLines ────────────────────────────────────────────────────────

describe('insertInvoiceLines', () => {
  beforeEach(() => mockQuery.mockReset());

  it('ne fait aucun appel si le tableau est vide', async () => {
    await insertInvoiceLines(1, []);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('insère chaque ligne avec la bonne position', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await insertInvoiceLines(1, [
      { id: 0, description: 'Ligne 1', quantity: 2, unitPrice: 50, total: 100 },
      { id: 0, description: 'Ligne 2', quantity: 1, unitPrice: 200, total: 200 },
    ]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    // Vérifie les positions 0 et 1
    expect(mockQuery.mock.calls[0][1][5]).toBe(0);
    expect(mockQuery.mock.calls[1][1][5]).toBe(1);
  });
});

// ── updateInvoice ─────────────────────────────────────────────────────────────

describe('updateInvoice', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne null si la facture n\'appartient pas à l\'orga', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)         // BEGIN
        .mockResolvedValueOnce({ rows: [] })      // UPDATE → 0 rows → not found
        .mockResolvedValueOnce(undefined),        // ROLLBACK
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(mockClient as never);

    const result = await updateInvoice(99, 2, { currency: 'USD' });
    expect(result).toBeNull();
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ── createSupplier / updateSupplier / deleteSupplier ──────────────────────────

describe('Suppliers CRUD', () => {
  beforeEach(() => mockQuery.mockReset());

  it('createSupplier passe organization_id en premier paramètre', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Acme', siret: null, vat_number: null, iban: null, address: null, created_at: NOW }],
    });
    await createSupplier(7, { name: 'Acme' });
    expect(mockQuery.mock.calls[0][1][0]).toBe(7); // orgId en position 0
    expect(mockQuery.mock.calls[0][1][1]).toBe('Acme');
  });

  it('updateSupplier filtre par id ET orgId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // not found
    const result = await updateSupplier(99, 3, { name: 'X' });
    expect(result).toBeNull();
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain(99); // id
    expect(params).toContain(3);  // orgId
  });

  it('deleteSupplier retourne false si rien supprimé', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteSupplier(99, 1)).toBe(false);
  });

  it('deleteSupplier retourne true si supprimé', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await deleteSupplier(1, 1)).toBe(true);
  });
});

// ── countSuppliers ────────────────────────────────────────────────────────────

describe('countSuppliers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne le total de l\'orga', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }] });
    expect(await countSuppliers(1)).toBe(42);
    expect(mockQuery.mock.calls[0][1]).toContain(1);
  });
});

// ── topSuppliers ──────────────────────────────────────────────────────────────

describe('topSuppliers', () => {
  beforeEach(() => mockQuery.mockReset());

  it('retourne les top fournisseurs filtrés par org', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ supplier_id: 1, name: 'Acme', invoice_count: '5', total_ttc: '6000' }],
    });
    const result = await topSuppliers(1, 5, 90);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Acme');
    expect(result[0].totalTtc).toBe(6000);
    expect(mockQuery.mock.calls[0][1]).toContain(1); // orgId
  });
});
