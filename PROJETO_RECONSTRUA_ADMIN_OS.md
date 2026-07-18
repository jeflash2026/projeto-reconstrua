# PROJETO RECONSTRUA — ADMIN OS
### A Constituição do Sistema Operacional do Reconstrua

> **Este documento é a Constituição do Portal.** Ele descreve, por inteiro, a experiência
> do administrador. Critério de aceite: **ao terminar de ler, qualquer pessoa consegue
> administrar a empresa inteira usando apenas este sistema** — sem nunca abrir Docker,
> Supabase, Evolution, banco ou logs. Nenhuma tela será construída antes da aprovação
> deste documento. A implementação seguirá a **ordem de prioridade de negócio** (Parte VII).

---

## PRINCÍPIOS FUNDADORES (o que nunca muda)

1. **O negócio manda.** O Sistema Operacional (SO) existe para o CEO administrar a empresa.
   Quando o negócio diverge da arquitetura atual (Canon), o negócio prevalece e a arquitetura
   evolui para acompanhá-lo (via Governança).
2. **A tecnologia é invisível.** Docker, Supabase, Evolution, filas, tokens, webhooks, logs —
   **nada disso aparece** na rotina do administrador. Quando um fato técnico importa ao negócio,
   ele vira **linguagem de negócio + semáforo** (verde/atenção/parado).
3. **Dois modelos oficiais de receita.** **A — Venda** de cliente qualificado a escritório
   parceiro. **B — Sociedade** com escritório até o encerramento, com participação em honorários.
   Ambos são cidadãos de primeira classe do SO. **O cliente nunca paga.**
4. **A pessoa é sagrada.** Nunca é "lead" ou "mercadoria". O que se vende/associa é o **caso**
   (o trabalho jurídico), não a pessoa. O SO trata a pessoa com dignidade em toda tela.
5. **Verdade, não invenção.** O SO só mostra o que existe. O que ainda não foi capturado
   aparece como **"não disponível"** — nunca um número inventado.
6. **Toda decisão é um ato registrado.** Qualificar, vender, atribuir, encerrar, distribuir —
   cada um é um botão que produz um **evento auditável** (quem, quando, por quê). Nada some;
   histórico é perpétuo.
7. **Sempre há próxima ação.** Todo cliente/caso na tela mostra o que fazer a seguir e quem
   é o responsável. Nada fica órfão.

---

## PARTE I — ENTIDADES OFICIAIS DO SO (o vocabulário do negócio)

Estas entidades passam a ser **oficiais** e entrarão no Canon via Decisão do Fundador:

- **PESSOA** — o ser humano atendido (Canon). Sagrada; nunca lead/venda.
- **CLIENTE** — a condição contratual/comercial que a Pessoa assume perante o Reconstrua.
- **MISSÃO** — a jornada de reconstrução de um direito daquela pessoa (Canon). Estados:
  nascida → em evolução → (bloqueada) → **CONCLUÍDA/ENCERRADA** (terminais). Reabertura possível.
- **ALIR — DOSSIÊ INTELIGENTE DO CLIENTE** *(entidade oficial NOVA)*. É o **prontuário vivo
  e auditável** que consolida, num só lugar, tudo sobre o cliente e seus casos: identidade da
  pessoa, todas as missões, documentos, perícia, verdade do caso, histórico de conversas com a
  AHRI, estágio comercial (A/B), situação financeira e a **próxima ação**. O ALIR é o que o
  administrador abre para "conhecer o cliente por inteiro" e é a fonte das telas de Clientes.
  A AHRI mantém o ALIR atualizado automaticamente; o humano decide sobre ele.
- **DOCUMENTO** · **PERÍCIA** · **CASO** · **PROCESSO** — o material jurídico do caso (Canon).
- **ESCRITÓRIO PARCEIRO** *(entidade oficial NOVA)* — o comprador (A) / sócio (B): cadastro,
  contato, casos recebidos, financeiro por parceiro.
