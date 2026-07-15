# Auditoria de Implementação — Portal do Advogado (Sprint 3B)

> O Portal do Advogado REAL: trabalho jurídico sobre processos ATRIBUÍDOS, com
> isolamento total entre advogados, dados operacionais em somente-leitura, e a AHRI
> **automaticamente informada** de cada atividade — com o **Executive Brain**
> decidindo, por Regra Operacional, se o cliente é comunicado. O advogado nunca
> conversa com o cliente. Nenhum módulo congelado alterado.

- **Data:** 2026-07-14
- **Congelados e INTOCADOS:** Domínio, 2A, 2A.2, 2B, 2C, 2D, 2E, 2F, 3A (Admin Portal).

## 0. Portões obrigatórios

```
pnpm typecheck   → 13/13   EXIT 0
pnpm lint        → 13/13   EXIT 0
pnpm test        → 13/13   EXIT 0
   domain 194 · application 86 · infrastructure 82 | 4 skipped · api 20 (+8) ·
   portal-admin 5 · portal-advogado 2 (+2)
next build (produção, portal-advogado) → EXIT 0 — 12 rotas compiladas
```
**389 testes passando; 10 novos no Sprint 3B. Build de produção verificado.**

## 1. Auditoria adversarial PRÉVIA — achados e soluções (tudo aditivo)

| Achado | Solução aditiva |
|---|---|
| Não existe "atribuição de processo a advogado" em módulo congelado | `AssignmentStore` + `AdvogadoWorkRuntime.assign` (configuração operacional, padrão StaffDirectory 3A); rota de atribuição na API NOVA (`/advogado-admin/assignments`) |
| O domínio congelado não tem "adicionar protocolo/despacho" (Process só tem `recognize`) | `JuridicalWorkStore` — REGISTRO DE TRABALHO jurídico; **não** é Verdade Operacional; consequências de domínio permanecem nos Use Cases existentes decididos pelo Brain |
| Como informar a AHRI e fazer o BRAIN decidir | `PerceptView.kind` é `string` livre (verificado) → percepts `advogado_<atividade>`; `ExecutiveBrainRuntime.decide` é público com `rules` por chamada → catálogo novo **RO-3B**; entrega ao cliente pelas CLASSES PÚBLICAS de 2B (queue/delivery/prompt/expression) |
| 3A congelado não expõe o Brain | Nova composição `assembleAdvogadoOperation` (mesmos blocos públicos; Conversa montada das peças 2B para reter os handles do mensageiro) |

## 2. Arquitetura entregue

```
Portal Next.js (apps/portal-advogado, porta 3200, acento âmbar)
   │ HTTP + cookie 'advogado-id' → header x-advogado-id
   ▼
API (apps/api/src/advogado/advogado-server.ts — ARQUIVO NOVO)
   │ valida advogado ATIVO (staff) + ATRIBUIÇÃO em toda rota
   ▼
assembleAdvogadoOperation (infra 3B)
   ├─ AdvogadoWorkRuntime  → atribuições + registros jurídicos (isolamento por construção)
   └─ AdvogadoAhriBridge   → atividade vira percept `advogado_*` → Brain decide (RO-3B)
                              → ConversationClientMessenger → fila+entrega humanizada 2B → cliente
```

## 3. VERIFICAÇÃO DE ISOLAMENTO ENTRE ADVOGADOS (exigida)

Provada em [advogado-server.test.ts](../../apps/api/src/advogado/advogado-server.test.ts)
com dois advogados reais (Ana e Bruno) e uma missão nascida de um turno REAL de WhatsApp:

| Cenário | Resultado |
|---|---|
| Sem header / id inexistente / inativo | **401** |
| A lista processos | vê **1** (o atribuído) |
| B lista processos | vê **0** |
| B abre o processo de A | **403** |
| B registra atividade no processo de A | **403** (bloqueado no runtime: `NotAssignedError`) |
| B consulta histórico/protocolos/etc. | sempre **vazio** — toda lista filtra por `advogadoId` no runtime |
| B conclui atividade de A | **403** |

