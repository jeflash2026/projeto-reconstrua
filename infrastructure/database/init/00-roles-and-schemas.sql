-- ─────────────────────────────────────────────────────────────────────────────
-- Reconstrua — Bootstrap de roles e schemas (idempotente).
-- Fundação técnica (Sprint 0). NÃO contém domínio, entidades nem regras de negócio.
--
-- Compatibilidade com o Livro Mestre:
--   • DF-08 / item 12: separação estrutural entre o lado de ESCRITA (event_store)
--     e o lado de LEITURA (read_model). Interfaces JAMAIS acessam o event_store.
--   • Lei 1 / DF-02: fonte única de estado (o event_store é a única origem).
-- ─────────────────────────────────────────────────────────────────────────────

-- Roles (senhas são definidas/rotacionadas fora daqui; aqui apenas garantimos existência).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reconstrua_app') THEN
    CREATE ROLE reconstrua_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reconstrua_read') THEN
    CREATE ROLE reconstrua_read LOGIN;
  END IF;
END
$$;

-- Schemas.
CREATE SCHEMA IF NOT EXISTS event_store AUTHORIZATION reconstrua_app;
CREATE SCHEMA IF NOT EXISTS read_model AUTHORIZATION reconstrua_app;

-- Item 12 do Canon aplicado de forma ESTRUTURAL:
-- a role de leitura (usada por toda interface) não enxerga o event_store.
REVOKE ALL ON SCHEMA event_store FROM reconstrua_read;
GRANT USAGE ON SCHEMA read_model TO reconstrua_read;

-- Por padrão, a role de leitura só recebe SELECT em objetos do read_model
-- (as tabelas de read model serão criadas em sprints futuras).
ALTER DEFAULT PRIVILEGES FOR ROLE reconstrua_app IN SCHEMA read_model
  GRANT SELECT ON TABLES TO reconstrua_read;

-- A aplicação de escrita opera no event_store.
GRANT USAGE ON SCHEMA event_store TO reconstrua_app;
ALTER DEFAULT PRIVILEGES FOR ROLE reconstrua_app IN SCHEMA event_store
  GRANT INSERT, SELECT ON TABLES TO reconstrua_app;
