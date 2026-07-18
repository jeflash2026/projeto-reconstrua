# PORTAL DO CLIENTE — UX BLUEPRINT (v1, para congelamento)
### A conversa silenciosa da AHRI. Nunca um sistema jurídico.

> Conceito central: **uma carta viva**. A página inteira lê-se de cima para baixo como um
> bilhete calmo que a AHRI deixou aberto para o cliente — não como um painel. Nenhum elemento
> "de software" (tabelas, cards técnicos, códigos, IDs, etapas internas, jargão). Todo texto
> vem pronto da projeção segura (Princípio 3) — o Portal só o dispõe com respiro e afeto.

---

## 1. Primeira impressão (os 3 primeiros segundos)

Fundo claro e quente (papel, não branco-hospital). Muito espaço vazio. **Uma saudação pessoal
em letras grandes** — nada de logotipo dominante, menu, sino de notificação ou grid. Um único
sinal de vida: um **ponto de presença que "respira"** ao lado do nome da AHRI. A sensação
buscada: *"alguém está cuidando disso — e está tudo sob controle."* Tranquilidade antes de
informação.

## 2. A primeira informação

A **saudação + a resposta à pergunta nº 1**, em uma frase única e humana:

> **Olá, Maria.**
> Seu caso está em **análise técnica** — e eu estou acompanhando cada passo.

