# PROJETO RECONSTRUA — PRODUCT MODEL

> **Documento de Arquitetura de Produto.** Não é código. Traduz o negócio para dentro
> do Portal Admin. Fonte operacional: o **Canon** (`constitution/` — 19 entidades, 39
> Decisões do Fundador). Fonte comercial: as diretrizes de negócio do fundador
> (ROADMAP-NEGÓCIO). Nada aqui vira tela ou código antes da sua aprovação.

## Ressalvas de fidelidade (leia primeiro)
1. **"ALIR" não consta no projeto** (busca vazia no Canon, docs e código). Onde ele
   apareceria, marquei **[DECISÃO DO FUNDADOR: definir ALIR]**. Não inventei significado.
2. **Camada comercial × Canon.** O Canon proíbe modelar a **Pessoa** como lead/venda e
   proíbe o sistema ser "plataforma de vendas" (Art. 5º/6º; Entidade 01 §"não é registro
   de venda"; Entidade 19 CLIENTE = *condição contratual/comercial* distinta da Pessoa).
   Os **Modelos A/B** operam na camada **B2B (Reconstrua ↔ escritórios/advogados)** — a
   Pessoa permanece sujeito, nunca mercadoria. Formalizar A/B no Canon exige **Decisão do
   Fundador** (Governança V04). Este documento os trata como **modelo de negócio vigente
   a ratificar**, não como cânone já existente.
3. **CLIENTE ≠ PESSOA.** No Canon, PESSOA é o ser humano (sagrado); CLIENTE (Entidade 19)
   é a *condição contratual/comercial* que a Pessoa assume. Quando este documento fala em
   "estados do cliente", refere-se a essa condição comercial + o estado operacional da
   **Missão** daquela pessoa.

---

# PARTE I — MODELO DE NEGÓCIO

## 1. Como o Projeto Reconstrua ganha dinheiro
**O cliente (a pessoa atendida) NUNCA paga.** A monetização é 100% **B2B**, com escritórios
e advogados parceiros, em dois modelos:

- **MODELO A — Venda de caso qualificado (entrega ao escritório).** O Reconstrua capta a
  pessoa, organiza documentos, faz a perícia e **qualifica** o caso; então **vende o caso
  pronto** a um escritório parceiro por um valor fixo por CPF qualificado — **R$ 400** (valor
  de referência). Receita = nº de casos qualificados vendidos × preço.
- **MODELO B — Sociedade (participação em honorários).** O caso qualificado é **atribuído**
  a um advogado/escritório parceiro que assume o processo; o Reconstrua recebe uma
  **participação nos honorários** ao final (êxito/acordo). Receita = Σ (honorário × % de
  participação) dos processos encerrados com êxito.

Regras invioláveis: cliente não paga; comunicação sóbria e em conformidade com a ética da
OAB (sem promessa de resultado); a decisão jurídica é sempre humana.
**[DECISÃO DO FUNDADOR: confirmar preço R$400, % de participação do Modelo B, e ratificar A/B via Governança.]**

## 2. Todos os produtos vendidos
1. **Caso qualificado (CPF qualificado)** — o "produto" do Modelo A. Definição de pronto:
   (a) 3 documentos recebidos e legíveis — **identidade** (RG/CNH) + **comprovante** +
   **HISCON** (ou equivalente do direito em questão); (b) **perícia concluída** com
   **irregularidade/direito confirmado**. *Qualificação é ato humano* (não há estado
   automático) — cabe ao operador/perito/advogado declarar.
2. **Condução do processo em sociedade** — o "produto" do Modelo B: o mesmo caso
   qualificado, porém **entregue como parceria** (o Reconstrua acompanha e participa dos
   honorários), não como venda avulsa.
3. *(potenciais, a ratificar)* **[DECISÃO DO FUNDADOR:** lotes de casos por tipo de direito;
   exclusividade por região; SLA de entrega; assinatura recorrente de escritórios. Não
   assumir sem decisão.]

> **Escopo do direito (Canon, Art. 301):** não é só INSS. É *"qualquer direito patrimonial,
> financeiro ou contratual passível de recuperação, com fundamento jurídico"* (cobranças
> indevidas, financiamentos abusivos, benefícios previdenciários, etc.). O produto é a
> **jornada de reconstrução** de um direito, não um nicho.

