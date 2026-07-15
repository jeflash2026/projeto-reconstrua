# ROLE ARCHITECTURE AUDIT — Bloco de Papéis (Entidades 14–19)

**Escopo:** AHRI (14), OPERADOR (15), PERITO (16), ADVOGADO (17), SUPERVISOR (18), CLIENTE (19).
**Objetivo:** determinar formalmente as fronteiras entre os papéis, antes de implementar qualquer um.
**Data:** 2026-07-14 · **Método:** confronto ontológico (itens 1–24 de cada entidade) + fundamentos (DF-09, DF-10, DF-12, DF-23; Art. 5º/6º/8º/10º/12º/15º; R7, R8; E9, E10; Lei Geral das RO; Lei 4).
**NENHUMA entidade foi implementada.** Auditoria documental apenas.

---

## 1. Naturezas ontológicas (essência de cada papel)

| # | Papel | Natureza | Competência EXCLUSIVA | É humano? |
|---|---|---|---|---|
| 14 | **AHRI** | inteligência operacional cognitiva **assistiva** | executar comportamento **aprovado** (Regras Operacionais); monitorar/organizar/propor/acionar (DF-09) | **Não** (Sistema) |
| 15 | **OPERADOR** | papel humano de **condução operacional diária** | conduzir a operação cotidiana (DF-10; R7) | Sim |
| 16 | **PERITO** | papel humano titular da **prova pericial** | **atos privativos de perícia** (DF-09/DF-10) | Sim |
| 17 | **ADVOGADO** | papel humano titular da **decisão jurídica** | **decisão jurídica definitiva + atos privativos de advocacia** (DF-09/DF-10) | Sim |
| 18 | **SUPERVISOR** | papel humano de **supervisão de conformidade** | zelar pela conformidade da atuação (R7) | Sim |
| 19 | **CLIENTE** | **condição** contratual de uma Pessoa | nomear a relação de serviço (Art. 5º/6º) | — (condição de uma Pessoa) |

**Observação estrutural decisiva:** CLIENTE **não é um papel de atuação** — é uma **condição/qualificação** de uma PESSOA (02). E AHRI **não é humana**. A matriz do fundador agrupa os seis por posição ontológica (14–19), mas ontologicamente há três tipos: **IA assistiva** (14), **papéis humanos de atuação** (15–18) e **condição de Pessoa** (19).

---

## 2. Matriz de fronteiras e dependências

```
                          MISSÃO (01)
                             │  (contém a operação; titularidade é do Projeto — Art. 8º/DF-20)
                          OPERAÇÃO (11)
                             │  (o agir conduzido em função da missão — R7 rege a atuação dos responsáveis)
              ┌──────────────┴───────────────┐
              │                               │
          AHRI (14)                    PAPÉIS HUMANOS
      (IA assistiva; executa RO;      (titulares de competência humana)
       nunca decide/privativo)                │
                             ┌──────────┬──────────┬───────────┬──────────┐
                          OPERADOR    PERITO    ADVOGADO   SUPERVISOR   CLIENTE*
                            (15)       (16)       (17)        (18)        (19)
                          condução   prova      decisão    supervisão   *condição
                          diária     pericial   jurídica   conformidade  de PESSOA(02)
```

`*` CLIENTE não atua sobre a missão; é condição de uma PESSOA (02) que se relaciona a MISSÕES.

### Direção das dependências EXISTENCIAIS (do que cada um precisa para existir)

| Papel | Depende existencialmente de | Papel-irmão de que dependa? |
|---|---|---|
| AHRI (14) | REGRA OPERACIONAL (12) + comportamento cognitivo congelado (E9/E10) | **Nenhum** |
| OPERADOR (15) | autorização/Governança (DF-12) [+ serve MISSÃO 01] | **Nenhum** |
| PERITO (16) | autorização (DF-12) + fase PERÍCIA (13) [+ MISSÃO] | **Nenhum** (Perícia é etapa, não papel) |
| ADVOGADO (17) | autorização (DF-12) [+ atua em PROCESSO 06/CASO 05/MISSÃO] | **Nenhum** |
| SUPERVISOR (18) | autorização + critérios de supervisão (DF-12; R7) [+ MISSÃO] | **Nenhum** |
| CLIENTE (19) | PESSOA reconhecida (02; DF-23) | **Nenhum** (Pessoa não é papel) |

**Todas as arestas existenciais apontam para entidades NÃO-papel** (Missão, Pessoa, Regra Operacional, Perícia) ou para **autorização/Governança** — **nenhum papel depende de outro papel para existir**. Grafo existencial = **DAG, sem ciclo**.

### Referências de INTERAÇÃO (nominais, DF-18) — pertencem à OPERAÇÃO/R7, não à existência

| Papel | Referencia nominalmente (interação) |
|---|---|
| AHRI (14) | papéis humanos (15–18) — "aciona" |
| OPERADOR (15) | AHRI (14), ADVOGADO (17), PERITO (16) — "aciona a competência" |
| SUPERVISOR (18) | papéis 14–17 — "supervisiona" |

