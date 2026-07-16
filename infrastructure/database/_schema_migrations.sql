-- ─────────────────────────────────────────────────────────────────────────────
-- LEDGER de migrations (MIG-01). METADADO do mecanismo de migração — NÃO é schema
-- de domínio. Idempotente: o runner o aplica no início de cada execução.
-- Registra qual migration (version) foi aplicada, com que conteúdo (checksum) e quando.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version     text        PRIMARY KEY,
  checksum    text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
