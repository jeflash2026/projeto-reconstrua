# Auditoria de Implementação — Admin Portal (Sprint 3A)

> O Portal Administrativo REAL: Next.js em produção, alimentado EXCLUSIVAMENTE por
> Read Models via API própria — o portal jamais consulta o Event Store; nada é
> inventado; ausência de fonte é declarada na tela. Nenhum módulo congelado alterado.

- **Data:** 2026-07-14
- **Congelados e INTOCADOS:** Domínio, 2A, 2A.2, 2B, 2C, 2D, 2E, 2F.

## 0. Portões obrigatórios

```
pnpm typecheck   → 12/12   EXIT 0
pnpm lint        → 12/12   EXIT 0
pnpm test        → 12/12   EXIT 0
   domain 194 · application 86 · infrastructure 82 | 4 skipped · api 12 (+8) · portal 5 (+5)
next build (produção) → EXIT 0 — 17 rotas compiladas
```
**379 testes passando; 13 novos no Sprint 3A. Build de produção verificado.**

## 1. Auditoria adversarial PRÉVIA — 3 achados que moldaram a arquitetura

1. **`assembleGoLive` (2F) não expõe** `conversationStore`/`registry`/`progressStore`
   → nova composição [`assembleAdminOperation`](../../packages/infrastructure/src/admin-portal/build-admin-operation.ts)
   fiando OS MESMOS blocos públicos congelados + as exposições de leitura. Aditivo puro.
2. **Interfaces nunca leem o Event Store** (item 12; DF-08) e não havia read model de
   timeline → novo [`TimelineProjector`](../../packages/application/src/admin-portal/timeline-projector.ts):
   projeção incremental (por `globalSeq`) que constrói timeline por missão, documentos,
   perícias, log pesquisável e o vínculo conversa↔missão (join person→origin `WhatsApp:`→
   mission.beneficiary). O projetor é backend; o portal lê SÓ o projetado.
3. **O domínio congelado não tem CRUD de papéis** (só designação por evento) →
   [`StaffDirectoryRuntime`](../../packages/application/src/admin-portal/staff-directory.ts):
   diretório OPERACIONAL (configuração, como o catálogo de ROs) com cadastrar/editar/
   ativar/desativar; fila/carga vêm dos read models (handoffs por papel). A designação
   constitucional permanece exclusiva do domínio. **Fronteira declarada, não burlada.**

**Nenhum requisito exigiu alterar congelado ⇒ prosseguido.**

## 2. Arquitetura entregue

```
Portal Next.js (apps/portal-administracao)
   │  HTTP (fetch no-store; NEXT_PUBLIC_API_URL)
   ▼
API Admin (apps/api/src/admin/admin-server.ts — ARQUIVO NOVO; server.ts 2B intocado)
   │  somente READ MODELS + diretório staff + Founder Console
   ▼
assembleAdminOperation (infra 3A) → blocos congelados 2A–2F + TimelineProjector + Staff
```

Rotas da API (todas testadas via inject): `/admin/dashboard`, `/admin/clients[?q]`,
`/admin/clients/:chatId`, `/admin/missions`, `/admin/missions/:id`, `/admin/documents`,
`/admin/pericias`, `/admin/staff/:role` (GET) + `/admin/staff` (POST) + `/admin/staff/:id`
(PATCH), `/admin/campaigns`, `/admin/finance`, `/admin/founder/briefing`,
`/admin/founder/ask`, `/admin/logs[?q]`, `/admin/health`, `/admin/config`.

## 3. As telas (17 rotas de produção)

