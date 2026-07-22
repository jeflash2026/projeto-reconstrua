# PORTAL DO CLIENTE — BLUEPRINT DE INTEGRAÇÃO

### Como a próxima fase nasce integrada ao ecossistema, sem quebrar nenhuma regra homologada

> Funcionalidade **planejada** do produto (não escopo novo), sequenciada após a estabilização
> do núcleo. Documento técnico de arquitetura — nenhum código ainda.

---

## 1. Papel do Portal (regra arquitetural PERMANENTE)

- **O WhatsApp é o relacionamento.** A AHRI continua uma inteligência VIVA: conversa
  naturalmente, com empatia e personalidade; tira dúvidas; fala do processo e de assuntos
  gerais quando apropriado; **nunca** vira menu de respostas automáticas. Nada disso muda com
  o Portal — o pipeline de conversa (percepção → Brain → expressão humanizada) permanece o canal.
- **O Portal é a janela de acompanhamento.** Somente leitura do próprio caso, em linguagem do
  cliente. Não conversa, não executa atos, não substitui a AHRI.
- **Fronteiras de segurança da AHRI (invioláveis):** nunca revelar informações internas da
  empresa, dados de outros clientes ou estratégias operacionais; nunca inventar; nunca
  prometer decisões que dependem da equipe humana; nunca ultrapassar as permissões do cliente.
  (Reforço operacional: essas fronteiras entram na configuração persistida de prompts da
  expressão — mecanismo já existente — e o Portal, por construção, só acessa a visão do §4.)
- **O CLIENTE NÃO SE CADASTRA.** Sem "criar conta", sem senha criada pelo cliente. O acesso
  nasce de um **link enviado pela AHRI no WhatsApp** — o canal de confiança já estabelecido.

## 2. Regras homologadas que este desenho preserva (mapa de conformidade)

| Regra/Lei                                    | Como o Portal a respeita                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Regra 1 (ALIR = visão única)                 | O Portal consome uma **visão filtrada do ALIR** (§4) — nenhuma nova representação do cliente                                                |
| Regra 3 / Lei 12 (comando canônico)          | Quem comunica o cliente é **sempre o Brain** (nova RO no catálogo, padrão RO‑3B) — nenhum "notificador" paralelo; o Portal não escreve nada |
| Lei 8 / Lei 11 (fato × consequência × tempo) | "Comunicação de conclusão enviada" é **fato** (1 registro); o link/token é **derivado** (stateless), nunca estado                           |
| Lei 9 / Lei 10 (declarar, rastrear)          | O Portal mostra apenas o que tem fonte real; etapas sem dado aparecem como "em andamento", nunca inventadas                                 |
| Regra 5 (estado novo só homologado)          | **1 registro persistido novo** (§5) + **1 variável de ambiente nova** — listados para sua homologação                                       |
| Lei 13 (produção fria)                       | Token stateless ⇒ sobrevive a restart por construção; teste de frio incluído no aceite                                                      |
| BL‑2.2 (segredo nunca no browser)            | O Portal Next chama a API **server‑side** pela rede Docker, como os outros dois portais                                                     |
| Regra 2 (sem LEGACY convivendo)              | Nenhuma funcionalidade substituída — o WhatsApp continua íntegro por definição                                                              |

## 3. Arquitetura de acesso — link mágico stateless

1. **Emissão:** ao comunicar a conclusão (gatilho do §6), a mensagem da AHRI inclui
   `https://www.projetoreconstrua.com.br/portal?t=<token>`.
2. **Token:** payload `{clienteId, exp}` assinado com HMAC‑SHA256 por um segredo **próprio do
   papel cliente** (`CLIENTE_PORTAL_SECRET` — novo, seguindo o padrão de 1 segredo por papel).
   **Stateless**: nada persistido, validade embutida (proposta: 90 dias), verificável após
   qualquer restart (Lei 13). Escopo do token = **um único cliente**.
3. **Sessão:** o Portal valida o token no primeiro acesso e abre cookie httpOnly (mesmo padrão
   de sessão dos portais Admin/Advogado). Middleware fail‑closed: sem sessão → página "peça seu
   link no WhatsApp" (nunca formulário de cadastro).
4. **Renovação viva:** o cliente pede pelo WhatsApp ("quero o link do portal") → percepção →
   Brain (RO própria) → AHRI responde com link novo. A renovação é **conversa**, não sistema
   de recuperação de senha.

## 4. A visão do cliente (subconjunto SEGURO do ALIR)

Rota interna de leitura (servida pelo servidor da API, consumida server‑side pelo Portal):
`acompanhamento(clienteId)` → derivado 100% de fontes existentes:

