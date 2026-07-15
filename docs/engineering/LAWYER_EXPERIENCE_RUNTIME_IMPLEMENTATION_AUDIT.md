# Auditoria de Implementação — Lawyer Experience Runtime (Sprint 3D)

> Implementação integral da arquitetura aprovada no Sprint 3C: **o advogado nunca
> começa o dia do zero**. Ele entra, entende (≤ 15s), decide e sai — a AHRI preparou
> a madrugada, parou nos limites constitucionais e continua sozinha depois de cada
> decisão. Nenhum módulo congelado alterado; nenhuma competência privativa
> automatizada.

- **Data:** 2026-07-14
- **Congelados e INTOCADOS:** Domínio, 2A, 2A.2, 2B, 2C, 2D, 2E, 2F, 3A, **3B
  (Lawyer Portal — app e API)**.

## 0. Portões obrigatórios

```
pnpm typecheck   → 13/13   EXIT 0
pnpm lint        → 13/13   EXIT 0
pnpm test        → 13/13   EXIT 0
   domain 194 · application 86 · infrastructure 82 | 4 skipped · api 29 (+9) ·
   portais 7
```
**398 testes passando; 9 novos no Sprint 3D** (todos passaram na primeira execução).

## 1. Auditoria adversarial PRÉVIA — conclusão: 100% aditivo

- `AssembledAdvogadoOperation` (3B, público) expõe TUDO que a experiência precisa
  (work/bridge/projector/workflow/memoryStore/handoff/observability) — verificado
  por leitura antes de codar.
- **After-Decision reusa o fluxo 3B inteiro**: `work.addEntry` → `bridge.notify` →
  Brain (RO-3B) → cliente. Nenhuma nova via de comunicação foi criada.
- **Achado honesto:** a spec diz "o objetivo NÃO é criar telas" E o portal 3B está
  congelado ⇒ o 3D entrega a experiência como **runtime + API** (`/lx/*`); o
  portal congelado a consome quando houver autorização. Não há conflito.

## 2. Os 9 itens implementados

| # | Item da spec | Implementação | Prova (teste) |
|---|---|---|---|
| 1 | **Cursor de Leitura** | [`cursor.ts`](../../packages/application/src/lawyer-experience/cursor.ts): último acesso, última missão aberta, último `globalSeq` visto POR missão; delta sempre relativo ao cursor | *"CURSOR: após abrir o quadro, o plantão mostra ZERO mudanças"* — `rawNewEvents === 0` (delta, nunca recálculo) |
| 2 | **Quadro de Plantão** | [`plantao.ts`](../../packages/application/src/lawyer-experience/plantao.ts): ONDE ESTOU · O QUE MUDOU (≤3 grupos) · O QUE ESPERA (≤3) + fila ordenada com motivo (`RO-3D-PRIORITY-001`) + zero-estado | teste do plantão: orçamento respeitado, motivo com RO, resumo em 4 linhas |
| 3 | **Timeline Inteligente** | [`smart-timeline.ts`](../../packages/application/src/lawyer-experience/smart-timeline.ts): dobra determinística — tríade R6 → "situação re-sintetizada"; capítulos por workflow; eventos crus DENTRO dos grupos | benchmark: soma dos eventos dos capítulos === total cru (**nada perdido**) |
| 4 | **Resumo Executivo** | composição determinística de FATOS (aconteceu/decisão/espera/AHRI resolveu) — **zero LLM** no caminho | 4 linhas verificadas no teste |
| 5 | **Preparação Noturna** | [`night-shift-runtime.ts`](../../packages/infrastructure/src/lawyer-experience/night-shift-runtime.ts): varre advogados ativos, abre decisões (docs presentes→confirmar distribuição; prazo vencido→análise), destaca riscos; idempotente; cron do dono | *"PREPARAÇÃO NOTURNA"* — decisão aberta às 03:00; rodar 2× não duplica |
| 6 | **Decision Runtime** | [`decision-gate.ts`](../../packages/application/src/lawyer-experience/decision-gate.ts): PARA + EXPLICA + CONTEXTO factual + FUNDAMENTO + AGUARDA; só o dono resolve | teste: explanation "competência sua", contexto com documentos, fundamento DF-09, status open |
| 7 | **After Decision** | [`after-decision-runtime.ts`](../../packages/infrastructure/src/lawyer-experience/after-decision-runtime.ts): marco jurídico (3B) + cliente informado (Brain RO-3B) + memória viva (fato com fonte `decision:<id>`) + auditoria — tudo automático | teste: `clientInformed:true`, gateway +1, entry `distribuicao` criada, memória atualizada, decisão fechada |
| 8 | **Productivity Metrics** | [`productivity.ts`](../../packages/application/src/lawyer-experience/productivity.ts): tempo até 1ª decisão, eventos ocultados, mudanças relevantes, comunicações da AHRI, tempo economizado com **parâmetros DECLARADOS** (20s/evento; 240s/comunicação) | teste de métricas: todos os campos > 0, params no relatório |
| 9 | **Zero Cognitive Load** | plantão + zero-estado ("quiet") + cursor: entra → entende → decide → sai | zero-estado testado após resolução |

