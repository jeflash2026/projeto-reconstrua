# PROJETO RECONSTRUA — MASTER IMPLEMENTATION PLAN
### O único documento mestre da execução

> **Arquitetura conceitual CONGELADA.** Este plano **não cria conceitos** — consolida a
> arquitetura já aprovada (Enterprise OS → Operational OS → Admin OS → Product Model → Canon) em
> um plano executável. A partir daqui: **modo engenharia**.
>
> **Regras permanentes da execução:**
> 1. **Todo código responde a um item deste plano.** Código sem item (ex.: `W1‑03`) não deve existir.
> 2. **Entregamos CAPACIDADES DE NEGÓCIO, não funcionalidades.** Uma capacidade pode cruzar vários
>    módulos, mas é **homologada como uma unidade de negócio**.
> 3. **Ciclo obrigatório por entrega:** Planejar → Implementar → Testar → Homologar → Publicar.
> 4. **Nunca iniciar uma Onda sem homologar a anterior.**
> 5. **Sucesso = capacidades empresariais entregues**, não quantidade de telas.

---

## 1. AS ONDAS = AS 5 CAPACIDADES EMPRESARIAIS

| Onda | Capacidade de negócio (unidade de homologação) | "Quando terminar, eu consigo…" |
|---|---|---|
| **Onda 1** | **Operar clientes reais** (capturar → qualificar → ALIR unificado) | operar clientes reais de ponta a ponta |
| **Onda 2** | **Vender um cliente qualificado** (Modelo A) | vender clientes reais e receber |
| **Onda 3** | **Administrar uma sociedade** (Modelo B + Financeiro) | administrar sociedades e distribuir honorários |
| **Onda 4** | **Administrar a empresa inteira** (Dashboard‑resposta + Governança + Auth/LGPD) | governar a empresa por perguntas e decisões |
| **Onda 5** | **Escalar o negócio** (Autonomia + Evolução) | escalar sem depender do fundador |

**Critério de conclusão de cada Onda:** a capacidade correspondente é **homologada com dados
reais** (ou de homologação fiéis), não apenas "as telas existem".

---

## 2. AS ENTIDADES (consolidadas — nada novo)

Legenda: 🟢 já existe no núcleo · 🟡 existe parcial (falta projeção/uso) · 🔴 a construir.

| Entidade | Estado | Onde nasce/vive |
|---|---|---|
| **Pessoa** | 🟢 | núcleo (identidade) |
| **Missão** (caso) | 🟢 | mission‑runtime |
| **Documento** | 🟡 | recebido/reconhecido; falta acervo durável no ALIR |
| **Perícia / Laudo** | 🔴 | ato humano do perito (registrar resultado) |
| **Verdade do caso** | 🟢 | executive‑brain (truth) |
| **Estado Operacional** | 🟢 | projeção (ENCERRADA/reaberta/etc.) |
| **ALIR** (identidade operacional) | 🔴 | **projeção unificada** sobre tudo do cliente |
| **Estágio Comercial** (funil 1→12) | 🔴 | projeção comercial sobre a missão |
| **Escritório Parceiro** | 🔴 | cadastro comercial |
| **Venda** (Modelo A) | 🔴 | ato comercial (oferta→venda→recebimento) |
| **Sociedade** (Modelo B) | 🔴 | ato comercial (atribuição→condução→encerramento) |
| **Honorário** | 🔴 | apuração financeira do êxito |
| **Distribuição** | 🔴 | partilha Reconstrua × escritório × investidor |
| **Lançamento Financeiro** (a receber/pagar) | 🔴 | módulo financeiro |
| **Colaborador / Papel** | 🔴 | equipe + auth por papel |
| **Decisão / Ato Auditável** | 🟢 | event store (append‑only) |
| **Conexão WhatsApp** | 🟢 | whatsapp-connection runtime |

**Núcleo já pronto (não replanejar):** event sourcing (append‑only, hash‑chain), read models,
Executive Brain determinístico, acompanhamento recorrente, encerramento/reabertura, métricas
operacionais, segurança de produção (requireBearer), observabilidade durável, conexão WhatsApp.

---

## 3. OS MÓDULOS × OPERAÇÕES × ONDA

Os 13 módulos do Admin OS, mapeados às operações (Operational OS) e à Onda que os entrega.