## 3. Todos os fluxos operacionais

### Fluxo comum (captação → qualificação) — vale para A e B
1. **Entrada (lead):** a pessoa chega pelo WhatsApp (landing/anúncio/indicação).
2. **Recepção pela AHRI:** acolhe, entende a situação, **nasce a MISSÃO** (Canon Ent. 01).
3. **Triagem de fundamento:** existe direito potencialmente recuperável (DF-01)? Sem
   fundamento → a Pessoa é conhecida e respeitada, **sem missão** (não vira "lead"). Com
   fundamento → a missão evolui.
4. **Solicitação documental:** a AHRI pede os documentos necessários.
5. **Recebimento + leitura:** documentos por foto; reconhecimento (R3) e vínculo ao caso;
   conteúdo capturado e disponível à equipe.
6. **Perícia:** o **PERITO** analisa e confirma (ou não) a irregularidade/direito.
7. **Qualificação (ato humano):** operador/advogado declara o caso **qualificado**.

### Modelo A — pipeline completo (lead → entrega ao escritório)
`Lead → Recepção AHRI → Missão → Triagem → Documentos → Leitura → Perícia → Qualificado
→ Empacotar caso → Ofertar/entregar ao escritório parceiro → Venda confirmada (R$400)
→ Recebimento → Encerramento da missão (entregue)`

### Modelo B — pipeline completo (lead → encerramento → distribuição financeira)
`Lead → … → Qualificado → Atribuição a advogado parceiro (Sociedade) → Processo jurídico
em andamento (número, protocolo, movimentações) → Acompanhamento do cliente pela AHRI
(recorrência) → Retorno do advogado → AHRI comunica o cliente → Encerramento (êxito/acordo
/ improcedência) → Apuração do honorário → Distribuição financeira (participação Reconstrua)`
Suporte: **reabertura** legítima do caso (fato jurídico novo) reativa a missão e o
acompanhamento.

### Fluxos operacionais transversais (já existentes no sistema)
- **Acompanhamento recorrente** (a AHRI nunca abandona o cliente; cadência com teto anti-spam).
- **Encerramento** (Estado terminal ENCERRADA/CONCLUÍDA — DF-11, histórico perpétuo).
- **Reabertura** (evento append-only; devolve à recorrência).
- **Perícia / handoff** (fila do perito), **atribuição** (admin → advogado), **plantão do
  advogado** (Lawyer Experience), **Shadow** (auditoria de cada turno).

## 4. Todos os estados de um cliente
Dois eixos combinados: **estado operacional da MISSÃO** (Canon) + **condição comercial**
(camada B2B). Um cliente/missão caminha por:

| # | Estado (comercial + operacional) | Origem | Terminal? |
|---|---|---|---|
| 1 | **Novo (chegou pelo WhatsApp)** — Pessoa conhecida; missão nascendo | Canon: nascida | não |
| 2 | **Em triagem de fundamento** | DF-01 | não |
| 3 | **Sem fundamento** — Pessoa sem missão (não é lead) | Canon | (encerra a triagem) |
| 4 | **Aguardando documentos** — bloqueada legítima (Art. 9º) | Canon: bloqueada | não |
| 5 | **Documentos recebidos / em análise** | Canon: em evolução | não |
| 6 | **Em perícia** | Ent. 13 | não |
| 7 | **Qualificado** — caso pronto (ato humano) | Negócio | não |
| 8A | **Ofertado / Entregue ao escritório** (Modelo A) | Negócio | não |
| 9A | **Vendido (R$400 recebido) → Missão encerrada** | Negócio + DF-11 | **sim (ENCERRADA)** |
| 8B | **Atribuído a advogado (Sociedade)** | 3B | não |
| 9B | **Em processo (andamento jurídico)** | 3B/3D | não |
| 10B | **Acompanhamento recorrente** | B4.2 | não |
| 11B | **Encerrado (êxito/acordo/improcedência)** | B4.1 / DF-11 | **sim (CONCLUÍDA/ENCERRADA)** |
| 12B | **Honorário apurado e distribuído** | Negócio | (pós-encerramento) |
| — | **Reaberto** (fato jurídico novo) → volta ao eixo B | B4.3 | não |

