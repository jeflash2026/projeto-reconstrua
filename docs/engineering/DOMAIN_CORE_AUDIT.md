# DOMAIN CORE — AUDITORIA CRUZADA DAS ENTIDADES 01–06

**Checkpoint obrigatório antes da Entidade 07** · Sprint 1F+ · Data: 2026-07-13
**Escopo:** MISSÃO (01), PESSOA (02), DOCUMENTO (03), EVENTO (04), CASO (05), PROCESSO (06).
**Método:** auditoria estrutural completa (varredura de imports, barrels, agregados, invariantes, eventos, referências) + confronto com o Livro Mestre congelado. Execução de `pnpm typecheck/test/lint` **não foi possível** — ver seção 9.
**Fonte da verdade:** `constitution/` (Livro Mestre congelado). Código auditado: `packages/domain/src/`.

---

## 1. Matriz completa de dependências (importador → importado)

`✔` = importa; `—` = não importa. Colunas = alvo do import.

| Importador ↓ \ Alvo → | kernel | mission | person | document | event | case | process |
|---|---|---|---|---|---|---|---|
| **kernel** | (interno) | — | — | — | — | — | — |
| **mission (01)** | ✔ | — (próprio) | — | — | — | — | — |
| **person (02)** | ✔ | — | — (próprio) | — | — | — | — |
| **document (03)** | ✔ | — | — | — (próprio) | — | — | — |
| **event (04)** | ✔ | — | — | — | — (próprio) | — | — |
| **case (05)** | ✔ | — | — | — | — | — (próprio) | — |
| **process (06)** | ✔ | — | — | — | — | — | — (próprio) |
| **index (barrel)** | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

**Leitura:** nenhuma entidade importa qualquer outra. Todas dependem **exclusivamente** do `kernel`. O único ponto que agrega as seis é o `index.ts` do pacote (barrel de composição), que não introduz lógica — apenas reexporta.

Evidência (varredura): `grep "from '../<entidade>/'"` em toda a árvore do domínio → **0 ocorrências**. Todos os imports de cada pasta de entidade apontam para `../kernel/...` ou irmãos `./...`; `vitest` aparece apenas em `*.test.ts`.

---

## 2. Grafo de dependências

```
                         ┌─────────────┐
                         │   kernel    │  (sink puro: não importa nenhuma entidade)
                         └──────▲──────┘
                                │  (todas as arestas apontam para cá)
   ┌──────────┬──────────┬──────┴─────┬──────────┬──────────┐
   │          │          │            │          │          │
mission     person    document      event      case      process
 (01)        (02)       (03)         (04)       (05)       (06)
   │          │          │            │          │          │
   └──────────┴──────────┴─────┬──────┴──────────┴──────────┘
                               │  (reexport, sem lógica)
                        ┌──────┴──────┐
                        │  index.ts   │  (barrel de composição)
                        └─────────────┘
```

- **Profundidade máxima:** 1 (entidade → kernel).
- **Arestas entre entidades:** 0.
- **Ciclos:** impossíveis por construção — o grafo é uma árvore com raiz no `kernel`, e o `kernel` não tem aresta de saída para entidades.
- As **referências cruzadas do Canon** (Documento→Missão, Evento→Missão/Fato, Caso→Missão, Processo→Missão/Caso) existem **apenas como ponteiros de identidade (`Uuid`)** dentro de cada entidade, sem import do módulo alvo. Acoplamento em tempo de compilação = nulo.

---

## 3. Acoplamentos encontrados

| # | Natureza | Avaliação |
|---|---|---|
| A1 | Toda entidade → `kernel` (primitivas: `Identity`, `Uuid`, `ValueObject`, `AggregateRoot`, `Result`, `CanonViolationError`, `Invariant`, `BaseDomainEvent`) | **Correto e desejado.** Acoplamento a um núcleo estável e livre de tecnologia (Lei Geral da Arquitetura). Não é acoplamento entre entidades. |
| A2 | Referências nominais por `Uuid` (ex.: `ProcessCaseRef`, `CaseMissionRef`, `EventMissionRef`, `Document 'MissionRef'`) | **Correto.** São Value Objects locais que carregam apenas um `Uuid`. Não importam a entidade referida; não acessam seu comportamento. Acoplamento estrutural = 0 (DF-18 menções nominais). |
| A3 | `EnforcementLocus` (união de literais) **redefinido** em cada arquivo `*-invariants.ts` (6 cópias) | **Duplicação benigna, não acoplamento.** Cada cópia é independente; nenhuma entidade importa a `EnforcementLocus` de outra. Ver Recomendação R1. |

**Acoplamento indevido entre entidades: NENHUM.**

---

## 4. Violações encontradas

Verificação item a item do checkpoint:

| # | Verificação | Resultado |
|---|---|---|
| 1 | Dependências circulares | **Nenhuma.** Grafo é árvore com raiz no kernel; kernel não importa entidades. |
| 2 | Acoplamento indevido entre entidades | **Nenhum.** 0 imports cruzados; referências só por `Uuid`. |
| 3 | Violação de Aggregate Roots | **Nenhuma.** Todos os agregados (`Mission`, `Person`, `DocumentAggregate`, `EventAggregate`, `CaseAggregate`, `ProcessAggregate`) têm construtor **privado** + fábrica estática retornando `Result`; nenhuma entidade acessa o interior de outra; refs por identidade preservam a fronteira do agregado. |
| 4 | Value Objects compartilhados incorretamente | **Nenhum.** Cada entidade possui os próprios VOs; nenhum importa VO de outra. `LegalFoundation` (Caso) e `ProcessLegalFoundation` (Processo) são deliberadamente separados para não acoplar. Só o kernel é compartilhado (correto). |
| 5 | Imports proibidos (tecnologia/infra) | **Nenhum.** 0 imports de Fastify/PostgreSQL/Drizzle/Next/Zod/IA/`node:*`. Só `../kernel/...`, irmãos `./...` e `vitest` (testes). |
| 6 | Responsabilidades deslocadas entre entidades | **Nenhuma.** Cada entidade contém só o seu conceito ontológico; nenhuma executa comportamento de outra (verificado nos testes estruturais de ausência). |
| 7 | Invariantes no locus errado | **Nenhuma.** Invariantes de runtime só onde há predicado sobre a instância; demais mapeadas a `event-store`/`projection`/`use-case`/`cross-entity` (ex.: INV-EV-02 projection; INV-PR-03 cross-entity; históricos em event-store). |
| 8 | Eventos de domínio na entidade errada | **Nenhum.** Cada evento pertence e é emitido exclusivamente pelo seu agregado (MissionCreated←Mission; PersonRecognized←Person; DocumentRecognized←DocumentAggregate; EventRecognized←EventAggregate; CaseRecognized←CaseAggregate; ProcessRecognized←ProcessAggregate). |
| 9 | Referências cruzadas incompatíveis com o Livro Mestre | **Nenhuma.** Ver seção 5. |
| 10 | Coerência entre as seis entidades | **Coerente.** Ver seção 5. |

**Total de violações: 0.**

---

## 5. Coerência com o Livro Mestre (referências cruzadas)

Cada entidade referencia **exatamente** o que o seu item 22 (Referências Ontológicas) e as invariantes autorizam:

| Entidade | Refs modeladas (por identidade) | Confronto com o Canon |
|---|---|---|
| MISSÃO (01) | `BeneficiaryPersonRef` (Pessoa), `InitialOperationalResponsibleRef` | Missão nasce com pessoa beneficiária + responsável operacional. **Não** referencia Caso/Processo (menções nominais DF-18). ✔ |
| PESSOA (02) | `RecognitionResponsibleRef`, `EvidenceRef` | Pessoa **não** referencia Missão — coerente com "pode ter 0 missões" (cardinalidade 0..n; CA-01). ✔ |
| DOCUMENTO (03) | `MissionRef` (incorporação a ≥1), `DocumentRecognitionResponsibleRef` | Documento incorporado a ≥1 Missão (INV-D08). ✔ |
| EVENTO (04) | `EventMissionRef` (exatamente 1), `FactRef`, `EventRecognitionResponsibleRef` | Evento vinculado a exatamente uma Missão (INV-EV-04); Relevante fundado em Fato (INV-EV-03). ✔ |
| CASO (05) | `CaseMissionRef` (exatamente 1), `CaseResponsibleRef` | Caso pertence a exatamente uma Missão (INV-CA-01). **Não** referencia Processo (é o Processo que decorre do Caso). ✔ |
| PROCESSO (06) | `ProcessMissionRef` (exatamente 1), `ProcessCaseRef` (opcional), `ProcessResponsibleRef` | Item 22 autoriza MISSÃO(01) + CASO(05) + ADVOGADO(17, nominal). Processo pertence a uma Missão (INV-PR-01) e decorre de Caso (opcional). ✔ |

**Direção das dependências conceituais** — coerente com a Modelagem Conceitual congelada: `Missão → contém → Caso → enseja → Processo`; `Documento/Evento → pertencem à Missão`. Nenhuma referência aponta na direção proibida (ex.: Missão não conhece Caso/Processo pelo código; Caso não conhece Processo). ✔

---

## 6. Recomendações (todas NÃO bloqueantes do congelamento)

