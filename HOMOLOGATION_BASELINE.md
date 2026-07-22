# HOMOLOGATION_BASELINE — Projeto Reconstrua

> **Natureza:** documento de referência da FASE DE HOMOLOGAÇÃO. Define o _comportamento
> esperado_ de cada módulo (o "deve"), para que a homologação compare **esperado × real**
> sem inventar critérios no meio do caminho. Não cria regra do Canon; **deriva** dele.
> **Fontes lidas:** Canon (Volumes 00–04, INDEX, Panorama), ADR-0001 (arquitetura), ADR-0002A
> (Executive Brain), manuais de operação e do primeiro cliente, fluxo da missão R1–R9,
> auditorias de engenharia, e inventário direto do código.
> **Base de código:** commit `9716fc6` (master = produção). **Read-only:** nada foi implementado.
> **Data:** 2026-07-16.

---

## 0. REGRA DE OURO DA HOMOLOGAÇÃO

Cada módulo recebe **exatamente um** status:

- 🟢 **APROVADO** — comportamento esperado atendido de ponta a ponta.
- 🟡 **APROVADO COM AJUSTES** — funciona; pendências não-bloqueantes listadas.
- 🔴 **REPROVADO** — bloqueador que impede operar com cliente real.

Toda homologação verifica, além do módulo, os **7 invariantes constitucionais** da §7.
Reconstrua é **independente do AHRIOS**; qualquer ajuste afeta somente este repositório.

---

## 1. OBJETIVO DO PROJETO RECONSTRUA

O Projeto Reconstrua é um **Sistema Operacional Jurídico Cognitivo** para direito
previdenciário (INSS), regido por uma regra absoluta: **o Canon (Livro Mestre) é a única
fonte de verdade** — "nenhuma linha de código pode existir sem origem no Canon".

A visão, em uma frase: **o cliente conversa pelo WhatsApp, uma IA viva (AHRI) organiza e
registra tudo de forma auditável, humanos habilitados respondem por cada decisão, e a
"Verdade Operacional" nunca é inventada nem apagada.**

Princípios inegociáveis (Constituição + ADRs):

1. **O cliente conversa, não preenche formulário** — 100% WhatsApp, humano, imediato.
2. **A AHRI parece viva mas é constitucionalmente limitada** — LLM só percebe e fraseia; o
   **Executive Brain é determinístico**, decide por Regras Operacionais e registra
   DECISOR/TIPO/FUNDAMENTO, ou emite "impedimento" com causa. Nunca decide matéria jurídica.
3. **Nada se apaga** (Lei 3/DF-11) — Event Store append-only; correção = novo evento.
4. **Interface nunca lê o Event Store** (DF-08/item 12) — só Read Models.
5. **Humanos decidem o que é humano** (DF-09) — advogado (jurídico), perito (técnico),
   administrador (gestão), supervisor.
6. **Nada sobe sem estar pronto** — Go-Live Checklist bloqueante.
7. **Operação sem herói** — deploy automático, rollback, ninguém abre a VPS.

---

## 2. MÓDULOS EXISTENTES (inventário)

Legenda de estado: **PROD** (publicado e no ar) · **CÓDIGO** (implementado, não publicado) ·
**SCAFFOLD** (esqueleto vazio) · **AUSENTE**.

