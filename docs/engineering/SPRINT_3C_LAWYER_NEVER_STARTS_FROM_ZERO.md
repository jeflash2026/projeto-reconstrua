# Sprint 3C — O Advogado Nunca Começa do Zero (ARQUITETURA)

> Documento de arquitetura. Sem código, sem telas novas, sem CRUDs, sem entidades.
> Objetivo único: **reduzir trabalho humano**. Cada proposta está ancorada numa
> primitiva CONGELADA que já existe — nada aqui promete capacidade inventada.

- **Data:** 2026-07-14
- **Pergunta única:** quando um advogado abre um processo pela primeira vez no dia,
  o que ele deveria encontrar para sentir que a AHRI trabalhou durante a madrugada?

---

## 0. Auditoria adversarial — o que EXISTE vs. o que seria inventado

Antes de arquitetar, verifiquei cada sinal necessário contra o código congelado:

| Sinal necessário | Primitiva congelada REAL (verificada por grep) |
|---|---|
| "O que mudou desde ontem" | `StoredEvent.globalSeq` (sequência global monotônica) + `recordedAt` — um CURSOR por advogado×processo resolve o delta sem tocar nada |
| Filtrar ruído | `StoredEvent.isRelevant` (Relevante × Informativo já é classificação constitucional, DF-05/DF-14) |
| Capítulos da missão | `WorkflowStep` (documento_recebido → … → conclusao) — read model 2F |
| Cliente preocupado | `ClientMemory.emotionsObserved` (2E) — emoção PERCEBIDA com data, nunca inferência nova |
| Documentos pendentes | `ClientMemory.documentsPending` (2E) + pendências 3B |
| Prazo aproximando | `JuridicalEntry.dueAt` (3B) — prazos do próprio advogado |
| Cliente sumiu / responde devagar | `lastContactAt` + `avgResponseMs` (2E) |
| AHRI trabalhou de madrugada | `SchedulerRuntime` (remind_client/resend_request/follow_deadline) + turnos noturnos reais no Event Store com proveniência |
| Decisão automática auditável | `ExecutiveBrainRuntime` + catálogos RO (toda decisão com DECISOR/TIPO/FUNDAMENTO/REGRA) |
| Métricas de produtividade | `ObservabilityRuntime` + timestamps de `JuridicalEntry` |

**O que NÃO existe e portanto NÃO é prometido:** resumo semântico de teor jurídico
(seria LLM inventando); detecção de "contradições" além de divergência FACTUAL entre
read models; "oportunidades" além de regras determinísticas sobre fatos. Onde a
palavra "resumo" aparece abaixo, é **composição determinística de fatos** (o padrão do
`RelationshipContext.summary` de 2E), nunca texto inventado.