(“quem” + `ondeEsta` da projeção, tecidos numa frase; jamais um rótulo solto tipo "STATUS:
ANÁLISE".)

## 3. Hierarquia visual (a página é as 5 perguntas — nessa ordem)

1. **Saudação + Onde está** (grande, dominante)
2. **O que está acontecendo agora** (`agora`)
3. **Você precisa fazer algo?** (`precisaFazerAlgo`) — destacado com suavidade: é o **maior
   redutor de ansiedade** da página
4. **O caminho** (timeline humana) — onde ele veio, onde está, o que vem (`etapas` + `proximoPasso`)
5. **Quanto tempo costuma levar** (`quantoTempo` + estimativa)
6. Secundários: novidades · quem cuida do processo · documentos recebidos
7. **Volta ao relacionamento**: "Quer conversar? Estou no WhatsApp." (única ação da página)

## 4. Acima da dobra (mobile — o que o cliente vê sem rolar)

```
   ● AHRI — acompanhando seu caso            ← presença (ponto respirando + microtexto)

   Olá, Maria.                               ← 28–32px, peso 600
   Seu caso está em análise técnica —
   e eu estou acompanhando cada passo.       ← 18–20px, tom de conversa

   ┌───────────────────────────────────┐
   │ ✓ Você não precisa fazer nada     │     ← "pílula de tranquilidade": fundo
   │ agora. Estou cuidando de tudo —   │        verde-suave/neutro, SEM borda dura;
   │ se eu precisar, falo com você     │        é a resposta à maior ansiedade
   │ no WhatsApp.                      │
   └───────────────────────────────────┘

   O que está acontecendo agora
   Já enviamos as solicitações do seu
   caso e estou acompanhando as respostas.   ← `agora`, texto corrido
```

## 5. Abaixo da dobra

1. **O caminho do seu caso** — timeline vertical (§6).
2. **O que vem depois** — `proximoPasso` como parágrafo.
3. **Quanto tempo costuma levar** — `quantoTempo`; se houver `estimativaAte`: *"a previsão é
   até 2 de agosto"* em linguagem corrida (nunca contador regressivo — contador gera ansiedade).
4. **Novidades** — as `atualizacoes` como **mensagens da AHRI** (§8); vazio tem texto próprio (§ estados).
5. **Quem está cuidando do seu processo** — só quando houver advogado: *"O advogado responsável
   pelo seu processo é **Dra. Ana Lima**."* + nº do processo em UMA linha discreta ("número do
   seu processo na Justiça: …" — é o único "número" permitido, porque pertence ao cliente).
6. **Documentos que você já me enviou** — frase + lista leve de rótulos (chips suaves, não tabela).
7. **Fecho da carta:** *"Qualquer dúvida, é só me chamar — estou no WhatsApp."* + **botão verde
   WhatsApp** (única cor de ação da página; Princípio 8).

## 6. Timeline ("O caminho do seu caso")

- **Vertical**, 4 momentos: *Documentação → Análise técnica → Processo → Conclusão*.
- Cada momento = ponto + título + **uma frase no passado/presente/futuro** (voz da AHRI):
  - concluída: ponto preenchido ✓ · *"Recebi e organizei toda a sua documentação."*
  - **atual**: ponto maior com a MESMA animação de respiração da presença + rótulo "você está
    aqui" · frase = o `agora`
  - futura: ponto vazio, texto esmaecido · frase no futuro (*"Depois, um advogado assume a
    condução do seu processo."*)
- Linha fina conectando; o traço até a etapa atual é desenhado com animação sutil no load.
- **Sem datas internas, sem duração por etapa, sem porcentagens** — é um caminho, não um Gantt.

## 7. Estados em linguagem humana (mapa fechado — nomes internos JAMAIS aparecem)

| Momento interno | O que o cliente lê (do payload; exemplos já implementados na visão) |
|---|---|
| coleta | "Estou organizando a sua documentação com você pelo WhatsApp." |
| análise (pronto/pedidos) | "Sua documentação está completa e a nossa equipe está analisando o seu caso." / "Já enviamos as solicitações administrativas do seu caso e estou acompanhando as respostas." |
| análise em conclusão | "Estamos concluindo a análise técnica do seu caso." |
| processo | "O advogado Dra. Ana Lima está conduzindo o seu processo." |
| conclusão | "Esta etapa do seu caso foi concluída." *(redação final pendente de homologação)* |

## 8. Como a AHRI "fala" dentro do Portal

- **Sempre 1ª pessoa** ("estou", "eu te aviso"), sempre dirigida ("você", nome próprio).
- As **novidades** são renderizadas como **balões de mensagem da AHRI** (o mesmo formato visual
  de um chat, alinhados à esquerda, com data humana: "ontem", "17 de julho") — o cliente
  reconhece a linguagem do WhatsApp: é a MESMA entidade falando (Princípio 1). Sem campo de
  resposta (Portal silencioso — D6): abaixo dos balões, *"para responder, me chame no WhatsApp"*.
- Nenhum texto institucional ("a empresa informa…"), nenhum aviso legal frio no corpo.

## 9. Como evitar ansiedade (decisões deliberadas)

1. "Você não precisa fazer nada" **acima da dobra** — a resposta que acalma vem primeiro.
2. **Nunca contador regressivo**; prazos como conversa ("costuma levar…", "a previsão é até…").
3. Vazio de novidades tem explicação: *"Ainda não há novidades — e isso é normal nesta fase."*
4. Sem vermelho de alerta: a paleta de estado usa neutros e verde suave; o vermelho da marca é
   só detalhe de identidade (nunca sinal de problema).
5. Timeline mostra o **caminho inteiro** — saber o que vem depois reduz medo do desconhecido.
6. Presença viva constante (ponto respirando) — "tem alguém aqui", mesmo sem movimento novo.

## 10. Transparência sem parecer ERP

Tudo o que diz respeito ao cliente está na página — mas **narrado, nunca tabelado**. As pistas
de profundidade ("nossa equipe técnica", "estou acompanhando as respostas") mostram que existe
muito acontecendo, sem expor engrenagem nenhuma. Proibições absolutas (checklist de revisão do
PC‑R2): ❌ tabelas · ❌ cards técnicos · ❌ códigos/IDs/status internos · ❌ contadores · ❌ badges
de sistema · ❌ termos internos ("perícia", "sócio", "handoff", "modalidade") · ❌ rodapé
corporativo pesado.

---

# DESIGN SYSTEM (mínimo suficiente — congelado para o PC‑R2)

**Estrutura da página:** coluna única, **max‑width 640px** centrada (proporção de carta) em
qualquer viewport; gutters 20px (mobile) / auto (desktop); seções separadas por espaço, não por
bordas.

**Componentes (7, nomeados):** `Presenca` (ponto + microtexto) · `Saudacao` (H1 + frase) ·
`PilulaTranquilidade` (precisaFazerAlgo) · `Pergunta` (título-pergunta + parágrafo — usado para
"agora", "depois", "tempo") · `Caminho` (timeline) · `NovidadeBalao` (mensagem da AHRI) ·
`VoltarAoWhatsApp` (botão verde). Nada além disso.

**Espaçamento:** base 8px; entre blocos de pergunta 40px (mobile) / 56px (desktop); respiro
acima da saudação 48px; padding interno da pílula 16–20px.

**Tipografia:** a MESMA família da landing (continuidade de marca); corpo 17px/1.65 (mobile
16px); saudação 30/36px peso 600; títulos-pergunta 13px caps suaves (letter‑spacing 0.06em,
cor secundária) — títulos pequenos, respostas grandes (a resposta é a estrela).

**Cor (paleta da marca, uso restrito):** fundo `#F8F9FB`; texto `#1C2128`; secundário
`#5C6672`; **verde WhatsApp** apenas no botão e no ✓ da pílula; **vermelho da marca** apenas no
ponto de presença e no ponto "você está aqui" (identidade, nunca alerta). **v1 somente tema
claro** (calma e controle; dark fica para depois — decisão deliberada).

**Animações (sutis, uma vez só):** entrada dos blocos em cascata (fade + subir 8px, 250ms,
stagger 60ms); respiração da presença (escala 1→1.15, opacidade, ciclo 3s ease-in-out); traço
da timeline desenhando até "você está aqui" (400ms). **`prefers-reduced-motion`: tudo vira
estático.** Nenhuma animação em loop além da respiração.

**Microinterações:** botão WhatsApp com leve elevação no toque; nada de hovers elaborados;
sem toasts, sem tooltips, sem modais — **zero cromo de aplicativo**.

**Estado de carregamento (skeleton):** *"a AHRI escrevendo"* — três pontos pulsando no lugar da
presença + 3 linhas suaves onde a saudação/frases entrarão + texto único: *"Um instante — estou
organizando as informações do seu caso…"*. Sem spinners.

**Estados vazios:** novidades → *"Ainda não há novidades — e isso é normal nesta fase. Eu te
aviso na hora em que algo acontecer, aqui e no WhatsApp."*; sem advogado ainda → seção
simplesmente não aparece (nunca "N/A").

**Estado de erro / link expirado (a MESMA voz):** página curta: *"Esse link já expirou — por
segurança, eles duram um tempo limitado. Me chama no WhatsApp que eu te envio um novo agora
mesmo."* + botão verde. Erro de rede: *"Não consegui carregar as informações agora. Tenta de
novo em instantes — ou me chama no WhatsApp."* Nunca códigos de erro.

**Atualização silenciosa:** revalidação automática discreta (~60s) **sem** flicker, spinner ou
"atualizado às…"; se algo mudou, o bloco novo entra com o mesmo fade suave (o Portal parece
vivo sem parecer nervoso).

**Mobile (comportamento primário):** tudo acima descrito é mobile‑first; alvo de toque ≥44px;
o botão WhatsApp repete no fecho (sem botão flutuante — a página é curta por design).

**Desktop:** exatamente a mesma coluna de 640px, mais respiro vertical — deliberadamente
"pequeno" na tela grande: uma carta sobre a mesa, não um dashboard esticado.

**Acessibilidade:** contraste AA no corpo; foco visível no botão; timeline com texto (não só
cor) para estado; `lang=pt-BR`; sem autoplay de nada.

---

## Critério de homologação deste blueprint
Abrir o Portal e, em ≤5 segundos, um cliente leigo consegue responder em voz alta: *onde meu
caso está, o que está acontecendo, se preciso fazer algo* — sem ter visto nenhum termo técnico
e com a sensação de que **a AHRI escreveu aquela página para ele**.