| O cliente vê                                                                                                                                                  | Fonte (existente)                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Linha do tempo da jornada em linguagem humana (recebemos seus documentos → análise → pedidos enviados → prazo → advogado responsável → processo em andamento) | status derivado (`ClientesList`/ALIR) traduzido para rótulos de cliente                                                           |
| Prazo em curso (contagem dos pedidos administrativos)                                                                                                         | fato `pedidos-administrativos` + relógio (Lei 8/11)                                                                               |
| Advogado responsável (apenas **nome**)                                                                                                                        | `assignments` + `staff`                                                                                                           |
| Nº do processo e **atualizações client‑facing**                                                                                                               | `JuridicalEntry` filtrado por `CLIENT_FACING_KINDS` (o MESMO filtro que a AHRI já usa — uma única definição do que é comunicável) |
| Documentos recebidos (rótulos, nunca conteúdo interno)                                                                                                        | ALIR documentos                                                                                                                   |

**Nunca exposto:** dados de outros clientes, notas internas (`observacao`/kinds internos),
métricas da operação, financeiro da empresa, identidades da equipe além do advogado do caso,
qualquer campo sem fonte.

## 5. Estado novo (mínimo, pendente da sua homologação — Regra 5)

| Item                                            | Conteúdo                                          | Justificativa                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registro **`liberacao-portal`** (1 por cliente) | `clienteId, chatId, comunicadoEm, prazoInformado` | O envio da mensagem de conclusão é **fato irrecuperável por derivação** (garante envio ÚNICO — sem ele, a AHRI re‑enviaria a cada avaliação). Mesmo padrão de `modalidade`/`venda`/`pedidos-administrativos` |
| Env **`CLIENTE_PORTAL_SECRET`**                 | segredo de assinatura do token                    | 1 segredo por papel (padrão vigente); não reutilizar segredo de outro papel                                                                                                                                  |

_Tokens, sessões e a visão do cliente: zero persistência (derivados)._

## 6. Integração ao Brain (o Portal nunca nasce isolado)

- **Gatilho de completude:** um subscriber (padrão dos existentes) observa os eventos de
  documento; quando o **Readiness** (determinístico, já homologado) vira PRONTO **e** não há
  fato `liberacao-portal`, entrega um **percept** (`documentacao_completa`) pela **entrada
  única serializada** — o mesmo caminho do sinal temporal e da ponte do advogado.
- **Decisão por RO:** nova regra no catálogo de produção (aditiva, padrão RO‑3B):
  `RO-CADASTRO-CONCLUIDO` → o Brain decide comunicar; a expressão humaniza o texto homologado
  (conclusão + em análise + prazo + link do Portal + "novidades continuam chegando por aqui").
- **Registro do fato** `liberacao-portal` na sequência (envio único; Lei 8).
- Consequência: o passo "AHRI identifica automaticamente a completude" fecha o gap apontado na
  auditoria **sem** mudar a fronteira congelada do snapshot (o percept entra pela conversa, não
  pelo snapshot).

## 7. Empacotamento (padrões já validados — nada novo de infra)

Next.js em `apps/portal-cliente` com `basePath: '/portal'` · target próprio no Dockerfile ·
serviço no compose (`:3300`, rede `npm-net`) · custom location `/portal` no NPM · páginas
`force-dynamic` · `noindex` (privacidade). Idêntico ao processo dos outros dois portais.

## 8. O que NÃO será construído (anti‑ERP)

Chat dentro do portal (conversa é WhatsApp) · upload pelo portal (coleta é da AHRI) · cadastro/
senha/recuperação · notificações por e‑mail/push (canal é WhatsApp) · área de "perfil" editável ·
qualquer escrita do cliente no sistema.

## 9. Roadmap da fase (uma entrega por vez, ciclo e auditoria de sempre)

| #         | Entrega                                                                                               | Aceite                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **PC‑R1** | Visão segura `acompanhamento(clienteId)` + token stateless + testes (incl. produção fria)             | dado um cliente real, a visão retorna só o subconjunto do §4; token expira e sobrevive a restart      |
| **PC‑R2** | App `portal-cliente` mínimo (1 página de acompanhamento + página "peça seu link") + empacotamento/NPM | `/portal?t=…` renderiza a jornada real; sem token → orientação ao WhatsApp                            |
| **PC‑R3** | Gatilho de completude → Brain (percept + RO) + fato `liberacao-portal` + mensagem homologada com link | cliente de teste completa documentos → recebe UMA mensagem com link válido; reavaliações não duplicam |
| **PC‑R4** | Renovação por conversa ("quero o link") via RO                                                        | pedido em linguagem natural → link novo na resposta da AHRI                                           |
| **PC‑R5** | Homologação ponta a ponta (funde as FASES 1–7 do plano anterior, agora com o Portal nos passos 5–7)   | jornada completa do "olá" ao processo acompanhado no Portal + notificado no WhatsApp                  |

## 10. Pendências que só você decide (antes do PC‑R3)

1. **Prazo oficial da mensagem:** o código homologado conta **10 dias** (pedidos
   administrativos); o fluxo declarado diz **~12 dias**. Definir o número (ou "10 dias úteis ≈
   12 corridos"?) e se o contador do Portal usa o mesmo fato.
2. **Texto exato da mensagem de conclusão** (a AHRI humaniza, mas o conteúdo factual é
   homologado por você).
3. **Homologação do estado novo** (§5): registro `liberacao-portal` + env `CLIENTE_PORTAL_SECRET`.
4. **Validade do link** (proposta: 90 dias, renovável por conversa).
