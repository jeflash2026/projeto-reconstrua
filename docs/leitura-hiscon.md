# Leitura do HISCON — o modelo definitivo (decreto 2026-07-27)

**Objetivo do dono:** leitura **100% real** de cada HISCON e, depois, a entrega
organizada dos **últimos 5 anos** — da qual todo o resto da plataforma se
alimenta (potencial financeiro, pedidos administrativos, contratos por
cliente/banco, dossiê do perito).

Este documento descreve o modelo, por que ele é assim, e como recalibrá-lo.
Calibrado com um **PDF real da base** (NYCOLLAS, 27/07/2026, 10 páginas) e
validado contrato a contrato contra o documento impresso.

## Princípios

1. **Por coordenada, nunca por texto corrido.** Um PDF não contém tabelas —
   contém milhares de fragmentos de texto com coordenadas ("154712" em x=20,
   "R$2.786" + ",94" em linhas vizinhas). Extração linear embaralha números de
   contrato: proibida para dado jurídico.
2. **Sem IA no caminho do PDF nativo.** A leitura é mecânica e determinística
   (pdf.js). A Vision só entra para foto/escaneado — e foto **nunca** vale como
   HISCON (regra do funil).
3. **100% real ou em branco.** Campo que não casa o formato esperado é omitido
   — nunca um valor de outra coluna vira dado no dossiê.
4. **Nunca falhar em silêncio.** Toda leitura é auditada contra o próprio
   documento (abaixo).

## A engine (`hiscon-posicional-v2.ts`)

### 1. Normalização
Cada item de texto é transformado pela **matriz do viewport** (scale 1) —
desfaz a rotação (as páginas do HISCON são paisagem rotacionada 90°) e leva a
origem ao topo-esquerdo. Centro x do item = `x + width/2` decide a coluna.

