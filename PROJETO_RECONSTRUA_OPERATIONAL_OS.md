# PROJETO RECONSTRUA — OPERATIONAL OS

### O mapa de TODAS as operações da empresa (a etapa mais importante)

> **Não descreve telas nem módulos. Descreve a EMPRESA funcionando.** As telas virão
> depois, e serão apenas **representações das operações** — nunca o contrário. Pergunta que
> este documento responde por inteiro: _"O que acontece do momento em que um cliente chega
> até o momento em que todo o ciclo financeiro termina?"_ Nenhuma linha de código antes da
> sua aprovação deste mapa.

---

## LEIS DO SISTEMA OPERACIONAL

**Lei das 3 Perguntas.** Nenhuma funcionalidade existe sem responder:

1. **Qual operação da empresa ela representa?**
2. **Qual decisão ela permite tomar?**
3. **Qual valor financeiro ela gera ou protege?**
   Se não responder às três, **não pertence ao SO**.

**Lei do ALIR (Sistema Solar).** O **ALIR é a identidade operacional do cliente**. Tudo o que
existe sobre um cliente **nasce dentro do ALIR** — pessoa, documentos, conversas, missões,
perícia, situação jurídica, situação comercial, financeiro, portal, timeline, AHRI e a
**próxima ação**. Todo o resto **orbita o ALIR**. Nenhum dado de cliente vive fora dele.

**Lei da Navegação por Contexto.** Não há módulos independentes. Estando dentro de um cliente
(ALIR), o administrador acessa documentos, conversas, financeiro, missões, perícia, histórico,
portal, processo, escritório e distribuição **sem trocar de tela** — tudo contextualizado.

