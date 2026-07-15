# Shadow Mode — Auditoria + Relatório da Semana Simulada (Sprint 4D)

> Observabilidade operacional pura: nenhuma funcionalidade nova, nenhum módulo
> congelado alterado. O ShadowRecorder envolve a ENTRADA ÚNICA (4C) e registra um
> Shadow Report auditável por turno — sem tocar em nada do comportamento. Depois:
> uma semana simulada com 1.505 clientes / 5.684 turnos.

- **Data:** 2026-07-14 · **Portões:** typecheck ✅ 13/13 · lint ✅ 13/13 · test ✅ 13/13 (**425 testes; 10 novos 4D**)

## 1. O que foi implementado (só observabilidade)

| Peça | Onde | Função |
|---|---|---|
| `SHADOW_MODE` (flag ENV, default on) | `build-production.ts` | ativa/desativa o registro; comportamento idêntico |
| `ShadowRecorder` | `shadow.ts` | envolve a entrada única; grava report por turno (inbound + temporal) |
| `ShadowReport` | `shadow.ts` | percept, contexto, estado/etapa/verdade, ROs, intenções, tempo de decisão, respostas, latência, LLM/**tokens**, resultado, feedback humano |
| `TokensMeter` (nos adapters LLM 4A) | `llm-adapters.ts` | captura chamadas + tokens in/out (OpenAI/Anthropic/Gemini) sem mudar o fluxo |
| Detecção automática (`detect`) | `shadow.ts` | loop, spam, repetição, latência, confuso, irritado, escalada/follow-up excessivo, RO super/nunca usada, erros |
| Shadow Center | `/production/shadow/center`, `/reports`, `/ask`, `/feedback` + UI | tudo em tempo real; feedback humano anexável |
| Perguntas do fundador (`askShadow`) | `shadow.ts` | responde **exclusivamente dos Shadow Reports**; "não vou inventar" quando não há dado |

## 2. Defeito encontrado PELO Shadow Mode (e corrigido no próprio sprint)

O Shadow Center acusou **conversations = 2365 para 1505 clientes** — impossível.
Investigado: os follow-ups do workflow usam `missionId` como `chatId` quando o
evento não carrega chatId; o tick temporal disparava `onTemporalTrigger` para esse
"chat" fantasma, gerando conversas espúrias — e, em produção, **enviaria mensagem
para um destinatário inválido**. Correção (aditiva, no ingress 4C/4D):
`ProductionIngress.tick` resolve o chat REAL da missão; se irresolúvel, **não
envia** (registra e segue). Pós-correção: **conversations = 1505 (exatamente 1 por
cliente)**, regressão coberta por teste. *Este é precisamente o tipo de defeito que
"não apareceu em laboratório" que o Shadow Mode existe para caçar.*

## 3. Semana simulada — Shadow Report Geral

**1.505 clientes · 5.684 turnos · 1.505 conversas · 5.532 decisões · 0 silêncios ·
0 erros** em 147s reais. Perfis incluíram ansiosos, confusos, rajadas concorrentes
e retries de webhook (os cenários A2/4C), todos absorvidos.

## 4. Os mapas exigidos

**Mapa das ROs** (uso real):
| RO | usos | | RO nunca usada |
|---|---|---|---|
| RO-2D-EXPLAIN | 2112 | | RO-2D-WAIT-DEFAULT |
| RO-2D-GREET | 1505 | | RO-2D-ESCALATE-HUMAN |
| RO-2D-DOC-ACK | 1055 | | RO-2D-ONBOARD / RO-2D-INGEST-DOC |
| RO-4C-FOLLOWUP-TIMEOUT | 860 | | RO-4C-FOLLOWUP-SILENCE |

*Achado real:* `RO-2D-ONBOARD`/`RO-2D-INGEST-DOC` (use_case) nunca aparecem porque
o Brain, no fluxo padrão, prioriza a resposta de conversa e a missão nasce pela
via de conversa — o use_case explícito fica ocioso. Não é bug (o pipeline funciona),
mas é uma RO redundante a revisar. Classificação: **BAIXO**.

**Mapa dos tempos** (offline; latência REAL exige LLM plugado):
| percept | n | avg | p95 |
|---|---|---|---|
| text | 3769 | 21ms | 96ms |
| pdf | 1055 | 59ms | 134ms |
| timeout | 860 | 0ms | 0ms |

**Mapa das decisões:** speak=5532 (offline não gera escaladas/use_case; validar com LLM real).
**Mapa dos advogados:** Dra. Ana **451** · Dra. Clara 151 · Dr. Bruno 150 — o Shadow
detectaria sobrecarga se cruzasse um teto (aqui é distribuição deliberada 60/20/20; o
Founder aponta corretamente a Ana como mais carregada).
**Mapa dos clientes:** clientes=1505 missões=1505 docs=1055 processos=1055; **clientes
com >1 missão = 0** (unicidade 4C sustentada em escala).
**Mapa dos erros:** **0 turnos com erro.**

## 5. Detecções automáticas — classificadas

| Severidade | Qtde | Tipos |
|---|---|---|
| **CRÍTICO** | **0** | — |
| **ALTO** | **0** | — |
| MÉDIO | 76 | cliente-confuso (perfil de teste que pergunta 3× — detecção FUNCIONANDO) |
| BAIXO | 5 | ro-nunca-usada (as 5 ROs ociosas acima) |

As 76 detecções "cliente-confuso" são **verdadeiros positivos**: são exatamente os
clientes que o simulador programou para expressar confusão 3×. O detector está
correto — em produção, sinalizaria clientes reais que precisam de mais clareza.

## 6. Semana REAL

**Não executada — não há dados reais** (sem Evolution/LLM/clientes plugados nesta
máquina). Declarado, não simulado como se fosse real. O instrumento (Shadow Center
+ `askShadow`) já está pronto para consumir a operação real assim que ela existir.

## 7. Classificação consolidada

| Severidade | Itens |
|---|---|
| **Crítico** | Nenhum |
| **Alto** | Nenhum (o defeito de roteamento de follow-up foi ALTO — **corrigido neste sprint**) |
| **Médio** | (a) latência/decisões só validáveis com LLM real; (b) detector de confuso ativo (não é defeito, é feature funcionando) |
| **Baixo** | 5 ROs ociosas no fluxo padrão (revisar redundância RO-2D-ONBOARD/INGEST-DOC vs. resposta de conversa) |

## 8. Veredito

O Shadow Mode registrou tudo, agregou tudo em tempo real, respondeu ao fundador
exclusivamente dos reports (sem inventar), detectou padrões corretamente e — a prova
maior do seu valor — **encontrou um defeito de produção que os testes de laboratório
não pegaram** (roteamento de follow-up), que foi corrigido e coberto por regressão.
A semana simulada de 1.505 clientes rodou com zero erros, zero missões duplicadas e
zero detecções CRÍTICO/ALTO.

> ## SHADOW APROVADO
>
> Evidências objetivas: 425 testes verdes (10 de Shadow); semana simulada 1.505
> clientes / 5.684 turnos / 0 erros / 0 duplicações / 0 detecções CRÍTICO-ALTO;
> unicidade 1 cliente→1 missão sustentada em escala; Founder respondendo dos reports
> com "não vou inventar" para o desconhecido; e um defeito real de produção caçado e
> corrigido pelo próprio Shadow Mode.
>
> Ressalva honesta que acompanha a aprovação: a semana REAL depende das credenciais
> do dono; latência e comportamento do LLM de produção só serão medidos quando o
> Shadow Center observar tráfego real — que é exatamente para o que ele foi feito.
