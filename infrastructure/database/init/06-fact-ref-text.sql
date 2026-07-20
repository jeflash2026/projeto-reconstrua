-- ─────────────────────────────────────────────────────────────────────────────
-- 06 — fact_ref: uuid → text (correção GO-LIVE, 2026-07-20).
--
-- CAUSA RAIZ provada em produção: fact_ref é uma REFERÊNCIA DE EVIDÊNCIA
-- (Lei 10 / E12-L09) e, nos eventos fundados em mensagem real, carrega o
-- messageId do WhatsApp (ex.: 3AE87DBE4E5850C0775E) — que NÃO é UUID. A coluna
-- nasceu `uuid` e rejeitava TODO append fundado em mensagem
-- ("invalid input syntax for type uuid") ⇒ o Mission Runtime falhava
-- silenciosamente e NENHUM evento persistiu em produção até esta migração
-- (event_store.events estava vazio; verificado em 2026-07-20). O event store em
-- memória dos testes não valida tipo — por isso as suítes sempre passaram.
--
-- Forward-only e segura: a tabela é append-only, estava vazia em produção e
-- nenhuma FK/índice aponta para fact_ref. `USING fact_ref::text` preserva
-- qualquer valor existente em outros ambientes.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE event_store.events
  ALTER COLUMN fact_ref TYPE text USING fact_ref::text;