O isolamento é imposto **no servidor, por construção** (`AdvogadoWorkRuntime.isAssigned`
antes de toda leitura/escrita de missão) — não é filtro de UI. O header é transporte
provisório até a autenticação da Governança (DF-12), declarado no código e na tela.

## 4. VERIFICAÇÃO DE INTEGRAÇÃO AUTOMÁTICA COM A AHRI (exigida)

Provada nos mesmos testes:
- **Despacho registrado** → `bridge.notify` roda **sempre** (dentro do POST) →
  `ahri.informed === true` → Brain decide por **RO-3B-INFORM-ANDAMENTO** →
  `decidedToSpeak === true` → **o cliente recebe a mensagem** (`gateway.texts()` +1),
  com humanização preservada (presença `composing` antes do envio) e proveniência
  registrada (INV-AH-02).
- **Observação interna** → Brain decide **RO-3B-WAIT-DEFAULT** → `decidedToSpeak ===
  false` → **nenhuma mensagem** ao cliente. A decisão é do Brain, nunca do advogado
  nem da ponte.

## 5. As proibições da spec (verificadas)

| Proibição | Prova |
|---|---|
| Advogado não conversa com cliente / sem WhatsApp | Não existe rota de conversa na API do advogado; a única fala ao cliente sai da AHRI via Brain+2B (teste §4) |
| Não vê processos de outros | §3 |
| Não altera permissões | Nenhuma rota de permissão existe |
| Não acessa Founder Console / financeiro | grep: zero rotas founder/finance na API do advogado |
| Não altera Verdade/Estado diretamente | grep: zero chamadas a fábricas/agregados em 3B; registros jurídicos são log de trabalho, não domínio |
| Read Models apenas | Portal sem nenhum import `@reconstrua/*` (grep); timeline via `TimelineProjector` (3A público) |

## 6. As telas (12 rotas de produção, build verificado)

Painel (processos/pendências/prazos/protocolos/docs novos/fila/alertas) · Meus
Processos · Processo (timeline auditável somente-leitura + formulário jurídico com a
decisão da AHRI exibida) · Pendências · Agenda (prazos ordenados) · Documentos (dos
seus processos) · Protocolos · Movimentações · Arquivos · Histórico · Perfil
(identificação + dados do diretório). Dark mode default, responsivo, acento âmbar
(distinção visual do admin), zero dado fictício.

## 7. Prova de não-alteração

Todo o 3B é código novo: `packages/application/src/advogado-portal/`,
`packages/infrastructure/src/advogado-portal/`, `apps/api/src/advogado/`,
`apps/portal-advogado/`. Mudanças compartilhadas: 1 linha `export *` por barril +
1 export em `apps/api/src/index.ts`. grep: nenhum congelado referencia 3B; `server.ts`
(2B) e `admin/` (3A) intocados. Os 194 testes de domínio e todos os de 2A–3A passam
idênticos.

## 8. Limites honestos

- Identificação por cookie/header até o login da Governança (DF-12) — o isolamento
  real já é servidor-side por atribuição.
- Anexos jurídicos guardam a REFERÊNCIA (o blob é do MediaStore futuro).
- "Marcar distribuição/conclusão" registra o marco jurídico e informa a AHRI; a
  evolução de Estado/Etapa do domínio permanece com os Use Cases R6 sob decisão do
  Brain (nunca escrita direta do advogado) — wiring de gatilho automático R6 é
  evolução natural da ponte.

## 9. Veredito

Portal do Advogado REAL entregue: 12 rotas de produção, isolamento total provado por
teste (401/403/listas vazias), integração automática com a AHRI provada por teste
(Brain decide por RO-3B; cliente recebe mensagem humanizada; atividades internas ficam
em silêncio), somente Read Models, e nenhuma das onze proibições violada. Portões:
`typecheck` ✅ `lint` ✅ `test` ✅ (389 passando, 10 novos) + `next build` ✅.

**Sprint 3B — Portal do Advogado: ENCERRADO.**
_Aguardando autorização explícita para o Sprint 3C._
