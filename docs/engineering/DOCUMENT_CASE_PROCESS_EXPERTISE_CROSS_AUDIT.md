# AUDITORIA CRUZADA — DOCUMENTO (03) × CASO (05) × PROCESSO (06) × PERÍCIA (13)

**Objetivo:** demonstrar formalmente, entre as quatro entidades, a ausência de sobreposição de responsabilidades, a ausência de circularidade e a aderência integral ao Livro Mestre.
**Data:** 2026-07-14 · **Método:** confronto ontológico (itens do Canon) + varredura estrutural de imports/refs + validação dinâmica.

---

## 1. Delimitação ontológica (sem sobreposição)

| Entidade | Natureza | Responsabilidade exclusiva | Jamais faz |
|---|---|---|---|
| **DOCUMENTO (03)** | prova documental reconhecida | preservar conteúdo probatório reconhecido, com origem e incorporação (INV-D02/D08/D10) | validar/decidir/valorar juridicamente (INV-D06/D07) |
| **CASO (05)** | recorte/contexto jurídico da missão | enquadrar juridicamente o interior da missão (INV-CA-01) | ser processo (INV-CA-02); decidir (item 16) |
| **PROCESSO (06)** | instrumento jurídico | instrumentalizar a via jurídica, pertencente a uma missão (INV-PR-01) | ser a missão (INV-PR-02); decidir (item 16) |
| **PERÍCIA (13)** | etapa operacional especializada | enquadrar a fase técnica de prova (INV-PE-01) | ser o Perito/papel (INV-PE-02); produzir prova; decidir (item 17) |

**Planos distintos:** DOCUMENTO é **evidência** (o quê probatório); CASO é **contexto jurídico**; PROCESSO é **instrumento jurídico**; PERÍCIA é **etapa/fase** (o quando operacional). Nenhuma responsabilidade se repete — cada uma habita um plano ontológico próprio (evidência × contexto × instrumento × etapa). **Sobreposição: NENHUMA.**

Confirmação por VOs (nenhum compartilhado): DOCUMENTO (`DocumentOrigin`, `ContentReference`); CASO (`LegalContext`, `LegalFoundation`); PROCESSO (`ProcessLegalFoundation`); PERÍCIA (sem VO escalar; só refs). Conceitos afins (ex.: fundamento jurídico) têm VOs **próprios e separados** por entidade — sem acoplamento.

---

## 2. Matriz de referências (por identidade nominal — DF-18)

`✔` referencia por `Uuid`; `—` não referencia.

| Entidade ↓ referencia → | Missão(01) | Documento(03) | Caso(05) | Processo(06) | Evento(04) | Etapa(09) | Perito(16, nominal) |
|---|---|---|---|---|---|---|---|
| **DOCUMENTO (03)** | ✔ (incorporação) | — | — | — | — | — | — |
| **CASO (05)** | ✔ | — | — | — | — | — | — |
| **PROCESSO (06)** | ✔ | — | ✔ (opcional, "decorre de") | — | — | — | — |
| **PERÍCIA (13)** | ✔ | — | — | — | — | ✔ (especializa) | ✔ (nominal) |

Todas as arestas apontam para **Missão** (contêiner) ou para entidades **anteriores** na ordem oficial (Caso 05 < Processo 06; Etapa 09 < Perícia 13). Perito (16) é referência **nominal** (identidade), não a entidade.

---

## 3. Ausência de circularidade

- **DOCUMENTO** → Missão. Nada o referencia entre as quatro. Folha.
- **CASO** → Missão. É referenciado por **Processo** (opcional). `Caso → (nada das quatro)`; `Processo → Caso`. Aresta única.
- **PROCESSO** → Missão, Caso. Nada o referencia. Folha do subgrafo.
- **PERÍCIA** → Missão, Etapa(09), Perito(nominal). Nada a referencia.

Grafo dirigido das quatro: `Documento → Missão`, `Caso → Missão`, `Processo → {Missão, Caso}`, `Perícia → {Missão, Etapa}`. **Não há caminho que retorne a um nó de origem → DAG → sem ciclo.** No código, todas as referências são ponteiros `Uuid` (zero import entre entidades) — ciclo de compilação impossível.

Evidência: `grep "from '../(document|case|process|pericia|…)/'"` em todo o domínio → **0 ocorrências**.

---

## 4. Aderência integral ao Livro Mestre

| Entidade | Invariantes do item 15 | Cobertura | Verbo fiel |
|---|---|---|---|
| DOCUMENTO (03) | INV-D01..D14 | manifesto completo, loci mapeados | `recognize` |
| CASO (05) | INV-CA-01..03 | manifesto completo | `recognize` |
| PROCESSO (06) | INV-PR-01..03 | manifesto completo | `recognize` |
| PERÍCIA (13) | INV-PE-01..03 | manifesto completo | `frame` |

Cada entidade cobre exatamente as invariantes do seu item 15; verbos das fábricas fiéis à natureza; omissões (execução, produção de prova, coleções, entidades futuras) por fidelidade, não por lacuna. **Aderência integral: confirmada.**

---

## 5. Validação dinâmica (executada)

`pnpm typecheck` ✅ 12/12 · `pnpm lint` ✅ 0 erros · `pnpm test` ✅ **13 arquivos, 134 testes** (inclui as quatro entidades: Documento 10, Caso 10, Processo 10, Perícia 10).

---

## 6. Veredito

**DOCUMENTO (03), CASO (05), PROCESSO (06) e PERÍCIA (13): sem sobreposição de responsabilidades, sem circularidade, integralmente aderentes ao Livro Mestre.** Quatro planos ontológicos distintos (evidência × contexto × instrumento × etapa), acoplados apenas por referências de identidade descendentes. Núcleo íntegro. Não iniciar a Entidade 14 sem autorização explícita.
