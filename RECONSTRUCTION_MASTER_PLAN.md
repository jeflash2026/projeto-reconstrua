# RECONSTRUCTION MASTER PLAN — Projeto Reconstrua

### Plano de reconstrução por CAPACIDADES · visão do CTO · regra única: **reaproveitar antes de construir**

> **Data:** 2026-07-16 · **Princípio:** _"Nunca construir algo novo enquanto existir algo
> equivalente que possa ser reaproveitado."_ Este plano não fala de módulos — fala de
> **capacidades de produto** e de onde cada uma já vive no código.

---

## 🔑 A DESCOBERTA CENTRAL (o maior economizador de tempo do projeto)

A conduta autônoma da AHRI (saudar, coletar, pedir documento, reconhecer, avisar prazo,
escalar, encerrar) **já está escrita** — em **dois catálogos de regras que a produção não
carrega**:

| Catálogo                     | Regras                                                                                                                                                                                      | Carregado em produção? |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `default-rule-catalog.ts`    | **12** (GREET, EXPLAIN, DOC-REQUEST, DOC-RECOGNIZE, DEADLINE-WARN, DEADLINE-NOTIFY-HUMAN, ESCALATE-HUMAN, ESCALATE-CANON, WAIT-DEFAULT, SILENCE-FOLLOWUP, TIMEOUT-WAIT, **STOP-CONCLUDED**) | ❌                     |
| `mission-rule-catalog.ts`    | **7** (ONBOARD, GREET, INGEST-DOC, DOC-ACK, EXPLAIN, WAIT, ESCALATE-HUMAN)                                                                                                                  | ❌                     |
| `production-rule-catalog.ts` | **2** (só follow-up de silêncio/timeout)                                                                                                                                                    | ✅                     |

**19 regras autorais existem; 2 rodam.** Trocar/mesclar o catálogo que a produção carrega é
potencialmente a diferença entre "a AHRI só cobra silêncio" e "a AHRI conduz a conversa
inteira" — sem escrever comportamento novo, apenas **curando e ligando** o que já existe.

---

## AS CAPACIDADES DO PRODUTO (uma a uma)

### CAP-01 · RECEBER O CLIENTE

- **Onde já existe:** `apps/landing/index.html` (+ embed `landing-html.ts`); rota `/` na API.
- **O que funciona:** página completa de conversão, CTA WhatsApp com campanha, Pixel/GA, SEO.
- **O que está incompleto:** número de WhatsApp errado; OAB/CNPJ vazios; `og.png` inexistente.
- **O que falta conectar:** a landing à marca oficial (ativos não versionados).
- **O que descartar:** a duplicação embed (manter fonte única).
- **Reaproveitável integralmente?** **SIM**, com ajuste de conteúdo/config — não se reescreve.

### CAP-02 · RECONHECER A PESSOA E CRIAR O CASO

- **Onde já existe:** `mission-runtime/use-cases/create-mission.ts`, `r1-recognize-person.ts`,
  `r2-recognize-cliente.ts`; domínio `person/`, `cliente/`.
- **O que funciona:** nascimento de missão + reconhecimento de pessoa/cliente — **testado e
  exercitado** pelo REAL_FIRST_CLIENT (8 etapas verdes).
- **O que está incompleto:** nada estrutural.
- **O que falta conectar:** nada — já roda no pipeline.
- **Reaproveitável integralmente?** **SIM.**

### CAP-03 · CONVERSAR COMO GENTE (perceber, decidir, falar, lembrar)

- **Onde já existe:** `packages/application/src/conversation/` (12 runtimes),
  `executive-brain/` (motor real), `living-memory/`, adapters LLM reais (`llm-adapters.ts`).
- **O que funciona:** percepção (12 naturezas), fronteira constitucional (LLM não decide),
  timing humano, anti-repetição, memória de nome/cidade/profissão. Tudo testado.
- **O que está incompleto:** nunca exercitado com cliente real (0 conversas).
- **O que falta conectar:** o repertório de regras (ver CAP-04); a entrada (CAP-01).
- **Reaproveitável integralmente?** **SIM** — é o ativo mais valioso do projeto.

### CAP-04 · CONDUZIR A CONVERSA AUTONOMAMENTE (o repertório)

- **Onde já existe:** `default-rule-catalog.ts` (12) + `mission-rule-catalog.ts` (7).
- **O que funciona:** as regras estão escritas com ref/prioridade/condição.
- **O que está incompleto:** a produção carrega só 2; as outras 19 **não são usadas**.
- **O que falta conectar:** curar um catálogo de produção a partir das regras existentes e
  fazer `build-production` carregá-lo (as regras exigem homologação de conduta — decisão do
  fundador/Governança, não código novo).
