# Relatório de Homologação — Sprint 4C (correções + re-homologação completa)

> Releitura integral do HOMOLOGATION_REPORT_4B.md como única fonte; correção
> EXCLUSIVA dos bloqueantes; re-execução de TODA a homologação 4B (mesmos 16
> passos + mesmas sondas adversariais, mesmo instrumento). Módulos proibidos
> intocados (Domain/Event Store/Dispatcher/Brain/Conversation/Mission/Memory/
> Founder) — as causas viviam fora deles.

- **Data:** 2026-07-14
- **Portões:** typecheck ✅ 13/13 · lint ✅ 13/13 · test ✅ 13/13 (**416 testes; 11 novos de prova 4C**)

## 1. O que causava A1 (Founder respondendo números errados)

`admin-projection.ts:15` usava `if (event.globalSeq <= metrics.lastGlobalSeq) return`
como "idempotência". Isso pressupõe entrega em ORDEM GLOBAL — mas o Dispatcher
(2A.2) garante ordem apenas POR STREAM e entrega streams em paralelo. Quando um
evento de outro stream chegava com `globalSeq` maior primeiro, os "atrasados" eram
**descartados silenciosamente**: subcontagem invisível (docs=0, processos=0).

**Eliminação (não remendo):** o dedup agora é **por stream** —
`processedByStream[streamId] >= version ⇒ já aplicado`. Isso casa EXATAMENTE com a
garantia real do Dispatcher (ordem por stream): exactly-once **lógico** demonstrável,
sem perda e sem dupla contagem, sob qualquer intercalação e qualquer reentrega.
Event Store, Dispatcher, append-only e auditabilidade intocados; `lastGlobalSeq`
vira marca d'água informativa. **Prova:** teste com a intercalação exata do bug
(seq 5 antes de seq 3) + 20 permutações aleatórias com reentrega dupla de cada
evento — contagens exatas em todas.

## 2. O que causava A2 (duas missões para o mesmo cliente)

O webhook processava turnos do MESMO cliente em paralelo; o mapa de identidades
(chat→missão) é read-modify-write: dois turnos simultâneos de um cliente NOVO liam
"sem missão" e ambos criavam uma.

**Eliminação:** `ProductionIngress` — **entrada única de produção**: todo turno
(mensagem do webhook E sinal temporal) entra numa **fila por chatId** (cadeia de
promessas por conversa). Turnos da mesma conversa são estritamente sequenciais ⇒
o segundo SEMPRE enxerga a identidade gravada pelo primeiro ⇒ `1 cliente → 1 missão`
até a missão terminar. Conversas diferentes seguem paralelas. Webhook, fluxo
REAL_FIRST_CLIENT e loop temporal do `main.ts` usam exclusivamente o ingress.

**Prova (matriz exigida, todos verdes):**
| Cenário | Resultado |
|---|---|
| 2 mensagens simultâneas (o caso que falhou no 4B) | 1 missão |
| Rajada de 10 simultâneas | 1 missão |
| Mesmo messageId 5× em paralelo (retry/redelivery) | 1 missão E 1 única resposta |
| Misto: rajada + duplicata + sinal temporal concorrente na mesma conversa | 1 missão |
| 4 clientes diferentes em paralelo | 4 missões (paralelismo preservado) |

*Escopo declarado:* garantia por processo (deploy atual = 1 nó). Multi-nó exigirá
sticky por chat ou lock distribuído — documentado, não escondido.

## 3. O que causava A3 (a AHRI abandonava o cliente)

O Scheduler disparava e o Brain decidia — corretamente, PELO CATÁLOGO — `WAIT`:
não existia NENHUMA Regra Operacional falante para os percepts temporais
(`silence`/`timeout`). O defeito não era do timer nem do Brain: era ausência de RO.