| #   | Módulo                                                      | Camada          | Localização                                                      | Estado                           |
| --- | ----------------------------------------------------------- | --------------- | ---------------------------------------------------------------- | -------------------------------- |
| M1  | Produção Real (API pública, go-live, monitor, health)       | apps/api        | `apps/api/src/production/`                                       | **PROD**                         |
| M2  | Landing                                                     | web             | `apps/landing/index.html` + embed `landing-html.ts`              | **PROD** (protótipo)             |
| M3  | WhatsApp Runtime (webhook + gateway Evolution)              | infra/app       | `packages/infrastructure/.../evolution/`, `production-server.ts` | **PROD** (texto)                 |
| M4  | AHRI — Perception → Executive Brain → Conversation          | application     | `packages/application/src/conversation/`, `executive-brain/`     | **PROD**                         |
| M5  | Memória Viva + Relationship                                 | application     | `packages/application/src/living-memory/`                        | **PROD**                         |
| M6  | Shadow Mode (auditoria de turnos)                           | application/api | `production/shadow/*`                                            | **PROD**                         |
| M7  | Founder Console                                             | application/api | `founder-console-route.ts`, `administration/`                    | **PROD** (API)                   |
| M8  | Banco / Event Store + CQRS                                  | infra           | `infrastructure/database/init/*.sql`                             | **PROD**                         |
| M9  | Portal Administrativo (16 telas + API `/admin/*`)           | web + api       | `apps/portal-administracao/`, `admin/admin-server.ts`            | **CÓDIGO**                       |
| M10 | Portal do Advogado (11 telas + API `/advogado/*`)           | web + api       | `apps/portal-advogado/`, `advogado/advogado-server.ts`           | **CÓDIGO**                       |
| M11 | Lawyer Experience (plantão, decisões, night-shift, `/lx/*`) | api             | `lawyer-experience/lawyer-experience-server.ts`                  | **CÓDIGO**                       |
| M12 | Central do Perito                                           | —               | fila `handoff perito` + read model `/admin/pericias`             | **AUSENTE** (bancada)            |
| M13 | Portal do Cliente                                           | web             | `apps/portal-cliente/`                                           | **SCAFFOLD**                     |
| M14 | Portal de Operação                                          | web             | `apps/portal-operacao/`                                          | **SCAFFOLD**                     |
| M15 | Fluxo Financeiro                                            | api             | `/admin/finance` + tela Financeiro                               | **CÓDIGO** (sem lastro no Canon) |
| M16 | Segurança / Autenticação                                    | transversal     | —                                                                | **AUSENTE**                      |
| M17 | Deploy / CI-CD / Infra                                      | infra           | `deploy.sh`, `.github/workflows/`                                | **PROD** (congelado)             |

---

## 3. COMPORTAMENTO ESPERADO E CRITÉRIO DE ACEITE — POR MÓDULO

### M1 · Produção Real

**Esperado:** `/production/health` = 200 liveness; `/production/go-live` = `ready:true` com
todos os gates verdes; `/production/monitor` reflete métricas reais; rotas sensíveis
(`config`, `shadow/*`, `monitor`, `ui`, `first-client`) **não** acessíveis da internet aberta.
**Aceite:** health 200; go-live ready; 12 componentes ONLINE; superfície pública restrita a
`/`, `/production/health`, `/webhook/evolution`.
**Estado conhecido (homologação parcial já feita):** motor 🟢 (13/13 gates, 12/12 ONLINE),
mas rotas sensíveis **públicas** e número de WhatsApp errado → **🔴 REPROVADO** (reabre após
os P0).

### M2 · Landing

**Esperado:** carrega em `/`; hero + como funciona + autoridade + AHRI + benefícios + FAQ +
LGPD + rodapé completo; CTA WhatsApp aponta para o **número oficial `554137989737`**; OG
image válida; identidade da **marca oficial** (vermelho/grafite); rodapé com OAB/UF e CNPJ;
copy em conformidade OAB 205 (sem promessa de resultado).
**Aceite:** `/`=200; CTA resolve `wa.me/554137989737`; `og.png`=200; sem `[preencher]`;
depoimentos reais ou ocultos.
**Estado conhecido:** CTA aponta para `5511989904824` (errado); `og.png`=404; OAB/CNPJ vazios;
identidade divergente → pendências mapeadas.

### M3 · WhatsApp Runtime

**Esperado:** webhook recebe `messages.upsert`, ignora `fromMe`, ACK imediato, entrada única
serializada por conversa; percebe texto, **imagem, áudio, PDF/documento**, localização,
contato; **baixa e armazena o conteúdo** da mídia (a Cadeia do Conhecimento exige a
EVIDÊNCIA, não só o aviso); valida a origem do webhook.
**Aceite:** mensagem de texto entra e gera resposta; documento enviado tem o **conteúdo**
capturado e vinculado ao caso; webhook rejeita origem não autenticada.
**Estado conhecido:** texto 🟢; mídia reconhece o **tipo** mas **não baixa o conteúdo**
(sem `getBase64`); webhook sem validação de origem.