- **O que descartar:** possível sobreposição entre os 3 catálogos → consolidar em um.
- **Reaproveitável integralmente?** **SIM (grande economia)** — comportamento já autorado.

### CAP-05 · RECEBER DOCUMENTOS DO CLIENTE (ler o conteúdo)

- **Onde já existe:** `evolution-webhook-mapper.ts` (percebe imagem/pdf/áudio/documento com
  atributos); `production/document-stores.ts` (armazenamento de documentos).
- **O que funciona:** o sistema **percebe** que veio um documento e cria a entidade.
- **O que está incompleto:** o **conteúdo binário nunca é baixado** da Evolution (sem
  `getBase64`/download); o `contentReference` aponta para o vácuo.
- **O que falta conectar:** um único elo de integração — buscar o blob na Evolution e gravá-lo
  no store de documentos **que já existe**.
- **Reaproveitável integralmente?** **PARCIAL** — o armazenamento existe; falta só o download.

### CAP-06 · CONSTRUIR A VERDADE DO CASO (reconhecer fatos, derivar estado)

- **Onde já existe:** `mission-runtime/use-cases/r3…r9`, Event Store append-only, projetores.
- **O que funciona:** reconhecimento de documento/evento, síntese da Verdade, derivação de
  estado — testado no pipeline REAL_FIRST_CLIENT.
- **O que está incompleto:** depende de CAP-05 (documento real) para ter substância.
- **Reaproveitável integralmente?** **SIM.**

### CAP-07 · RESPONDER O ANDAMENTO ("como está meu caso?")

- **Onde já existe:** read models (`admin-portal/timeline-projector.ts`), memória, brain.
- **O que funciona:** o estado deriva da Verdade e é auditável — a resposta é possível hoje.
- **O que falta conectar:** o gatilho conversacional (é uma regra — CAP-04).
- **Reaproveitável integralmente?** **SIM.**

### CAP-08 · PROATIVIDADE TEMPORAL (silêncio, prazos, retornos)

- **Onde já existe:** `SchedulerRuntime`, `NotificationRuntime` — **já ligados na produção**;
  `silence-detection-runtime.ts`; regras SILENCE/TIMEOUT/DEADLINE (nos catálogos).
- **O que funciona:** o motor temporal e os canais de notificação existem e estão conectados.
- **O que está incompleto:** só 2 regras temporais ativas; regras de prazo estão no catálogo
  não carregado (CAP-04).
- **Reaproveitável integralmente?** **SIM.**

### CAP-09 · ESCALAR PARA O HUMANO (handoff)

- **Onde já existe:** `HumanHandoffRuntime` (ligado na produção), filas por papel
  (advogado/perito), regras ESCALATE-HUMAN (nos catálogos).
- **O que funciona:** a mecânica de escalar e enfileirar existe.
- **O que falta conectar:** o **destino** — os portais humanos publicados (CAP-10/11/12).
- **Reaproveitável integralmente?** **SIM** (a mecânica); falta a porta de saída.

### CAP-10 · TRABALHO DO ADVOGADO

- **Onde já existe:** `apps/portal-advogado/` — **11 telas + 6 componentes**, cliente de API,
  APIs `/advogado/*` e `/lx/*` (plantão, decisões, night-shift).
- **O que funciona:** painel "nunca começa do zero", processos, atividades, agenda — completo
  em código, consumindo read models reais.
- **O que está incompleto:** não publicado; autenticação por cookie provisório.
- **O que falta conectar:** **publicar** (next start + subdomínio) e **autenticar**.
- **Reaproveitável integralmente?** **SIM** — semanas de UI prontas.

### CAP-11 · TRABALHO DO OPERADOR

- **Onde já existe:** APIs de staff/atribuição no admin; `apps/portal-operacao/` (scaffold).
- **O que funciona:** o back-end de triagem/atribuição existe (rotas admin).
- **O que está incompleto:** o portal de operação é scaffold vazio (sem telas).
- **O que falta conectar / construir:** a UI — mas pode **reaproveitar padrões e componentes**
  do portal-advogado/admin (mesmo design system, mesmos read models).
- **Reaproveitável integralmente?** **PARCIAL** — back-end sim; UI a montar reusando padrões.

### CAP-12 · TRABALHO DO PERITO (bancada)