## 3. BENCHMARK — antes da AHRI × depois da AHRI (medido no teste, não estimado à mão)

Cenário real do teste: cliente chega de madrugada, envia documento; um advogado, um processo.

| Métrica | ANTES (sem AHRI) | DEPOIS (3D) | Evidência |
|---|---|---|---|
| Eventos a ler ao abrir o processo | **≥ 10 eventos crus** (onboarding + ingestão geram 12+) | **capítulos dobrados** (< nº cru; asserção `shownLines < rawTotal`) | teste "BENCHMARK" |
| Informação perdida na compressão | — | **zero** (soma dos eventos nos capítulos === total cru) | mesma asserção |
| Releitura no 2º acesso | tudo de novo | **0 eventos** (`rawNewEvents === 0` após cursor) | teste "CURSOR" |
| Preparar ambiente de manhã | manual | decisões já abertas às 03:00 com contexto+fundamento | teste "PREPARAÇÃO NOTURNA" |
| Comunicar o cliente após decisão | escrever mensagem | **0 mensagens escritas** — AHRI comunicou (gateway +1, humanizado) | teste "AFTER DECISION" |
| Tempo economizado estimado | — | `eventsHidden×20s + comunicações×240s`, **parâmetros declarados no relatório** | teste "MÉTRICAS" |
| Tempo até a 1ª decisão do dia | não medido | medido (`timeToFirstDecisionMs`) — a métrica-mãe do 3C | idem |

## 4. CONFIRMAÇÃO EXPLÍCITA — nenhuma competência privativa foi automatizada

1. **Nada jurídico é produzido**: grep em todo o 3D — zero geração de peça, minuta,
   estratégia ou recurso (`(none — nada jurídico é produzido)`).
2. **A AHRI jamais resolve uma decisão**: os ÚNICOS chamadores de `gate.resolve` são
   o After-Decision e a rota POST — ambos exigem o `advogadoId` DONO; teste prova que
   outro advogado recebe **403** e que não existe caminho de resolução sem advogado.
3. **O Night Shift só ABRE paradas** (`gate.open`) — nunca resolve, nunca marca marco.
4. **3D não muta domínio**: grep — zero chamadas a fábricas/agregados; a continuidade
   passa pelo fluxo 3B → Brain (RO-gated, proveniência).
5. **Toda parada carrega fundamento constitucional** (DF-09; INV-AD; RO-R7-001) —
   verificado por asserção.
6. As 12 competências privativas listadas no 3C permanecem intocáveis por construção:
   não existe rota, runtime ou regra que as execute.

## 5. Prova de não-alteração

Todo o 3D é código novo: `packages/application/src/lawyer-experience/`,
`packages/infrastructure/src/lawyer-experience/`, `apps/api/src/lawyer-experience/`.
Mudanças compartilhadas: 1 linha `export *` por barril + 1 export em
`apps/api/src/index.ts`. grep: nenhum congelado referencia 3D; API 3B
(`advogado-server.ts`) e portal 3B intocados. Os 194 testes de domínio e todos os de
2A–3B passam idênticos. Única correção interna 3D durante o build: renomear
`DecisionType`→`LawyerDecisionType` (colisão de export com 2C — resolvida no 3D, não
no congelado).

## 6. Limites honestos

- Stores in-memory (cursor/decisões/produtividade) — Postgres entra pelos mesmos ports.
- O "tempo economizado" é estimativa **parametrizada e declarada** no próprio
  relatório; os parâmetros (20s/240s) são operacionais, ajustáveis, nunca vendidos
  como medição direta.
- A superfície visual do plantão no portal congelado aguarda autorização (a spec
  desta sprint exigia a EXPERIÊNCIA, não telas — entregue via API `/lx/*` pronta).
- O Night Shift roda por cron do dono (`POST /lx-admin/night-shift`) — nenhum
  servidor é iniciado pelo código.

## 7. Veredito

A experiência 3C está implementada integralmente: cursor persistente com delta real,
Quadro de Plantão com orçamento duro e zero-estado, timeline dobrada sem perda,
resumo executivo determinístico, preparação noturna idempotente, pontos de decisão
que param com explicação+contexto+fundamento, continuidade automática pós-decisão
(cliente informado pela AHRI via Brain), e métricas de produtividade com benchmark
medido em teste. Nenhuma competência privativa automatizada — confirmado por grep,
por construção e por teste. Portões: `typecheck` ✅ `lint` ✅ `test` ✅ (398 passando,
9 novos).

**Sprint 3D — Lawyer Experience Runtime: ENCERRADO.**
_Aguardando autorização explícita para o próximo Sprint._
