-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — MÍDIA (CAT-02A). Migração forward-only aplicada pelo mecanismo
-- MIG-01. Armazena os BYTES REAIS recebidos do cliente, content-addressed por
-- sha256 (deduplicação natural + prova de integridade). Imutável.
-- Depende do schema `production` (criado em 04-production.sql).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production.media_blobs (
  sha256      text        PRIMARY KEY,   -- sha256 hex do conteúdo (content-addressed)
  mime        text        NOT NULL,
  size        integer     NOT NULL,
  bytes       bytea       NOT NULL,      -- conteúdo real, imutável
  created_at  timestamptz NOT NULL DEFAULT now()
);
