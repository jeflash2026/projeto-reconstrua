# Integração Corvo — notificação de bancos por correspondência

_2026-08-25. O Corvo (`https://corvo.clsolucoes.com`) recebe o lead completo,
cria uma caixa de e-mail exclusiva do cliente e notifica os bancos dos contratos
consignados; cada resposta de banco volta para cá por webhook._

## Variáveis de ambiente (`.env` da API, na VPS)

```
CORVO_BASE_URL=https://corvo.clsolucoes.com
CORVO_API_KEY=<INTEGRACAO_API_KEY>            # para chamar o Corvo
CORVO_WEBHOOK_SECRET=<INTEGRACAO_WEBHOOK_SECRET>  # para verificar o que o Corvo manda
CORVO_CRED_KEY=<opcional>                     # chave da cifra da senha da caixa
                                              # (ausente ⇒ deriva do WEBHOOK_SECRET)
```

Sem `CORVO_API_KEY`, a integração é **inerte**: nada é enviado, os jobs não
rodam e a tela do Admin avisa. Sem `CORVO_WEBHOOK_SECRET`, o webhook responde
401 a tudo (fail-closed).

**URL pública do nosso webhook** (informar ao Corvo como `INTEGRACAO_WEBHOOK_URL`):

```
https://projetoreconstrua.com.br/webhooks/corvo
```

A rota vive no servidor MAIN (o mesmo do `/webhook/meta`, porta 3001 interna).
No Nginx Proxy Manager, garanta a Custom Location `/webhooks/corvo` → o mesmo
destino do `/webhook/meta`, nos DOIS hosts (www e sem-www).

## A. Envio do lead (nós → Corvo)

- **Gatilho (decisão do dono, 2026-08-28 — 100% automático)**: o único portão
  manual é o **setor humanizado**, que confere os documentos e conclui o
  cadastro. Cliente 100% completo entra **sozinho** em perícia (job de 5 min:
  `iniciarPericiasAutomaticas` no main.ts — relógio dos 10 dias) e o lead vai
  à **fila** (`corvo-envio-fila`) → POST ao Corvo → notificações disparam lá.
  Os botões do perito ("Baixar pacote e iniciar" / "iniciar todos") continuam
  funcionando e também alimentam a fila (idempotente). **Nunca** se varre a
  base inteira. Reenvio manual: botão "Reenviar" na tela Bancos (Corvo).
  O POST é o **sinal de disparo**: item da fila sempre envia — pacote idêntico
  ao último ENVIADO ganha sufixo `:rN` na key (fora da janela de replay).
- **ZIP** (`CorvoService.varrerEEnviar` → `montarZipDoLead`):
  - `Contratos - <NOME>.xlsx` na raiz — colunas `CPF do cliente` (texto, 11
    dígitos), `Nome do cliente`, `Banco` (`033 - BANCO SANTANDER`), `Contrato`,
    `Modalidade`, `Valor emprestado`, `Qtde parcelas`, `Valor parcela`,
    `Início`, `Fim`, `Situação`; linha em branco entre bancos. Os contratos são
    os **selecionados pelo guia** (os que viram processo — incl. espelhos de
    migração e RMC/RCC).
  - `documentos/HISCON - <NOME>.pdf` (o PDF original do cliente, código CNIS),
    `Procuração assinada`, `RG` (2ª face ganha sufixo após o " - "),
    `Comprovante de endereço` — dos docs da equipe (fase 2).
- **Idempotência**: `X-Idempotency-Key` no formato acordado —
  `lead:<cpf>:<sha256 dos bytes do ZIP, 16 hex>`. Retry do mesmo pacote reusa a
  key (replay inofensivo); pacote novo = key nova; `409` acrescenta sufixo
  `:rN`. A assinatura de conteúdo (contratos + refs de docs) continua evitando
  reenvio sem mudança.
- **Retry**: 5xx/timeout → backoff 1m, 5m, 30m (máx. 5 tentativas); 400/401/413
  → estado `ERRO`, parado até ação do operador (botão "Reenviar") ou conteúdo
  novo. Conteúdo novo (doc/contrato) muda a assinatura ⇒ reenvio automático em
  modo `mesclar`.

## B. Webhook (Corvo → nós)

`POST /webhooks/corvo` no servidor main. Pipeline (tudo em
`CorvoService.receberWebhook`):

1. corpo BRUTO (parser `parseAs: buffer`, escopado ao plugin da rota);
2. HMAC-SHA256 de `"<X-Corvo-Timestamp>.<corpo>"` comparado em tempo constante
   com o `v1=<hex>` de `X-Corvo-Signature`; diferente ⇒ 401;
