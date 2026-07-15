-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — PRODUÇÃO REAL (Sprint 4A). Migração forward-only: schema
-- production com o armazenamento genérico de documentos (namespace × key → JSONB)
-- que sustenta config, memória viva, sessões, cursores, decisões, equipe,
-- atribuições, trabalho jurídico, métricas, identidades, scheduler, handoff,
-- progresso e produtividade. Não altera 01/02/03 (Event Store / Snapshots /
-- Deliveries), que continuam sendo a fonte da verdade de domínio.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS production;

CREATE TABLE IF NOT EXISTS production.documents (
  namespace   text        NOT NULL,
  key         text        NOT NULL,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_pk PRIMARY KEY (namespace, key)
);

CREATE INDEX IF NOT EXISTS documents_namespace_idx ON production.documents (namespace);
