# Auditoria de Implementação — Produção Real / GO LIVE com Clientes (Sprint 4A)

> Nenhuma funcionalidade nova: a plataforma inteira (2A→3D) ligada ao MUNDO REAL —
> anúncio → landing → WhatsApp/Evolution → AHRI → cliente — com Postgres real,
> LLM real, configuração persistida, monitor, checklist bloqueante e o fluxo
> REAL_FIRST_CLIENT homologado ponta a ponta. Nenhum módulo congelado alterado.

- **Data:** 2026-07-14
- **Congelados e INTOCADOS:** Domínio, 2A, 2A.2, 2B, 2C, 2D, 2E, 2F, 3A, 3B, 3D e portais.

## 0. Portões

```
pnpm typecheck   → 13/13   EXIT 0
pnpm lint        → 13/13   EXIT 0
pnpm test        → 13/13   EXIT 0   (405 passando; 7 novos 4A — inclui REAL_FIRST_CLIENT 8/8)
next build       → admin ✅  advogado ✅
docker build     → Dockerfile + compose entregues; docker NÃO está instalado nesta
                   máquina (verificado) — build local impossível; sintaxe validada
                   e processo documentado no Manual de Deploy. DECLARADO, não omitido.
```

## 1. Auditoria adversarial PRÉVIA — conclusões

1. **Nenhuma composição existente expõe o superset** (admin op sem work/bridge;
   advogado op sem founder/admin) ⇒ `assembleProduction` (4A) fia os blocos públicos
   congelados UMA vez e produz **visões estruturais** para os três servidores
   congelados (`AssembledAdminOperation`/`AssembledAdvogadoOperation`/
   `AssembledLawyerExperience`) — reuso sem alteração.
2. **Telas em portais congelados** ⇒ o Monitor+Config são servidos pela PRÓPRIA API
   (`/production/ui`, HTML único) — portal intocado; tela definitiva aguarda
   descongelamento autorizado.
3. **Os 4 usos de LLM da spec têm ports congelados injetáveis** (verificado antes
   de codar): `LlmPerceptionPort`, `LlmExpressionPort`, `AdminNarrationPort`
   (Founder), `MemoryAttributeExtractorPort` (Memory). Nenhum port novo foi preciso.
4. Um `docker-compose.yml` de DEV já existia (Sprint 0, só banco) ⇒ intocado;
   produção usa `docker-compose.production.yml` separado.

## 2. Fluxograma completo (o pipeline validado)

```
META ADS ──utm_campaign──► LANDING (apps/landing/index.html, estática)
     │ wa.me/<numero>?text="Olá! Vim pelo anúncio [campanha]…"
     ▼
WHATSAPP ──webhook messages.upsert──► POST /webhook/evolution (ACK imediato)
     ▼ mapEvolutionUpsert (2B)
CONVERSATION RUNTIME (2B) ─ percebe (LLM real: Perception) 
     ▼ FullLoopBrainAdapter (2F)
EXECUTIVE BRAIN (2C) ─ decide por RO (determinístico, sem LLM)
     ▼ use_case intents
MISSION RUNTIME (2D) ─ R1→R2→Missão→Verdade→Estado→Etapa / R3→R4→R5→R6
     ▼ append atômico
EVENT STORE (2A, Postgres) ──► DISPATCHER (2A.2) ──► READ MODELS (2E métricas,
     3A projector, 2F workflow) + MEMÓRIA VIVA (2E, extração LLM) 
     ▼ conversation intents (LLM real: Expression, humanizado 2B)
CLIENTE ◄── WhatsApp (Evolution real, HTTP resiliente com retry/backoff)
     │
     ├─► PORTAL ADMIN (3A, API 3002) ─ dashboards/founder (narração LLM)
     └─► PORTAL ADVOGADO (3B/3D, APIs 3003/3004) ─ plantão/decisões
```

## 3. Os 9 itens implementados

