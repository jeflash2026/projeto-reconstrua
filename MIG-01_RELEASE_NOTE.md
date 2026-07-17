# MIG-01 — RELEASE NOTE
### Mecanismo oficial de migrations (forward-only, idempotente, banco já existente)

**Capacidade:** evolução de schema do banco. **Commit:** `5a8b1ee` · **Data:** 2026-07-16
**Base:** `f6d0f54` → **HEAD:** `5a8b1ee`

---

## Objetivo
Substituir definitivamente o `docker-entrypoint-initdb.d` (que só roda no 1º boot de um banco
vazio) por um mecanismo oficial de migrations que funciona em **banco já instalado**, é
**forward-only**, **idempotente**, e **nunca coloca DDL na aplicação** — todo DDL vive nos `.sql`.

## Como funciona
- Migrations = `infrastructure/database/init/NN-*.sql`, aplicadas em ordem alfabética.
- Runner dedicado (`apps/api/dist/migrate/main.js`, **separado de `production/main.ts`**) aplica só
  as ainda não registradas no ledger `public.schema_migrations`, **uma por transação**, com
  **checksum sha256** (normalizado LF). Editar migration aplicada ⇒ **falha** (forward-only).
- Compose: serviço one-shot `migrate` (`depends_on: postgres healthy`); a `api` depende de
  `migrate` com `service_completed_successfully`. O `deploy.sh` permanece **intocado** — o
  `up -d api` resolve a cadeia postgres → migrate → api.

## Riscos (produção) — resultado
- **P0 fail-closed:** migration ruim bloquearia o deploy (api não sobe), nunca corromperia. No
  deploy real, o `migrate` **adotou o banco existente** e a api subiu → **sem incidente**.
- **P1:** runner roda como owner via `DATABASE_URL`; sem segredo/porta/exposição novos.
- **P2:** reusa `DATABASE_URL`/`POSTGRES_PASSWORD`; nenhum env novo obrigatório.
- **P3/P4:** documentado no `infrastructure/database/README.md`; checksum normaliza CRLF/LF;
  `pg_advisory_lock` serializa runners.

## Validação de produção (não apenas testes)
- **Deploy CI/CD do `5a8b1ee`: Success (54s)** — o serviço `migrate` rodou contra o **Postgres de
  produção já existente**, concluiu com êxito, e a `api` (dependente de `service_completed_
  successfully`) subiu.
- **Go-Live ao vivo pós-MIG-01:** `ready:true`; gates `postgres`, `event-store`, `read-models`,
  `dispatcher` = **passed**.
- **Portões locais:** typecheck (infra+api) OK; **lint limpo**; **migrator 6/6**.

## Escopo preservado
Sem tocar Event Store, Mission Runtime, DocumentAggregate, RecognizeDocument, Conversation
Runtime nem qualquer runtime de produção além do mecanismo de migrations. **Nada da CAT-02A**
(sem `media_blobs`, sem MediaStore, sem gateway de mídia).

## Rollback
`git revert 5a8b1ee` + push → remove o serviço `migrate`, restaura a montagem `initdb.d`, remove
runner/COPY. A tabela `schema_migrations` permanece (aditiva, inerte). MIG-01 **não criou nenhum
objeto de domínio** (só o ledger, adotando `00–04`), então reverter deixa o schema idêntico e
funcional. Emergência: rollback de imagem via `deploy.sh`.

## Declaração
**MIG-01 APROVADA PARA PRODUÇÃO**
