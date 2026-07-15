# Relatório de Homologação Operacional Real — Sprint 4B

> Homologação ponta a ponta executada com o CÓDIGO DE PRODUÇÃO (composição 4A),
> do anúncio ao advogado com processo pronto, mais sondas adversariais deliberadas
> (corrida, idempotência, repetição, loops). Nenhuma funcionalidade nova; nenhum
> módulo alterado. **Este relatório não esconde nada** — inclui os defeitos que a
> própria homologação encontrou, com classificação e recomendação.

- **Data:** 2026-07-14 · **Instrumento:** script de homologação sobre `assembleProduction`
- **Ambiente:** SEM credenciais reais nesta máquina (sem Evolution conectada, sem
  chave LLM, sem Postgres ativo, sem HTTPS, sem Docker instalado). Passos 1–2
  auditados como artefato+prontidão; passos 3–16 EXECUTADOS de verdade em processo.

## 1. Checklist dos 16 passos

| # | Passo | Resultado | Evidência |
|---|---|---|---|
| 1 | Landing publicada / HTTPS / responsiva / Pixel | **PENDENTE-DONO** (artefato pronto) | `apps/landing/index.html` existe, viewport responsivo, CTA wa.me com `utm_campaign` no texto; Pixel é PLACEHOLDER (dono cola o snippet); HTTPS/publicação = deploy |
| 2 | Evolution conectado | **PENDENTE-DONO** | adapter+retry prontos; go-live acusa vermelho sem ENV (correto) |
| 3 | Primeira conversa "Olá" | ✅ | Brain decidiu `RO-2D-GREET`; AHRI: "Oi, vamos seguir com boas-vindas…" |
| 4 | Condução natural, sem script | ⚠️ PARCIAL | sem árvore/roteiro (intenção→fraseado); MAS em modo offline as frases vêm de rotação determinística → repetição exata no 13º turno (achado A4); com LLM real, a validar |
| 5 | Coleta nome/telefone/cidade/docs/HISCON | ⚠️ PARCIAL | nome ✅ ("Carlos"), telefone ✅ (chatId), cidade ✅ ("Fortaleza"), HISCON ✅; **profissão capturada ERRADA** ("profession=de Fortaleza" — achado A6); **imagem RG.jpg NÃO ingerida** (achado A2) |
| 6 | Reconhecimento de documentos | ⚠️ PARCIAL | HISCON.pdf reconhecido (R3) ✅; imagem não (A2) |
| 7 | Missão criada | ✅ | mission stream com proveniência AHRI |
| 8 | Admin recebe notificação | ⚠️ PARCIAL | dashboard/read models refletem ✅; **notificação push inexistente** (nenhuma RO a emite — achado A5) |
| 9 | Distribuição manual ao advogado | ✅ | atribuição admin→Dra. Ana |
| 10 | Advogado visualiza | ✅ | `myMissions`=1; isolamento já provado em 3B |
| 11 | Cliente recebe atualização automática | ✅ | despacho → `RO-3B-INFORM-ANDAMENTO` → "Veja bem, seguindo em andamento do seu processo…" |
| 12 | Workflow funcionando | ✅ (nome de passo confuso — A8) | steps: acompanhamento→documento_reconhecido→distribuicao |
| 13 | Follow-ups automáticos | ❌ **SILENCIOSOS** | tarefa venceu, tick rodou, Brain decidiu `RO-2D-WAIT-DEFAULT` → **nenhuma mensagem proativa jamais sai** (o catálogo 2D não tem RO de reengajamento temporal — achado A3) |
| 14 | Scheduler funcionando | ✅ | dispara 1×, sem loop (tick repetido = 0) |
| 15 | Read Models atualizados | ❌ **SUBCONTANDO** | projector vê 1 documento; métricas dizem docs=0, processos=0 (achado A1 — o mais grave) |
| 16 | Founder Console (6 perguntas) | ⚠️ 2/6 | clientes ✅(1), processos ⚠️(respondeu 0 por A1), documentos/perícias/advogados/workflows → "não tenho esse dado" (honesto, mas o catálogo de perguntas 2E não cobre — achado A7) |

Sondas extras: idempotência ✅ (messageId repetido = 0 respostas novas) · humanização ✅
(piso de 1,2s é sobre o TOTAL; a sonda de sleep individual era falso-positivo — verificado) ·
REAL_FIRST_CLIENT ✅ 8/8 · go-live sem credenciais = bloqueado (comportamento correto).

## 2. Lista de defeitos (classificados)

