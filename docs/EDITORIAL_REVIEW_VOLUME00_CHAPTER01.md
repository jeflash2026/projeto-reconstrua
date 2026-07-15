# EDITORIAL REVIEW — VOLUME 00, CAPÍTULO 01

**Escopo desta revisão:** Preâmbulo, Capítulo 1 (A Identidade do Projeto Reconstrua) e Capítulo 2 (As Leis Fundamentais), conforme entregues pelo fundador em 2026-07-13.

**Documento revisado:** `constitution/00-CONSTITUICAO-OPERACIONAL.md`

---

## 1. Revisão de estrutura editorial

O texto foi transcrito integralmente para o documento oficial, sem remoção, resumo ou simplificação de nenhum conteúdo. A estrutura foi organizada em padrão editorial de publicação:

- Separadores ASCII (`====`, `----`) substituídos por hierarquia de títulos Markdown (capítulos como `##`, artigos e leis como `###`).
- Adicionado cabeçalho de identificação do volume ("Livro Mestre — Volume 00") e a declaração de fonte única de verdade.
- Listas padronizadas em marcador único (`-`), incluindo a lista do Artigo 6º que usava `•`.
- Itens da lista do Artigo 5º padronizados em caixa baixa com ponto e vírgula, seguindo o padrão da própria lista original (que já usava ponto e vírgula).

## 2. Alterações de escrita aplicadas (sem alteração de significado)

Apenas duas microedições gramaticais foram aplicadas. Todas as demais frases estão verbatim.

| Local | Original | Editado | Justificativa |
|---|---|---|---|
| Preâmbulo, §6 | "independentemente da evolução tecnológica, mudanças arquiteturais ou substituição completa da plataforma" | "independentemente da evolução tecnológica, de mudanças arquiteturais ou da substituição completa da plataforma" | Paralelismo de regência com "da evolução". Significado idêntico. |
| Artigo 5º, lista | Itens iniciando em maiúscula ("Software jurídico convencional") | Itens em caixa baixa ("software jurídico convencional") | Uniformização tipográfica da lista. Significado idêntico. |

Se o fundador preferir o texto 100% verbatim, ambas as edições são reversíveis com uma palavra de comando.

## 3. Coerência entre capítulos

- **Preâmbulo ↔ Artigo 1º:** coerentes na definição pela missão; ver Ambiguidade A1 sobre a extensão do escopo.
- **Preâmbulo ("prevalecerá esta Constituição") ↔ Lei 5:** plenamente coerentes; a Lei 5 é a forma normativa do princípio enunciado no Preâmbulo. Não há conflito — há reforço intencional.
- **Artigo 2º ("fluxo operacional verificável") ↔ Lei 3 ("rastreável") ↔ Lei 4 ("auditável"):** coerentes entre si; os três termos apontam na mesma direção, mas não são definidos formalmente (ver Ambiguidade A5).
- **Artigo 5º ↔ Artigo 1º:** coerentes — o que o Projeto não é (ferramentas isoladas) complementa o que ele é (Sistema Operacional completo).

## 4. Ambiguidades detectadas

**A1 — Escopo: relação contratual vs. direitos recuperáveis em geral.**
O Preâmbulo fundamenta o Projeto nas consequências de "uma relação contratual injusta, abusiva ou financeiramente destrutiva". O Artigo 1º define o alcance como "direitos potencialmente recuperáveis perante instituições financeiras, empresas ou outros agentes econômicos" — formulação mais ampla, que pode abranger direitos de origem não contratual (ex.: danos extracontratuais). Não é contradição, mas é ambiguidade de escopo. → **DECISÃO DO FUNDADOR (DF-01)**

**A2 — Lei 1: "Toda plataforma".**
"Toda plataforma deverá possuir uma única fonte oficial de estado operacional." A expressão "toda plataforma" admite duas leituras: (a) qualquer plataforma que o Projeto venha a construir, cada uma com sua fonte única; (b) forma genérica de referir-se à plataforma do Projeto. Se existirem múltiplas plataformas no futuro, a leitura (a) permitiria múltiplas fontes de verdade — uma por plataforma —, o que pode ou não ser a intenção. → **DECISÃO DO FUNDADOR (DF-02)**