| Módulo | Operações (OP) | Onda |
|---|---|---|
| **Operação** (fila/handoffs) | OP‑01..08, T3, T4 | 1 |
| **Clientes / ALIR** | OP‑01..10, T1 | 1 |
| **Documentos** | OP‑04..06 | 1 |
| **Jurídico / Perícia** | OP‑07..09 | 1 |
| **Escritórios Parceiros** | OP‑T6 | 2 |
| **Modelo A — Venda** | OP‑A1..A5, OP‑10 | 2 |
| **Modelo B — Sociedade** | OP‑B1..B9 | 3 |
| **Financeiro** | OP‑A4, B7, B8, T12 | 3 |
| **Dashboard Executivo** (respostas) | agrega todas | 4 |
| **Relatórios** | agrega todas | 4 |
| **Equipe / Acessos** | OP‑T7, T11 | 4 |
| **AHRI** (Shadow/qualidade) | OP‑T8 | 4 |
| **Configurações / Autonomia** | OP‑T5, T9 + backups/monitor | 5 |

---

## 4. DEPENDÊNCIAS ENTRE MÓDULOS

```
                     ┌───────────────────────────────┐
                     │  NÚCLEO (pronto): eventos,      │
                     │  brain, read models, WhatsApp   │
                     └───────────────┬────────────────┘
                                     │
                 ┌───────────────────▼───────────────────┐
   ONDA 1        │  ALIR unificado  ← Clientes/Operação/  │   (base de tudo)
                 │  Documentos/Jurídico(Perícia)          │
                 └───────┬───────────────────────┬────────┘
                         │                        │
   ONDA 2   Escritórios ─┴─ Modelo A (Venda) ─────┤ depende de: ALIR + qualificar/rotear
                         │                        │
   ONDA 3   Modelo B (Sociedade) ── Financeiro ───┤ depende de: ALIR + Escritórios + Venda(caixa)
                         │                        │
   ONDA 4   Dashboard‑resposta ─ Relatórios ─ Equipe/Acessos ─ AHRI/Shadow
                         │        (dependem de A + B para ter o que responder)
   ONDA 5   Autonomia (backups/monitor/acessos) ─ Evolução (novos direitos/escritórios/países)
```

**Regra de dependência:** um módulo só entra em implementação quando **suas dependências estão
homologadas**. O **ALIR é dependência dura de tudo** — por isso abre a Onda 1.

---

## 5. AS ONDAS EM DETALHE (itens executáveis)

> Cada item tem ID (`W#‑NN`). **Todo commit referencia um ID.** Cada Onda lista:
> **Itens · Critérios de aceite (negócio) · Definição de concluído (engenharia) · Migração · Rollback.**

### ONDA 1 — OPERAR CLIENTES REAIS  *(capacidade: operar clientes de ponta a ponta)*

**Itens**
- `W1‑01` Projeção **ALIR unificado** (read model) consolidando pessoa, missão, verdade, estado, documentos, timeline, próxima ação — **só lê read models** (DF‑08).
- `W1‑02` Entidade **Documento** durável no ALIR (acervo por caso: tipo, origem, status, evidência).
- `W1‑03` Ato **Perícia/Laudo**: registrar resultado (direito confirmado/afastado) como evento.
- `W1‑04` Atos de domínio **Qualificar** (OP‑09) e **Rotear A/B** (OP‑10) como eventos auditáveis + estágio comercial inicial.
- `W1‑05` SO — tela **Cliente (ALIR)** com **navegação por contexto** (documentos, conversas, missões, perícia, histórico, próxima ação) sem trocar de tela.
- `W1‑06` SO — tela **Operação** (fila de handoffs, missões bloqueadas, casos parados) → OP‑T3/T4.
- `W1‑07` Ações do SO: solicitar documento, encaminhar perícia, registrar laudo, **qualificar**, **rotear**.

**Critérios de aceite (negócio):** a partir de um cliente real, consigo ver tudo dele em um lugar,
pedir e conferir documentos, mandar para perícia, registrar o laudo, **qualificar** e **decidir a
rota** — tudo pelo SO, sem abrir banco/logs/Evolution.

**Definição de concluído (engenharia):** typecheck + lint limpos; suíte completa verde; testes
novos para W1‑01..07; ALIR reflete eventos reais; atos geram eventos append‑only; auditoria de
completude; homologação ponta a ponta da captação→qualificação→rota.

