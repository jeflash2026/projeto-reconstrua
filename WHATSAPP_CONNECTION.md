# Conexão WhatsApp pelo Portal Admin

Gerencia a instância **Evolution** de produção diretamente do Portal Admin, sem depender do
painel da Evolution. Uma instância só é considerada válida quando o QR é lido com o **número
oficial** da empresa (`554137989737`).

## Decisões de arquitetura (aprovadas)

- **Persistir + aplicar no restart** (sem hot-reload). A config confirmada (instância, apiKey,
  número) é persistida no `ConfigStore` **existente**; o gateway de envio da AHRI passa a usá-la
  no **próximo restart controlado** (não há troca de instância em runtime).
- **`EVOLUTION_GLOBAL_API_KEY`** só no backend: nunca vai ao browser, a logs ou a respostas.
  Usada apenas nos endpoints administrativos protegidos (BL-2.1).
- **Perfil FOUNDER** para operações destrutivas (criar/descartar): além do Bearer do Admin,
  exige o header `x-founder-secret` = `FOUNDER_ACCESS_SECRET`. Descarte exige `confirm:true`.
- **Auditoria durável** (B5.3): cada ação registra perfil + instância + quando, via
  `ObservabilityRuntime` (aparece no `docker logs`).
- **Validação do número**: a confirmação só ativa se `ownerJid` == número oficial; divergente ⇒
  erro `"O número conectado não corresponde ao número oficial da empresa."` e permite novo QR.

## Componentes (backend)

- `EvolutionInstanceClient` — wrapper da API de INSTÂNCIAS da Evolution (create, connect/QR,
  connectionState, fetchInstances/ownerJid, logout, delete, webhook/set). HTTP próprio injetável
  (GET/POST/DELETE); **não** usa o gateway de envio congelado.
- `WhatsAppConnectionRuntime` — orquestra status/criar/QR/confirmar/descartar; valida o número;
  persiste a config pendente; audita. **Nunca** retorna segredos.

## Rotas (API Admin, todas atrás de BL-2.1)

| Método | Rota                                 | Perfil          | Função                                                                                |
| ------ | ------------------------------------ | --------------- | ------------------------------------------------------------------------------------- |
| GET    | `/admin/whatsapp/status`             | Admin           | Status: ativa (env) × pendente (persistida) × ao vivo (Evolution) + `matchesOfficial` |
| GET    | `/admin/whatsapp/qr/:instance`       | Admin           | (Re)gera o QR da instância                                                            |
| POST   | `/admin/whatsapp/confirm`            | Admin           | Confirma; só ativa se `ownerJid` == oficial                                           |
| GET    | `/admin/whatsapp/apply-instructions` | Admin           | Valores de `.env` + comando para aplicar no restart                                   |
| POST   | `/admin/whatsapp/instances`          | **Founder**     | Cria nova instância + webhook (destrutivo)                                            |
| POST   | `/admin/whatsapp/discard`            | **Founder**     | Logout + delete da instância (exige `confirm:true`)                                   |
| GET    | `/production/whatsapp`               | Operador (B5.1) | Status para o card do Production UI                                                   |

## Tela (Portal Admin) — "Conexão WhatsApp"

`/conexao-whatsapp`: verifica status em tempo real; cria nova instância (Founder); exibe o QR com
auto-refresh; botão "Confirmar conexão" (valida o número); "Descartar instância antiga"
(Founder + confirmação); "Aplicar Configuração" (mostra os valores de `.env` + restart). Quando o
número oficial conecta: **✅ WhatsApp conectado / Número / OwnerJid / ONLINE**.

## Card (Production UI `/production/ui`)

Card **WhatsApp**: `● Online/○ Offline`, número conectado, OwnerJid, instância, webhook, última sync.

## Variáveis de ambiente (novas)

| Variável                   | Onde                               | Descrição                                                         |
| -------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `EVOLUTION_GLOBAL_API_KEY` | API (.env)                         | Chave GLOBAL da Evolution — só backend; criar/descartar           |
| `FOUNDER_ACCESS_SECRET`    | API (.env)                         | Segredo do perfil Founder (header `x-founder-secret`)             |
| `OFFICIAL_WHATSAPP_NUMBER` | API (.env, default `554137989737`) | Número oficial esperado no QR                                     |
| `FOUNDER_API_TOKEN`        | Portal (.env)                      | = `FOUNDER_ACCESS_SECRET`; usado server-side pelas Server Actions |

## Fluxo operacional

1. Admin abre **Conexão WhatsApp** → vê status (instância antiga com número divergente, se houver).
2. (Founder) **Descartar instância antiga**.
3. (Founder) **Criar nova instância** (`reconstrua-prod`) → webhook configurado automaticamente.
4. **QR** aparece na tela (auto-refresh) → ler com o aparelho do **+55 41 3798-9737**.
5. **Confirmar conexão** → valida `ownerJid`; se oficial ⇒ persiste a config pendente.
6. **Aplicar Configuração** → aplicar `.env` + restart controlado (Operador).
7. Após o restart, o status mostra **ONLINE** e o app usa a nova instância/número.

## Limitações conscientes (não implementadas por decisão)

- **Sem hot-reload**: a nova instância só entra em uso após o restart controlado.
- **Aplicação via operador**: o botão "Aplicar" instrui o `.env` + restart (o app lê Evolution do
  ambiente no boot; não há gravação automática do `.env` do host pelo container).
- **Integração Evolution não é testável offline**: o backend é coberto por testes unitários com
  HTTP falso; a validação ponta a ponta exige uma Evolution real (homologação na VPS).
