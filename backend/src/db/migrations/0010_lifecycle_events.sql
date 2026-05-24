-- Sprint 5 — 4 regulatory lifecycle statuses (réforme DGFiP)
-- These track the invoice journey between PDPs on the e-invoicing network,
-- distinct from internal workflow statuses in invoice_status_history.

CREATE TYPE lifecycle_status AS ENUM (
  'DEPOSITED',       -- Déposée : sent on the PDP network
  'REFUSED',         -- Refusée : rejected by the recipient PDP
  'MADE_AVAILABLE',  -- Mise à disposition : received by recipient
  'SETTLED'          -- Encaissée : payment confirmed
);

CREATE TABLE invoice_lifecycle_events (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status       lifecycle_status NOT NULL,
  occurred_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  actor        TEXT           NOT NULL,           -- email or 'system'
  comment      TEXT
);

CREATE INDEX idx_lifecycle_events_invoice_id ON invoice_lifecycle_events(invoice_id);