**A3 — Lei 1: alcance da proibição de "recalcular estados".**
"Nenhum dashboard poderá recalcular estados de forma independente." Não está definido se a proibição alcança apenas o **estado operacional** (etapa/estágio) ou também **métricas e agregações derivadas** (contagens, percentuais, indicadores) exibidas em dashboards. → **DECISÃO DO FUNDADOR (DF-03)**

**A4 — Lei 2: granularidade da etapa operacional (pessoa vs. caso).**
"Toda pessoa ocupa exatamente uma etapa operacional." O Artigo 2º, porém, fala em conduzir "cada caso" através de um fluxo operacional. Se uma mesma pessoa puder ter dois casos simultâneos, a Lei 2 admite duas leituras incompatíveis entre si: (a) a etapa é da **pessoa** (uma pessoa nunca tem dois estágios, ainda que tenha dois casos); (b) a etapa é do **caso** (cada caso tem exatamente uma etapa, e uma pessoa pode ter várias). Esta é a ambiguidade de maior impacto futuro do capítulo. → **DECISÃO DO FUNDADOR (DF-04)**

**A5 — Lei 3: critério de "relevante".**
"Toda decisão relevante produz um evento. Todo evento relevante atualiza a operação." O qualificador "relevante" não possui critério definidor: quem decide o que é relevante e onde esse critério ficará registrado? Sem isso, a regra não é verificável objetivamente. → **DECISÃO DO FUNDADOR (DF-05)**

**A6 — Artigo 6º: vocabulário oficial das entidades de pessoa.**
O artigo antecipa "entidades técnicas como cliente, lead ou beneficiário" sem defini-las nem delimitar a lista ("como" sugere enumeração aberta). Presume-se que um capítulo futuro trará o glossário oficial. Registrado aqui apenas para não se perder. → **DECISÃO DO FUNDADOR (DF-06)**

## 5. Conflitos detectados

Nenhum conflito direto entre Preâmbulo, Capítulo 1 e Capítulo 2. A tensão A1 (escopo) e a tensão A4 (pessoa vs. caso) são ambiguidades a resolver, não regras em choque frontal.

## 6. Regras contraditórias

Nenhuma contradição interna detectada nas cinco Leis Fundamentais nem entre os seis Artigos.

## 7. DECISÃO DO FUNDADOR — registro consolidado

| # | Decisão pendente | Origem |
|---|---|---|
| DF-01 | O escopo oficial do Projeto limita-se a relações **contratuais** ou abrange qualquer **direito recuperável** perante agentes econômicos? | Preâmbulo × Artigo 1º |
| DF-02 | "Toda plataforma" (Lei 1) refere-se à plataforma única do Projeto ou admite múltiplas plataformas, cada qual com sua fonte de estado? | Lei 1 |
| DF-03 | A proibição de recálculo independente (Lei 1) alcança apenas o estado operacional ou também métricas/agregações derivadas em dashboards? | Lei 1 |
| DF-04 | A etapa operacional única (Lei 2) pertence à **pessoa** ou ao **caso**? Uma pessoa pode ter múltiplos casos simultâneos? | Lei 2 × Artigo 2º |
| DF-05 | Qual é o critério oficial de "decisão relevante" e "evento relevante" (Lei 3), e onde esse critério será registrado? | Lei 3 |
| DF-06 | Qual será o glossário oficial e fechado das entidades de pessoa (cliente, lead, beneficiário, outras)? | Artigo 6º |

Nenhuma dessas decisões foi assumida nesta edição. O texto oficial permanece exatamente como entregue.

## 8. Situação do índice

`constitution/INDEX.md` criado e atualizado: Volume 00 registrado com Preâmbulo + Capítulos 1 e 2, status "Em edição — aguardando decisões do fundador".

---

*Trabalho editorial, não arquitetural. Nenhuma arquitetura, banco, UX ou código foi produzido nesta revisão.*
