# ADR-0001 — Arquitetura Oficial do Projeto Reconstrua

**Status:** Aceito · **Data:** 2026-07-13 · **Escopo:** Sprint 0 (Fundação Técnica)
**Natureza:** documento de engenharia (fora do Canon). Não cria regra do Livro Mestre; deriva dele.

## Contexto

O Livro Mestre (Canon) está CONGELADO e é a única fonte de verdade normativa. Ele é **agnóstico de tecnologia** (Preâmbulo do Volume 00) e exige que **a modelagem da empresa prevaleça sobre a modelagem do software** (Lei Geral da Arquitetura). Esta ADR fixa as decisões técnicas que **realizam** os invariantes do Canon sem contrariá-lo (Lei 5).

Independência fundacional: nada do AHRIOS é reutilizado (artefatos intelectuais/arquiteturais). Tecnologias de mercado são livres.

## Decisões (ratificadas pelo fundador)

| # | Decisão | Norma do Canon que a exige/justifica |
|---|---|---|
| 1 | **Node.js 22 LTS + TypeScript** (strict) | Invariantes "impossíveis de violar" → tipos fortes; tecnologia autorizada |
| 2 | **Backend: Fastify puro** (sem NestJS) | Leveza; composição explícita; sem framework opinativo sobre o domínio |
| 3 | **PostgreSQL 16 + Event Store append-only** | Lei 1/DF-02/DF-08 (fonte única); Lei 3/DF-11 (nada se apaga) |
| 4 | **Arquitetura Hexagonal + DDD**; domínio sem dependência de tecnologia; adaptadores substituíveis | Lei Geral da Arquitetura; Preâmbulo Volume 00 |
| 5 | **Monorepo: pnpm workspaces + Turborepo** | Isolamento de camadas; builds incrementais |
| 6 | **Frontend: Next.js**, três portais (Cliente, Operação, Administração) | DF-08 (interfaces só consomem a Verdade) |
| 7 | **Validação: Zod** | Invariantes válidas em compilação e runtime |
| 8 | **ORM: Drizzle** (migrations forward-only) | Append-only; nada é sobrescrito (Lei 3) |
| 9 | **Testes: Vitest**; um teste por invariante; gate de conformidade | R9/G9 (auditabilidade); decisão do fundador (item 9) |
| 10 | **Observabilidade** (logs/tracing/métricas) **separada** da Auditoria Constitucional | DF-03 (métricas derivam, não substituem); Lei 4 |
| 11 | **IA sem regras**: executa apenas regras do Canon; tudo rastreável | Art. 15º; DF-09; DF-13; E9; E10 |
| 12 | **Nenhuma interface lê o Event Store**; só Read Models | DF-08; decisão do fundador (item 12) |

## Consequências arquiteturais

### Event Sourcing como materialização da Epistemologia
A Cadeia do Conhecimento (E3) e a regra "só Evento Relevante altera estado" (DF-05/DF-14, E12) mapeiam-se num **event store append-only**; a **Verdade Operacional é uma projeção** recomputável (DF-08), nunca fonte independente. Correções = novos eventos (E8-L04). `UPDATE`/`DELETE` são bloqueados no banco por trigger (Lei 3/DF-11).

### CQRS por decisão constitucional
A separação escrita (Event Store) / leitura (Read Models) não é preferência técnica — é o item 12 e a DF-08. Reforçada por **roles de banco distintas**: a role de leitura não enxerga o schema `event_store`.

### Fronteira da IA como barreira de código
As vedações da AHRI (DF-09) e sua natureza assistiva (Art. 15º) serão **estruturais**: toda ação automatizada exige `regra_operacional_ref` e registra `DECISOR/TIPO/FUNDAMENTO`; decisão jurídica definitiva é impossível de automatizar por construção.

### Camadas (dependências apontam para dentro)
`apps` → `application` → `domain`; `infrastructure` implementa ports de `application`. O `domain` não importa nada de tecnologia.

## Decisões reservadas (não inventadas — pertencem ao Canon/fundador)
- Broker de fila na escala (início: outbox + Postgres LISTEN/NOTIFY).
- Provedor de hospedagem/deploy (é do dono).
- Critérios de autorização/visibilidade (DF-12, Governança) e mecanismo de retenção/LGPD (DF-40).
- Catálogo de eventos por domínio e limiares de suficiência (configuração operacional).

## Alternativas consideradas e rejeitadas
- **NestJS:** rejeitado pelo fundador (peso/opinião sobre o domínio).
- **ORM com update/delete livre (Prisma/TypeORM padrão):** rejeitado — conflita com append-only.
- **Estado mutável (CRUD clássico):** rejeitado — viola DF-05/DF-08/Lei 3 frontalmente.