- **VENDA** *(entidade oficial NOVA)* — o ato de entregar um caso qualificado a um escritório
  por preço fixo (Modelo A). Registra caso, escritório, valor, data, recebimento.
- **SOCIEDADE / HONORÁRIO / DISTRIBUIÇÃO** *(entidades oficiais NOVAS)* — a parceria do
  Modelo B: processo em andamento, honorário apurado no encerramento, participação do Reconstrua.
- **EQUIPE** — OPERADOR, PERITO, ADVOGADO, SUPERVISOR, ADMINISTRADOR (Canon).
- **AHRI** — o motor cognitivo invisível que atende, organiza e acompanha (Canon).

---

## PARTE II — O CICLO DE VIDA DO CLIENTE (o funil que o SO governa)

```
1  Novo (chegou pelo WhatsApp)
2  Em triagem de fundamento
   └─ 3 Sem fundamento → Pessoa conhecida, sem missão (não é lead)
4  Aguardando documentos (bloqueado legítimo)
5  Documentos recebidos / em análise
6  Em perícia
7  QUALIFICADO  ← ponto de decisão A ou B
   ├─ MODELO A: 8A Ofertado → 9A Vendido (R$400) → Missão ENCERRADA
   └─ MODELO B: 8B Atribuído → 9B Em processo → 10B Acompanhamento →
                11B Encerrado (êxito/acordo/improcedência) → 12B Honorário distribuído
   (Reabertura por fato jurídico novo → volta ao eixo B)
```
Cada estágio tem: **próxima ação**, **responsável**, **tempo no estágio** e **alertas** (parado,
em risco de abandono, documento pendente há N dias). Este funil é a espinha dorsal do SO.

---

## PARTE III — OS 13 MÓDULOS DE NEGÓCIO

Para cada módulo: **Objetivo** (necessidade da empresa), **O administrador faz**, **Vê**,
**Telas**, **Ligação com A/B/ALIR**.

### 1. DASHBOARD EXECUTIVO *(a home do CEO)*
- **Objetivo:** em 10 segundos, o CEO sabe como a empresa está hoje.
- **Vê (só negócio):** Receita **prevista** · Receita **realizada** · Clientes **em
  qualificação** · Clientes **prontos para venda** · Clientes **em sociedade** · **Valor
  estimado da carteira** · **Honorários futuros** · **Casos parados** · **Escritórios
  parceiros** · **Conversão por origem** · **Documentos pendentes** · **Gargalos
  operacionais** · **Missões bloqueadas da AHRI**.
- **Faz:** clica em qualquer número e cai na lista acionável por trás dele; lê o **briefing do
  dia** narrado pela AHRI (o que mudou desde ontem) e os **3 alertas** que exigem decisão.
- **NUNCA mostra:** uptime, tokens, webhook, container, fila técnica.
- **Telas:** Home (cartões + briefing + alertas) → drill-down em cada indicador.

### 2. OPERAÇÃO *(o pipeline vivo)*
- **Objetivo:** mover cada cliente pelo funil (Parte II) sem nada travar.
- **Vê:** Kanban por estágio (1→12) com contadores; cada card = um cliente com próxima ação,
  responsável, tempo no estágio e alerta.
- **Faz:** abre o card → age (pedir documento, mandar para perícia, qualificar, encaminhar A/B);
  reengaja clientes em silêncio; destrava bloqueios.
- **Telas:** Pipeline (Kanban) → Card do Caso (mini-ALIR + ações).

