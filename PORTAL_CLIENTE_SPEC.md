# PORTAL DO CLIENTE — ESPECIFICAÇÃO TÉCNICA (v2 — CONGELADA)
### Extensão do ecossistema AHRI — filosofia oficial + arquitetura. Base do PC‑R1.

## PRINCÍPIOS CONGELADOS (arquitetura oficial do produto)

1. **O Portal é uma EXTENSÃO da AHRI** — não um produto separado. A sensação: a AHRI abriu
   uma janela para o cliente enxergar o próprio processo. Mesma voz, mesma identidade.
2. **A AHRI é o centro da experiência** — ela conversa, explica, orienta, notifica e acolhe.
   O Portal apenas permite visualizar.
3. **UMA ÚNICA VERDADE** — tudo que o Portal exibe vem da MESMA projeção segura consultada
   pelo Brain. O Portal **nunca interpreta estados, nunca calcula etapas, nunca tem lógica
   própria**: toda tradução para linguagem humana acontece na camada de aplicação (a visão);
   o app apenas renderiza strings autorizadas.
4. **O Portal REDUZ ANSIEDADE** — o objetivo não é mostrar dados; é responder naturalmente às
   perguntas do cliente: *onde meu caso está? · o que está acontecendo agora? · o que acontece
   depois? · preciso fazer alguma coisa? · quanto tempo costuma levar?* A própria estrutura da
   projeção é organizada por essas perguntas (§3.1).
5. **ZERO ERP** — nada de tabelas, códigos, jargão jurídico ou termos internos. Tudo em
   linguagem humana.
6. **Transparência SEM exposição** — o cliente percebe que há muito acontecendo, mas vê apenas
   o que lhe diz respeito. Sensação: "estou completamente informado" — nunca "estou vendo o
   sistema interno".
7. **O Portal deve parecer VIVO** — mesmo sem chat: linguagem em primeira pessoa da AHRI
   ("estou cuidando disso"), estados com voz de acompanhamento, nunca telas estáticas de
   sistema.
8. **A experiência é CONTÍNUA** — conversa → link → portal → volta à conversa. O cliente
   nunca sai do ecossistema da AHRI (a única ação do portal leva de volta ao WhatsApp).

> Decisões oficiais incorporadas: **(D1)** prazo por política única (`PROCESSING_ESTIMATE_DAYS`),
> **(D2)** mensagem humana com frase final obrigatória, **(D3)** Portal nunca é fonte de verdade,
> **(D4)** WhatsApp = identidade primária (link é extensão temporária; renovação por conversa),
> **(D5)** AHRI inteligência viva (intenção primeiro), **(D6)** Portal silencioso.

---

## 1. Arquitetura geral

```
WhatsApp ──► Percepção ──► BRAIN ──► Expressão humanizada ──► Cliente
                ▲            │ decide (ROs novas, aditivas)
   percept      │            ├─ RO-CADASTRO-CONCLUIDO  → mensagem de conclusão + LINK
 "documentacao_ │            └─ RO-LINK-PORTAL         → reenvio do link por conversa
  completa"     │
                │                    ┌───────────────────────────────────────────┐
  Subscriber de completude           │   VISÃO DE ACOMPANHAMENTO (application)   │
  (Readiness PRONTO + sem fato) ─────│  projeção SEGURA e ÚNICA sobre ALIR +     │
                                     │  pedidos + assignments/staff + juridical  │
                                     │  (filtro CLIENT_FACING_KINDS — o MESMO    │
                                     │   da AHRI: uma só definição do dizível)   │
                                     └───────────────┬───────────────────────────┘
                                       consumida por │ dois clientes, mesma fonte:
                          ┌──────────────────────────┴─────────────────────┐
                          ▼                                                ▼
        API: GET /cliente/acompanhamento (main :PORT,          Contexto de conversa da AHRI
        auth = TOKEN do cliente; server-side only)             (D5: "consultar estado quando
                          ▼                                     necessário" usa ESTA visão)
        portal-cliente (Next, basePath /portal, :3300)
        página única de acompanhamento — renderiza, nada mais
```

