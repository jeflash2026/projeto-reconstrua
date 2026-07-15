# Banco de dados — fundação (Sprint 0)

PostgreSQL 16. Dois schemas, com separação estrutural exigida pelo Livro Mestre:

- **`event_store`** — lado de **escrita**. Fonte única e append-only da verdade (Lei 1, DF-02, DF-08). `UPDATE`/`DELETE` são bloqueados por trigger (Lei 3, DF-11). Acessível apenas pela role `reconstrua_app`.
- **`read_model`** — lado de **leitura**. Projeções derivadas da Verdade Operacional. É a **única** superfície que as interfaces consultam (item 12 da decisão do fundador; DF-08). Role `reconstrua_read` só enxerga este schema.

## Ordem de aplicação (idempotente)

Os arquivos em `init/` rodam automaticamente na primeira subida do container (`docker-entrypoint-initdb.d`), em ordem alfabética:

1. `00-roles-and-schemas.sql` — roles e schemas + grants.
2. `01-event-store.sql` — tabela `events` (append-only) + `outbox`.

> Nesta fase **não há tabelas de negócio** (Missão, Pessoa, etc.). O event store é genérico; o domínio entra em sprints futuras, derivado do Canon. As migrations versionadas de domínio serão geridas por **Drizzle** (`drizzle-kit`) a partir do Sprint 1.

## Local

```bash
pnpm db:up      # sobe o Postgres (o dono controla ambientes; o CI não sobe banco)
pnpm db:down
```

Nenhuma aplicação e nenhum dev server são iniciados por estes comandos.
