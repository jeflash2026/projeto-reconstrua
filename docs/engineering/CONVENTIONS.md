# Convenções Oficiais do Projeto Reconstrua (Engenharia)

Documento de engenharia (fora do Canon). Complementa, nunca contraria, o Livro Mestre (Lei 5).

## 1. Regra de ouro
Nenhuma linha de código sem origem no Canon. Todo PR que implemente comportamento **cita o capítulo/entidade** do Livro Mestre que o origina (G1). A IA não contém regras; executa regras do Canon (item 11).

## 2. Camadas e dependências (Hexagonal/DDD)
- `packages/domain` — entidades e invariantes (Volume 01). **Não importa** `application`, `infrastructure`, `contracts`, nem nenhuma biblioteca de I/O.
- `packages/application` — casos de uso (R1–R9) e **ports**. Importa só `domain` e `contracts`.
- `packages/infrastructure` — adaptadores. Implementa ports; importa `application`/`domain`.
- `apps/*` — composição e interfaces. `apps/api` é o único que **escreve** no Event Store.
- Direção das dependências: sempre **para dentro** (apps → application → domain). Violações são barradas em revisão e, quando possível, por lint.

## 3. Event Store (append-only)
- Somente `INSERT`. `UPDATE`/`DELETE` são proibidos (trigger no banco; Lei 3/DF-11).
- Correções nascem como **novos eventos** (E8-L04). Nunca reescrever histórico.
- Todo Evento Relevante carrega `fact_ref` (E12-L09). Toda ação automatizada carrega `actor`/`decision_type`/`fundamento`/`operational_rule_ref` (DF-09/DF-13).

## 4. Leitura (CQRS constitucional)
- Interfaces consultam **apenas Read Models** (item 12; DF-08). Proibido consultar o `event_store` a partir de qualquer app/portal.
- Read Models são projeções recomputáveis; nunca fonte de verdade.

## 5. Testes e conformidade
- **Uma invariante do Canon = um teste.** Nome do teste referencia o identificador da invariante (ex.: `INV-02`, `INV-D09`).
- Suíte `conformance` espelha os "Critérios de Auditoria" (R9/G9).
- **Nenhum merge** com teste de conformidade falhando (item 9). CI é o portão.

## 6. Git e versionamento
- Trunk-based; PRs obrigatórios; branch protection em `main`.
- Conventional Commits. SemVer nos packages.
- Mudança de regra normativa pressupõe mudança no Canon via **Volume 04 (Governança)** — o código não inova regra (G3/G4/G5).

## 7. Estilo
- Prettier + ESLint (typescript-eslint, type-checked). `no-console` no código de produção (logs via logger estruturado).
- **Nunca** rodar Prettier/ESLint sobre `constitution/` e `docs/` (Canon congelado — Regra da Imutabilidade Editorial/DF-21). Já ignorados no `.prettierignore`.

## 8. Ambiente e execução
- Node 22 (`.nvmrc`), pnpm (`engine-strict`).
- `pnpm db:up` sobe apenas o Postgres local. **Não se iniciam dev servers**; ambientes e deploy são do dono.
- CI faz `lint · typecheck · test · build`; **não faz deploy**.

## 9. Nomenclatura de domínio
- Termos de código seguem o **Glossário Oficial** (Volume 01): Missão, Pessoa, Documento, Evento, Verdade Operacional, etc. Proibido introduzir termo fora do Glossário (DF-06).

## 10. Regra Oficial de Implementação de Entidades (Padrão MISSÃO)
Instituída pelo fundador em 2026-07-13. Toda entidade do domínio é implementada **individualmente** (nunca em lote), auditada e só então liberada. Cada entidade deve conter **exclusivamente** o que o Canon determina para ela.

Obrigatório por entidade:
1. **Identity própria** (deriva de `Identity<Uuid>` do Kernel).
2. **Aggregate Root apenas quando previsto pelo Canon** (do contrário, `BaseEntity`/`ValueObject`).
3. **Value Objects mínimos** (só os estritamente exigidos pelo Canon).
4. **Eventos de domínio apenas como contratos** (sem dispatcher, store ou payload de negócio).
5. **Manifesto de Invariantes** (todas as INV da entidade, com referência normativa).
6. **Testes unitários.**
7. **Testes das invariantes.**
8. **Tabela de derivação linha a linha** para o Livro Mestre (construto → norma).
9. **Mapa de enforcement**, indicando para cada invariante se é garantida por: a entidade · Event Store · projeções · Casos de Uso · outra entidade.

Proibições:
- **Proibido antecipar comportamento de outra camada.**
- **Proibido implementar algo "porque será necessário depois".**
- Estado que o Canon manda derivar da Verdade Operacional **não** é atributo mutável da entidade (ex.: MISSÃO não tem estado próprio — INV-02/INV-08/INV-09).

Após cada entidade, executar a **mesma auditoria da MISSÃO** e responder: (a) decisão fora do Canon? (b) regra inventada? (c) comportamento implícito? (d) dependência de infraestrutura? (e) aderência integral ao Livro Mestre? Só então aguardar autorização para a próxima.

Referência viva do padrão: `packages/domain/src/mission/`.
