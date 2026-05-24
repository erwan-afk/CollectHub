-- Sprint 4 — Agent IA conversationnel : pgvector + traces

-- Extension pgvector (disponible sur Neon)
CREATE EXTENSION IF NOT EXISTS vector;

-- Colonne embedding sur les lignes de facture (nomic-embed-text = 768 dim)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS description_embedding vector(768);

-- Index HNSW pour la recherche cosinus
CREATE INDEX IF NOT EXISTS idx_invoice_lines_embedding
  ON invoice_lines USING hnsw (description_embedding vector_cosine_ops);

-- Table de traces des sessions agent
CREATE TABLE IF NOT EXISTS ai_agent_traces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  messages        JSONB NOT NULL DEFAULT '[]',
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  final_answer    TEXT NOT NULL DEFAULT '',
  provider        VARCHAR(50) NOT NULL,
  model           VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_traces_org     ON ai_agent_traces(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user    ON ai_agent_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created ON ai_agent_traces(created_at DESC);
