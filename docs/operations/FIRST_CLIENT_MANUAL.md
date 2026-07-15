# Manual do Primeiro Cliente — REAL_FIRST_CLIENT

## Antes de ligar o anúncio
1. `GET /production/go-live` → **ready: true** (obrigatório; vermelho = não sobe).
2. Rodar a homologação ponta a ponta: `POST /production/first-client`
   (ou o botão na UI `/production/ui`). As 8 etapas devem passar:
   `anuncio → whatsapp → coleta_dados → coleta_hiscon → reconhecimento →
   missao_criada → admin_recebe → workflow_continua` — cada uma com evidência.
3. Conferir no Portal Admin: o cliente de homologação aparece em Clientes,
   a missão em Missões (timeline com proveniência AHRI), o documento em Documentos.

## O fluxo real (o que acontece sozinho)
1. **Anúncio Meta** → landing (`?utm_campaign=X`) → botão WhatsApp com o texto
   "Olá! Vim pelo anúncio [X]…" — a campanha fica registrada na primeira mensagem.
2. **Primeira mensagem** → Perception → Executive Brain decide (RO) → missão nasce
   (Pessoa→Cliente→Missão→Verdade→Estado→Etapa) → AHRI responde humanizada.
3. **Coleta de dados**: a AHRI conversa; a memória viva registra nome/cidade com fonte.
4. **HISCON**: cliente fotografa/envia o extrato → R3 reconhece → R6 re-sintetiza →
   AHRI confirma o recebimento.
5. **Admin recebe**: dashboards e read models atualizam em tempo real.
6. **Workflow continua**: follow-ups agendados; prazo administrativo monitorado;
   quando o Administrador atribuir o advogado, o plantão 3D assume.

## O que observar no primeiro dia
- `/production/monitor`: conversas, filas, eventos/s, uso de LLM, health.
- Tempo de resposta da AHRI (nunca instantâneo — é proposital).
- Fila `advogado` no monitor: se crescer, atribuir processos no Admin.

## Se o cliente real travar em alguma etapa
- Ver `/admin/clients/<chatId>` (conversa + memória + missões) e `/admin/logs?q=<chatId>`.
- A AHRI nunca inventa: se o Brain decidiu esperar, há uma RO citada no log.