3. anti-replay: |agora − timestamp| > 300s ⇒ 401;
4. idempotência: `id` do evento no ns `corvo-webhook-entregas`; repetido ⇒ 200
   sem reprocessar;
5. processamento (rápido, sem downloads) → 200; falha ⇒ 500 (o Corvo retenta);
6. anexos de `banco.resposta` descem em segundo plano (≤ 8 MB ficam guardados;
   maiores são baixados sob demanda pelo proxy).

Eventos: `lead.recebido` (marca confirmação; `SEM_PROCURACAO` vira alerta),
`caixa.criada` (senha **cifrada AES-256-GCM** em repouso; única vez que chega),
`banco.envio`, `banco.resposta` (`RESPOSTA`/`BOUNCE`/`BACEN`), `webhook.teste`;
desconhecidos respondem 200 e ficam no log.

## C. Reconciliação

Job a cada 15 min: `GET /api/integracao/eventos?desde=<último − 1h>` paginado;
qualquer `id` fora de `corvo-webhook-entregas` passa pelo MESMO handler. A senha
vem `null` no feed — nunca sobrescreve a guardada; se faltar, o botão "Pedir
reenvio da credencial" chama `/api/integracao/caixas/{cpf}/reenviar-credencial`.
Envio sem `lead.recebido` aparece na tela como selo "sem confirmação".

## Tela do Admin

**Gestão → Bancos (Corvo)**: totais, lista de clientes (estado do envio, bancos,
caixa) e, por cliente, a timeline — caixa criada (revelar senha = ato explícito
com trilha; reenvio de credencial), notificações por banco e respostas com corpo
e anexos.

## Armazenamento (JsonStore/Postgres)

| namespace | chave | conteúdo |
|---|---|---|
| `corvo-importacoes` | clienteId | estado do envio, idempotency key, bancos, caixa |
| `corvo-caixas` | cpf | e-mail, senha **cifrada** (iv/tag/dados), imap/smtp |
| `corvo-envios` | envioId | notificação banco a banco |
| `corvo-respostas` | respostaId | resposta/bounce/bacen + metadados dos anexos |
| `corvo-anexos` | respostaId:i | anexo baixado (base64, ≤ 8 MB) |
| `corvo-webhook-entregas` | id do evento | dedupe do webhook + reconciliação |
| `corvo-estado` | 'reconciliacao' | cursor temporal do feed |

## Dossiê de integridade (2026-08-26)

Pacote de prova (ZIP com .eml + `SHA256SUMS.txt` + `relatorio.json`) que o
Corvo gera por CPF em `GET /api/integracao/dossie/{cpf}` (X-Api-Key).

- **Gatilho**: `banco.envio`/`banco.resposta` com `dados.dossie != null` →
  fila com **debounce por CPF** (2 min de silêncio; teto 10 min) — nunca
  baixado dentro do webhook. Botão "Atualizar dossiê" na ficha dispara na hora.
- **Verificação obrigatória**: `sha256(SHA256SUMS.txt) == X-Dossie-Hash-Raiz`;
  divergiu ⇒ descartado e registrado (nada gravado).
- **Persistência**: ns `corvo-dossies` (chave `cpf:hashRaiz`) — uma linha por
  VERSÃO, nunca sobrescrita; `clienteId` resolvido pelo CPF (null = conciliação
  manual, fica visível); ZIP no **media store** privado (content-addressed por
  `hashZip`); idempotência por (cpf, hash-raiz) só atualiza `baixadoEm`.
- **Ficha do cliente** (timeline Corvo): geração, hash-raiz com copiar,
  envios/respostas, Baixar ZIP (autenticado, via proxy do portal), Atualizar
  dossiê, versões anteriores.
- Rotas Admin: `GET /admin/corvo/dossies/:cpf`, `POST .../:cpf/atualizar`,
  `GET .../:cpf/:hashRaiz/zip`.

## Código

- `packages/infrastructure/src/corvo/` — `corvo-zip.ts` (formato do ZIP),
  `corvo-client.ts` (HTTP), `corvo-service.ts` (orquestração; testes ao lado);
- ligação em `build-production.ts` (serviço `prod.corvo`), jobs em
  `apps/api/src/production/main.ts`, webhook em `production-server.ts`, rotas
  Admin em `admin-server.ts` (`/admin/corvo*`), tela em
  `apps/portal-administracao/app/(painel)/corvo/`.
