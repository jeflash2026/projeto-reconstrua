-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — Snapshots do Event Store (otimização de reidratação).
-- Insert-only: um snapshot é uma foto do estado reconstruído numa versão; jamais
-- substitui eventos (a fonte da verdade é o event_store.events — Lei 3/DF-11).
-- Vive no schema event_store (lado de ESCRITA); a role de leitura não o enxerga
-- (item 12) — snapshots são detalhe de reconstrução, nunca fonte para interfaces.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_store.snapshots (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  stream_type  text        NOT NULL,
  stream_id    uuid        NOT NULL,
  version      integer     NOT NULL CHECK (version >= 1),
  state        jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snapshots_pk PRIMARY KEY (id)
);

-- Leitura do snapshot mais recente por stream.
CREATE INDEX IF NOT EXISTS snapshots_latest_idx
  ON event_store.snapshots (stream_type, stream_id, version DESC);

-- Coerência com o ethos append-only: proibir UPDATE/DELETE também nos snapshots
-- (são descartáveis por recomputação, mas jamais mutados no lugar).
DROP TRIGGER IF EXISTS snapshots_no_update ON event_store.snapshots;
CREATE TRIGGER snapshots_no_update
  BEFORE UPDATE ON event_store.snapshots
  FOR EACH ROW EXECUTE FUNCTION event_store.forbid_mutation();

DROP TRIGGER IF EXISTS snapshots_no_delete ON event_store.snapshots;
CREATE TRIGGER snapshots_no_delete
  BEFORE DELETE ON event_store.snapshots
  FOR EACH ROW EXECUTE FUNCTION event_store.forbid_mutation();
