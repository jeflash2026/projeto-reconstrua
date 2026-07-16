# Banco de dados — fundação (Sprint 0)

PostgreSQL 16. Dois schemas, com separação estrutural exigida pelo Livro Mestre:

- **`event_store`** — lado de **escrita**. Fonte única e append-only da verdade (Lei 1, DF-02, DF-08). `UPDATE`/`DELETE` são bloqueados por trigger (Lei 3, DF-11). Acessível apenas pela role `reconstrua_app`.
- **`read_model`** — lado de **leitura**. Projeções derivadas da Verdade Operacional. É a **única** superfície que as interfaces consultam (item 12 da decisão do fundador; DF-08). Role `reconstrua_read` só enxerga este schema.

## Migrations — mecanismo oficial (MIG-01)

**Forward-only, idempotente, funciona em banco novo E já existente.** Substitui o
`docker-entrypoint-initdb.d` (que só rodava no 1º boot de um banco vazio).

- As migrations são os arquivos `init/NN-*.sql`, aplicados em **ordem alfabética**.
- O runner dedicado (`apps/api/dist/migrate/main.js`) aplica **apenas as ainda não registradas**
  no ledger `public.schema_migrations`, **uma por transação**, com **checksum sha256** (normalizado
  LF). Editar uma migration já aplicada faz o runner **falhar** (forward-only).
- O ledger é criado idempotentemente por `_schema_migrations.sql` no início de cada execução.
- Orquestração: no `docker-compose.production.yml`, o serviço one-shot `migrate` roda com
  `depends_on: postgres (healthy)`, e a `api` depende dele com `service_completed_successfully`.
  O `deploy.sh` permanece intocado.

### Adicionar uma migration
1. Crie `init/NN-descricao.sql` (próximo número; use `CREATE ... IF NOT EXISTS`).
2. **Nunca edite** uma migration já aplicada — crie uma nova.
3. No deploy, o serviço `migrate` a aplica automaticamente antes da `api`.

> **A aplicação nunca executa DDL** — todo DDL vive nestes arquivos `.sql`. Banco existente é
> **adotado**: como os `.sql` são idempotentes (`IF NOT EXISTS`), reaplicá-los é no-op e apenas
> popula o ledger.

## Local

```bash
pnpm db:up      # sobe o Postgres (o dono controla ambientes; o CI não sobe banco)
pnpm db:down
```

Nenhuma aplicação e nenhum dev server são iniciados por estes comandos.