> Canon: **só CONCLUÍDA e ENCERRADA são terminais**; nascida/em evolução/bloqueada são
> curso normal (não catálogo de negócio). A **Pessoa nunca é encerrada** — só missões.

---

# PARTE II — O CEO E OS INDICADORES

## 5. Decisões que o CEO toma diariamente
1. **Onde está o gargalo hoje?** (documentos parados, perícia atrasada, atribuições pendentes).
2. **Quais casos estão prontos para qualificar** e quem qualifica.
3. **Modelo A ou B para cada caso pronto** — vender (R$400) ou entrar em sociedade.
4. **Para qual escritório/advogado** entregar/atribuir cada caso.
5. **Quais clientes correm risco de abandono** (silêncio, sem follow-up) — reengajar.
6. **Onde investir captação** (qual canal/campanha traz caso qualificável).
7. **O que está travado e por quê** (impedimentos com responsável e prazo).
8. **Saúde financeira do dia** — quanto foi vendido (A) / a receber de honorários (B).
9. **Equipe:** quem está sobrecarregado (advogado/perito/operador).
10. **Conexão viva:** o WhatsApp oficial está conectado e respondendo?

## 6. Informações que o CEO precisa enxergar (sem abrir Supabase/Docker/Evolution/banco/logs)
- **Funil por estágio** (contagens do estado 1→12) e o que move cada um.
- **Casos prontos para qualificar** e **casos qualificados aguardando destino (A/B)**.
- **Pipeline financeiro:** vendas do Modelo A (nº × R$400) e honorários esperados/recebidos (B).
- **Clientes aguardando cliente / em silêncio / follow-ups pendentes e enviados.**
- **Perícias na fila e concluídas; documentos pendentes por cliente.**
- **Carga por advogado/perito/operador.**
- **Gargalos e setor que precisa de atenção** (já existe no Founder Console: `bottlenecks`,
  `sector_needing_attention`).
- **Status ao vivo do WhatsApp** (online, número oficial, ownerJid, instância, webhook).
- **Saúde do sistema** (verde/amarelo/vermelho) — sem jargão técnico.

## 7. Indicadores que realmente importam (KPIs)
**Aquisição/qualificação:** novos clientes/dia · taxa lead→qualificado · tempo médio até
qualificação · nº de casos qualificados prontos.
**Monetização A:** casos vendidos/dia e mês · receita A (nº × preço) · tempo qualificado→venda.
**Monetização B:** casos em sociedade · processos em andamento · encerrados com êxito ·
honorário médio · **valor a distribuir/distribuído** · tempo qualificado→encerramento.
**Operação/qualidade:** tempo médio entre interações · tempo médio até encerramento ·
casos aguardando cliente · follow-ups pendentes/enviados · casos reabertos · casos por etapa
· casos por advogado. *(itens 6–10 já existem em `/admin/metrics/operacional` — B4.4.)*
**Risco:** clientes em silêncio prolongado · documentos pendentes há N dias · perícias
atrasadas · detecções do Shadow (confuso/irritado/escalada).

> **Honestidade (Canon):** o que o domínio ainda não captura (ex.: valor financeiro por caso,
> ROI por campanha) aparece como **"não disponível"**, nunca inventado (Founder Console já faz isso).

---

# PARTE III — O PORTAL ADMIN (o cérebro operacional)

## Princípio-mestre
O Portal representa **a empresa, não a tecnologia**. O administrador **nunca** abre
Supabase, Docker, Evolution, banco ou logs — **tudo** (operação, dinheiro, equipe, conexão
do WhatsApp, saúde) vive **no Portal**. O portal atual (`apps/portal-administracao`) é uma
lente **técnica** (missões, timeline, event streams); ele **não representa o negócio A/B** e
deve ser **reconstruído** em torno do funil comercial — reaproveitando as APIs `/admin/*` já
existentes onde couberem, descartando o que for jargão técnico.

