-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — Ledger de ENTREGAS + IDEMPOTÊNCIA (Event Dispatcher — Sprint 2A.2).
-- Migração forward-only (ADR-0001 item 8): apenas CREATE IF NOT EXISTS; não altera
-- os arquivos 01/02 (Event Store / Snapshots). Vive no schema event_store (lado de
-- ESCRITA); a role de leitura não o enxerga (item 12).
--
-- Uma entrega por (evento × subscriber): dá isolamento, ordenação por stream,
-- retry/backoff e Dead Letter Queue por entrega, sem all-or-nothing. Não é
-- append-only (é fila de trabalho técnica, como a outbox) — mas nada some: os
-- estados transitam (pending → delivered | dead) e ficam auditáveis.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_store.deliveries (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES event_store.events (id),
  subscriber      text        NOT NULL,
  -- Chaves de ordenação (copiadas do evento) — FIFO por stream × subscriber.
  stream_type     text        NOT NULL,
  stream_id       uuid        NOT NULL,
  version         integer     NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'delivered', 'dead')),
  attempts        integer     NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  locked_at       timestamptz,
  locked_by       text,
  CONSTRAINT deliveries_pk PRIMARY KEY (id),
  -- Idempotência do enqueue: uma entrega por (evento, subscriber).
  CONSTRAINT deliveries_event_subscriber_uq UNIQUE (event_id, subscriber)
);

-- Reivindicação ordenada por stream × subscriber (head-of-line).
CREATE INDEX IF NOT EXISTS deliveries_head_idx
  ON event_store.deliveries (stream_type, stream_id, subscriber, version)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS deliveries_status_idx
  ON event_store.deliveries (status);
CREATE INDEX IF NOT EXISTS deliveries_locked_idx
  ON event_store.deliveries (locked_at) WHERE locked_at IS NOT NULL;

-- Camada de idempotência: (subscriber × evento) processado.
CREATE TABLE IF NOT EXISTS event_store.idempotency (
  subscriber    text        NOT NULL,
  event_id      uuid        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_pk PRIMARY KEY (subscriber, event_id)
);
