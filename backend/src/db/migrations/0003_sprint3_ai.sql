-- Sprint 3 — IA extraction + fraude
-- Ajout de risk_assessment sur invoices et table extraction_corrections

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS risk_assessment JSONB;

CREATE TABLE IF NOT EXISTS extraction_corrections (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_id      INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  field           VARCHAR(50) NOT NULL,
  raw_text_snippet TEXT NOT NULL DEFAULT '',
  ai_value        TEXT NOT NULL DEFAULT '',
  corrected_value TEXT NOT NULL,
  cost_usd        NUMERIC(10, 8) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_supplier ON extraction_corrections(supplier_id);
CREATE INDEX IF NOT EXISTS idx_corrections_org ON extraction_corrections(org_id);