- **Onde já existe:** fila `handoff perito`, read model `/admin/pericias`, entidade E13/E16.
- **O que funciona:** o caso chega à fila; o gerencial de perícias existe no admin.
- **O que está incompleto:** não há bancada de trabalho do perito.
- **O que falta construir:** a UI da bancada — reaproveitando o design system e o padrão de
  "painel + tabela + formulário" já usado no portal-advogado.
- **Reaproveitável integralmente?** **PARCIAL** — dados/fila sim; UI nova (com reuso de padrão).

### CAP-13 · COMANDO ADMINISTRATIVO

- **Onde já existe:** `apps/portal-administracao/` — **16 telas** (Dashboard, Clientes,
  Missões, Documentos, Perícias, Equipe, Campanhas, Financeiro, **Founder Console**, Logs,
  Health, Config).
- **O que funciona:** tudo, em código, consumindo `/admin/*`; chat com a AHRI (founder).
- **O que está incompleto:** não publicado; sem login.
- **O que descartar:** a tela **Financeiro** (sem lastro no Canon — decidir).
- **Reaproveitável integralmente?** **SIM** (menos Financeiro) — **publicar**, não construir.

### CAP-14 · ENCERRAR O CASO

- **Onde já existe:** invariante de encerramento (INV-14/DF-11) no domínio; **regra
  `RO-STOP-CONCLUDED-001`** já escrita no catálogo; estados terminais CONCLUÍDA/ENCERRADA.
- **O que funciona:** o domínio e a regra de conduta existem.
- **O que falta construir:** um **use case operacional de encerramento** (pequeno, no padrão
  dos R1–R9 já existentes) que aplique o invariante — e ligar a regra STOP-CONCLUDED.
- **Reaproveitável integralmente?** **PARCIAL** — domínio + regra sim; falta o use case-cola.

### CAP-15 · AUTENTICAR PESSOAS (advogado/operador/perito/admin/cliente)

- **Onde já existe:** transporte provisório por cookie `advogado-id`; DF-12 (Governança)
  define o critério, ainda não implementado.
- **O que falta construir:** autenticação real — **do zero**, porém é peça padrão de mercado.
- **Reaproveitável integralmente?** **NÃO** (a lacuna mais "nova", mas de baixo risco técnico).

### CAP-16 · AUDITAR E LEMBRAR TUDO (a Verdade perpétua)

- **Onde já existe:** Event Store append-only (triggers), Shadow Mode, observabilidade.
- **O que funciona:** nada se apaga; tudo auditável; Shadow registra cada turno.
- **O que está incompleto:** roles de leitura/escrita não efetivadas (app conecta como dono);
  Shadow exposto publicamente.
- **O que falta conectar:** a conexão do app às roles corretas; fechar Shadow na borda.
- **Reaproveitável integralmente?** **SIM** — só endurecer configuração.

### CAP-17 · PUBLICAR E OPERAR (infra)

- **Onde já existe:** deploy automático CI/CD, rollback, captura forense, go-live bloqueante.
- **O que funciona:** tudo — provado verde em produção.
- **O que descartar:** servidor dev legado (`server.ts`/`index.ts`), monitor `/production/ui`
  público.
- **Reaproveitável integralmente?** **SIM** (congelado).

---

## MAPA DE REAPROVEITAMENTO

`CAPACIDADE → Código → Banco → Interface → Integração → Estado atual → Estado ideal → Próximo passo mínimo`

