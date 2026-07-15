-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — Event Store (append-only). Fundação técnica genérica.
-- NÃO contém entidades de negócio (Missão, Pessoa, etc.) — apenas a mecânica
-- de armazenamento de eventos, agnóstica de domínio. O domínio entra em sprints
-- futuras, derivado do Livro Mestre.
--
-- Compatibilidade com o Livro Mestre:
--   • Lei 3 / Lei 4 / DF-11 / Art. 14º — histórico perpétuo, nada é apagado,
--     rastreabilidade integral: UPDATE e DELETE são estruturalmente proibidos.
--   • DF-05 / DF-14 — distinção Evento Relevante × Informativo (coluna is_relevant).
--   • E12-L09 — Evento Relevante fundado em Fato reconhecido (fact_ref).
--   • DF-09 — decisões automatizadas registram decisor/tipo/fundamento.
--   • DF-13 — automação referencia Regra Operacional (operational_rule_ref).
--   • E8-L03 / Lei 2 — uma cadeia por stream, versão sequencial (unicidade).
--   • R9 — cadeia reconstituível: encadeamento por hash.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabela única de eventos. "stream" é a raiz de consistência (uma Missão será um
-- stream, mas isto é genérico: o event store não conhece o domínio).
CREATE TABLE IF NOT EXISTS event_store.events (
  -- Identidade do evento (imutável).
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),

  -- Stream: raiz de consistência e ordenação.
  stream_type      text        NOT NULL,
  stream_id        uuid        NOT NULL,
  version          integer     NOT NULL CHECK (version >= 1),

  -- Natureza epistemológica do evento (Canon DF-05 / DF-14).
  event_type       text        NOT NULL,
  is_relevant      boolean     NOT NULL, -- true = Evento Relevante; false = Informativo

  -- Conteúdo e metadados (sem esquema de negócio fixo nesta fase).
  payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Rastreabilidade constitucional (Canon Art. 14º / DF-09 / DF-13 / E11-E12).
  -- Preenchidos pela camada de aplicação; NULL permitido nesta fundação genérica.
  fact_ref             uuid,   -- Fato reconhecido que fundamenta um Evento Relevante (E12-L09)
  actor                text,   -- quem atuou (DECISOR — humano ou AHRI) (Art. 14º / DF-09)
  decision_type        text,   -- TIPO (ex.: "Decisão Operacional Automatizada") (DF-09)
  fundamento           text,   -- FUNDAMENTO (Regra Constitucional + Regra Operacional) (DF-09)
  operational_rule_ref text,   -- Regra Operacional referenciada (DF-13)

  -- Encadeamento verificável (R9 — cadeia reconstituível).
  previous_hash    text,
  hash             text        NOT NULL,

  -- Tempos.
  occurred_at      timestamptz NOT NULL, -- quando o fato ocorreu na Realidade
  recorded_at      timestamptz NOT NULL DEFAULT now(), -- quando foi reconhecido pelo Sistema

  -- Sequência global monotônica para leitura ordenada / projeções.
  global_seq       bigint      GENERATED ALWAYS AS IDENTITY,

  CONSTRAINT events_pk PRIMARY KEY (id),
  -- Uma cadeia por stream, versão única e sequencial (concorrência otimista).
  CONSTRAINT events_stream_version_uq UNIQUE (stream_type, stream_id, version),
  -- Evento Relevante deve declarar o Fato que o fundamenta (E12-L09).
  CONSTRAINT events_relevant_requires_fact
    CHECK (is_relevant = false OR fact_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS events_stream_idx
  ON event_store.events (stream_type, stream_id, version);
CREATE INDEX IF NOT EXISTS events_global_seq_idx
  ON event_store.events (global_seq);
CREATE INDEX IF NOT EXISTS events_relevant_idx
  ON event_store.events (is_relevant) WHERE is_relevant = true;

-- ── Append-only: UPDATE e DELETE proibidos no nível do banco (Lei 3 / DF-11) ──
CREATE OR REPLACE FUNCTION event_store.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'event_store.events é append-only (Livro Mestre: Lei 3, DF-11). % proibido; correcoes geram novos eventos.',
    TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS events_no_update ON event_store.events;
CREATE TRIGGER events_no_update
  BEFORE UPDATE ON event_store.events
  FOR EACH ROW EXECUTE FUNCTION event_store.forbid_mutation();

DROP TRIGGER IF EXISTS events_no_delete ON event_store.events;
CREATE TRIGGER events_no_delete
  BEFORE DELETE ON event_store.events
  FOR EACH ROW EXECUTE FUNCTION event_store.forbid_mutation();

-- ── Transactional Outbox ─────────────────────────────────────────────────────
-- Garante atomicidade entre gravar o evento e disparar efeitos (nada se perde —
-- Lei 3). Um worker publica; após publicado, marca-se published_at (esta tabela
-- NÃO é append-only: é fila de trabalho técnica, distinta do event store).
CREATE TABLE IF NOT EXISTS event_store.outbox (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES event_store.events (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      integer     NOT NULL DEFAULT 0,
  CONSTRAINT outbox_pk PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
  ON event_store.outbox (created_at) WHERE published_at IS NULL;