**Lei do Dashboard-Resposta.** O dashboard **responde perguntas** ("o que precisa da minha
atenção hoje?", "quanto entra este mês?", "qual advogado está parado?"), não exibe painéis de
números soltos.

**Lei da Tecnologia Invisível.** Docker, Supabase, Evolution, banco, logs, tokens — **nunca**
na rotina do admin. Fato técnico relevante vira **operação + semáforo**.

---

## PARTE I — CATÁLOGO DE OPERAÇÕES

Formato de cada operação: **Inicia · Entra · Validações · Decisões da AHRI · Decisões humanas
· Documentos possíveis · Estados possíveis · Termina quando · Próxima operação · Valor
financeiro (Lei 3) · Modelo**.

### BLOCO 0 — CAPTAÇÃO → QUALIFICAÇÃO _(compartilhado A e B)_

**OP‑01 · Receber novo cliente**

- Inicia: a **Pessoa** (mensagem no WhatsApp) · a **AHRI** recebe.
- Entra: primeira mensagem, número, origem/campanha (UTM), texto.
- Validações: número válido; não é `fromMe`; deduplicação por mensagem; identidade da pessoa (nova ou já conhecida).
- Decisões da AHRI: acolher (saudar), abrir contexto, iniciar percepção; se matéria humana, escalar.
- Decisões humanas: nenhuma (automático).
- Documentos: — (ainda não).
- Estados: **Novo**.
- Termina quando: a AHRI acolhe e o **ALIR do cliente é criado/atualizado**.
- Próxima operação: OP‑02 (AHRI).
- Valor: protege receita futura (todo caso nasce aqui) · **Compartilhada**.

**OP‑02 · Triagem de fundamento jurídico**

- Inicia: AHRI (a partir da conversa).
- Entra: relato da situação, tipo de direito alegado.
- Validações: existe **fundamento jurídico** para atuar? (DF‑01).
- Decisões da AHRI: identificar tipo de direito; pedir dados mínimos; sinalizar se é matéria humana.
- Decisões humanas: operador confirma/afasta fundamento quando a AHRI escala.
- Documentos: pode pedir identificação inicial.
- Estados: **Em triagem** → **Sem fundamento** (pessoa conhecida, sem missão) **ou** segue.
- Termina quando: fundamento confirmado (segue) ou afastado (encerra triagem, sem missão).
- Próxima operação: OP‑03 (se com fundamento) · Operador (se dúvida).
- Valor: protege receita (evita gastar esforço em caso sem direito) · **Compartilhada**.

**OP‑03 · Nascer a missão (abrir o caso no ALIR)**

- Inicia: AHRI (por decisão do Brain — OnboardClient).
- Entra: pessoa + direito identificado.
- Validações: 1 pessoa → 1 missão por direito (unicidade); missão pertence a exatamente uma pessoa.
- Decisões da AHRI: criar missão, verdade/estado/etapa iniciais.
- Decisões humanas: nenhuma.
- Documentos: —.
- Estados: **Nascida → Em evolução**.
- Termina quando: a missão existe no ALIR com dono operacional e próxima ação.
- Próxima operação: OP‑04 (AHRI).
- Valor: cria o ativo que será vendido (A) ou associado (B) · **Compartilhada**.

**OP‑04 · Solicitar documentos**

- Inicia: AHRI (por regra) ou operador.
- Entra: lista de documentos exigidos pelo tipo de direito.
- Validações: quais faltam para qualificar (identidade + comprovante + HISCON/equivalente).
- Decisões da AHRI: pedir os documentos certos, no tom certo; agendar cobrança.
- Decisões humanas: operador pode pedir documento adicional específico.
- Documentos: **RG/CNH, comprovante, HISCON/extrato, contrato, procuração** (conforme direito).
- Estados: **Aguardando documentos (bloqueada legítima)**.
- Termina quando: o pedido foi feito e registrado.
- Próxima operação: OP‑05 (cliente entrega) · OP‑T2 (reengajar se silêncio).
- Valor: destrava a qualificação (sem documento não há produto) · **Compartilhada**.

**OP‑05 · Receber documentos**

- Inicia: a Pessoa (envia foto/arquivo) · AHRI capta.
- Entra: mídia (imagem/PDF), legenda.
- Validações: tipo/mime; captura do conteúdo real (evidência, não só aviso).
- Decisões da AHRI: reconhecer o documento (R3), vincular ao caso, confirmar recebimento.
- Decisões humanas: nenhuma no recebimento.
- Documentos: os enviados.
- Estados: **Documentos recebidos / em análise**.
- Termina quando: documento reconhecido e vinculado ao ALIR.
- Próxima operação: OP‑06 (AHRI) · OP‑04 (se ainda faltam).
- Valor: insumo direto do produto · **Compartilhada**.

**OP‑06 · Ler e conferir documentos**

- Inicia: AHRI (leitura) + operador/perito (conferência).
- Entra: conteúdo do documento.
- Validações: legibilidade, completude, coerência com o caso.
- Decisões da AHRI: extrair dados, organizar, sinalizar pendências.
- Decisões humanas: operador confere se os 3 documentos são suficientes.
- Documentos: os recebidos.
- Estados: **Em análise** → **Pronto para perícia** ou **Falta documento**.
- Termina quando: conjunto suficiente confirmado.
- Próxima operação: OP‑07 · OP‑04 (se falta).
- Valor: garante que o produto será qualificável · **Compartilhada**.

**OP‑07 · Encaminhar para perícia**

- Inicia: operador/AHRI.
- Entra: caso com documentos suficientes.
- Validações: documentos mínimos presentes.
- Decisões da AHRI: abrir handoff para o **perito**.
- Decisões humanas: operador confirma o envio à perícia.
- Documentos: HISCON/extrato + contrato.
- Estados: **Na fila de perícia**.
- Termina quando: o caso entra na fila do perito.
- Próxima operação: OP‑08 (perito).
- Valor: passo obrigatório para qualificar · **Compartilhada**.

**OP‑08 · Realizar perícia**

- Inicia: **Perito**.
- Entra: documentos + caso.
- Validações: existe irregularidade/direito recuperável? (análise técnica).
- Decisões da AHRI: nenhuma (ato humano); registra o resultado.
- Decisões humanas: **perito** conclui laudo (confirma ou afasta o direito).
- Documentos: laudo/parecer.
- Estados: **Em perícia** → **Direito confirmado** ou **Direito afastado**.
- Termina quando: laudo concluído.
- Próxima operação: OP‑09 (se confirmado) · Encerrar sem direito (se afastado).
- Valor: define se há produto vendável · **Compartilhada**.

**OP‑09 · Qualificar o caso** _(ato humano central)_

- Inicia: operador/advogado (com base no laudo).
- Entra: 3 documentos legíveis + perícia com direito confirmado.
- Validações: critério de qualificação atendido.
- Decisões da AHRI: nenhuma (ato humano); registra o evento "qualificado".
- Decisões humanas: **declarar o caso QUALIFICADO**.
- Documentos: laudo + os 3 documentos.
- Estados: **Qualificado**.
- Termina quando: o caso é marcado como qualificado (evento auditável).
- Próxima operação: OP‑10 (CEO/operador).
- Valor: **cria o produto** (o ativo que gera R$400 em A ou honorário em B) · **Compartilhada**.

**OP‑10 · Decidir a rota (Modelo A ou B)**

- Inicia: **CEO/administrador**.
- Entra: caso qualificado + contexto comercial (valor potencial, escritório disponível).
- Validações: caso realmente qualificado; existe destino (comprador A / sócio B).
- Decisões da AHRI: nenhuma (decisão de negócio).
- Decisões humanas: **vender (A)** ou **fazer sociedade (B)**.
- Documentos: —.
- Estados: **Roteado para A** ou **Roteado para B**.
- Termina quando: a rota é escolhida.
- Próxima operação: OP‑A1 (A) ou OP‑B1 (B).
- Valor: **decide a forma de monetização** (imediata vs. recorrente) · **Compartilhada / ponto de bifurcação**.

### BLOCO A — MODELO A · VENDA

**OP‑A1 · Empacotar o caso (ALIR‑pacote)**

- Inicia: operador/CEO.
- Entra: ALIR do cliente (documentos, laudo, verdade do caso).
- Validações: pacote completo e legível.
- Decisões da AHRI: montar o resumo do caso a partir do ALIR.
- Decisões humanas: revisar o pacote antes de ofertar.
- Documentos: dossiê (ALIR) exportável.
- Estados: **Pronto para venda**.
- Termina quando: pacote pronto.
- Próxima operação: OP‑A2.
- Valor: prepara a entrega que gera R$400 · **Modelo A**.

**OP‑A2 · Ofertar ao escritório parceiro**

- Inicia: CEO/comercial.
- Entra: pacote + escritório escolhido + preço.
- Validações: escritório ativo; preço definido.
- Decisões da AHRI: nenhuma.
- Decisões humanas: escolher o escritório e ofertar.
- Documentos: pacote (sem dados sensíveis além do necessário — LGPD).
- Estados: **Ofertado** (aguardando aceite).
- Termina quando: oferta enviada e registrada.
- Próxima operação: OP‑A3.
- Valor: inicia a venda · **Modelo A**.

**OP‑A3 · Confirmar a venda**

- Inicia: CEO/comercial (após aceite do escritório).
- Entra: aceite, preço final (R$400), condições.
- Validações: aceite registrado; preço confirmado.
- Decisões da AHRI: nenhuma.
- Decisões humanas: **confirmar a venda** (evento auditável).
- Documentos: comprovante/contrato de cessão (se houver).
- Estados: **Vendido (a receber)**.
- Termina quando: venda registrada.
- Próxima operação: OP‑A4.
- Valor: **gera a receita A** · **Modelo A**.

**OP‑A4 · Receber o pagamento**

- Inicia: financeiro/CEO.
- Entra: pagamento do escritório.
- Validações: conciliação (valor, data, escritório).
- Decisões da AHRI: nenhuma.
- Decisões humanas: **registrar recebimento**; cobrar se atrasar (OP‑T12).
- Documentos: comprovante de pagamento/NF.
- Estados: **Recebido** (ou **Inadimplente**).
- Termina quando: pagamento conciliado.
- Próxima operação: OP‑A5.
- Valor: **realiza a receita A** · **Modelo A**.

**OP‑A5 · Encerrar a missão (entregue)**

- Inicia: operador/AHRI.
- Entra: venda concluída.
- Validações: caso entregue e pago.
- Decisões da AHRI: nenhuma (registra encerramento).
- Decisões humanas: **encerrar a missão** com motivo "vendida/entregue" (DF‑11).
- Documentos: —.
- Estados: **ENCERRADA** (terminal, histórico perpétuo).
- Termina quando: missão encerrada.
- Próxima operação: — (ciclo A concluído) · pós‑venda opcional.
- Valor: fecha o ciclo financeiro de A · **Modelo A**.

### BLOCO B — MODELO B · SOCIEDADE

**OP‑B1 · Atribuir o caso ao advogado parceiro**

- Inicia: **CEO/administrador**.
- Entra: caso qualificado + advogado/escritório parceiro.
- Validações: advogado ativo; caso qualificado; isolamento por atribuição.
- Decisões da AHRI: nenhuma; passa a rotear o caso ao advogado.
- Decisões humanas: **atribuir** (evento auditável).
- Documentos: procuração, dossiê (ALIR).
- Estados: **Atribuído**.
- Termina quando: atribuição registrada; caso aparece isolado ao advogado.
- Próxima operação: OP‑B2 (advogado).
- Valor: inicia a receita futura (honorários) · **Modelo B**.

**OP‑B2 · Registrar andamento do processo**

- Inicia: **Advogado parceiro**.
- Entra: número do processo, protocolo, despacho, movimentação, prazo.
- Validações: pertence ao advogado atribuído (isolamento).
- Decisões da AHRI: avaliar se a atividade é comunicável ao cliente.
- Decisões humanas: advogado registra o que fez.
- Documentos: peças, protocolos, decisões.
- Estados: **Em processo (andamento)**.
- Termina quando: cada atividade é registrada (operação recorrente).
- Próxima operação: OP‑B3 (ponte AHRI).
- Valor: mantém o ativo vivo até o honorário · **Modelo B**.

**OP‑B3 · Retorno do advogado → AHRI**

- Inicia: Advogado (ao registrar atividade cliente‑facing).
- Entra: atividade (despacho/movimentação/conclusão).
- Validações: é matéria a comunicar? (regra RO‑3B).
- Decisões da AHRI: decidir se comunica o cliente e como (ou silêncio se interno).
- Decisões humanas: advogado escolhe o tipo de atividade.
- Documentos: —.
- Estados: **Atualização pendente de comunicação**.
- Termina quando: a AHRI decide comunicar ou silenciar.
- Próxima operação: OP‑B4 (AHRI, se comunicar).
- Valor: protege a relação com o cliente (retenção) · **Modelo B**.

**OP‑B4 · AHRI comunica o cliente**

- Inicia: AHRI.
- Entra: intenção de comunicação (da OP‑B3).
- Validações: caso não encerrado; tom humano; anti‑repetição.
- Decisões da AHRI: frasear e enviar a atualização ao cliente.
- Decisões humanas: nenhuma.
- Documentos: —.
- Estados: **Cliente atualizado**.
- Termina quando: mensagem entregue.
- Próxima operação: OP‑B5 (acompanhamento) · OP‑B2 (novas atividades).
- Valor: retém o cliente até o encerramento (protege honorário) · **Modelo B**.

**OP‑B5 · Acompanhamento recorrente do cliente**

- Inicia: AHRI (agenda/recorrência).
- Entra: tempo desde o último contato.
- Validações: caso ativo; teto anti‑spam; respeita encerrado.
- Decisões da AHRI: reengajar na cadência certa (RO‑4C) ou parar se encerrado.
- Decisões humanas: nenhuma.
- Documentos: —.
- Estados: **Em acompanhamento**.
- Termina quando: cliente responde, novo marco ocorre, ou teto atingido.
- Próxima operação: OP‑B2/OP‑B6 conforme o caso.
- Valor: evita abandono (protege honorário futuro) · **Modelo B**.

**OP‑B6 · Encerrar o processo**

- Inicia: Advogado/CEO.
- Entra: desfecho (êxito, acordo, improcedência).
- Validações: desfecho registrado; motivo.
- Decisões da AHRI: parar acompanhamento (STOP‑CONCLUDED).
- Decisões humanas: **encerrar** com motivo (DF‑11).
- Documentos: sentença/acordo.
- Estados: **CONCLUÍDA / ENCERRADA** (terminal).
- Termina quando: encerramento registrado.
- Próxima operação: OP‑B7 (se houver honorário) · OP‑B9 (se reabrir depois).
- Valor: dispara a apuração financeira · **Modelo B**.

**OP‑B7 · Apurar o honorário**

- Inicia: financeiro/CEO.
- Entra: valor do êxito/acordo, contrato de honorários.
- Validações: base de cálculo, % combinado.
- Decisões da AHRI: nenhuma.
- Decisões humanas: **calcular o honorário e a participação do Reconstrua**.
- Documentos: contrato de honorários, comprovante do êxito.
- Estados: **Honorário apurado (a distribuir)**.
- Termina quando: valores definidos.
- Próxima operação: OP‑B8.
- Valor: **quantifica a receita B** · **Modelo B**.

**OP‑B8 · Distribuir a participação financeira**

- Inicia: financeiro/CEO.
- Entra: honorário apurado, participação do Reconstrua, escritório.
- Validações: conciliação; recebimento do escritório.
- Decisões da AHRI: nenhuma.
- Decisões humanas: **registrar a distribuição** (recebido do parceiro).
- Documentos: comprovante/repasse, NF.
- Estados: **Distribuído (recebido)** ou **A receber/Inadimplente**.
- Termina quando: participação recebida e registrada.
- Próxima operação: — (ciclo B concluído).
- Valor: **realiza a receita B** · **Modelo B**.

**OP‑B9 · Reabrir o caso (fato jurídico novo)**

- Inicia: CEO/advogado.
- Entra: fato jurídico legítimo.
- Validações: caso encerrado; fato legítimo.
- Decisões da AHRI: retomar acompanhamento após reabertura.
- Decisões humanas: **reabrir** (evento append‑only).
- Documentos: fundamento do novo fato.
- Estados: **Reaberto → Em processo**.
- Termina quando: reabertura registrada.
- Próxima operação: OP‑B2 (volta ao eixo B).
- Valor: recupera receita de casos que voltam · **Modelo B**.

### BLOCO T — OPERAÇÕES TRANSVERSAIS _(compartilhadas / contínuas)_

**OP‑T1 · Manter o ALIR atualizado** — Inicia: AHRI (contínuo) · Entra: todo evento do cliente · Termina: nunca (vive) · Valor: base de toda decisão · **Compartilhada**.
**OP‑T2 · Reengajar cliente em silêncio** — Inicia: AHRI (scheduler) · Decisão AHRI: cadência/limite · Estados: Em risco/Reengajado · Valor: protege conversão e honorário · **Compartilhada**.
**OP‑T3 · Destravar missão bloqueada** — Inicia: operador · Entra: impedimento registrado (Art. 9º) · Humano: providenciar o que desbloqueia · Valor: destrava receita parada · **Compartilhada**.
**OP‑T4 · Escalar para humano (handoff)** — Inicia: AHRI (matéria humana/canon silente) · Decisão AHRI: escalar ao papel certo · Humano: assumir · Valor: evita erro jurídico e perda de caso · **Compartilhada**.
**OP‑T5 · Conectar/reconectar o WhatsApp** — Inicia: CEO/Founder · Entra: instância + QR · Validações: ownerJid = número oficial · Humano: ler QR, confirmar, aplicar · Valor: sem isto não há operação · **Compartilhada**.
**OP‑T6 · Cadastrar/gerir escritório parceiro** — Inicia: CEO · Entra: dados, modelo (A/B), acordo · Valor: define para quem vender/associar · **Compartilhada**.
**OP‑T7 · Gerir equipe** — Inicia: CEO/supervisor · Entra: papéis, carga · Valor: capacidade de qualificar/conduzir · **Compartilhada**.
**OP‑T8 · Auditar qualidade (conversas/AHRI)** — Inicia: CEO (Shadow) · Entra: turnos, detecções · Valor: protege reputação e retenção · **Compartilhada**.
**OP‑T9 · Monitorar saúde do sistema** — Inicia: SO · Entra: semáforo · Humano: agir em "atenção/parado" · Valor: protege toda a operação · **Compartilhada**.
**OP‑T10 · Governar por perguntas (Dashboard/Relatórios)** — Inicia: CEO · Entra: dados de todas as operações · Valor: decisões diárias e de período · **Compartilhada**.
**OP‑T11 · Gerir acessos/perfis** — Inicia: CEO · Entra: usuários, papéis, senhas · Valor: segurança e responsabilidade · **Compartilhada**.
**OP‑T12 · Cobrança de parceiro / conciliação financeira** — Inicia: financeiro · Entra: vendas/honorários a receber · Humano: cobrar, conciliar · Valor: **realiza a receita (A e B)** · **Compartilhada**.

---

## PARTE II — CLASSIFICAÇÃO DAS OPERAÇÕES

| Compartilhadas (entrada + transversais)                 | Modelo A (Venda)                  | Modelo B (Sociedade) |
| ------------------------------------------------------- | --------------------------------- | -------------------- |
| OP‑01…OP‑10 (captação→qualificação→rota) + OP‑T1…OP‑T12 | OP‑A1, OP‑A2, OP‑A3, OP‑A4, OP‑A5 | OP‑B1…OP‑B9          |

- **Ponto de bifurcação:** OP‑10 (decidir rota).
- **Ciclo financeiro A:** OP‑A3 (gera) → OP‑A4 (realiza).
- **Ciclo financeiro B:** OP‑B7 (quantifica) → OP‑B8 (realiza).
- **Realização de caixa (ambos):** OP‑T12 (conciliação/cobrança).

---

## PARTE III — MAPA OPERACIONAL DO PROJETO RECONSTRUA

```
                         ┌──────────────── O ALIR (identidade operacional) ────────────────┐
                         │  Pessoa · Documentos · Conversas · Missões · Perícia · Jurídico  │
                         │  Comercial · Financeiro · Portal · Timeline · AHRI · Próxima ação │
                         └────────────────────────────────────────────────────────────────┘
                                                   ▲  (tudo orbita e nasce aqui)
CLIENTE CHEGA                                       │
   │                                                │
OP‑01 Receber → OP‑02 Triagem →(sem fundamento: pessoa sem missão)
   │                    └─(com fundamento)→ OP‑03 Nascer missão → OP‑04 Solicitar docs
   │                                                                     │
OP‑05 Receber docs → OP‑06 Conferir → OP‑07 Perícia → OP‑08 Perito → OP‑09 QUALIFICAR
                                                                            │
                                                                    OP‑10 DECIDIR ROTA
                                              ┌──────────────────────────────┴───────────────────────────┐
                                        MODELO A (venda)                                        MODELO B (sociedade)
                                A1 Empacotar → A2 Ofertar → A3 Vender               B1 Atribuir → B2 Andamento ⇄ B3 Retorno →
                                → A4 Receber (R$400) → A5 Encerrar                   B4 AHRI comunica ⇄ B5 Acompanhar →
                                        │                                            B6 Encerrar → B7 Apurar → B8 Distribuir
                                        └──────── receita imediata                            │            │  (B9 Reabrir ↺)
                                                                                     receita futura ── realiza caixa
   TRANSVERSAIS o tempo todo: T1 manter ALIR · T2 reengajar · T3 destravar · T4 escalar ·
   T5 WhatsApp · T6 escritórios · T7 equipe · T8 qualidade · T9 saúde · T10 governar · T11 acessos · T12 conciliar
```

**Leitura do mapa:** todo cliente entra por OP‑01 e caminha até um dos dois ciclos financeiros
(A ou B). O **ALIR** é o centro — cada operação lê e escreve nele. As **transversais** sustentam
o organismo continuamente. A empresa "funciona" quando esse fluxo roda sozinho, com humanos
apenas nos **atos de decisão** (qualificar, rotear, vender, atribuir, encerrar, distribuir).

---

## PARTE IV — DAS OPERAÇÕES ÀS TELAS (a inversão obrigatória)

As telas serão **projeções das operações**, com **navegação por contexto** a partir do ALIR:

- Dentro de um cliente (ALIR), sem trocar de tela: documentos (OP‑04..06), conversas (OP‑01/T1),
  financeiro (OP‑A4/B7/B8), missões (OP‑03), perícia (OP‑08), histórico (timeline), portal,
  processo (OP‑B2), escritório (OP‑T6), distribuição (OP‑B8) — **tudo contextualizado**.
- O **Dashboard responde perguntas**, e cada resposta é a **lista das operações** por trás:
  - _"O que precisa da minha atenção hoje?"_ → casos parados (OP‑T3), missões bloqueadas (OP‑T4), clientes em risco (OP‑T2).
  - _"Quanto dinheiro entra este mês?"_ → OP‑A3/A4 (A) + OP‑B7/B8 (B) do período.
  - _"Qual advogado está parado?"_ → OP‑B2 sem movimentação há N dias.
  - _"Quais clientes estão prontos para venda?"_ → OP‑09 roteados A (OP‑10).
  - _"Quais podem virar sociedade?"_ → OP‑09 sem rota + perfil B.
  - _"Qual missão da AHRI bloqueia mais casos?"_ → OP‑T4/OP‑T3 agregadas.
  - _"O que atrasa meu faturamento?"_ → OP‑T12 (a receber) + gargalos por operação.

_(A definição das telas em si vem só depois da aprovação deste mapa — telas representam operações, nunca o contrário.)_

---

## PARTE V — AUDITORIA CRÍTICA: o que falta para operar sozinho por anos

> Sem economizar arquitetura. Meta: o **melhor SO jurídico do Brasil**, autossuficiente.
> Legenda: 🟢 existe · 🟡 parcial · 🔴 ausente.

**Núcleo cognitivo & atendimento**

- 🟢 AHRI (percepção→decisão→conversa), missões, acompanhamento recorrente, encerramento/reabertura, Shadow.
- 🟡 Leitura de documento por IA existe, mas **sem gatilho automático** — depende de humano.
- 🔴 **ALIR como entidade unificada** (hoje os dados existem espalhados em read models; falta o "sistema solar" como projeção única).

**Comercial & financeiro (o que mais falta)**

- 🔴 **Entidades ESCRITÓRIO PARCEIRO, VENDA, SOCIEDADE, HONORÁRIO, DISTRIBUIÇÃO** — não existem.
- 🔴 **Módulo financeiro real:** contas a receber/pagar, conciliação, inadimplência, receita prevista×realizada, carteira, honorários futuros.
- 🔴 **Contratos** (cessão A, honorários B, procuração) — geração/armazenamento/assinatura.
- 🔴 **Nota fiscal / integração contábil** — emissão e registro.
- 🔴 **Régua de cobrança** de parceiros (A e B).
- 🔴 **Regras de comissão/participação** parametrizáveis por escritório.

**Pipeline & governança operacional**

- 🟡 Estágios comerciais (1→12) — os operacionais existem; falta a **projeção de estágio comercial** e o Kanban.
- 🔴 **Ato "qualificar" e "rotear A/B"** como eventos de domínio.
- 🟡 Métricas operacionais (B4.4) — falta camada de **KPIs comerciais** e **Dashboard‑resposta**.
- 🔴 **Relatórios/BI** por período, origem, escritório, colaborador; exportação.

**Segurança, identidade e conformidade**

- 🟡 Autenticação = **segredo único** (sem contas/usuário‑senha/perfis por papel) → 🔴 **auth real com papéis**.
- 🔴 **Trilha de auditoria navegável** (quem fez o quê) na UI.
- 🔴 **LGPD operacional:** consentimento, exportação e exclusão de dados do titular, retenção.
- 🔴 **Portal do cliente / do parceiro** (autoatendimento) — hoje só WhatsApp.

**Continuidade & autonomia (não depender de ferramentas externas)**

- 🔴 **Backups automáticos + restauração testada** (do dono hoje; precisa virar rotina do SO).
- 🔴 **Monitoramento + alertas** ao CEO (queda, degradação, DLQ) — sem abrir logs.
- 🔴 **Gestão de segredos/acessos pelo SO** (sem editar `.env` no terminal).
- 🟡 **Leitura de documento / OCR** automatizada e durável.
- 🔴 **Integrações jurídicas** (consulta a andamento processual em tribunais, se desejado) e **pagamentos** (gateway/Pix para conciliação).
- 🔴 **Multi‑instância/escala horizontal** (hoje instância única — ok para começar, não para "anos").

**Resumo do gap:** o **cérebro de atendimento** está pronto; o que falta para o SO governar a
empresa **sozinho por anos** é, em ordem de valor: **(1) o ALIR unificado**, **(2) o pipeline
comercial com os atos qualificar/rotear/vender/atribuir/encerrar/distribuir**, **(3) o módulo
financeiro (A e B) com contratos/NF/cobrança**, **(4) auth real com perfis + LGPD**, e **(5)
autonomia operacional (backups, monitoramento, acessos, tudo dentro do SO)**.

---

## APROVAÇÃO

Aprove este mapa se ele representa **a empresa funcionando** de ponta a ponta. Aprovado, a
implementação seguirá **operação por operação**, na ordem de **valor de negócio** (Onda 1 =
capturar→qualificar→ALIR; Onda 2 = vender (A); Onda 3 = sociedade + financeiro (B); depois
Dashboard‑resposta, auth/LGPD e autonomia). **As telas serão apenas a representação destas
operações — nunca o ponto de partida.**