| Capacidade        | Código           | Banco    | Interface        | Integração | Atual             | Ideal            | **Próximo passo mínimo**         |
| ----------------- | ---------------- | -------- | ---------------- | ---------- | ----------------- | ---------------- | -------------------------------- |
| Receber cliente   | ✅               | —        | ✅ landing       | WhatsApp   | número errado     | contratável      | corrigir número + marca/legal    |
| Reconhecer pessoa | ✅               | ✅       | —                | —          | pronto            | pronto           | nada (já roda)                   |
| Conversar         | ✅               | ✅       | WhatsApp         | LLM real   | pronto, inédito   | vivo em campo    | ligar CAP-01 e CAP-04            |
| Conduzir (regras) | ✅ 19 escritas   | —        | —                | —          | 2 de 19 ativas    | repertório pleno | **carregar catálogo curado**     |
| Receber documento | 🟡               | ✅ store | WhatsApp         | Evolution  | conteúdo no vácuo | doc lido         | **baixar blob (getBase64)**      |
| Construir verdade | ✅               | ✅       | —                | —          | pronto            | pronto           | depende do doc real              |
| Andamento         | ✅               | ✅       | WhatsApp         | —          | pronto            | pronto           | ligar regra de status            |
| Proatividade      | ✅ ligado        | ✅       | —                | —          | 2 regras          | prazos/retornos  | catálogo (CAP-04)                |
| Escalar humano    | ✅ ligado        | ✅       | —                | —          | sem destino       | ativa            | publicar portais                 |
| Advogado          | ✅ 11 telas      | ✅       | ✅ pronto        | ✅         | não publicado     | em uso           | **publicar + auth**              |
| Operador          | 🟡 back-end      | ✅       | ❌ scaffold      | ✅         | sem UI            | em uso           | montar UI reusando padrão        |
| Perito            | 🟡 fila          | ✅       | ❌               | ✅         | sem bancada       | em uso           | bancada reusando padrão          |
| Admin             | ✅ 16 telas      | ✅       | ✅ pronto        | ✅         | não publicado     | em uso           | **publicar + auth**              |
| Encerrar caso     | 🟡 regra+domínio | ✅       | (admin/advogado) | —          | sem use case      | encerrável       | use case-cola + ligar regra      |
| Autenticar        | ❌               | —        | —                | —          | provisório        | real             | construir (padrão de mercado)    |
| Auditar/lembrar   | ✅               | ✅       | (admin)          | —          | roles dormentes   | endurecido       | conexão de roles + fechar Shadow |
| Publicar/operar   | ✅               | ✅       | —                | ✅         | verde             | verde            | remover legado                   |

---

## AS TRÊS RESPOSTAS

### 1. O que pode entrar em produção PRATICAMENTE SEM ALTERAÇÃO?

- A **espinha conversacional** (perceber → decidir → falar → lembrar) — CAP-03.
- O **reconhecimento de pessoa e nascimento do caso** — CAP-02 (já testado ponta a ponta).
- O **Event Store / Verdade / auditoria** — CAP-06/16 (só endurecer config).
- A **infra de deploy/rollback/go-live** — CAP-17.
- A **landing** — CAP-01 (após corrigir número e dados legais; a estrutura fica).

### 2. O que precisa APENAS SER CONECTADO (existe, está desligado)?

- **As 19 regras de conduta da AHRI** → curar e carregar em produção (CAP-04) — _a maior
  economia do projeto: comportamento já escrito._
- **Os 27 painéis humanos** (16 admin + 11 advogado) → publicar + autenticar (CAP-10/13).
- **Notificação / handoff / scheduler** → já ligados; falta o destino (portais) e as regras.
- **A resposta de andamento** → ligar o gatilho (regra) sobre read models prontos (CAP-07).
- **As roles do banco** → apontar a conexão para as roles corretas (CAP-16).

### 3. O que realmente precisa ser DESENVOLVIDO DO ZERO (não há equivalente)?

Pouco — e cada item é pequeno ou reusa padrão existente:

- **O download do conteúdo de mídia** da Evolution (um único elo de integração; o _store_ de
  documentos já existe) — CAP-05.
- **A UI da bancada do perito** e a **UI do portal de operação** — telas novas, mas
  **reusando o design system e os padrões** de painel/tabela/formulário já prontos — CAP-11/12.
- **O use case de encerramento** de caso (pequeno; no molde dos R1–R9 existentes; a regra
  STOP-CONCLUDED já existe) — CAP-14.
- **A autenticação real** (DF-12) — peça padrão de mercado — CAP-15.
- **O portal do cliente** (opcional; espelha read models já prontos) — CAP-13/CAP-07.

---

## VEREDITO DO CTO

Este não é um projeto para "recomeçar" — é um projeto para **ligar**. A maior parte do que
parecia faltar (a AHRI proativa, as telas dos humanos, a proatividade temporal, o
encerramento) **já foi construída e está desconectada ou desligada**. O trabalho genuinamente
novo cabe em cinco itens pequenos, quatro deles reusando padrões existentes. A regra guia se
confirma na prática: **antes de escrever qualquer linha, quase sempre já existe algo
equivalente esperando ser conectado.** O caminho mais curto para o primeiro cliente real não
passa por construir — passa por **corrigir a entrada, carregar as regras que já temos, publicar
as telas que já temos, e baixar o documento que o cliente já nos manda.**

_Documento de reconstrução orientado a reaproveitamento. Nenhuma linha de código escrita;
nada alterado ou commitado._
