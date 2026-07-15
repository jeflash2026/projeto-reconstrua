# CANON IMPLEMENTATION RISKS — CONSELHO CONSTITUCIONAL

**Data:** 2026-07-13
**Escopo:** riscos que um engenheiro da Fable enfrentará ao implementar o Canon — incluindo os lugares onde duas interpretações são possíveis (vetor 20 do mandato). Identificação apenas; nenhuma solução proposta.

---

## P1 — Riscos estruturais (exigem decisão do fundador antes da implementação correspondente)

### IR-01 (P1) — Retenção perpétua × direitos do titular de dados

O Canon determina permanência absoluta: nenhuma missão desaparece (DF-11), a Pessoa nunca é encerrada (INV-P13), vínculos jamais apagados (INV-P07), documentos perpétuos (INV-D11), verdades anteriores preservadas (INV-E8-03). O Projeto Reconstrua tratará dados pessoais sensíveis de pessoas reais no Brasil — jurisdição com direitos de eliminação e anonimização a pedido do titular. **O Canon não possui, hoje, nenhum regime de compatibilização.** A fronteira já foi anotada (PERSON_ONTOLOGY_REVIEW, observação não bloqueante) com foro presumido na Governança (DF-12). Risco se ignorado: implementação legalmente inviável ou violação do Canon por engenheiros "resolvendo" por conta própria. **Decisão exclusiva do fundador, no foro da Governança.**

### IR-02 (P1) — Incompletude planejada do Canon

Estão pendentes: 16 das 19 entidades ontológicas; o catálogo oficial de Eventos Relevantes (DF-05); os estados terminais (DF-11); os critérios de autorização/Governança (DF-12); o volume de Regras Operacionais (DF-13); o catálogo de origens de reconhecimento (DF-23); a Modelagem Conceitual (Missão×Caso×Processo, DF-08/DF-10); o Glossário (DF-06). **Nada disso é falha — é sequência deliberada.** O risco é operacional: qualquer tentativa de implementação integral antes desses volumes forçará engenheiros a preencher lacunas informalmente, o que o Canon proíbe (Lei 5; Lei da Estabilidade do Conhecimento). Mitigação natural já ordenada pelo fundador: continuar a Ontologia.

## P2 — Riscos de dupla interpretação e sequenciamento

### IR-03 (P2) — Nenhuma automação da AHRI pode operar sem Regras Operacionais

Toda automação da AHRI deve referenciar pelo menos uma Regra Operacional (DF-13), e o volume que as define não existe. Consequência de sequenciamento: qualquer plano de MVP com AHRI ativa depende da escrita (ao menos parcial) desse volume. Risco: pressão de cronograma levar a "regras implícitas" no código — violação direta.

### IR-04 (P2) — Pontos de dupla leitura mapeados (consolidação do vetor 20)

Cada item abaixo tem análise completa no CANON_CONSTITUTIONAL_AUDIT e foro de resolução designado:

| Ref. | Dupla leitura possível | Foro designado |
|---|---|---|
| CA-01 | Pessoa com zero missões × "uma ou mais" (Lei 2/DF-20) | Consolidação de relações (DF-18) ou DF direta |
| CA-02 | Verdade Operacional: fonte única global × verdades por missão | Entidade 07 |
| CA-03 | Etapa = dado × representação visual | Entidades 08/09 |
| CA-04 | "Workflow"/"Timeline Operacional" sem definição | Glossário / Regras Operacionais |
| CA-05 | Nascimento de missão exige Fato/Evento Relevante? | Entidade EVENTO + catálogo (DF-05) |
| CA-06 | Responsável pelo reconhecimento em origens autosserviço | Governança (DF-12) / Regras Operacionais |
| CA-07 | O que qualifica como "Regra Constitucional" no FUNDAMENTO (DF-09) | Glossário / Regras Operacionais |

### IR-05 (P2) — Custo da rastreabilidade total × simplicidade operacional

O Canon exige: cadeia de sete camadas reconstituível para todo Fato, históricos perpétuos de tudo (decisões, juízos, hipóteses, conflitos, verdades, alterações), justificativas integrais nascendo junto com cada ato. É exequível — mas o volume de registro é grande, e o Art. 16º ordena que evolução reduza complexidade operacional. Não há contradição normativa (registro ≠ trabalho manual; automação pode registrar); há um desafio de engenharia real: cumprir a rastreabilidade sem tornar o trabalho diário mais difícil. Risco: implementações que "simplifiquem" cortando rastreabilidade (violação) ou que a cumpram com burocracia manual (violação do Art. 13º/16º).

### IR-06 (P3) — Mecanismos probabilísticos × vedação de scores

E4-L08 e o Preâmbulo vedam que juízos e verdades se expressem como scores/probabilidades. Modelos de IA modernos são internamente probabilísticos. Não há contradição: o Canon disciplina a **expressão epistemológica oficial** (linguagem justificada), não a mecânica interna das ferramentas. Risco prático: vazamento de scores internos para registros oficiais, telas ou justificativas — engenheiros precisam de fronteira explícita entre mecanismo e registro.

### IR-07 (P3) — Independência tecnológica declarada × tentação de acoplamento

O Preâmbulo do Volume 00 e o E9 (Restrições) declaram que o comportamento independe da tecnologia. Risco recorrente de a implementação acoplar conceitos do Canon a recursos específicos de fornecedores (nomes de modelos, formatos, plataformas de mensageria citadas como exemplos conceituais — WhatsApp aparece como *exemplo de origem*, não como dependência). Engenheiros devem tratar as listas de origens como conceituais, exatamente como escritas.

---

*Conselho Constitucional — apenas identificação. Nenhuma solução proposta, nenhum documento alterado.*