**Reutilizado (nada novo):** pipeline de conversa e humanização; entrada única serializada
(caminho do percept — o mesmo do sinal temporal e da ponte do advogado); catálogo de ROs
(aditivo, padrão RO‑3B); ALIR/ClientesList/Readiness; `CLIENT_FACING_KINDS`; JsonStore;
padrão de empacotamento dos portais (Dockerfile target, compose, NPM location, basePath,
force‑dynamic); disciplina BL‑2.2 (browser nunca fala com API interna).

**Novo (mínimo):** visão de acompanhamento (pura) · token stateless (puro) · 1 registro
(`liberacao-portal`) · 1 subscriber · 2 ROs · 1 rota de leitura · 1 app Next de página única ·
1 env de política (`PROCESSING_ESTIMATE_DAYS`) · 1 env de segredo (`CLIENTE_PORTAL_SECRET`).

## 2. Configuração de prazo (D1 — fonte única, nunca duplicada)

- **`PROCESSING_ESTIMATE_DAYS`** (default `12`): a **expectativa operacional vigente** da etapa
  de análise. Lida em **um único ponto** (config de produção, `build-production`) e injetada:
  (a) no contexto factual da RO‑CADASTRO‑CONCLUIDO (mensagem da AHRI); (b) na resposta da API
  de acompanhamento (o Portal exibe o que a API mandar — o Portal **não** tem env própria de
  prazo). Mudou a política → muda em todo lugar, sem tocar regra de negócio.
- **Relógio do Portal:** `estimativaAte = liberacao-portal.comunicadoEm + PROCESSING_ESTIMATE_DAYS`
  — o **fato** é imutável (Lei 8/11); a **estimativa** é política vigente e pode ser recalculada
  se a política mudar (comportamento desejado pela D1). Exibida sempre como *estimativa*
  ("previsão", nunca promessa — fronteira da AHRI: não prometer decisões humanas).
- **Distinção documentada:** `PRAZO_PEDIDOS_DIAS=10` (interno, fila operacional da Jornada B,
  conta a partir de `pedidos-administrativos.confirmadoEm`) **não é** o prazo do cliente e não
  aparece no Portal como número — evita duas contagens confusas para o cliente.

## 3. Componentes

### 3.1 `VisaoAcompanhamento` (application — pura, PC‑R1)
`acompanhamento(clienteId)` → compõe de fontes existentes (Regra 1; D3). **Princípios 3/4/5:**
a estrutura É as respostas às perguntas do cliente, já em linguagem humana, na primeira pessoa
da AHRI — o app renderiza strings autorizadas, sem nenhuma lógica:

```ts
interface AcompanhamentoCliente {
  clienteId; quem;                        // nome lembrado (ALIR)
  // ── As 5 perguntas (Princípio 4) — textos prontos, voz da AHRI (Princípio 7) ─
  ondeEsta: string;                       // "Onde meu caso está?" — nome humano da etapa
  agora: string;                          // "O que está acontecendo agora?"
  proximoPasso: string;                   // "O que acontece depois?"
  precisaFazerAlgo: string;               // "Preciso fazer alguma coisa?" (via de regra: nada)
  quantoTempo: string;                    // "Quanto tempo costuma levar?" (política D1)
  // ── Suporte visual ───────────────────────────────────────────────────────────
  etapas: EtapaTimeline[];                // jornada (concluída/atual/futura), rótulos humanos
  estimativaDias: number;                 // PROCESSING_ESTIMATE_DAYS (política vigente)
  estimativaAte: Date | null;             // liberacao.comunicadoEm + estimativa (D1)
  advogado: { nome } | null;              // só o nome
  processo: { numero } | null;
  atualizacoes: { quando; texto }[];      // SÓ CLIENT_FACING_KINDS
  documentosRecebidos: string[];          // rótulos humanos
  whatsapp: string;                       // volta ao relacionamento (Princípio 8)
}
```
**Nunca no payload:** outros clientes, kinds internos (`observacao`, `prazo` interno…),
métricas, financeiro, códigos/status internos crus (Princípio 5 — nem `ClienteStatus` sai),
equipe além do advogado do caso, qualquer campo sem fonte (Princípio 6).
**Dupla serventia (Princípio 3 / D5):** esta MESMA visão é o "pacote de estado" que a AHRI
consulta quando a conversa pede status — uma única definição do dizível para WhatsApp e
Portal, sem divergência.