## 8. Módulos que o Portal Admin precisa possuir
1. **Painel do CEO (Home)** — briefing do dia, funil, financeiro, alertas, saúde. *(evolui do Founder Console)*
2. **Funil / Pipeline** — Kanban dos estados 1→12 (arrastar não decide; decisões são atos registrados).
3. **Clientes & Missões** — a pessoa (sagrada), suas missões, documentos, histórico, acompanhamento.
4. **Documentos & Perícia** — pendências, leitura de documento, fila do perito, laudo/qualificação.
5. **Qualificação** — casos prontos para o ato humano de qualificar.
6. **Modelo A — Vendas** — casos qualificados → oferta/entrega a escritório → venda (R$400) → recebimento.
7. **Modelo B — Sociedade & Processos** — atribuição a advogado, andamento do processo,
   acompanhamento, encerramento, **apuração e distribuição de honorários**.
8. **Escritórios & Advogados parceiros** — cadastro, casos por parceiro, financeiro por parceiro.
9. **Financeiro** — receita A, honorários B, a receber/recebido, distribuição, por parceiro/mês.
10. **Equipe** — operadores/peritos/advogados/supervisores; carga; produtividade.
11. **Conexão WhatsApp** — status, criar/descartar instância, QR, validação do número oficial. *(já existe)*
12. **Indicadores** — KPIs da Parte 7 (reusa `/admin/metrics/operacional`). *(já existe base)*
13. **Shadow / Qualidade** — auditoria de conversas, detecções, perguntas ao Shadow. *(já existe)*
14. **Saúde & Configuração** — verde/amarelo/vermelho, config sem jargão. *(reusa /production/*)*
15. **Founder Console (Assistente)** — "pergunte qualquer coisa" sobre a operação (só read models).

## 9. Telas que existirão
- **Home / Painel do CEO** (briefing + funil + financeiro + alertas + saúde).
- **Pipeline** (Kanban por estágio) → **Detalhe do Caso** (pessoa, missão, documentos, timeline humana, ações).
- **Qualificação** (lista de prontos) → **Ficha de Qualificação** (docs + perícia + botão "Qualificar").
- **Vendas (A)**: fila de qualificados → **Oferta/Entrega** → **Confirmar venda** → recibo.
- **Sociedade (B)**: **Atribuir advogado** → **Painel do Processo** (andamento) → **Encerrar** →
  **Apurar honorário** → **Distribuir**.
- **Clientes** (busca) → **Perfil do Cliente** (pessoa + missões + acompanhamento).
- **Documentos & Perícia** (pendências, visualizar conteúdo, fila do perito).
- **Escritórios/Advogados** (lista, ficha do parceiro, financeiro por parceiro).
- **Financeiro** (receita A, honorários B, a receber/recebido, distribuição).
- **Equipe** (papéis, carga, produtividade).
- **Conexão WhatsApp** (status/QR/criar/descartar). *(pronta)*
- **Indicadores** (KPIs). *(base pronta)*
- **Shadow / Qualidade** (conversas + detecções). *(pronta)*
- **Saúde & Config** (semáforo + configuração). *(reusa /production/*)*
- **Assistente (Founder Console)**.
- **Configurações & Acessos** (segredos/senha do operador, perfis — sem terminal).

## 10. Experiência completa do administrador
1. **Login único** no Portal (uma senha/segredo; futuramente usuário+senha — a decidir).
2. **Home** abre com o **briefing do dia** narrado pela AHRI + 4–6 números que importam +
   **3 alertas acionáveis** (gargalo, cliente em risco, caso pronto).
3. Um clique leva ao **Pipeline**; cada card é um caso com **próxima ação clara** (Canon INV-07:
   sempre há próxima ação). Nada de "event stream" — linguagem de negócio.
4. **Qualificar / Vender / Atribuir** são **botões de ato** (registrados, auditáveis) — não
   formulários técnicos. Cada ação diz o que acontece com o cliente e o dinheiro.
5. **Financeiro** e **Indicadores** respondem "como estamos" sem planilha e sem inventar número.
6. **Conexão WhatsApp** e **Saúde** dão o pulso da operação com **semáforo**, sem Docker/logs.
7. **Assistente** para perguntas livres ("qual o gargalo?", "quantos prontos para vender?").
8. Tudo em **tempo real**, responsivo, com a **identidade da marca** (vermelho #D90416/grafite).

---

# PARTE IV — ARQUITETURA DO PORTAL ADMIN (proposta, a aprovar)

## Diretrizes
- **Descartar** a lente técnica; **manter** as APIs `/admin/*`, `/production/*`, `/lx/*` que já
  servem read models — o portal novo é uma **camada de negócio** por cima delas.
- **CQRS constitucional (DF-08):** o portal só lê **read models** via HTTP; nunca o Event Store,
  nunca o banco direto. Toda "decisão" (qualificar/vender/atribuir/encerrar) vira **evento**
  pelo backend existente.
- **Zero jargão técnico** na UI. Zero acesso externo (Supabase/Docker/Evolution/DB/logs).

## Camadas
```
[ Navegador ]  Portal Admin (Next) — UI de NEGÓCIO, identidade da marca
      │  (Server Actions, token server-side)
[ API Admin (/admin/*, /production/*, /lx/*) ] — read models + atos (eventos)
      │
[ AHRI / Mission Runtime / Event Store (append-only) / Read Models / Scheduler ]
      │
[ Postgres · Evolution · LLM ] — invisíveis ao administrador
```

## Mapa Módulo → API (reuso vs. a criar)
| Módulo do Portal | Já existe | A criar (evento/read model) |
|---|---|---|
| Home/CEO, Assistente | `/admin/founder/*`, `/admin/dashboard` | agregar funil + financeiro |
| Pipeline / Caso | `/admin/missions*`, `/admin/clients*` | projeção de **estágio comercial** (1→12) |
| Qualificação | documentos/perícia (`/admin/documents*`, `/admin/pericias`) | **evento "qualificar caso"** (ato humano) |
| Modelo A — Vendas | — | **eventos** ofertar/entregar/**vender**; read model de vendas |
| Modelo B — Sociedade | `/advogado-admin/assignments`, `/advogado/*`, encerrar/reabrir | read model de **processo** + **honorários** |
| Escritórios/Advogados | `staff` (parcial) | cadastro de **escritório parceiro** + financeiro |
| Financeiro | `/admin/finance` (declara ausência) | read models **receita A** e **honorários B** |
| Indicadores | `/admin/metrics/operacional` (B4.4) | KPIs comerciais (A/B) |
| Conexão WhatsApp | `/admin/whatsapp/*` | — (pronto) |
| Shadow/Qualidade | `/production/shadow/*` | — (pronto) |
| Saúde/Config | `/production/health|monitor|config` | semáforo de negócio |

## Lacunas que exigem Decisão do Fundador antes de qualquer código
1. **Ratificar Modelos A/B no Canon** (Governança V04) — hoje o Canon é silente/contrário à
   "venda"; sem DF, não há entidade canônica de venda/honorário.
2. **Entidades comerciais novas:** ESCRITÓRIO PARCEIRO, VENDA, HONORÁRIO/DISTRIBUIÇÃO,
   ESTÁGIO COMERCIAL — nenhuma existe no Canon (as 19 são operacionais). Precisam de DF +
   modelagem no padrão MISSÃO.
3. **Preço (R$400), % de participação (B), regras de qualificação** — confirmar valores.
4. **Definir "ALIR"** — termo citado sem lastro no projeto.
5. **Login do Portal:** senha única (atual) vs. usuário+senha por perfil (nova feature).

## Próximo passo (aguardando sua aprovação)
Aprovada esta arquitetura, a implementação seguirá o rito do Canon: **uma tela/um módulo por
vez**, cada um citando a entidade/DF que o origina, com read model + eventos no backend antes
da UI. Nenhuma tela será construída antes da sua aprovação desta arquitetura.