- **R1 — Consolidar `EnforcementLocus` no kernel.** A união de literais está duplicada nos 6 arquivos `*-invariants.ts`, e apenas MISSÃO a reexporta no índice do domínio (assimetria histórica). Promover o tipo para `kernel` (ex.: `kernel/invariant.ts`) e importá-lo removeria a duplicação e a assimetria. Como toca as 6 entidades congeladas, fica para um **sprint de consolidação dedicado**, sob autorização — não deve ser feito silenciosamente neste checkpoint.
- **R2 — Padronizar o nome da ref de Missão do DOCUMENTO.** DOCUMENTO usa `MissionRef` (genérico), enquanto EVENTO/CASO/PROCESSO usam `EventMissionRef`/`CaseMissionRef`/`ProcessMissionRef`. Não há colisão (só DOCUMENTO exporta `MissionRef`), mas renomear para `DocumentMissionRef` uniformizaria o padrão. Cosmético; adiar para o mesmo sprint de consolidação.
- **R3 — Executar o toolchain assim que o ambiente do dono permitir.** `pnpm install` + `pnpm typecheck && pnpm test && pnpm lint` para validação dinâmica (ver seção 9). A auditoria estrutural não substitui a verificação de tipos/execução dos testes.

Nenhuma recomendação aponta defeito de fidelidade ou de arquitetura; todas são de higiene/uniformização.

---

## 7. Pontos aprovados

- ✅ **Zero dependências circulares** (impossíveis por construção).
- ✅ **Zero imports entre entidades** — isolamento total; núcleo hexagonal preservado.
- ✅ **Zero imports de tecnologia/infra** — domínio soberano (Lei Geral da Arquitetura; V00).
- ✅ **Fronteiras de agregado íntegras** — construtores privados + fábricas `Result`; refs só por identidade.
- ✅ **Eventos e invariantes no locus correto** — cada um na sua entidade; loci não-entidade explicitamente mapeados.
- ✅ **Referências cruzadas 100% coerentes** com os itens 22 e as invariantes do Livro Mestre.
- ✅ **Barrel do domínio sem colisões** de símbolos (Ids, agregados, eventos, refs, manifestos, specs — todos únicos; `EnforcementLocus` reexportado só por MISSÃO).
- ✅ **Padrão oficial (CONVENTIONS.md §10) uniforme** nas seis entidades, com auditoria persistida por entidade.

---

## 8. Respostas obrigatórias

- **Existe alguma dependência circular?** **NÃO.**
- **Existe alguma violação do Livro Mestre?** **NÃO.**
- **Existe alguma entidade assumindo responsabilidade de outra?** **NÃO.**
- **Existe alguma dependência tecnológica?** **NÃO.**
- **O núcleo do domínio pode ser considerado congelado?** **SIM** — do ponto de vista **estrutural e de fidelidade ao Canon**, o núcleo 01–06 está apto ao congelamento. **Ressalva honesta:** o congelamento definitivo deveria ser confirmado após a validação dinâmica (`typecheck`/`test`/`lint`), que não pôde ser executada neste ambiente (seção 9). Nenhuma resposta impede o congelamento; a única pendência é operacional (execução do toolchain), não estrutural.

Nenhuma resposta impediu o congelamento — a auditoria **não foi interrompida**.

---

## 9. Execução do toolchain (por que não foi possível)

Tentativa registrada (Git Bash, com Node no PATH):

```
node -v   → v24.18.0        (disponível)
pnpm -v   → command not found (pnpm NÃO instalado)
C:\Projeto Reconstrua\node_modules              → não existe
C:\Projeto Reconstrua\packages\domain\node_modules → não existe
node_modules/.bin/{vitest,tsc,eslint}           → ausentes
```

**Motivo:** as dependências do monorepo nunca foram instaladas neste ambiente e o `pnpm` não está presente. Rodar `typecheck/test/lint` exigiria `corepack enable` + `pnpm install`, ou seja, **provisionamento com acesso de rede** para baixar toda a árvore de dependências — operação de infraestrutura sob controle do dono, fora do escopo "apenas código + lint/build" e possivelmente indisponível (rede). Não executei instalação de rede por decisão de segurança/escopo.

**Compensação:** auditoria **estrutural** completa (seções 1–8) via varredura de imports, barrels, agregados, invariantes, eventos e confronto linha-a-Canon. Ela cobre dependências circulares, acoplamento, fronteiras de agregado, imports proibidos, locus de invariantes e coerência — **mas não** valida tipos (`tsc`) nem executa os testes (`vitest`). Recomendação R3: o dono deve rodar o toolchain para a confirmação dinâmica antes de declarar o núcleo definitivamente congelado.

---

## 10. Veredito

**Núcleo do domínio (Entidades 01–06): estruturalmente íntegro, sem ciclos, sem acoplamento entre entidades, sem dependência tecnológica e integralmente coerente com o Livro Mestre congelado.** Apto ao congelamento no plano estrutural; pendente apenas a validação dinâmica do toolchain (operacional, do dono). **Não prosseguir à Entidade 07 sem autorização explícita.**