| ID | Sev | Área | Defeito | Causa raiz | Correção recomendada |
|---|---|---|---|---|---|
| **A1** | **BLOQUEANTE** | Read Models | Métricas administrativas SUBCONTAM (docs=0, processos=0 com domínio populado) → Founder responde NÚMEROS ERRADOS | `admin-projection.ts:15` descarta evento com `globalSeq <= lastGlobalSeq`, assumindo ordem GLOBAL; o Dispatcher (2A.2) entrega streams em PARALELO (ordem só por stream) → eventos "atrasados" são dropados silenciosamente | Substituir o guard por dedup por eventId (ou seq por stream). 2E é congelado ⇒ exige AUTORIZAÇÃO para corrigir 2E, ou subscriber substituto aditivo trocado na composição 4A |
| **A2** | **BLOQUEANTE** | Corrida | 2 mensagens SIMULTÂNEAS de cliente novo criaram **2 missões** | webhook não serializa por chatId; identity map (2D) é read-modify-write | Fila por conversa no servidor de produção (serialização por chatId) — aditivo em 4A; reforço futuro: compare-and-set no identity map |
| **A3** | **ALTO** | Follow-up | Follow-ups NUNCA falam com o cliente (scheduler dispara, Brain decide WAIT — o catálogo 2D não tem RO de reengajamento temporal) | `MISSION_RULE_CATALOG` sem regra para percept `timeout`/`silence` falante | Catálogo ESTENDIDO injetado na composição 4A (o port aceita; 2D intocado) — precisa de RO aprovada |
| **A4** | **ALTO** | Conversa | Resposta EXATAMENTE igual no 13º turno (offline): rotação de 12 combos > janela anti-repetição (8) | double `VaryingLlmExpression` é cíclico | Em produção o LLM real frasea (validar na homologação com credenciais); para modo offline: ampliar janela/combos |
| **A5** | **MÉDIO** | Admin | Sem notificação push ao Administrador quando cliente novo chega (só dashboard) | nenhuma RO `notification` para chegada | RO nova de notification (canal portal-admin) no catálogo estendido |
| **A6** | **MÉDIO** | Coleta | Extrator determinístico gravou `profession="de Fortaleza"` (valor errado); imagem RG não conta como documento enviado | double de extração 2E simplista; percepção offline não marca artefato em `image` | Em produção, extractor/percepção LLM reais cobrem; corrigir padrões do double para homolog offline |
| **A7** | **MÉDIO** | Founder | 4 das 6 perguntas exigidas não têm mapeamento (perícias/advogados/workflows/documentos-total) — resposta honesta, mas sem dado | `AdminQueryKind` (2E, congelado) é união fechada | Wrapper aditivo de perguntas em 4A/4C respondendo dos read models (staff/projector/workflow) |
| **A8** | **BAIXO** | UX/Semântica | Step de workflow "distribuicao" acende no `process.recognized` (antes da distribuição real pelo advogado) — informação confusa no acompanhamento | mapa de reações 2F nomeia o passo pelo evento | renomear rótulo na exibição (portal) ou novo passo "processo_reconhecido" em catálogo futuro |
| A9 | BAIXO | Coleta | `documentsSent` na memória = 1 (imagem não entra) — consequência de A2/percepção offline | idem A6 | idem |

**Não-defeitos verificados:** idempotência de mensagem; loop de scheduler (não redispara);
piso de humanização (total ≥ 1,2s); isolamento entre advogados (3B); go-live bloqueando sem
credenciais (é o comportamento desejado).

## 3. Mapa de gargalos

1. **Consistência dos read models (A1)** — o gargalo estrutural: qualquer relatório
   administrativo/Founder está sujeito a subcontagem sob paralelismo. É o primeiro a corrigir.
2. **Serialização por conversa (A2)** — sob tráfego real de anúncio (cliente ansioso
   manda 3 mensagens seguidas), a duplicação de missão é provável, não teórica.
3. **Reengajamento (A3)** — sem ele, o funil para: cliente que some nunca é chamado de volta.
4. **Cobertura do Founder (A7)** — o fundador pergunta, o sistema (honestamente) não sabe.
5. Latência: no laço offline tudo é sub-segundo por turno (+ humanização proposital);
   a latência REAL de LLM/Evolution só é mensurável na homologação com credenciais.

## 4. Correções recomendadas (ordem de execução)

1. A1 (autorizar correção pontual no 2E OU subscriber substituto aditivo) + teste de entrega embaralhada.
2. A2 (fila por chatId no servidor de produção — aditivo).
3. A3 + A5 (catálogo de ROs estendido injetado — exige aprovação de ROs).
4. A7 (wrapper de perguntas administrativas — aditivo).
5. A4/A6 (só afetam modo offline; revalidar com LLM real).
6. Homologação COM credenciais do dono (Evolution+LLM+Postgres+HTTPS): repetir este
   roteiro e medir latência real + Pixel disparando.

## 5. Parecer final

**A plataforma NÃO pode atender clientes reais HOJE.**

Baseado exclusivamente na implementação encontrada (não na intenção):

1. **A1** faz o retrato administrativo mentir por omissão (números subcontados) — inaceitável
   num sistema cuja constituição proíbe informação inventada ou distorcida.
2. **A2** duplica missões sob o padrão de tráfego mais comum de anúncio (rajada de mensagens).
3. **A3** quebra a promessa operacional central ("a AHRI acompanha sozinha") — hoje ela
   agenda, acorda… e decide calar para sempre.
4. Além disso, as credenciais reais (Evolution/LLM/Postgres/HTTPS) ainda não foram
   plugadas — e o próprio go-live bloqueia a subida, como projetado.

**O que a homologação também provou:** o pipeline inteiro funciona ponta a ponta
(anúncio→missão→advogado→cliente atualizado, 8/8 no fluxo oficial), a idempotência
segura, o scheduler não loopa, o isolamento é real e o sistema **degrada com
honestidade** (Founder diz "não tenho esse dado" em vez de inventar). Os bloqueios
são pontuais, localizados e têm correção clara — estimativa: A1+A2 são pequenos;
A3/A5/A7 dependem de ROs aprovadas + wrappers aditivos.

**Recomendação:** autorizar um Sprint 4C de correções (A1–A3 no mínimo), repetir esta
homologação, e só então plugar credenciais e ligar o anúncio.
