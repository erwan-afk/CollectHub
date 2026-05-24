import { describe, it, expect, vi } from 'vitest';

// ─── Mocks DB ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../../../db/database', () => ({
  pool: { query: mocks.query },
}));

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { scoreRisk } from '../../../services/fraud/risk-scorer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  orgId: 1,
  supplierId: 42,
  invoiceId: 100,
  invoiceNumber: 'FA-2025-0156',
  issueDate: '2025-06-15',
  amountTtc: 9600,
  iban: 'FR7630006000011234567890189',
};

describe('scoreRisk', () => {
  it('retourne score 0 si pas de supplierId', async () => {
    const result = await scoreRisk({ ...BASE_INPUT, supplierId: null });
    expect(result.score).toBe(0);
    expect(result.flags).toEqual([]);
  });

  it('retourne score 0 si pas de amountTtc', async () => {
    const result = await scoreRisk({ ...BASE_INPUT, amountTtc: null });
    expect(result.score).toBe(0);
  });

  it("détecte un changement d'IBAN (flag rouge, +50)", async () => {
    // checkIbanChanged : IBAN != connu
    // checkAberrantAmount : pas assez d'historique
    // checkDuplicate : pas de doublon
    // checkNonSequentialNumber : pas de numéro
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7612345678901234567890123' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) return { rows: [] };
      if (sql.includes('TO_CHAR')) return { rows: [] };
      if (sql.includes('invoice_number')) return { rows: [] };
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBe(50);
    expect(result.flags.some((f) => f.startsWith('iban_change'))).toBe(true);
  });

  it('détecte un montant aberrant (z-score > 3, +20)', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7630006000011234567890189' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return {
          rows: [
            { amount_ttc: '1000' },
            { amount_ttc: '1100' },
            { amount_ttc: '1050' },
            { amount_ttc: '980' },
            { amount_ttc: '1020' },
          ],
        };
      }
      if (sql.includes('TO_CHAR')) return { rows: [] };
      if (sql.includes('invoice_number')) return { rows: [] };
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBe(20);
    expect(result.flags.some((f) => f.includes('montant_aberrant'))).toBe(true);
  });

  it('détecte un doublon proche (même montant+même mois, +20)', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7630006000011234567890189' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return { rows: [{ amount_ttc: '9600' }, { amount_ttc: '9500' }, { amount_ttc: '9400' }] };
      }
      if (sql.includes('TO_CHAR')) return { rows: [{ id: 99 }] }; // doublon trouvé
      if (sql.includes('invoice_number')) return { rows: [] };
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBe(20);
    expect(result.flags.some((f) => f.includes('doublon_proche'))).toBe(true);
  });

  it('détecte un numéro non-séquentiel (saut > 100, +20)', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7630006000011234567890189' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return { rows: [{ amount_ttc: '9600' }, { amount_ttc: '9500' }, { amount_ttc: '9400' }] };
      }
      if (sql.includes('TO_CHAR')) return { rows: [] };
      if (sql.includes('invoice_number')) {
        return {
          rows: [
            { invoice_number: 'FA-2024-0010' },
            { invoice_number: 'FA-2024-0009' },
            { invoice_number: 'FA-2024-0008' },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBe(20);
    expect(result.flags.some((f) => f.includes('numero_non_sequentiel'))).toBe(true);
  });

  it('détecte une date future (+20)', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7630006000011234567890189' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return { rows: [{ amount_ttc: '9600' }, { amount_ttc: '9500' }, { amount_ttc: '9400' }] };
      }
      if (sql.includes('TO_CHAR')) return { rows: [] };
      if (sql.includes('invoice_number')) return { rows: [] };
      return { rows: [] };
    });

    const result = await scoreRisk({
      ...BASE_INPUT,
      issueDate: '2030-01-15',
    });
    expect(result.flags.some((f) => f.includes('date_future'))).toBe(true);
  });

  it('cumule les scores (IBAN changé + montant aberrant = 70)', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7612345678901234567890123' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return {
          rows: [
            { amount_ttc: '1000' },
            { amount_ttc: '1100' },
            { amount_ttc: '1050' },
            { amount_ttc: '980' },
            { amount_ttc: '1020' },
          ],
        };
      }
      if (sql.includes('TO_CHAR')) return { rows: [] };
      if (sql.includes('invoice_number')) return { rows: [] };
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBe(70);
    expect(result.flags.length).toBe(2);
  });

  it('plafonne le score à 100', async () => {
    mocks.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM suppliers'))
        return { rows: [{ iban: 'FR7612345678901234567890123' }] };
      if (sql.includes('amount_ttc') && sql.includes('90 days')) {
        return { rows: [{ amount_ttc: '1000' }, { amount_ttc: '1100' }, { amount_ttc: '1050' }] };
      }
      if (sql.includes('TO_CHAR')) return { rows: [{ id: 99 }] };
      if (sql.includes('invoice_number')) return { rows: [{ invoice_number: 'FA-2024-0010' }] };
      return { rows: [] };
    });

    const result = await scoreRisk(BASE_INPUT);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