| Tela | Rota | Fonte (read model) |
|---|---|---|
| Dashboard | `/` | métricas 2E + memória viva + handoffs + observabilidade + health + gargalos/alertas (AdminIntelligence) |
| Clientes (pesquisa/filtros) | `/clientes` | memória viva (`all` + busca por atributo) |
| Cliente (timeline/conversa/memória/situação) | `/clientes/[chatId]` | memória + relationship + conversationStore + workflow + projector |
| Missões | `/missoes` | TimelineProjector (sumários) |
| Missão (timeline auditável: Estado/Etapa/Verdade/Operações/Projeções, DECISOR/REGRA/FUNDAMENTO por evento) | `/missoes/[id]` | TimelineProjector + workflow |
| Documentos (origem/status/pendências) | `/documentos` | projector + memória viva |
| Perícias (+ gestão de Peritos) | `/pericias` | projector + handoff + staff |
| Advogados / Operadores / Supervisores | `/advogados` `/operadores` `/supervisores` | StaffDirectory + carga por handoffs |
| Campanhas | `/campanhas` | `campaignAttribution` (ausência declarada) |
| Financeiro | `/financeiro` | `financialUnderAdministration` (ausência declarada) |
| Founder Console (chat 2E integrado; abertura automática com briefing; "Pergunte qualquer coisa...") | `/founder-console` | FounderConsoleRuntime (proveniência em toda resposta) |
| Configurações | `/configuracoes` | config em leitura (regras mudam por Governança) |
| Logs (pesquisável: eventos + dispatcher/workflow/scheduler/conversation/brain/mission) | `/logs` | projector.searchLog + observability.trail |
| Health (latência/fila/memória/estado 4-níveis) | `/health` | HealthRuntime |

**UI:** design system próprio (CSS vars), **dark mode default** + toggle persistente,
**responsiva** (sidebar colapsa < 860px), tempo real por refresh periódico (5–8s),
estados vazios/erro REAIS ("API indisponível", "sem fonte de dados") — **zero dado fake**
(grep confirmou: nenhum mock/fixture no portal).

## 4. Regras verificadas

| Regra | Prova |
|---|---|
| Read Models, nunca consulta direta | grep: portal sem nenhum import `@reconstrua/*` nem acesso a Event Store — só HTTP `/admin/*`; a API serve apenas projeções/stores de leitura |
| Nunca inventar dados | Financeiro/Campanhas/Honorários devolvem `null`/`available:false` e a tela declara a ausência (testes `finance.available===false`) |
| Congelados intocados | grep: nenhum módulo congelado referencia 3A; `server.ts` (2B) sem rotas admin; mudanças compartilhadas = 1 linha `export *` por barril + export no `apps/api/src/index.ts` |
| Auditável | timeline por evento exibe relevância/DECISOR/REGRA/FUNDAMENTO (teste: todos `actor==='AHRI'` e `RO-*`) |
| Founder Console nunca decide | resposta carrega `decidesNothing: true` + proveniência (teste) |
| Produção | `next build` EXIT 0 (17 rotas); API com CORS próprio; `.listen` continua do dono |

## 5. Testes novos (13)

- **api (8):** dashboard real; clientes lista+busca; cliente detalhe (memória/relationship/
  conversa/missões); missões + timeline auditável; 404 real; staff CRUD+carga+papel inválido;
  founder briefing/ask (proveniência, decidesNothing, 400 sem pergunta); logs+health+
  finance/campaigns indisponíveis explícitos.
- **portal (5):** formatação (`formatMs`, `formatMoney` com "sem fonte de dados", `shortId`,
  `healthBadgeClass`, datas inválidas).

## 6. Limites honestos

- A API usa `assembleAdminOperation` com stores in-memory por default; produção injeta
  os adapters Postgres pelos mesmos ports (nenhuma tela muda).
- Autenticação/autorização do portal pertence à Governança (DF-12) — a matriz de papéis
  existe (2F `PortalIntegrationRuntime`); o login do portal admin é sprint próprio.
- OCR: a tela exibe a referência probatória preservada (INV-D10); extração de texto do
  blob é adapter do MediaStore (futuro), não invenção da UI.

## 7. Veredito

Portal Administrativo REAL entregue: 17 rotas de produção (build verificado), 16 telas
do menu, API própria servindo exclusivamente Read Models, Founder Console integrado com
abertura automática, logs pesquisáveis, health completo, dark mode, responsivo — e a
fronteira constitucional intacta (nenhum congelado alterado; nada inventado; tudo
auditável). Portões: `typecheck` ✅ `lint` ✅ `test` ✅ (379 passando, 13 novos) + `next build` ✅.

**Sprint 3A — Admin Portal: ENCERRADO.**
_Aguardando autorização explícita antes do próximo Sprint._