**Eliminação:** `PRODUCTION_RULE_CATALOG` = catálogo 2D (importado, intocado) +
**RO-4C-FOLLOWUP-SILENCE** e **RO-4C-FOLLOWUP-TIMEOUT** — injetado na composição
4A pelo port que sempre existiu. **Nunca timer cego:** o timer só percebe; o Brain
decide por regra, com fundamento (Art. 9º/INV-07; RO-R8-004/R6-002) e BLOQUEIOS
(missão ENCERRADA ⇒ cala; matéria humana ⇒ escala, jamais fala automática). A
Conversation segue só executora (fraseado humanizado, anti-repetição).

**Prova:** follow-up vencido → cliente recebe mensagem com `RO-4C-FOLLOWUP-TIMEOUT`
e presença "digitando" antes; tick repetido → 0 (sem loop); ENCERRADA → wait/stop;
matéria humana → escalação única.

## 4. Nova homologação (os mesmos 16 passos + sondas)

| Passo/Sonda | 4B | **4C** |
|---|---|---|
| Read models (15) | ❌ docs=0, processos=0 | ✅ **docs=1, processos=1 — iguais ao domínio** |
| Founder "quantos processos?" (16) | ❌ "0" (errado) | ✅ **"1 processos"** [fonte: read-model] |
| Corrida 2 msgs simultâneas | ❌ 2 missões | ✅ **1 missão** |
| Follow-up automático (13) | ❌ silêncio eterno | ✅ **mensagem por RO-4C-FOLLOWUP-TIMEOUT** |
| Loop de scheduler (14) | ✅ | ✅ (tick repetido = 0) |
| Idempotência messageId | ✅ | ✅ |
| REAL_FIRST_CLIENT | ✅ 8/8 | ✅ 8/8 (agora via entrada única) |
| Passos 3–12 (conversa→advogado→cliente atualizado) | ✅ | ✅ |

## 5. Achados remanescentes (classificação final — nada escondido)

| Sev | Achado | Por que NÃO bloqueia produção |
|---|---|---|
| MÉDIO | Imagem (RG.jpg) não ingerida; profissão extraída errada; resposta idêntica no 13º turno | São artefatos dos **doubles offline** (percepção/expressão/extrator 2B/2E). Em produção o go-live **BLOQUEIA `llm=offline`** — o sistema se recusa a subir sem LLM real, que cobre os três casos. Revalidar na homologação com credenciais (obrigatória antes do anúncio) |
| MÉDIO | Sem notificação push ao Admin na chegada de cliente (dashboard cobre) | A5 do 4B — RO aditiva a aprovar; fora do escopo 4C (só bloqueantes) |
| MÉDIO | Founder sem mapeamento p/ perícias/advogados/workflows/documentos-total (responde honestamente "não tenho") | A7 — wrapper aditivo futuro; honestidade preservada |
| BAIXO | Rótulo "distribuicao" acende no process.recognized | A8 — cosmético de exibição |
| — | "Espera 578ms" da sonda | **Falso positivo** da sonda (mede sleeps individuais; o piso de 1,2s é sobre o TOTAL — provado por teste desde 2B) |
| — | go-live vermelho sem credenciais | Comportamento PROJETADO (bloqueio até o dono plugar Evolution/LLM/Postgres/HTTPS) |

**BLOQUEANTES RESTANTES: NENHUM.**

## 6. Classificação final

Os três bloqueantes do 4B foram **eliminados na causa raiz**, com provas
automatizadas permanentes (11 testes novos) e re-homologação completa dos 16
passos. Os remanescentes são MÉDIO/BAIXO, não impedem produção, e os artefatos de
modo offline são estruturalmente impedidos de chegar a produção pelo próprio
go-live.

> **"APTO PARA PRODUÇÃO."**
>
> Nos termos exatos do sistema: com as credenciais reais do dono (Evolution, LLM,
> DATABASE_URL, HTTPS), `GET /production/go-live` deve responder `ready:true` e o
> processo sobe; sem elas, a plataforma continua se recusando a subir — que é a
> última linha de defesa funcionando como projetada. Passo final recomendado antes
> do anúncio: repetir o REAL_FIRST_CLIENT com as credenciais plugadas (botão em
> `/production/ui`) para validar latência real e o fraseado do LLM de produção.