### M4 · AHRI (Perception → Executive Brain → Conversation)

**Esperado (ADR-0002A):** três camadas; LLM só nas pontas; **Brain determinístico e sem
LLM**, decide objetivo/prioridade/timing da Verdade real; toda atuação carrega
`regra_operacional_ref` + DECISOR/TIPO/FUNDAMENTO **ou** é "impedida" com causa; competência
jurídica sempre escala a humano (Human Handoff); onde o Canon é silente, declara incerteza
(E10) e escala. Resposta **nunca instantânea** (proposital).
**Aceite:** dado o mesmo estado, a mesma decisão (reprodutível); nenhuma decisão jurídica
automatizada; todo ato automatizado tem fundamento rastreável no log.
**Estado conhecido:** implementado e em produção (Brain, intents, ROs, handoff).

### M5 · Memória Viva + Relationship

**Esperado:** memória infinita = projeção do Event Store; **nunca cria fato**; ausência é
declarada; Relationship serve dignidade/continuidade (Art. 6º), **jamais CRM comercial**,
jamais muta domínio.
**Aceite:** "como está meu caso?" retorna estado real registrado; nenhum dado inventado.
**Estado conhecido:** implementado e em produção.

### M6 · Shadow Mode

**Esperado:** registra cada turno para auditoria (R9); `shadow/center` e `shadow/reports`
**restritos** (contêm dados de cliente); `shadow/ask` consulta LLM sobre a operação, interno.
**Aceite:** turnos auditáveis internamente; **nada exposto publicamente**.
**Estado conhecido:** funcional, porém **público** → viola G8/IR-01.

### M7 · Founder Console

