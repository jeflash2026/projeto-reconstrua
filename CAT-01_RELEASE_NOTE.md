# CAT-01 — RELEASE NOTE
### Reconexão do catálogo oficial de regras da AHRI

**Capacidade:** conduta autônoma da AHRI (catálogo de Regras Operacionais)
**Data:** 2026-07-16 · **Tech Lead:** revisão final de produção
**Base (pré-CAT-01):** `9716fc6` → **HEAD:** `f6d0f54`

---

## 1. Commits que compõem a capacidade (exatamente 2)
| Commit | Escopo |
|---|---|
| `547f567` | Implementação — reconecta 2 regras aprovadas ao `PRODUCTION_RULE_CATALOG` |
| `f6d0f54` | Prova de comportamento — suíte permanente (15 testes) |

*Verificado:* `git log 9716fc6..HEAD` retorna **somente** esses dois commits.

## 2. Arquivos modificados (exatamente 2)
| Arquivo | Tipo | Δ |
|---|---|---|
| `packages/infrastructure/src/production/production-rule-catalog.ts` | dados (catálogo) | +17 / −1 |
| `packages/infrastructure/src/production/production-rule-catalog.behavior.test.ts` | teste | +171 |

*Verificado:* `git diff 9716fc6..HEAD` excluindo esses dois arquivos = **vazio**. Nenhum outro arquivo tocado.

## 3. Confirmação de não-alteração estrutural
- **API pública:** inalterada — nenhum endpoint, rota ou assinatura mudou.
- **Banco:** inalterado — nenhuma migração; schema/roles idênticos.
- **Contrato:** inalterado — `OperationalRuleSpec` e todos os tipos intocados.
- **Runtime:** inalterado — Executive Brain, RuleEvaluator, Mission Runtime, Conversation, Event Store: **zero linhas alteradas**.
- **Natureza da mudança:** exclusivamente **dados** — 2 refs aprovadas somadas ao array do catálogo, por reuso do `DEFAULT_RULE_CATALOG` (specs intocadas). `MISSION_RULE_CATALOG` e `FOLLOW_UP_RULES` (4C) preservados byte a byte.

## 4. Análise de risco de produção
| Nível | Risco | Situação |
|---|---|---|
| **P0 — Funcional** | Regra nova quebrar decisão | **Nenhum.** As 2 novas regras disparam corretamente (fatos → avaliação → vencedora → intenção provados) e respeitam a fronteira humana (bloqueadas quando `matterRequiresHuman`). Regressão 2D/4C verde. |
| **P1 — Segurança** | Exposição/auth/LGPD | **Nenhum.** Catálogo é dado de decisão interno; nenhum endpoint, credencial ou exposição criado. |
| **P2 — Configuração** | .env/porta/URL | **Nenhum.** Nada de ambiente mudou. |
| **P3 — Documentação** | Doc desatualizada | **Nenhum novo.** Esta release note documenta a mudança. |
| **P4 — Evolução** | Destino não realizado | **Conhecido, não-defeito:** a escalação de Canon silente é **gravada** na fila do supervisor (auditável), mas o portal do supervisor ainda não está publicado (CAP-11) — a informação não se perde, apenas aguarda a publicação dos portais. Regras adiadas (DOC-REQUEST, STOP-CONCLUDED, NOTIFY-HUMAN) permanecem para sprints próprios. |

**Rollback:** `git revert 547f567 f6d0f54` + push (deploy automático restaura o catálogo anterior). Sem migração → reversão limpa.

## 5. Novos comportamentos que o cliente perceberá após o deploy
1. **Aviso proativo de prazo** — quando o caso tiver um prazo em **≤3 dias**, a AHRI enviará, por conta própria, uma mensagem no WhatsApp alertando sobre o prazo (`deadline_warning`, urgência alta). *Este é o único comportamento novo VISÍVEL ao cliente.*

*(A segunda regra — Canon silente → supervisor — não gera mensagem ao cliente: ela apenas roteia internamente o caso para um humano em vez de esperar em silêncio. Efeito percebido: em situações que o sistema não sabe resolver, o caso passa a ser encaminhado a um responsável, não abandonado.)*

## 6. Comportamentos que NÃO mudam
- Acolhimento no 1º contato (GREET) e nascimento da missão (ONBOARD).
- Ingestão e confirmação de documentos (INGEST-DOC, DOC-ACK).
- Acompanhamento em turnos de texto (EXPLAIN).
- Reengajamento no silêncio e no timeout (4C).
- Escalação de matéria jurídica ao advogado (2D-ESCALATE-HUMAN).
- Espera legítima quando nada se aplica (WAIT).
- Tempo de resposta, humanização, número de WhatsApp, endpoints, segurança, dados e portais: **idênticos**.

## 7. Validação de produção (não apenas testes)
- **Deploy CI/CD:** ambos os runs (`547f567`, `f6d0f54`) = **completed successfully** (verde).
- **Go-Live ao vivo pós-deploy:** `GET /production/go-live` → **`ready:true`** (13/13 gates verdes; `brain` com catálogo não-vazio).
- **Suíte:** 15 testes de comportamento verdes + compatibilidade (corrections-4c, shadow, REAL_FIRST_CLIENT, go-live, brain-adapter) verdes; typecheck OK.

## 8. Declaração
Escopo isolado (2 commits, 2 arquivos, só dados), zero mudança de API/banco/contrato/runtime, risco de produção controlado, comportamento provado no Brain real e validado em produção.

**CAT-01 APROVADA PARA PRODUÇÃO**