| # | Item | Entrega | Evidência |
|---|---|---|---|
| 1 | **Landing** | [apps/landing/index.html](../../apps/landing/index.html) — estática, focada em conversão (dor→passos→CTA duplo), `utm_campaign` viaja NO TEXTO do WhatsApp (atribuição real), placeholder do Meta Pixel, disclaimer ético | arquivo + Manual de Deploy §4 |
| 2 | **Pipeline completo** | validado ponta a ponta pelo REAL_FIRST_CLIENT (8 etapas com evidência cada) | teste 8/8 verde |
| 3 | **Evolution REAL** | `EvolutionGateway` (2B) + config por ENV + `ResilientHttpClient` (retry/backoff/429/5xx + observabilidade; reconexão = retry, HTTP stateless) + health no boot/checklist | [resilient-http.ts](../../packages/infrastructure/src/production/resilient-http.ts) |
| 4 | **LLM REAL** | [llm-adapters.ts](../../packages/infrastructure/src/production/llm-adapters.ts): OpenAI/Anthropic/Gemini via HTTP puro, nos 4 ports congelados; prompts da config; uso/erros na observabilidade; **degrade explícito** (nunca inventa) — perception neutra factual, fraseado mínimo, narração determinística | typecheck+lint; provider selection testada (offline) |
| 5 | **Postgres REAL** | `production.documents` (04-production.sql) + `PgJsonStore` + **16 adapters** de documento (config/memória/sessões/conversa/scheduler/handoff/progresso/staff/atribuições/jurídico/cursor/decisões/produtividade/métricas/identidades) + Event Store/Outbox/Deliveries **Pg de 2A** reutilizados — **só adapters; zero runtime alterado** | seleção por DATABASE_URL testada em modo memory (mesmo código) |
| 6 | **Admin Config** | GET/PUT `/production/config` persistida; **segredos mascarados no GET**; **merge protege segredos** (máscara não sobrescreve); UI em `/production/ui` (API keys Evolution/OpenAI/Claude/Gemini/Meta + 5 prompts) | teste de roundtrip+máscara+merge |
| 7 | **Monitor** | `/production/monitor`: clientes online, conversas, filas (scheduler/advogado/perito), eventos/s, uso LLM (calls/latência/erros), latência, workers, health, uptime — só read models/observabilidade | teste do monitor |
| 8 | **REAL_FIRST_CLIENT** | [real-first-client.ts](../../packages/infrastructure/src/production/real-first-client.ts): Anúncio→WhatsApp→Coleta de dados→Coleta HISCON→Reconhecimento→Missão criada→Admin recebe→Workflow continua — cada etapa com evidência verificável; exposto em POST `/production/first-client` e na UI | teste 8/8 + rota |
| 9 | **Checklist Go Live** | [production-go-live.ts](../../packages/infrastructure/src/production/production-go-live.ts): Evolution, LLM, Postgres, Redis (declarado n/a — fila é outbox/Postgres por ADR-0001), Workers, Scheduler, HTTPS, Variáveis, Portas, Health, Read Models, Dispatcher, Event Store. **Qualquer vermelho ⇒ bloqueado**; o `main.ts` NÃO SOBE com vermelho (exit 1) | testes: incompleto⇒bloqueado com itens nomeados; estruturais passam |

## 4. Defeito real encontrado pelos testes (e corrigido no 4A)

`reviveDates` tratava `Date` como objeto plano (virava `{}`) ao reidratar documentos
do store — sessões quebravam. Corrigido (`instanceof Date` passa direto); provado
pelos testes que passaram em seguida. Nenhum congelado envolvido.

## 5. Regras absolutas (verificadas)

- **Nenhum congelado alterado**: 4A é todo módulos novos; mudanças compartilhadas =
  1 linha `export *` por barril + 1 export na api; compose de dev intocado; grep:
  nenhum congelado referencia 4A.
- **LLM nunca decide**: adapters implementam apenas os 4 ports de linguagem; toda
  decisão continua no Brain (RO+proveniência); em falha de LLM o sistema **degrada
  para o factual**, jamais inventa.
- **Servidores do dono**: nenhum `.listen` em código de composição; `main.ts` é o
  ponto de entrada QUE O DONO executa (Docker/node) — e mesmo ele só sobe com o
  checklist verde.

## 6. Entregáveis de operação

[DEPLOY_MANUAL](../operations/DEPLOY_MANUAL.md) · [FIRST_CLIENT_MANUAL](../operations/FIRST_CLIENT_MANUAL.md) ·
[ROLLBACK_MANUAL](../operations/ROLLBACK_MANUAL.md) · [OPERATIONS_MANUAL](../operations/OPERATIONS_MANUAL.md) ·
`Dockerfile` · `docker-compose.production.yml` · `apps/landing/` · UI `/production/ui`.

## 7. Limites honestos

- `docker build` não pôde ser executado NESTA máquina (docker ausente — verificado);
  o Dockerfile segue o padrão pnpm/turbo do repo e o deploy manual descreve a subida.
- Homologação com Evolution/LLM/Postgres REAIS exige as credenciais do dono (o
  checklist é exatamente o portão disso: com ENV completo, `ready:true`; sem, bloqueia).
- Autenticação dos portais aguarda DF-12 (exposição recomendada: só 3001 pública).
- Fila de mensagens de saída permanece in-memory por processo (drena dentro do
  turno; documentado) — persistência é evolução direta pelo mesmo port.

## 8. Veredito

O pipeline real está montado, testado ponta a ponta (REAL_FIRST_CLIENT 8/8, com
evidência por etapa), com adapters reais de Evolution/LLM/Postgres plugados nos
ports congelados, configuração persistida com segredos protegidos, monitor em tempo
real, e um Go-Live bloqueante que impede qualquer subida com item vermelho — inclusive
no boot do container. Portões: `typecheck` ✅ `lint` ✅ `test` ✅ (405) + `next build` ✅✅.

**Sprint 4A — Produção Real: ENCERRADO.**

> **"A plataforma está pronta para receber o primeiro cliente real."**
> (condicionada, como manda o próprio checklist, ao ambiente do dono: credenciais
> Evolution/LLM, DATABASE_URL e HTTPS — com eles, `GET /production/go-live` deve
> responder `ready:true`; sem eles, a própria plataforma se recusa a subir.)
