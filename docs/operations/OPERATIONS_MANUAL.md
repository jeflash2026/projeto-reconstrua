# Manual Operacional — AHRIOS em produção

## Rotina diária (10 minutos)
1. **`/production/monitor`** — health ONLINE? eventos/s normais? erros de LLM ~0?
2. **Filas** — `advogado`/`perito` crescendo ⇒ atribuir processos (Admin) ou
   cadastrar/ativar equipe.
3. **Portal Admin → Dashboard** — gargalos e alertas (a AHRI aponta o setor).
4. **Founder Console** — "o que precisa da minha atenção hoje?" (resposta com fonte).

## Rotinas automáticas (não exigem humano)
- **Loop temporal** (1/min): tarefas vencidas do Scheduler viram sinais → Brain decide.
- **Preparação noturna** (03:00): decisões abertas para os advogados, riscos, filas.
- **Anti-spam**: notificações repetidas são suprimidas por audiência×motivo.

## Sinais e reações
| Sinal | Onde | Reação |
|---|---|---|
| Health DEGRADED/FAILED | monitor | ver componente; reiniciar container se preciso (dados seguros) |
| Erros LLM crescendo | monitor.llm.errors | verificar chave/quota; a AHRI degrada com fraseado factual (não para) |
| Evolution sem entregar | logs `http-retry` | verificar instância Evolution (reconexão do WhatsApp) |
| Fila advogado > capacidade | monitor.queues | atribuir/ativar advogados |
| Prazo vencido | plantão do advogado (decisão `juridical_review`) | ação humana |
| Integridade | R9 via `/admin/*` (auditor) | se falhar: incidente — ninguém escreve à mão no Event Store |

## Segurança operacional
- Segredos só via ENV/Config (mascarados na leitura). Nunca em git.
- Backups do Postgres: `pg_dump` diário (o Event Store é a memória oficial).
- Autenticação dos portais aguarda DF-12: até lá, exponha 3002–3004 apenas em rede
  privada/VPN; a API pública é somente 3001 (webhook + produção).

## Quem decide o quê (lembrete constitucional)
- **Executive Brain** decide operacional (com RO + proveniência) — nunca LLM.
- **Advogado** decide jurídico — a AHRI para e aguarda (Decision Runtime).
- **Administrador** decide gestão (atribuições, equipe, campanhas).
- **A memória nunca cria fatos; respostas nunca inventam dados** — ausência é declarada.