Estas são relações de **atuação** (quem aciona/supervisiona quem), **não** dependências existenciais. Produzem referências mútuas nominais (ex.: 14↔15, 14↔18), mas **não** ciclos de dependência — ver §4.

---

## 3. Respostas obrigatórias

**1. Existe alguma sobreposição conceitual?** **NÃO.** Seis essências distintas; a partição de atos privativos é nítida — **perícia** (só PERITO) × **advocacia** (só ADVOGADO); AHRI, OPERADOR e SUPERVISOR **não** praticam privativos; CLIENTE é condição, não atuação. A fronteira é traçada pela DF-09.

**2. Existe alguma responsabilidade duplicada?** **NÃO.** Condução diária→OPERADOR; prova técnica→PERITO; decisão jurídica→ADVOGADO; conformidade→SUPERVISOR; execução de comportamento aprovado→AHRI; condição de serviço→CLIENTE. Cada responsabilidade tem **um único** titular. *(Ponto mais delicado: AHRI "conduz operacionalmente" [DF-09] × OPERADOR "condução diária" — resolvido por complementaridade, não duplicação: a AHRI executa **comportamento aprovado (RO)** e é **assistiva** [Art. 15º], enquanto o OPERADOR faz **condução humana** e aciona competências; a linha é a DF-09.)*

**3. Existe algum papel que dependa de outro para existir?** **NÃO.** As dependências existenciais são sobre Missão/Pessoa/Regra Operacional/Perícia/autorização — todas **não-papel**. Nenhum papel precisa de um papel-irmão para existir.

**4. Existe alguma herança implícita?** **NÃO.** Seis entidades irmãs, cada uma com invariantes próprias; nenhuma é subtipo de outra. CLIENTE é **condição** de PESSOA (composição/qualificação — "não é a Pessoa"), **não** herança. PERITO **não** herda de PERÍCIA (item 4/INV-PT-02: distintos).

**5. Existe algum risco de acoplamento futuro?** **BAIXO e controlado.** Sob a disciplina já estabelecida (referências apenas por `Uuid` nominal; zero import entre entidades; responsáveis genéricos), implementar 14–19 produz **zero acoplamento de código**. Risco residual: as referências de **interação** (AHRI→papéis; OPERADOR→papéis; SUPERVISOR→papéis 14–17) — o maior fan-out é o SUPERVISOR (quatro). **Recomendação R1:** modelar essas relações de interação na **OPERAÇÃO (11)/R7**, não nas entidades de papel — eliminando até a referência nominal mútua (ver §5).

**6. Existe alguma dependência circular?** **NÃO.** Há referências **mútuas de interação** (14↔15, 14↔18), mas não são dependências: (a) são ponteiros `Uuid` nominais (DF-18) → **zero import** → ciclo de compilação impossível; (b) o grafo **existencial** é DAG (§2); (c) o Canon declara "Circular? NÃO" em cada item 24. A mutualidade é de **atuação** (OPERAÇÃO/R7), não de existência.

**7. Existe alguma responsabilidade que deveria pertencer à OPERAÇÃO e não ao papel?** **SIM — e o Canon já a aloca corretamente.** A **coordenação/sequenciamento** da atuação (quem aciona quem, quando) é da **OPERAÇÃO (11)/R7 ("Atuação dos Responsáveis")**, não do papel. O papel representa **quem** e sua competência/vedação; o **agir coordenado** é da OPERAÇÃO. **Diretriz de implementação:** manter as relações "aciona/supervisiona" na OPERAÇÃO/R7 (fora das entidades de papel).

**8. Existe alguma responsabilidade que deveria pertencer à MISSÃO e não ao papel?** **SIM — e o Canon já a aloca corretamente.** A **titularidade** não pertence a nenhum papel (todos: "nunca possuirá titularidade"); a missão pertence ao Projeto/à Pessoa beneficiária (Art. 8º; DF-20). O Canon mantém corretamente a titularidade fora dos papéis.

**9. Existe alguma responsabilidade que deveria pertencer à AHRI?** **SIM — e o Canon já a aloca corretamente.** A execução operacional-cognitiva de **comportamento aprovado** (monitorar/organizar/propor/acionar — DF-09/item 16) é da AHRI; **nenhum papel humano** deve deter "execução de automação aprovada". Reciprocamente, a AHRI **não** detém o que é humano (privativos, decisão jurídica). A DF-09 (seis vedações) traça a linha corretamente.

**10. Existe alguma decisão humana sendo atribuída incorretamente à IA?** **NÃO — e este é o salvaguarda central do Canon.** INV-AH-01 (assistiva, nunca decisão final), INV-AH-03 (jamais ato privativo/decisão jurídica), INV-AH-04 (jamais cria fatos/verdade); INV-AD-01/02 (decisão jurídica e advocacia só do advogado); INV-PT-01 (perícia só do perito); item 17 do ADVOGADO ("a AHRI jamais decide estratégia jurídica final nem assina"); DF-09 ("toda decisão jurídica definitiva pertence ao profissional humano competente"). **Zero atribuição indevida.**

