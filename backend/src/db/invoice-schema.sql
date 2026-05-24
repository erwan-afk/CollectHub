CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  siret      VARCHAR(14) UNIQUE,
  vat_number VARCHAR(20),
  iban       VARCHAR(34),
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM
    ('PROCESSING','DRAFT','PENDING_VALIDATION','VALIDATED','REJECTED','ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number  VARCHAR(100),
  issue_date      DATE,
  due_date        DATE,
  amount_ht       NUMERIC(12,2),
  amount_tva      NUMERIC(12,2),
  amount_ttc      NUMERIC(12,2),
  currency        CHAR(3) NOT NULL DEFAULT 'EUR',
  status          invoice_status NOT NULL DEFAULT 'DRAFT',
  file_path       VARCHAR(512) NOT NULL,
  file_mime       VARCHAR(100),
  ocr_raw_text    TEXT,
  ocr_confidence  JSONB,
  file_hash       VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier    ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date  ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_file_hash   ON invoices(file_hash);

-- Empêche d'insérer 2 factures avec le même n° pour un même fournisseur.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_supplier_number
  ON invoices(supplier_id, invoice_number)
  WHERE supplier_id IS NOT NULL AND invoice_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_status_history (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  from_status invoice_status,
  to_status   invoice_status NOT NULL,
  reason      TEXT,
  actor       VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