### 3. CLIENTES *(o ALIR)*
- **Objetivo:** conhecer e conduzir o cliente por inteiro.
- **Vê:** busca de clientes → **ALIR completo**: pessoa (dados, dignidade), todas as missões e
  estágios, documentos, perícia, verdade do caso, **linha do tempo humana** (não "event
  stream": "documentos recebidos", "em análise", "avisado"), histórico da AHRI, situação
  financeira, próxima ação.
- **Faz:** tudo que muda o rumo do cliente (mesmas ações do funil), com registro auditável.
- **Telas:** Lista de Clientes → **ALIR** (perfil 360°) → Ações.

### 4. ESCRITÓRIOS PARCEIROS
- **Objetivo:** gerir quem compra (A) e quem faz sociedade (B).
- **Vê:** lista de escritórios, contato, casos recebidos, situação financeira por parceiro,
  desempenho (quantos casos, quanto pagou/deve, honorários gerados).
- **Faz:** cadastrar/editar parceiro; definir se compra (A), faz sociedade (B) ou ambos;
  registrar acordos comerciais.
- **Telas:** Lista de Escritórios → Ficha do Parceiro (dados + casos + financeiro).

### 5. MODELO A — VENDA
- **Objetivo:** transformar caso qualificado em **receita imediata** (R$400/CPF).
- **Vê:** fila de **qualificados prontos para venda**; ofertas em aberto; vendas do mês;
  receita A realizada.
- **Faz:** empacotar o caso → **ofertar/entregar** a um escritório → **confirmar venda** →
  registrar **recebimento** → a missão é **encerrada como entregue**.
- **Telas:** Fila de Venda → Empacotar Caso → Confirmar Venda → Recibo.
- **ALIR:** a venda usa o ALIR como "pacote" entregue ao escritório.

### 6. MODELO B — SOCIEDADE
- **Objetivo:** transformar caso qualificado em **receita futura recorrente** (honorários).
- **Vê:** casos em sociedade por escritório/advogado; processos em andamento; encerramentos;
  honorários a apurar/distribuir.
- **Faz:** **atribuir** o caso a um advogado parceiro → acompanhar o **processo** (número,
  protocolo, movimentações) → a AHRI mantém o cliente informado → **encerrar** (êxito/acordo/
  improcedência) → **apurar honorário** → **distribuir** a participação do Reconstrua. Suporta
  **reabertura** por fato jurídico novo.
- **Telas:** Casos em Sociedade → Atribuir Advogado → Painel do Processo → Encerrar → Apurar
  Honorário → Distribuir.

### 7. FINANCEIRO
- **Objetivo:** o dinheiro da empresa num só lugar, sem planilha.
- **Vê:** Receita A (nº × preço) · Honorários B (a apurar / a receber / recebido / distribuído)
  · **valor estimado da carteira** (soma dos casos em sociedade × expectativa) · receita
  prevista × realizada · por escritório, por mês, por modelo.
- **Faz:** registrar recebimentos, confirmar distribuições, acompanhar inadimplência de parceiro.
- **Telas:** Visão Financeira → por Modelo (A/B) → por Escritório → Recebimentos/Distribuições.
- **Honestidade:** o que o sistema ainda não captura aparece como "não disponível".

### 8. JURÍDICO
- **Objetivo:** a saúde jurídica dos casos e o trabalho dos advogados/peritos.
- **Vê:** processos em andamento, prazos, movimentações, perícias; casos por advogado; plantão.
- **Faz:** acompanhar prazos e andamentos; ver o retorno do advogado que a AHRI comunica ao
  cliente; garantir que nenhum caso jurídico esteja sem responsável.
- **Telas:** Painel Jurídico → Processo → Perícias → Plantão do Advogado.

### 9. DOCUMENTOS
- **Objetivo:** nada trava por falta de documento.
- **Vê:** documentos pendentes por cliente (há quantos dias), recebidos, reconhecidos; conteúdo
  do documento acessível à equipe.
- **Faz:** cobrar documento (a AHRI executa), conferir, marcar como suficiente para qualificar.
- **Telas:** Documentos Pendentes → Documento (visualização + status) → Fila de Perícia.

### 10. AHRI
- **Objetivo:** enxergar e confiar no atendimento automático — **sem falar em IA/tokens**.
- **Vê:** quantos clientes a AHRI está acompanhando; **missões bloqueadas** (o que a AHRI não
  consegue resolver sozinha e precisa de humano); qualidade das conversas (clientes confusos/
  irritados/escalados — do Shadow, em linguagem de negócio); follow-ups pendentes/enviados.
- **Faz:** intervir onde a AHRI escalou; ajustar o tom/mensagens padrão; ver o **status da
  Conexão WhatsApp** (online, número oficial) — e **conectar/reconectar** o WhatsApp por aqui,
  sem abrir a Evolution.
- **Telas:** Painel da AHRI → Missões Bloqueadas → Qualidade das Conversas → **Conexão WhatsApp**.

### 11. EQUIPE
- **Objetivo:** as pessoas certas nos lugares certos, sem sobrecarga.
- **Vê:** operadores, peritos, advogados, supervisores; carga de cada um; produtividade.
- **Faz:** cadastrar/ativar/desativar; distribuir trabalho; ver quem está sobrecarregado.
- **Telas:** Equipe → Ficha do Colaborador (papel + carga + produtividade).

### 12. RELATÓRIOS
- **Objetivo:** decidir com dados ao longo do tempo (semana/mês).
- **Vê:** funil e conversões por período; receita A/B por mês; tempo médio por estágio;
  conversão por origem/campanha; desempenho por escritório e por colaborador.
- **Faz:** filtrar por período/origem/modelo; exportar; comparar meses.
- **Telas:** Relatórios (funil, financeiro, origem, equipe, escritórios).

### 13. CONFIGURAÇÕES
- **Objetivo:** controlar o SO sem terminal.
- **Vê/Faz:** acessos e senhas (perfis do time), preço da Venda (A) e % de participação (B),
  parâmetros de acompanhamento (cadência/limite), identidade/dados institucionais (OAB, CNPJ),
  **saúde do sistema** em semáforo (verde/atenção/parado) e a **Conexão WhatsApp**. Nada de
  Docker/logs — se algo técnico está ruim, aparece como "atenção" com uma ação sugerida.
- **Telas:** Configurações → Acessos & Perfis → Comercial (preço/%) → Acompanhamento → Sistema.

---

## PARTE IV — A EXPERIÊNCIA COMPLETA DO ADMINISTRADOR (um dia no SO)

1. **Entra** no SO com seu acesso (uma senha; evoluível para usuário+senha por perfil).
2. **Home (Dashboard Executivo):** lê o **briefing do dia** ("Ontem: 12 novos, 3 qualificados,
   1 venda de R$400, 2 casos parados") + os números de negócio + **3 alertas acionáveis**.
3. Vê **"5 prontos para venda"** → entra no **Modelo A** → oferta ao escritório parceiro →
   confirma a venda → recebe. *(receita imediata)*
4. Vê **"2 casos parados"** → **Operação** → destrava (cobra documento / manda para perícia).
5. Vê **"caso qualificado grande"** → decide **Modelo B** → **atribui** ao advogado parceiro →
   acompanha o processo; a AHRI mantém o cliente informado. *(receita futura)*
6. Abre um **cliente** → o **ALIR** mostra tudo; ele age com contexto total.
7. Confere o **Financeiro** ("quanto entrou hoje, quanto vou receber de honorários").
8. Olha a **AHRI** → vê **missões bloqueadas** e resolve; confirma que o **WhatsApp está
   online** com o número oficial.
9. Fecha o dia com **Relatórios** ("a semana está melhor que a passada?").

**Em nenhum momento** ele abre Docker, Supabase, Evolution, banco ou logs. Tudo o que precisa
para **administrar a empresa inteira** está no SO, em linguagem de negócio.

---

## PARTE V — COMO A TECNOLOGIA DESAPARECE (mapa de abstração)

| Realidade técnica (hoje) | Como o admin vê no SO |
|---|---|
| Container/Docker/uptime | **Saúde do sistema:** verde / atenção / parado |
| Evolution / instância / webhook | **Conexão WhatsApp:** online, número oficial, "reconectar" |
| LLM / tokens / latência | *(oculto)* — só aparece como "qualidade das conversas" se afetar o cliente |
| Event Store / read models / filas | **Linha do tempo humana** e **contadores de negócio** |
| Logs / erros | **Alertas de atenção** com ação sugerida (nunca stack trace) |
| `.env` / segredos | **Configurações → Acessos** (senha do time, sem terminal) |
| Missão bloqueada (INV-07) | card **"Casos parados / Missões bloqueadas"** com responsável e próxima ação |

---

## PARTE VI — GOVERNANÇA (o que evolui no Canon)

Como o negócio prevalece, estas mudanças entram no Canon por **Decisão do Fundador** (a
arquitetura acompanha o negócio, não o contrário):
1. **ALIR** — formalizado como entidade oficial (dossiê inteligente do cliente).
2. **Modelos A e B** — oficiais (não exceção); reconhecidos como pilares de receita.
3. **Entidades comerciais** — ESCRITÓRIO PARCEIRO, VENDA, SOCIEDADE/HONORÁRIO/DISTRIBUIÇÃO,
   ESTÁGIO COMERCIAL.
4. **Parâmetros** — preço da Venda (R$400 a confirmar), % de participação (B), regra de
   qualificação (3 docs + perícia).

*(Estas entram no Canon como evolução — não como violação. O Canon serve o negócio.)*

---

## PARTE VII — ORDEM DE IMPLEMENTAÇÃO (por prioridade de NEGÓCIO)

O critério é **chegar à receita** e sustentar a operação — nunca facilidade técnica. Cada
onda entrega valor de negócio verificável.

- **ONDA 1 — Ver e mover o cliente (gera casos qualificáveis).**
  Módulos: **Clientes/ALIR** + **Operação (Pipeline)** + **Documentos** + **Jurídico/Perícia**.
  Resultado: capturar → conduzir → **qualificar** (MARCO 1: 1º CPF qualificado).
- **ONDA 2 — Primeira receita (Modelo A).**
  Módulos: **Escritórios Parceiros** + **Modelo A (Venda)**.
  Resultado: vender o 1º caso qualificado (MARCO 3: 1ª venda / R$400).
- **ONDA 3 — Receita recorrente (Modelo B).**
  Módulos: **Modelo B (Sociedade)** + **Financeiro** (honorários/distribuição).
  Resultado: 1ª atribuição, 1º processo, 1º honorário (MARCOS 2 e 4).
- **ONDA 4 — Visão executiva.**
  Módulos: **Dashboard Executivo** + **Relatórios** (consolidam os dados das ondas 1–3).
  Resultado: o CEO governa por indicadores (MARCO 5: operação recorrente).
- **ONDA 5 — Sustentação.**
  Módulos: **AHRI** (missões bloqueadas + Conexão WhatsApp já pronta) + **Equipe** +
  **Configurações**.

> O **Dashboard** aparece cedo como esqueleto e **cresce** conforme as ondas alimentam seus
> números — mas seu valor pleno depende dos dados das ondas 1–3, por isso consolida na Onda 4.

---

## CRITÉRIO DE APROVAÇÃO DESTE DOCUMENTO
Aprove se, ao ler, você consegue responder **sim** a: *"Com este portal, e só com ele, eu
consigo administrar o Reconstrua inteiro — ver o dinheiro, mover cada cliente, vender (A),
fazer sociedade (B), acompanhar o jurídico, gerir a equipe e a AHRI, tudo sem abrir nada
técnico?"* Se **sim**, autorizo a **Onda 1**. Se **não**, aponte o que falta e eu reviso antes
de qualquer tela.