---

## 4. Demonstração formal de aciclicidade

- **Grafo existencial** (o que cada papel precisa para existir): arestas apenas para {MISSÃO, PESSOA, REGRA OPERACIONAL, PERÍCIA, autorização/Governança}. Nenhuma aresta papel→papel. Como esses alvos não referenciam papéis de volta (Missão/Pessoa/RO/Perícia já implementadas ou anteriores não referenciam 14–19), o grafo é uma **árvore/DAG com folhas nos papéis** → **sem ciclo**.
- **Grafo de código** (imports): sob a disciplina do domínio (cada entidade importa só `../kernel`; referências a outras entidades por `Uuid`), **zero aresta de import entre papéis** → aciclicidade trivial.
- **Grafo de interação** (aciona/supervisiona): possui arestas mútuas, mas é um grafo de **dinâmica operacional** (OPERAÇÃO/R7), não de dependência; não afeta existência nem compilação.

**Conclusão: ausência de ciclos comprovada nos três planos (existência, código, e — por alocação à OPERAÇÃO — também na dinâmica).**

---

## 5. Recomendações de implementação (para os Sprints 14–19)

- **R1 — Relações de interação na OPERAÇÃO/R7, não nos papéis.** Modelar cada papel com suas dependências **existenciais** apenas (autorização/Missão; CLIENTE→PESSOA; PERITO→PERÍCIA); **omitir** as referências "aciona/supervisiona" (elas pertencem à OPERAÇÃO 11 / R7). Isso elimina a mutualidade nominal e mantém DAG estrito — mesmo padrão já aplicado (OPERAÇÃO omitiu a coleção de ações).
- **R2 — Referências nominais genéricas, sem antecipar.** Como os papéis referenciam-se, ao implementar um papel anterior que precise apontar um posterior (raro sob R1), usar `Uuid` nominal genérico; jamais importar o módulo do outro papel.
- **R3 — Sem herança.** CLIENTE modela **condição de PESSOA** por referência (`PersonRef`), não por herança; PERITO referencia a **fase PERÍCIA** por identidade, sem herdar da etapa.
- **R4 — Linha AHRI/humano é invariante de entidade.** INV-AH-01/03/04 e as vedações da DF-09 devem ser garantidas **estruturalmente** (ausência de métodos de decisão/privativos/criação de verdade na AHRI), tal como nas entidades já feitas.

---

## 6. Fronteiras de responsabilidade (síntese)

| Papel | FAZ | JAMAIS FAZ |
|---|---|---|
| AHRI (14) | executa RO aprovada; monitora/organiza/propõe/aciona; declara incerteza (E10) | decidir (final/jurídico), ato privativo, criar Realidade/Evidência/Verdade (DF-09; INV-AH-01..04) |
| OPERADOR (15) | condução operacional diária; aciona a competência certa | ato privativo, decisão jurídica, titularidade (INV-OPr-01..03) |
| PERITO (16) | produz prova técnica (privativo de perícia) | advocacia, titularidade; confundir-se com a PERÍCIA (INV-PT-01..03) |
| ADVOGADO (17) | decisão jurídica definitiva + advocacia (privativo) | titularidade; ser substituído pela AHRI (INV-AD-01..03) |
| SUPERVISOR (18) | supervisiona conformidade | ato privativo alheio, decisão jurídica, titularidade (INV-SU-01..03) |
| CLIENTE (19) | nomeia a relação de serviço de uma PESSOA | ser a Pessoa; alterar identidade civil; deter Estado/Verdade (INV-CL-01..03) |

---

## 7. Aderência ao Livro Mestre e veredito

Cada papel cobre exatamente as invariantes do seu item 15; a partição de competências (assistiva-IA | condução | perícia | advocacia | supervisão | condição-de-Pessoa) é **exaustiva e mutuamente exclusiva**; a linha decisão-humana × IA é traçada com rigor pela DF-09 e reforçada por INV-AH-01/03/04 + INV-AD-01/02 + INV-PT-01. Os itens 24 declaram, todos, "Circular? NÃO".

**NENHUM CONFLITO ENCONTRADO.** As dez perguntas foram respondidas: sem sobreposição, sem duplicação, sem dependência inter-papel existencial, sem herança, com acoplamento futuro controlado, sem ciclo, com OPERAÇÃO/MISSÃO/AHRI corretamente titulares de suas responsabilidades e **sem qualquer decisão humana atribuída à IA**.

**Veredito: ARQUITETURA DE PAPÉIS ÍNTEGRA — APTA À IMPLEMENTAÇÃO** (observadas as recomendações R1–R4). Não iniciar a Entidade 14 sem autorização explícita.
