# Reconstrua CNH — funil de captação da tese de CNH

Sistema próprio, separado do consignado, para captar clientes com problema na CNH
(suspensão e cassação) pelo WhatsApp. A AHRI atende seguindo o roteiro do
escritório do Dr. Glauco Voigt (etapas 1 a 4: recepção → qualificação →
viabilidade → proposta) e passa para a equipe no aceite.

## Peças

| Peça | Onde | O que faz |
| --- | --- | --- |
| Regras do roteiro | `packages/application/src/cnh/funil-cnh.ts` | Etapas, ficha do lead, descartes, honorários e os textos do roteiro |
| AHRI da CNH | `packages/application/src/cnh/ahri-cnh.ts` | Instruções da IA e a validação de cada resposta |
| Atendimento | `packages/infrastructure/src/cnh/atendimento-cnh.ts` | Recebe, responde, grava e as ações do painel |
| Serviço `cnh-api` | `apps/api/src/cnh/` | Webhook da Meta, repasse e rotas do painel (porta 3140) |
| Painel | `apps/portal-cnh` | `/cnh` (porta 3950) |
| Dados | `infrastructure/database/init/07-cnh.sql` | Tabela própria `cnh.documents` |

O `cnh-api` usa a mesma imagem da API do Reconstrua, mas é outro contêiner, com
variáveis próprias (`CNH_*`). Uma pane na CNH não afeta o consignado.

## Como a AHRI atende

A IA conduz a conversa pelo roteiro e devolve, a cada mensagem, o que respondeu,
o que aprendeu (a ficha) e a ação. Antes de sair para o cliente, cada resposta é
conferida:

- **Proposta, descarte, transferência e aceite** saem com as palavras do roteiro.
  A IA escolhe o momento, nunca o texto.
- **Honorários só da tabela**: suspensão R$ 1.500,00 e cassação R$ 2.000,00, à
  vista ou em até 2 vezes. Preço antes da proposta, ou qualquer outro valor em
  R$, derruba a resposta.
- **Promessa de resultado** ("garanto", "causa ganha") derruba a resposta.
- **A etapa só avança pelo roteiro**: não dá para pular da recepção para a
  proposta.
- Resposta derrubada volta uma vez para a IA. Se falhar de novo, sai a próxima
  pergunta do roteiro e o painel avisa.

**Urgência** ("fui parado agora", audiência hoje) e **"quero falar com o doutor"**
passam o lead para a equipe. **Aceite** também: a AHRI para de responder e o
painel mostra "enviar contrato e pagamento".

**"Vou pensar"** vira lead morno. O follow-up de 24 h **não sai sozinho**: ele
aparece na fila do painel e só é enviado quando alguém aprova (regra da casa
desde julho de 2026).

A IA ainda não lê áudio nem foto: ela vê "[o cliente enviou uma foto]" e segue o
roteiro. A equipe abre a mídia pelo painel.

## Implantação

### 1. Variáveis no `.env` da VPS

```
CNH_API_TOKEN=<gere um segredo longo>
CNH_PAINEL_SENHA=<senha do painel>
CNH_ENCAMINHAMENTO_SEGREDO=<gere outro segredo>
CNH_META_VERIFY_TOKEN=<gere outro segredo>
CNH_META_PHONE_NUMBER_ID=<id do número da CNH na Meta>
# Só se o número estiver em outro app Meta:
CNH_META_TOKEN=
# Depois que o modelo de follow-up for aprovado na Meta:
CNH_META_TEMPLATE_FOLLOWUP=
```

### 2. Subir

```
cd /opt/reconstrua && git pull
bash deploy.sh
docker compose --env-file .env -f docker-compose.production.yml up -d --build cnh-api portal-cnh
docker restart nginx-proxy-manager
```

O `deploy.sh` roda a migração que cria a tabela `cnh.documents` e atualiza a API
do Reconstrua com o repasse.

### 3. NPM (nos dois hosts do domínio)

| Location | Destino |
| --- | --- |
| `/cnh` | `2.25.162.251` porta `3950` |
| `/cnh-api` | `2.25.162.251` porta `3140` |

### 4. WhatsApp (Meta)

1. Cadastre o número novo da CNH no Meta Business e copie o **phone_number_id**
   para `CNH_META_PHONE_NUMBER_ID`.
2. **Número no mesmo app do Reconstrua**: não configure webhook novo. A API do
   Reconstrua reconhece que a mensagem é de outro número e repassa ao `cnh-api`.
3. **Número em app próprio**: webhook
   `https://www.projetoreconstrua.com.br/cnh-api/webhook/meta?token=<CNH_META_VERIFY_TOKEN>`,
   token de verificação igual a `CNH_META_VERIFY_TOKEN`, campo `messages`.

### 5. Modelo de follow-up (para enviar depois de 24 h)

Crie na Meta um modelo de categoria **Marketing**, idioma português (BR), com uma
variável para o primeiro nome. Sugestão de texto:

> Oi, {{1}}! Passando para saber se ficou alguma dúvida sobre o seu caso da CNH.
> Se houver prazo correndo, quanto antes começarmos, mais opções de defesa
> existem. Posso te ajudar a seguir?

Quando for aprovado, coloque o nome dele em `CNH_META_TEMPLATE_FOLLOWUP` e suba o
`cnh-api` de novo.

## O site (feito à parte)

O site não precisa de servidor próprio nem de formulário. Todo botão de contato
abre o WhatsApp da CNH com uma mensagem pronta; quem começa a conversa é o
cliente, e a AHRI responde na hora:

```
https://wa.me/55DDDNUMERO?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20preciso%20de%20ajuda%20com%20a%20minha%20CNH.
```

Texto para passar a quem for fazer o site:

> Site de captação para advogado de Direito de Trânsito (suspensão e cassação de
> CNH). Todos os botões de ação ("Falar com um especialista", "Quero defender
> minha CNH") devem abrir o link do WhatsApp acima em nova aba. Não criar
> formulário: o atendimento acontece todo no WhatsApp. Não prometer resultado nem
> falar em "causa ganha" (regras da OAB). Os honorários não aparecem no site.