### 2. Classificação POR PÁGINA (a chave de tudo)
O HISCON real tem seções com layouts diferentes — ler tudo com um mapa só é o
erro que inflava leituras (caso NYCOLLAS: ~80 linhas mensais viravam "87
contratos"):

| Página (título)                              | O que é                       | Tratamento |
|----------------------------------------------|-------------------------------|------------|
| capa ("Quantitativo de Empréstimos…")        | benefício + o DECLARADO       | cabeçalho + auditoria |
| "VALORES DO BENEFÍCIO"                       | margens (base, extrapolada…)  | linhas de margem (indícios) |
| "CONTRATOS ATIVOS/EXCLUÍDOS" (sem cartão)    | **empréstimos** (linha=contrato) | mapa de empréstimos |
| "CARTÃO DE CRÉDITO" + "CONTRATOS…"           | **contratos** RMC/RCC         | mapa de cartão |
| "DESCONTOS DE CARTÃO"                        | histórico MENSAL do cartão    | **pulado** (mês ≠ contrato) |

### 3. Mapas de colunas (centros x fixos do template do INSS)
- **Empréstimos** (25 colunas): contrato→25 · banco→54 · situação→80 ·
  averbação→108 · inclusão→138 · início→170 · fim→205 · qtde→235 · parcela→265
  · emprestado→308 · liberado→355 · IOF→388 · CET→414/442 · juros→470/498 ·
  pago→526 · 1º desconto→561 · (suspensões/exclusão→598…813, lidas e não
  mapeadas). **Âncora do registro: o token `MM/AAAA` do início de desconto.**
- **Cartão (contratos)**: contrato→55 · tipo→120 · banco→190 · situação→248 ·
  averbação→300 · inclusão→352 · limite→408 · reservado→462. **Âncora: a data
  `dd/mm/aa` da inclusão.** O RESERVADO/ATUALIZADO é o mensal comprometido do
  cartão ⇒ vira VALOR PARCELA a jusante. RMC×RCC decide a seção pela coluna TIPO.

### 4. Segmentação e remontagem
Registros cortados no **ponto médio entre âncoras**; células multi-linha
remontadas por (y, x) — sem espaço nas numéricas, com espaço nas textuais.
Linhas de **cabeçalho/título são removidas por linha inteira** (3+ tokens do
vocabulário de cabeçalho), inclusive no MEIO da página (sub-tabela "EXCLUÍDOS").
Notas de rodapé (`*`) delimitam o fim do corpo.

### 5. Normalizações com fronteira
- Situação canônica por prefixo (ATIVO/SUSPENSO/EXCLUÍDO/ENCERRADO/RESERVADO);
  fora disso ⇒ campo omitido.
- **Migração** (juridicamente crítico): o bloco "Migrado do contrato X CBC: N"
  é alto e vaza fragmentos entre linhas vizinhas. A âncora confiável é a frase
  **"do contrato"**: quem a tem É migrado (o "Migrado" perdido é reposto; os
  dígitos partidos são reunidos); um "Migrado" solto numa linha com vocabulário
  de averbação é descarte de vazamento. Errar isso mandaria contrato migrado
  para pedido administrativo indevido — ou o contrário.
- Banco: código numérico resolvido por dicionário (35 consignatários);
  desconhecido = texto bruto (nunca inventar nome).

### 6. Auditoria embutida (nunca silêncio)
A capa declara o "Quantitativo de Empréstimos por Situação". A leitura compara
**ativos e suspensos lidos × declarados** (e o TOTAL, quando o quantitativo
lista excluídos/encerrados). Resultado no cabeçalho do texto:
`AUDITORIA DA LEITURA: conferida…` / `DIVERGÊNCIA…` / `quantitativo não
localizado`. Cartões ficam fora da conta (o quantitativo declara empréstimos).

### 7. Portão do template e escolha
Uma página de tabela só é processada se o **cabeçalho aparecer nas posições
esperadas** (incluindo um rótulo do lado direito). A produção
(`pdf-text-extractor.extrairTextoDePdf`) roda V2 e V1 e escolhe pelo
`escolherLeituraHiscon`: **V2 conferido vence**; sem conferência, vence quem
mais se aproxima do declarado; nenhum leu ⇒ extração linear ⇒ Vision.

### 8. Saída e o resto da plataforma
A saída é o texto **Formato A** que `parseHisconDetalhado` (application) já lê
— nada a jusante mudou. Dali: `contratosDaJanela` aplica os **5 anos** pela
competência de desconto; `agruparPorBanco`, migrados, potencial e indícios
(margem extrapolada etc.) se alimentam do mesmo parse.

## Validação e recalibração

- **Testes**: `hiscon-posicional-v2.test.ts` grava o comportamento (fixtures
  com a fragmentação real, rotação, auditoria, histórico mensal pulado, caso
  do migrado vazado).
- **Relatório vivo**: página admin **"Releitura HISCON"** roda os dois leitores
  sobre TODOS os PDFs armazenados (só leitura; nada regravado) com medidores
  de qualidade (números válidos × marcadores × coincidência com a leitura
  atual). É o critério objetivo para reprocessar clientes.
- **Ferramenta de calibração**: `packages/infrastructure/scripts/dump-hiscon.mjs`
  despeja os itens posicionais de um PDF
  (`node scripts/dump-hiscon.mjs entrada.pdf saida.json`, rodando de
  `packages/infrastructure`). Se o INSS mudar o template, é com ela que se
  levantam as novas coordenadas.

## Limitações conhecidas
- HISCON enviado como FOTO não tem releitura posicional (Vision leu; o funil
  hoje recusa fotos novas).
- O CBC da migração pode se perder quando o bloco vaza inteiro para a linha
  vizinha (o contrato de origem em si é preservado).
- O histórico mensal de descontos do cartão é pulado; agregá-lo (ex.: total
  descontado em RMC — útil para a tese do cartão) é evolução futura.

## Revínculo do HISCON (caso Roberto, 2026-07-27)

Descoberta em produção: vários "leitor não reconheceu a tabela" **não eram
problema de leitura** — o CNIS registrado apontava ao **anexo errado** (a
pessoa mandou outro arquivo antes, e o HISCON verdadeiro chegou depois na
mesma conversa; o PDF certo lia perfeitamente).

Ferramenta: `packages/infrastructure/src/pericia/revinculo-hiscon.ts`
(`RevinculoHiscon`), exposta na página **Releitura HISCON** do painel:

- **`candidatos()`** (GET `/admin/pericia/revinculo-hiscon`, SÓ LEITURA):
  para cada cliente cujo HISCON registrado não produz leitura V2 conferida,
  varre os anexos PDF da MESMA conversa (`conv:<chatId>` → `meta.messageId` →
  `media-message-ref` → sha256) e lista os que leem com **auditoria
  conferida**, com beneficiário, contratos e data — para o dono reconhecer o
  arquivo certo.
- **`aplicar(chatId, sha256)`** (POST `/admin/pericia/revinculo-aplicar`, ato
  explícito do dono, confirmação em 2 passos no painel): **reverifica tudo do
  zero** (nada vindo do painel é confiado), exige que o anexo **pertença
  àquela conversa** (nunca religa o PDF de outro cliente), guarda backup do
  vínculo antigo (`document-link-backup`) e do texto que houver no cache do
  sha novo (`document-text-backup`), religa `documentId → sha` no
  `document-link`, grava o texto V2 no `document-text` e deixa trilha em
  `revinculo-hiscon` (de → para, quando).

A identidade documental (documentId do CNIS no onboarding) **não muda** — só o
blob ao qual ela aponta. Toda a plataforma a jusante passa a ler o PDF certo
imediatamente. Testes: `revinculo-hiscon.test.ts` (invariante só-leitura do
relatório, recusa de sha de outra conversa, recusa sem auditoria conferida,
backups e trilha).

### Upload manual (quando o anexo nunca foi capturado)

Diagnóstico de 27/07: nas conversas mais antigas, o anexo original **não tem
bytes no acervo** (a captura de mídia ainda não existia) — o revínculo não tem
o que oferecer. Para esses casos, o bloco de revínculo ganhou **"Enviar HISCON
do meu WhatsApp (PDF)"**: o dono sobe o arquivo, o serviço valida os magic
bytes `%PDF`, teto de 20 MB, roda o leitor e **só aceita auditoria conferida**.
O fluxo é em 2 passos: primeiro um **dry-run** (POST
`/admin/pericia/revinculo-upload` com `confirmar=false`) que mostra
beneficiário/contratos SEM gravar nada; a confirmação grava o blob
(content-addressed por sha256), religa com os mesmos backups e deixa trilha
com `origem: 'upload-admin'` (o vínculo fica com
`messageId = upload-admin:<data>` — a procedência do ato é auditável).

### HISCON zerado (caso Marcelo, 27/07)

Existe HISCON **legítimo com zero contratos**: quem nunca fez consignado recebe
um PDF de 2 páginas (quantitativo declarando 0 em tudo + margens), **sem
nenhuma página de tabela**. O leitor aceita esse documento como leitura válida
(0 contratos, auditoria conferida) SOMENTE quando o próprio documento declara
zero E nenhuma página de tabela foi detectada — quantitativo > 0 sem tabela
lida, ou tabela presente que o portão pulou, continuam sendo recusa (nunca
inventar zero). O texto sai com o cabeçalho normal + a linha "NENHUM CONTRATO
DE EMPRÉSTIMO CONSIGNADO REGISTRADO NO DOCUMENTO".

### Contrato bancário ≠ HISCON (caso 5521969515359, 27/07)

O CONTRATO do empréstimo firmado com o banco (cédula de crédito bancário,
proposta, termo de adesão) cita "empréstimo consignado" e era aceito pelo
classificador como HISCON ("cadastro completo"). Trava
`pareceContratoBancario` em `onboarding-documental.ts`: sinal FORTE de
contrato (cédula/contrato/proposta/termo de adesão) ou 2 sinais fracos
(cláusula, emitente, credor, assinatura…) SEM sinal forte de extrato do INSS ⇒
OUTRO, com a mensagem própria `contratoBancarioRecebido` explicando a
diferença e pedindo o extrato do Meu INSS.
