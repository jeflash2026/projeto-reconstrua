-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua CNH (2026-09-18) — o funil de captação da tese de CNH tem os
-- PRÓPRIOS dados, separados do consignado: schema cnh com o mesmo armazenamento
-- genérico de documentos (namespace × key → JSONB) do schema production. O
-- serviço cnh-api grava SÓ aqui (PgJsonStore com tabela cnh.documents).
-- Migração forward-only e idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS cnh;

CREATE TABLE IF NOT EXISTS cnh.documents (
  namespace   text        NOT NULL,
  key         text        NOT NULL,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cnh_documents_pk PRIMARY KEY (namespace, key)
);

CREATE INDEX IF NOT EXISTS cnh_documents_namespace_idx ON cnh.documents (namespace);