### 3.2 Token de acesso (application — puro, PC‑R1)
- Formato: `base64url({clienteId, exp}) + "." + HMAC-SHA256(payload, CLIENTE_PORTAL_SECRET)`.
- Stateless (Lei 13: sobrevive a qualquer restart); escopo = 1 cliente; validade proposta
  **90 dias** *(pendência de homologação §9)*; renovação **somente por conversa** (D4).
- O segredo vive **apenas na API** (assina no envio, verifica na rota). O portal **não** tem o
  segredo: guarda o token em cookie httpOnly e o repassa server‑side — a API é o único ponto de
  validação (mais forte que BL‑2.2: nem o servidor do portal conhece segredos).

### 3.3 Fato `liberacao-portal` (infra — o ÚNICO estado persistido novo)
`{clienteId, chatId, comunicadoEm, estimativaDiasInformada}` — namespace no JsonStore, padrão
de `modalidade`/`venda`/`pedidos-administrativos`. Garante **envio único** da mensagem de
conclusão (sem ele, a reavaliação re‑enviaria) e ancora o relógio da estimativa.
`estimativaDiasInformada` registra o que foi DITO ao cliente (Lei 10 — rastreabilidade), mesmo
que a política mude depois.

### 3.4 Gatilho de completude (infra — subscriber, PC‑R3)
Observa eventos de documento (padrão dos subscribers existentes); quando **Readiness = PRONTO**
(determinístico, homologado) **e** não existe `liberacao-portal` → entrega percept
`documentacao_completa` pela **entrada única serializada**. Nenhuma mudança na fronteira
congelada do snapshot.

### 3.5 ROs novas (catálogo de produção — aditivas, PC‑R3/R4)
- **`RO-CADASTRO-CONCLUIDO`** (percept `documentacao_completa`): conversar → conteúdo factual
  homologado (§5) com link; após entrega, grava o fato 3.3.
- **`RO-LINK-PORTAL`** (intenção "quero o link/acessar o portal" na percepção): responder com
  link novo. Renovação é conversa (D4) — nunca "esqueci minha senha".

### 3.6 API de leitura (api — main server `:PORT`, PC‑R1)
`GET /cliente/acompanhamento` — header `authorization: Bearer <token-do-cliente>`; valida
assinatura+expiração → responde a visão 3.1 do `clienteId` do token. 401 token inválido/vencido
(resposta neutra: "peça um novo link à AHRI"). Rota no servidor MAIN (já público para o
webhook); o token é a autorização (escopo de 1 cliente).

### 3.7 App `portal-cliente` (Next, PC‑R2)
`basePath /portal` · `:3300` · rota `/portal?t=…` seta cookie httpOnly e redireciona limpo →
página única de acompanhamento (server component chama 3.6 server‑side) · `force-dynamic` ·
`noindex` · sem token/expirado → página "Peça seu link de acesso conversando comigo no
WhatsApp" com botão `wa.me/<oficial>` (a ÚNICA ação do portal aponta de volta ao
relacionamento — D6). Auto‑refresh no padrão dos outros portais.

## 4. Estados exibidos ao cliente (mapeamento — derivado, jamais persistido)

| Interno (`ClienteStatus`) | Etapa no Portal (linguagem do cliente) |
|---|---|
| pós‑liberação, antes de pedidos | **Análise técnica** — "nossa equipe está analisando seu caso" + estimativa (D1) |
| `AGUARDANDO_10_DIAS` | **Solicitações enviadas** — "enviamos as solicitações administrativas do seu caso" (sem contagem interna) |
| `AGUARDANDO_SOCIO` | **Análise técnica em conclusão** — neutro (fila interna não é exposta) |
| `EM_PROCESSO` | **Processo em andamento** — advogado (nome), nº do processo, atualizações |
| `VENDIDO` / `ENCERRADO` | **Caso encaminhado/concluído** — texto neutro definido na homologação |

*(Portal só existe após a liberação; estados de coleta não são renderizados.)*

## 5. Mensagem de conclusão (D2 — conteúdo factual homologado)

Modelo aprovado (com `{{PROCESSING_ESTIMATE_DAYS}}` da config única):