**Custo de implementação futuro (fora deste sprint):** 1 read model novo (cursor
`advogado×processo → lastSeenGlobalSeq`) + 1 composição de leitura ("Quadro de
Plantão") + regras RO-3D no catálogo do Brain. Zero alteração em congelados.

---

## 1. O primeiro quadro (entender um processo em < 20 segundos)

**O QUADRO DE PLANTÃO** — três faixas, nesta ordem, com orçamento rígido de 7 itens:

```
┌─ ONDE ESTÁ ────────────────────────────────────────────────┐
│ Etapa atual (1 linha) · prazo mais próximo (1 linha)       │
├─ O QUE MUDOU DESDE SUA ÚLTIMA VISITA ──────────────────────┤
│ ≤ 3 mudanças RELEVANTES, agrupadas por capítulo            │
│ ("2 documentos novos reconhecidos", nunca 6 eventos crus)  │
├─ O QUE ESPERA VOCÊ ────────────────────────────────────────┤
│ ≤ 3 itens acionáveis: prazo, confirmação pedida, pendência │
└────────────────────────────────────────────────────────────┘
     ↓ (um clique)  timeline completa auditável — a de hoje
```

**Aparece:** etapa atual; o prazo mais próximo; o delta desde o cursor; o que
depende DELE. **Desaparece da primeira dobra:** a timeline crua; eventos
Informativos; a tríade interna Verdade→Estado→Etapa (vira UMA linha: "situação
re-sintetizada"); o histórico que não mudou; qualquer número da empresa.

**Regra de ouro do zero-estado:** se nada mudou e nada espera, o quadro diz
exatamente isso em uma linha — "Nada mudou desde ontem às 18:12. Nenhuma ação sua
é necessária." Isso também é informação, e economiza a abertura inteira.

## 2. O que a AHRI preparou automaticamente (só de fatos existentes)

| Preparação | Fonte factual (sem invenção) |
|---|---|
| **Mudanças desde ontem** | eventos com `globalSeq >` cursor, filtrados por `isRelevant`, agrupados por capítulo do workflow |
| **Resumo executivo** | composição determinística: etapa atual + nº docs reconhecidos/pendentes + último contato + prazo mais próximo (padrão `summary` do 2E) |
| **Riscos novos** | REGRAS sobre fatos: prazo ≤ N dias (dueAt); cliente sem contato ≥ N dias (lastContactAt); documento pendente ≥ N dias; perícia enquadrada sem perito (handoff aging) |
| **Documentos pendentes** | `documentsPending` (2E) — com há quantos dias e quantas cobranças já feitas (scheduler fired) |
| **Cliente preocupado** | `emotionsObserved` recentes com `anxious`/`negative` — mostrado como OBSERVAÇÃO datada ("percebi ansiedade 2× esta semana"), nunca como diagnóstico |
| **Mensagens importantes** | entradas inbound cuja percepção teve urgência `high` — já registrado por turno |
| **Contradições** | somente divergência FACTUAL entre read models (ex.: memória diz "RG enviado", domínio não tem documento reconhecido) — flag "verificar", nunca conclusão |
| **Oportunidades** | somente regra determinística (ex.: zero pendências + conhecimento construído ⇒ "pronto para distribuição — confirme") |

## 3. Divisão de decisão (antes do advogado chegar)

**O Brain decide sozinho (madrugada, com RO + proveniência):**
- cobrar documento pendente (com anti-spam), reengajar cliente em silêncio;
- reagendar follow-ups, reordenar a fila do advogado por prioridade (prazo > risco > antiguidade);
- confirmar recebimento de documentos que chegaram à noite (R3 já roda no turno);
- escalar ao papel certo quando matéria exige humano;
- montar o Quadro de Plantão de cada processo.

**O advogado CONFIRMA (a AHRI propõe, ele aceita com um clique):**
- "pronto para distribuição" (o marco é dele);
- encerramento de pendência ("cliente diz que enviou — confirma?");
- silenciar um risco sinalizado (aceite consciente, registrado).

**JAMAIS automático (lista fechada — ver §6):** qualquer ato jurídico.

## 4. Timeline de centenas de eventos → 1 minuto (sem mágica)

Cinco reduções DETERMINÍSTICAS, todas sobre campos existentes:

1. **Cursor** — só o que é novo para ESTE advogado (`globalSeq > lastSeen`).
2. **Filtro constitucional** — `isRelevant=false` sai da primeira dobra (Informativo nunca altera estado; DF-05).
3. **Dobradura da tríade R6** — Verdade+Estado+Etapa do mesmo turno = 1 linha ("situação re-sintetizada às 03:12").
4. **Capítulos** — agrupar por `WorkflowStep` (recepção de documentos, perícia, distribuição…), com contagem: "Coleta de documentos (4 eventos)".
5. **Estado-primeiro** — mostrar ONDE ESTÁ antes de COMO CHEGOU; o "como" é expansível.

Resultado: 200 eventos → ~6 linhas de capítulo + 3 mudanças novas. Cada linha
expande para os eventos crus com DECISOR/REGRA/FUNDAMENTO — a auditabilidade não
se perde, ela se dobra.

## 5. "Ela trabalhou antes de mim" — ações concretas às 08:00

O que o advogado encontra, com carimbo de hora da madrugada e RO citada:
1. **Documentos que chegaram à noite já reconhecidos** (R3) e o conhecimento re-sintetizado (R6) — com hora: "03:41".
2. **Cobranças feitas**: "cobrei o CPF da Maria às 07:00 (3ª cobrança, RO-2D); ela respondeu 'envio hoje'".
3. **Fila ordenada**: os processos dele ordenados por prioridade decidida por RO, com o motivo ("1º: prazo em 2 dias").
4. **Confirmações preparadas**: "2 processos prontos para distribuição — aguardando seu clique".
5. **Riscos novos sinalizados** com o fato que os originou.
6. **Clientes acalmados**: "o José perguntou do processo às 23:50; respondi e ele agradeceu" — o advogado nem soube, e não precisava.
7. **O zero-estado honesto** nos processos parados: "nada mudou" — dito, não descoberto.

## 6. Decisões jurídicas EXCLUSIVAMENTE humanas (lista fechada)

1. Estratégia processual (tese, via, momento).
2. Redação, revisão e assinatura de qualquer peça.
3. Enquadramento jurídico final dos fatos.
4. Valoração de prova.
5. Propor/aceitar/recusar acordo ou transação.
6. Interpor ou não recurso.
7. Aconselhamento jurídico ao cliente (a AHRI comunica FATOS decididos; nunca aconselha).
8. Marcar distribuição e conclusão (marcos jurídicos — a AHRI só prepara e lembra).
9. Definição do objeto e quesitos de perícia (com o perito).
10. Questões de ética profissional e conflito de interesses.
11. Aceitação/renúncia de mandato; honorários.
12. Qualquer decisão sobre mérito.

(DF-09; INV-AD-01/02 — o `LegitimacyGate` já impede a AHRI de atuar em matéria
humana; esta lista é a explicitação operacional.)

## 7. Tarefas repetitivas que deixam de existir (estimativa honesta)

| Tarefa que morre | Antes (por processo/dia) | Depois |
|---|---|---|
| Reler o processo para saber onde parou | 10–20 min | 20 s (Quadro) |
| Cobrar documentos do cliente | 5–10 min | 0 (Brain cobra) |
| Escrever atualização ao cliente | 5–15 min | 0 (AHRI comunica após atividade) |
| Conferir prazos manualmente na agenda | 3–5 min | 0 (alertas por regra) |
| Triar o que mudou entre dezenas de e-mails/mensagens | 5–10 min | incluído no delta |
| Perguntar ao operador "chegou o documento?" | 2–5 min | 0 (reconhecido à noite) |

**Total honesto: 30–65 min/processo/dia → 3–8 min.** Num plantão de 10 processos
ativos, isso devolve **4 a 9 horas por dia** ao trabalho exclusivamente jurídico.
(Estimativas operacionais a validar com o piloto — ver §8; não são promessas.)

## 8. Como medir (métricas já capturáveis pelos stores existentes)

- **Tempo de abertura→primeira ação** (timestamps de acesso vs. 1ª `JuridicalEntry` do dia).
- **Processos tocados por advogado/dia** (entries por dia).
- **Prazos perdidos** (dueAt < done) — meta zero; hoje é o nº que importa.
- **Idade da fila de handoff** (aging do openFor) — quanto tempo um processo espera advogado.
- **Latência documento→reconhecimento→cliente informado** (recordedAt do evento vs. outbound).
- **Proporção de comunicação AHRI vs. humano** (deve tender a 100% AHRI para status).
- **Cobranças por documento até recebimento** (scheduler fired por pendência).
- **Retrabalho**: reaberturas do mesmo processo no mesmo dia (proxy de quadro insuficiente).
- **A métrica-mãe:** minutos entre 08:00 e a primeira ação JURÍDICA (não administrativa) do dia. Se o portal funciona, ela despenca.

## 9. Contra o excesso de informação

**Orçamento duro:** máximo 7 itens no Quadro; máximo 3 por faixa; 1 clique para tudo o mais.
**Nunca na tela inicial:** timeline crua; eventos Informativos; a tríade interna de
re-síntese; transcrição integral do WhatsApp; atributos completos da memória; logs
de runtime; métricas da empresa; qualquer dado de outro advogado; qualquer número
financeiro. **Nunca em lugar nenhum do portal do advogado:** Founder Console, financeiro,
processos alheios (já garantido por construção no 3B).
**Prioridade de exibição é decisão de RO** (auditável), não heurística de UI: se dois
riscos disputam espaço, a regra de prioridade decide e a escolha fica registrada.

## 10. LAWYER-WORKDAY-00

Entregue em documento próprio: [LAWYER-WORKDAY-00.md](./LAWYER-WORKDAY-00.md).

---

## Veredito da auditoria adversarial

Tudo o que este documento propõe é **composição de leitura sobre fatos que os módulos
congelados já produzem** + regras RO novas no catálogo injetável do Brain + um único
read model novo (cursor de visto). Nada exige alterar congelados; nada promete IA
inventando conteúdo; toda preparação noturna é o Scheduler+Brain que já existem,
com proveniência. A implementação (Sprint 3D, se autorizada) é majoritariamente
uma VIEW nova sobre a API 3B existente.
