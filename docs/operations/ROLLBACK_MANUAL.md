# Manual de Rollback — AHRIOS

## Princípio
O Event Store é **append-only** (Lei 3): nenhum rollback apaga história. Rollback
= voltar o CÓDIGO; os dados permanecem íntegros e auditáveis.

## Rollback de aplicação (minutos)
1. `git checkout <tag-anterior>` (toda subida deve ser taggeada: `prod-YYYYMMDD-N`).
2. `docker compose -f docker-compose.production.yml up -d --build`.
3. O GO-LIVE roda de novo no boot; vermelho ⇒ não sobe (proteção também no rollback).
4. Verificar `/production/go-live` e `/production/monitor`.

## Rollback de migração
Migrações são **forward-only** e idempotentes (`CREATE IF NOT EXISTS`). Nunca
escreva `DROP` em rollback. Se uma migração nova causou problema, o rollback de
código basta (o schema antigo continua compatível — as tabelas novas ficam ociosas).

## Parada de emergência (kill switch)
- **Parar de atender sem derrubar dados**: desligar o webhook na Evolution
  (mensagens ficam na fila do WhatsApp; nada se perde) e/ou `docker compose stop api`.
- O Postgres NUNCA é derrubado no kill switch.
- Retomada: religar o webhook; a AHRI processa as mensagens pendentes com
  idempotência (mesma mensagem nunca processa 2×).

## Rollback de configuração
A configuração é versionável por edição (`/production/config`). Para reverter:
reaplicar os valores anteriores pela UI/PUT. Segredos mascarados nunca vazam no GET.

## O que JAMAIS fazer
- `DELETE`/`UPDATE` manual em `event_store.*` (viola a Constituição e a cadeia de hashes — o R9 acusará).
- Subir com `ALLOW_DEGRADED=true` em produção real.
- Reprocessar webhooks manualmente sem verificar idempotência (use os ids originais).