**Esperado:** "pergunte qualquer coisa" com resposta **fundamentada em dados** ("o LLM só
narra"); nunca inventa; acesso restrito ao fundador/admin.
**Aceite:** resposta cita fonte; sem acesso público.
**Estado conhecido:** API implementada; exposição a definir na proteção de borda.

### M8 · Banco / Event Store + CQRS

**Esperado (ADR-0001):** Postgres 16; Event Store append-only; `UPDATE`/`DELETE` **bloqueados
por trigger**; role de leitura **não enxerga** o schema `event_store`; migrations
forward-only; interfaces só leem Read Models.
**Aceite:** triggers `no_update`/`no_delete` ativos; `reconstrua_read` só em `read_model`;
go-live valida event-store/dispatcher/read-models.
**Estado conhecido:** 🟢 **verificado em SQL** (`01-event-store.sql`, `00-roles-and-schemas.sql`).

### M9 · Portal Administrativo

**Esperado (DF-08):** consome **exclusivamente** `/admin/*` (Read Models); nunca o Event
Store; falha de rede vira estado explícito ("API indisponível", nunca dado inventado); telas:
Dashboard, Clientes(+detalhe), Missões(+detalhe), Documentos, Perícias, Equipe (Advogados/
Operadores/Supervisores), Campanhas, Financeiro, Founder Console, Config, Logs, Health;
**publicado com autenticação por perfil**.
**Aceite:** portal acessível (protegido); todas as telas renderizam dados reais; tempo real
por auto-refresh; nenhuma leitura do Event Store.
**Estado conhecido:** 16 telas completas e conectadas, **não publicadas, sem auth**.

### M10 · Portal do Advogado

**Esperado (3B/3C/3D):** "o advogado nunca começa do zero"; Painel, Processos(+detalhe),
Pendências, Agenda, Documentos, Protocolos, Movimentações, Arquivos, Histórico, Perfil;
isolado por atribuição; identidade por autenticação da Governança (DF-12); publicado.
**Aceite:** advogado vê só os seus processos; registra atividade com prazo; plantão/decisões
funcionam; auth real (não cookie provisório).
**Estado conhecido:** 11 telas completas; **não publicado**; auth por cookie `advogado-id`
marcada no código como **provisória até DF-12**.

### M11 · Lawyer Experience

**Esperado:** plantão, quadro do processo, decisões estruturadas (`resolver`), métricas,
preparação noturna às 03:00; a AHRI **para e aguarda** a decisão humana (Decision Runtime).
**Aceite:** decisão jurídica pendente bloqueia a automação; night-shift roda no horário.
**Estado conhecido:** 6 rotas implementadas; sem front dedicado publicado.

### M12 · Central do Perito

**Esperado (E13/E16):** bancada do perito — casos na fila de perícia, laudo/parecer técnico,
devolução ao fluxo; a AHRI escala competência técnica ao perito.
**Aceite:** perito recebe, trabalha e devolve o caso por uma superfície própria.
**Estado conhecido:** só existe a **fila** (`handoff perito`) e o read model `/admin/pericias`;
**bancada AUSENTE**.

### M13 · Portal do Cliente

**Esperado (README/DF-08):** superfície de leitura da Pessoa/Cliente; só Read Models; espelho
web do "como está meu caso?" (status, documentos enviados, próximos passos). Sprint 8.
**Aceite:** cliente autenticado vê o estado real do seu caso.
**Estado conhecido:** **SCAFFOLD** — nunca construído.

### M14 · Portal de Operação

**Esperado:** console dos Responsáveis (Operador, Perito, Supervisor — Art. 10º); Read Models;
escrita via API. Sprint 8.
**Estado conhecido:** **SCAFFOLD**.

### M15 · Fluxo Financeiro

**Esperado:** **não localizado no Canon.** Nenhuma DF/entidade convoca honorários/financeiro.
**Aceite de conformidade:** ou ganha capítulo/DF que o legitime, ou é **descartado** (fere
"nenhuma linha sem origem no Canon").
**Estado conhecido:** `/admin/finance` + tela existem **sem lastro normativo**.

### M16 · Segurança / Autenticação

**Esperado (DF-12):** autenticação por perfil (E15 Operador, E17 Advogado, E18 Supervisor,
E19 Cliente); borda restringe rotas sensíveis; webhook validado; segredos só em ENV.
**Aceite:** nenhuma rota sensível pública; login por papel nos portais.
**Estado conhecido:** **zero autenticação**; rotas sensíveis públicas; webhook aberto → o
achado de conformidade mais grave.

### M17 · Deploy / CI-CD

**Esperado:** push em `master` → Actions → SSH → `git reset --hard origin/master` → `deploy.sh`
(build sem cache, health checks, rollback); gate de conformidade (CI) verde antes do merge.
**Aceite:** deploy automático verde; **CI de conformidade rodando e passando**.
**Estado conhecido:** deploy automático 🟢 (runs #10/#11 verdes); **CI de conformidade voltou a
rodar em master e está FALHANDO** — o gate constitucional está tecnicamente reprovando a master.

---

## 4. FLUXOS ESPERADOS (jornadas de referência)

### 4.1 Jornada do Cliente (primeiro cliente — 8 etapas)

`Anúncio Meta → Landing (utm) → WhatsApp → AHRI (missão nasce: Pessoa→Cliente→Missão→Verdade→
Estado→Etapa) → coleta de dados (memória com fonte) → HISCON/documento (R3 reconhece conteúdo)
→ Admin recebe em tempo real → workflow continua (follow-ups, prazo administrativo) →
atribuição do advogado → plantão 3D assume → acompanhamento "como está meu caso?" → conclusão`.
**Quebras conhecidas:** documento (conteúdo não capturado), Portal do Cliente (inexistente),
conclusão formal (sem fluxo operacional).

### 4.2 Jornada do Advogado

`Login (DF-12) → Painel "nunca começa do zero" → Processos atribuídos → registra atividade com
prazo → decisões do plantão → preparação noturna 03:00`. **Quebra:** portal não publicado, auth
provisória.

### 4.3 Jornada do Operador / Perito

`Console de Operação (Art. 10º) → fila → ação → devolução`. **Quebra:** superfícies inexistentes
(scaffold/ausente).

### 4.4 Jornada Administrativa

`Dashboard → filas (advogado/perito) → atribuições/equipe/campanhas → Founder Console (com
fonte)`. **Quebra:** portal não publicado, sem auth.

### 4.5 Ciclo Operacional da Missão (R1→R9)

`R1 Nascimento → R2 Pessoa → R3 Documentos → R4 Eventos → R5 Verdade Operacional → R6 Evolução →
R7 Responsáveis → R8 AHRI → R9 Auditoria`. Só **R1** tem capítulo operacional congelado; R2–R9
ainda **Pendentes** no Canon (mas materializados em runtime).

---

## 5. INTEGRAÇÕES ESPERADAS

| Integração           | Esperado                                                                          | Estado conhecido                              |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| Evolution (WhatsApp) | instância oficial `554137989737`; webhook → API; envio texto/presença/reação/lido | 🟢 gateway ativo (go-live); mídia não baixada |
| Anthropic (LLM)      | provedor nas pontas (perceber/frasear); degrada com fraseado factual, não para    | 🟢 provider anthropic ONLINE                  |
| Postgres             | Event Store + Read Models; roles separadas                                        | 🟢 verificado                                 |
| Meta Pixel / GA      | atribuição da landing (opcional, só se definidos)                                 | injetáveis via `.env`                         |
| NPM (borda)          | expõe só `/`, `/health`, `/webhook`; restringe o resto                            | 🔴 hoje expõe rotas sensíveis                 |

---

## 6. BANCO — BASELINE DE DADOS

- **Event Store append-only** (`event_store` schema): `INSERT`+`SELECT` para `reconstrua_app`;
  triggers `events_no_update` / `events_no_delete` (e snapshots) bloqueiam mutação.
- **Read Models** (`read_model` schema): `SELECT` para `reconstrua_read`, que **não** enxerga
  `event_store`.
- **Migrations** forward-only em `infrastructure/database/init/` (rodam no 1º boot).
- **Aceite:** correções entram como novos eventos; nenhuma escrita manual no Event Store.

---

## 7. INVARIANTES CONSTITUCIONAIS (verificar em TODA homologação)

1. **Nada se apaga** — sem `UPDATE`/`DELETE` no Event Store (Lei 3/DF-11).
2. **Interface só lê Read Models** — nunca o Event Store (DF-08/item 12).
3. **IA não decide o humano** — nenhuma decisão jurídica/técnica automatizada (DF-09).
4. **Todo ato automatizado tem fundamento** — `regra_operacional_ref` + DECISOR/TIPO/FUNDAMENTO,
   ou "impedido" com causa (INV-AH-02; RO-R7-001).
5. **Nada inventado** — ausência é declarada; incerteza explícita (E10).
6. **Dado pessoal protegido** — não exposto publicamente (G8/IR-01; LGPD).
7. **Nada sem origem no Canon** — módulo sem lastro é irregular (ex.: Financeiro).

---

## 8. NOTAS DE CONFORMIDADE PARA A HOMOLOGAÇÃO

- **Nomenclatura:** `docs/operations/OPERATIONS_MANUAL.md` traz o título "AHRIOS em produção" —
  resíduo a corrigir; **Reconstrua é independente do AHRIOS**.
- **ADR-0001 desatualizado:** prevê 3 portais (existem 4) e cita **Zod**/**Drizzle** — Zod não é
  usado no código; validação é manual. Regularizar o ADR ou o código (decisão do fundador).
- **Financeiro (M15):** sem lastro no Canon — decidir DF que o legitime ou descarte.
- **CI de conformidade (M17):** rodando e falhando em `master` — o próprio gate do Canon está
  reprovando; prioridade de engenharia.

---

## 9. ORDEM SUGERIDA DE HOMOLOGAÇÃO

Do que sustenta a produção para o que depende dele:
**M1 Produção → M8 Banco → M3 WhatsApp → M4 AHRI → M5 Memória → M6 Shadow → M2 Landing →
M9 Admin → M10 Advogado → M11 LX → M7 Founder → M12 Perito → M13 Cliente → M14 Operação →
M15 Financeiro → M16 Segurança → M17 Deploy.**

Cada módulo fecha com 🟢 / 🟡 / 🔴 e só então segue o próximo.

---

_Documento de baseline. Nenhum código implementado, nenhum arquivo de produto alterado,
nenhum comportamento novo criado — apenas o esperado, consolidado das fontes existentes._