> "Recebi toda a documentação necessária e seu cadastro foi concluído. Agora seu caso entra na
> etapa de análise técnica da nossa equipe. Essa fase costuma levar aproximadamente
> {{PROCESSING_ESTIMATE_DAYS}} dias. Enquanto isso você já pode acompanhar toda a evolução pelo
> seu Portal do Cliente: {{LINK}}. Sempre que houver alguma movimentação importante eu também
> avisarei você por aqui. **Se precisar conversar comigo durante esse período, estarei aqui.**"

**Regras de entrega:** a AHRI humaniza o fraseado (pipeline de expressão + anti‑repetição —
nunca soa automática), mas há **guardas determinísticas** (Lei 9): o `{{LINK}}` entra verbatim
(se o fraseado o omitir, é reanexado) e a **última frase é obrigatória** (disponibilidade
contínua — o relacionamento nunca termina). Conteúdo factual não é inventável nem alterável
pelo LLM.

## 6. Personalidade e fronteiras (D5 — permanente)

O fluxo intenção‑primeiro **já é** a arquitetura (percepção → Brain → expressão): ansiedade,
dúvidas, curiosidade e conversa geral continuam tratadas como hoje. O que esta fase adiciona:
quando a intenção pedir **status**, a AHRI consulta a **mesma visão 3.1** e combina estado +
conversa. Fronteiras (reforçadas na configuração persistida de prompts): nunca revelar dados
internos/de outros clientes/estratégias; nunca inventar; nunca prometer decisão humana; nunca
ultrapassar as permissões do cliente (a visão 3.1 é, por construção, o teto do que ela sabe
dizer sobre o processo).

## 7. Segurança (resumo)

Token HMAC stateless com expiração · escopo 1 cliente · segredo só na API · cookies httpOnly/
secure/lax · portal sem escrita alguma (superfície de ataque ≈ zero) · `noindex` · 401 neutro
(não confirma existência de cliente) · logs sem PII · renovação exclusivamente pela AHRI (o
WhatsApp — posse do número — é a identidade primária, D4).

## 8. Plano de implementação e testes de homologação

| Fase | Entrega | Testes de aceite |
|---|---|---|
| **PC‑R1** | Visão 3.1 + token 3.2 + rota 3.6 + config D1 | visão de cliente real contém SÓ o §3.1 (teste nega campos proibidos); filtro = `CLIENT_FACING_KINDS` (interno nunca vaza); token: válido/expirado/assinatura errada/cliente inexistente; **produção fria**: token emitido antes de restart valida depois (Lei 13); `PROCESSING_ESTIMATE_DAYS` refletida na resposta |
| **PC‑R2** | App `/portal` + empacotamento + NPM | `/portal?t=válido` renderiza jornada real; expirado → página de orientação com `wa.me`; sem escrita; build dinâmico; URL limpa após set do cookie |
| **PC‑R3** | Subscriber + `RO-CADASTRO-CONCLUIDO` + fato + mensagem §5 | completar docs de cliente teste → **UMA** mensagem (reavaliações não duplicam — fato); mensagem contém link válido + estimativa + frase final obrigatória; fato gravado com `estimativaDiasInformada` |
| **PC‑R4** | `RO-LINK-PORTAL` + pacote de estado na conversa (D5) | "quero o link" em linguagem natural → link novo; pergunta de status → resposta combinando estado real (visão 3.1) e conversa humana |
| **PC‑R5** | Homologação ponta a ponta (funde as fases 1–7 do plano geral) | jornada completa: "olá" → coleta → conclusão automática c/ link → portal acompanha → advogado movimenta → WhatsApp notifica → portal reflete → conversa livre com a AHRI em qualquer ponto |

Cada fase: ciclo Planejar→Implementar→Testar→Homologar + auditoria das 10 perguntas.

## 9. Pendências de homologação (antes do PC‑R3; não bloqueiam PC‑R1)

1. Registro `liberacao-portal` + envs `CLIENTE_PORTAL_SECRET` e `PROCESSING_ESTIMATE_DAYS`
   (default 12) — Regra 5.
2. Validade do link: proposta **90 dias** (renovável por conversa).
3. Textos neutros dos estados finais (§4: VENDIDO/ENCERRADO).
