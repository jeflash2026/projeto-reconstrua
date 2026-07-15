# FOUNDER DECISIONS — ONTOLOGIA — DF-13 a DF-16

**Data:** 2026-07-13
**Autoridade:** Fundador do Projeto Reconstrua
**Status:** Autoridade ontológica. Parte oficial do Livro Mestre (Volume 01).

As decisões abaixo foram transcritas sem reinterpretação, sem resumo e sem alteração.

---

## DF-13 — Regra Operacional

> REGRA OPERACIONAL é uma Entidade Fundamental.
>
> Ela representa toda regra executável pelo Sistema Operacional.
>
> Uma Regra Operacional nunca representa uma decisão humana.
>
> Ela representa um comportamento previamente aprovado pelo Projeto Reconstrua.
>
> Toda automação executada pela AHRI deverá referenciar pelo menos uma Regra Operacional.
>
> Toda Regra Operacional deverá possuir:
>
> - Identificador único;
> - Nome;
> - Objetivo;
> - Critério de execução;
> - Critério de bloqueio;
> - Evento de entrada;
> - Evento de saída;
> - Evidências produzidas;
> - Responsável pela aprovação;
> - Histórico de versões.
>
> As Regras Operacionais serão detalhadas em volume próprio.

**Resolve:** DF-13 do índice ontológico (e pendência P7 do Volume 00). REGRA OPERACIONAL entra na Ontologia como Entidade Fundamental. Coerente com a DF-09 (FUNDAMENTO das decisões operacionais automatizadas) e com a Lei 4 (auditabilidade).

## DF-14 — Evento

> A entidade EVENTO possuirá dois subtipos oficiais.
>
> **EVENTO RELEVANTE**
>
> Representa qualquer evento capaz de alterar a Verdade Operacional de uma Missão.
>
> Somente Eventos Relevantes podem alterar Estado Operacional.
>
> **EVENTO INFORMATIVO**
>
> Representa qualquer evento registrado apenas para preservar histórico, auditoria ou contexto.
>
> Eventos Informativos jamais alteram Estado Operacional.
>
> Os dois subtipos pertencem à mesma entidade EVENTO.
>
> O Catálogo Oficial de Eventos será definido posteriormente.

**Resolve:** DF-14 do índice ontológico. Os subtipos serão definidos dentro da entidade EVENTO no Volume 01. Coerente com a DF-05, que permanece intocada. Catálogo Oficial de Eventos permanece pendente de volume/capítulo próprio.

## DF-15 — Ordem Oficial da Ontologia

> A Ontologia deverá ser escrita exatamente nesta ordem.
>
> 1. MISSÃO
> 2. PESSOA
> 3. CASO
> 4. PROCESSO
> 5. DOCUMENTO
> 6. EVENTO
> 7. VERDADE OPERACIONAL
> 8. ESTADO OPERACIONAL
> 9. ETAPA OPERACIONAL
> 10. PROJEÇÃO
> 11. OPERAÇÃO
> 12. REGRA OPERACIONAL
> 13. AHRI
> 14. OPERADOR
> 15. PERITO
> 16. ADVOGADO
> 17. SUPERVISOR
> 18. CLIENTE
>
> Esta ordem é obrigatória.
>
> Cada entidade poderá utilizar apenas conceitos definidos anteriormente.
>
> Nenhuma entidade poderá depender de uma definição futura.

**Resolve:** DF-15 do índice ontológico. Gera os alertas editoriais AE-01 e AE-02 (abaixo).

## DF-16 — Completude da Ontologia

> O índice atual NÃO é considerado definitivo.
>
> Antes da conclusão do Volume 01 deverá existir uma revisão completa de cobertura.
>
> Ao final do Volume deverão ser respondidas as perguntas:
>
> Existe alguma entidade utilizada pela Constituição que não foi formalmente definida?
>
> Existe alguma entidade definida que nunca é utilizada?
>
> Existe alguma redundância conceitual?
>
> Somente após essa auditoria o Volume 01 poderá ser congelado.

**Resolve:** DF-16 do índice ontológico. A auditoria de cobertura fica registrada como etapa obrigatória de encerramento do Volume 01.

---

## ALERTAS EDITORIAIS REGISTRADOS

### AE-01 — PERÍCIA ausente da Ordem Oficial

A ordem obrigatória da DF-15 contém 18 posições e **não inclui PERÍCIA**, que é entidade registrada pela DF-06. Nenhuma decisão revogou PERÍCIA. Possibilidades (a escolha é exclusiva do fundador):
(a) incluir PERÍCIA na ordem, em posição a definir;
(b) declarar que PERÍCIA foi absorvida por PERITO (exigiria decisão expressa, pois a DF-06 as registra como nomes distintos);
(c) remeter PERÍCIA a outro volume;
(d) removê-la do rol de entidades (decisão de revogação parcial da DF-06).
Enquanto não houver decisão, PERÍCIA permanece listada no índice como entidade registrada **sem posição na ordem de escrita**. A auditoria da DF-16 ("entidade utilizada mas não definida") capturaria o caso, mas o registro antecipado evita que se perca. → **DECISÃO DO FUNDADOR (DF-17)**

### AE-02 — Referências nominais a entidades posteriores

A DF-15 proíbe que uma entidade dependa de definição futura. Porém, o protocolo obrigatório das 10 perguntas exige responder "quais entidades pode possuir" (pergunta 9). A MISSÃO — primeira da ordem — presumivelmente possui Documentos, Eventos, Casos etc., todos definidos depois dela. Leitura harmônica proposta (não assumida): **citar o nome** de uma entidade registrada no Volume 00 não constitui dependência de definição futura; apenas o uso do **conteúdo da definição** constitui. Sem essa confirmação, a escrita da MISSÃO conforme o protocolo é impossível sem violar a DF-15. → **DECISÃO DO FUNDADOR (DF-18)**

---

*Registro editorial. Nenhuma definição de entidade foi iniciada. Nenhuma arquitetura, banco, UX ou código foi produzido.*