**Migração:** apenas **adição** de read models/eventos; nenhum evento histórico reescrito. ALIR é
projeção reconstruível a partir do event store.

**Rollback:** desligar a projeção/rotas novas por flag; núcleo intacto (projeções são
recriáveis). Nenhuma migração destrutiva de dados.

### ONDA 2 — VENDER UM CLIENTE QUALIFICADO  *(capacidade: Modelo A)*

**Itens**
- `W2‑01` Entidade **Escritório Parceiro** (cadastro, modelo A/B, condições) — OP‑T6.
- `W2‑02` Entidade **Venda** (OP‑A1..A3): empacotar ALIR, ofertar, confirmar venda (evento).
- `W2‑03` **Recebimento A** (OP‑A4): lançamento "a receber → recebido", preço (R$400, parametrizável), conciliação.
- `W2‑04` **Encerrar missão vendida** (OP‑A5) reutilizando o encerramento existente (motivo "vendida").
- `W2‑05` SO — telas **Escritórios** e **Modelo A** (ofertar/vender/receber) na navegação por contexto do ALIR.

**Critérios de aceite (negócio):** consigo cadastrar um escritório, ofertar um caso qualificado,
**registrar a venda**, **registrar o recebimento (R$400)** e ver a missão encerrada como vendida.

**Definição de concluído:** ciclo Planejar→Testar→Homologar completo; venda gera receita
rastreável (origem/estado/responsável); testes de venda + recebimento; homologação da capacidade
"vender um cliente".

**Migração:** novas entidades comerciais como eventos/projeções; nada retroativo.
**Rollback:** flags por módulo comercial; venda cancelável por evento (OP‑cancelar), sem apagamento.

### ONDA 3 — ADMINISTRAR UMA SOCIEDADE  *(capacidade: Modelo B + Financeiro)*

**Itens**
- `W3‑01` Entidade **Sociedade** (OP‑B1): atribuir caso ao advogado/escritório (isolado).
- `W3‑02` **Andamento do processo** (OP‑B2/B3): registrar movimentações; ponte advogado→AHRI (reusa workflow/handoff existentes).
- `W3‑03` **Encerrar processo** (OP‑B6) e **Reabrir** (OP‑B9) — reutiliza encerramento/reabertura já prontos.
- `W3‑04` Entidade **Honorário** (OP‑B7): apurar valor do êxito e participação do Reconstrua.
- `W3‑05` Entidade **Distribuição** (OP‑B8): partilha e recebimento.
- `W3‑06` **Módulo Financeiro** (OP‑T12): a receber/pagar, conciliação, inadimplência (A e B unificados).
- `W3‑07` SO — telas **Modelo B** e **Financeiro** na navegação por contexto.

**Critérios de aceite (negócio):** consigo atribuir um caso a um advogado, acompanhar o processo,
encerrá‑lo, **apurar o honorário** e **registrar a distribuição**, e ver o financeiro consolidado
(a receber, recebido, inadimplente).

**Definição de concluído:** ciclo completo; toda cifra com origem/estado/responsável; testes de
honorário/distribuição/conciliação; homologação da capacidade "administrar uma sociedade".

**Migração:** aditiva. **Rollback:** flags; distribuições/lançamentos reversíveis por evento.

### ONDA 4 — ADMINISTRAR A EMPRESA INTEIRA  *(capacidade: governar por perguntas + decisões)*

**Itens**
- `W4‑01` **Dashboard‑resposta** (as 7 perguntas do Enterprise/Admin OS), cada resposta = lista de operações por trás.
- `W4‑02` **Relatórios** por período/origem/escritório/colaborador; exportação.
- `W4‑03` **Auth real com papéis** (substitui segredo único) + **sucessão de acessos**; alçadas/delegação.
- `W4‑04` **Trilha de auditoria navegável** (quem fez o quê) sobre o event store.
- `W4‑05` **LGPD operacional** (consentimento, exportação e exclusão do titular — registrada).
- `W4‑06` **AHRI/Shadow** no SO (qualidade das conversas) — OP‑T8.
- `W4‑07` **Equipe** (papéis, carga) — OP‑T7.

**Critérios de aceite (negócio):** abro o SO e ele **responde** o que precisa da minha atenção,
quanto entra no mês, qual advogado está parado, quais casos vender/associar, qual missão bloqueia
mais casos e o que atrasa o faturamento; e consigo dar acesso por papel com auditoria.

**Definição de concluído:** dashboard responde com dados reais das Ondas 1‑3; auth por papel
homologada; auditoria e LGPD funcionais; homologação da capacidade "administrar a empresa".

**Migração:** introduzir auth por papel **sem quebrar** o acesso atual (transição por flag +
sucessão). **Rollback:** manter segredo único como fallback até a homologação da auth por papel.

### ONDA 5 — ESCALAR O NEGÓCIO  *(capacidade: autonomia + evolução)*

**Itens**
- `W5‑01` **Backups automáticos + restauração testada** operados/monitorados pelo SO.
- `W5‑02` **Monitoramento + alertas** ao CEO (queda/degradação/DLQ) — sem abrir logs.
- `W5‑03` **Gestão de acessos/segredos e conexões pelo SO** (sem editar `.env` no terminal).
- `W5‑04` **Evolução por extensão:** novo direito/tipo de missão + critério de qualificação + documentos exigidos, **sem reescrita**.
- `W5‑05` **Multi‑escritório / novos parceiros** em escala; **moeda/idioma** como atributos (preparação p/ país novo).

**Critérios de aceite (negócio):** a empresa continua operando e crescendo **sem o fundador**:
backups garantidos, alertas chegando, acessos geridos no SO, e um **novo direito/escritório**
entra sem reescrever arquitetura.

**Definição de concluído:** teste do "fundador ausente" (Riscos Estruturais) sem 🔴 remanescente
nos itens cobertos; homologação da capacidade "escalar".

**Migração/Rollback:** autonomia é infra aditiva; cada capacidade nova protegida por flag.

---

## 6. ESTRATÉGIAS GLOBAIS

**Migração (constitucional):** *append‑only, aditiva, reconstruível.* Novas capacidades entram
como **novos eventos + novas projeções**; **nenhum evento histórico é reescrito**; toda projeção
(inclusive ALIR) é reconstruível a partir do event store. Correção nunca é apagamento (Enterprise
OS, Parte IV).

**Rollback:** *feature flags por capacidade + reversão por evento.* Cada item entrega atrás de
flag; desligar a flag remove a capacidade sem tocar no núcleo. Atos comerciais/financeiros são
**revertidos por evento de cancelamento/estorno**, nunca por delete. O núcleo cognitivo
homologado permanece intocado.

**Homologação:** cada Onda só é "concluída" após homologação **da capacidade de negócio** com
dados reais/fiéis — não pela existência de telas. Reusa o rito já praticado: typecheck + lint +
**suíte completa** + testes novos + Auditoria de Completude + homologação ponta a ponta.

**Ordem por VALOR DE NEGÓCIO (não técnico):** 1 (operar) → 2 (vender/receita imediata) → 3
(sociedade/receita recorrente) → 4 (governar) → 5 (escalar). Dentro de cada Onda, o ALIR e os
atos que **geram/protegem receita** vêm primeiro.

**Critério para "módulo concluído":** (a) responde às **3 Perguntas**; (b) suas operações estão
funcionais no SO com navegação por contexto; (c) gera/registra os eventos e cifras esperados com
origem/estado/responsável; (d) testado e homologado; (e) publicado. Sem os cinco, não está concluído.

---

## 7. GOVERNANÇA DA EXECUÇÃO (o que muda a partir de agora)

- **Nenhum novo documento estrutural** salvo necessidade real durante a implementação.
- **Cada entrega** = uma capacidade (ou item `W#‑NN`) percorrendo Planejar→Implementar→Testar→
  Homologar→Publicar, **um item por vez**, aguardando sua autorização entre passos relevantes.
- **Servidores/deploy continuam sob o dono** — entrego código + lint/build/testes; publicação é sua.
- **Papel:** atuo como **CTO** — a missão é entregar **capacidades empresariais**, não telas.

---

## PONTO DE PARTIDA
Aguardo seu **"iniciar W1‑01"** (ou autorização da Onda 1). O primeiro item é o **ALIR unificado
(`W1‑01`)** — a dependência dura de toda a empresa. A partir dele, tudo orbita.
