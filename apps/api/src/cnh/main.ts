// ─────────────────────────────────────────────────────────────────────────────
// RECONSTRUA CNH — ponto de partida do contêiner cnh-api (2026-09-18). Mesma
// imagem da API do Reconstrua, outro processo: `node apps/api/dist/cnh/main.js`.
// Tudo o que é da CNH vem de variáveis PRÓPRIAS (CNH_*): número de WhatsApp,
// token do painel, segredo do repasse. Dados na tabela cnh.documents.
// Sem número configurado o serviço sobe mesmo assim (o painel mostra o que
// falta); sem DATABASE_URL, guarda em memória e avisa (só para teste local).
// ─────────────────────────────────────────────────────────────────────────────
import {
  AnthropicCompletion,
  AtendimentoCnh,
  CompletionComRetentativa,
  FetchHttpClient,
  FetchMetaHttp,
  InMemoryJsonStore,
  MetaCloudGateway,
  PgJsonStore,
  PostgresSqlClient,
  SystemClock,
  type JsonStore,
} from '@reconstrua/infrastructure';
import { ESCRITORIO_CNH_PADRAO } from '@reconstrua/application';
import { buildCnhServer } from './cnh-server.js';

function log(evento: string, detalhe: string): void {
  process.stdout.write(`[cnh] ${new Date().toISOString()} ${evento} ${detalhe}\n`);
}

async function main(): Promise<void> {
  const env = process.env;
  const clock = new SystemClock();

  const databaseUrl = env['DATABASE_URL'] ?? '';
  let json: JsonStore;
  if (databaseUrl !== '') {
    json = new PgJsonStore(PostgresSqlClient.connect(databaseUrl), 'cnh.documents');
  } else {
    json = new InMemoryJsonStore();
    log(
      'aviso',
      'DATABASE_URL ausente — dados em MEMÓRIA (somem ao reiniciar). Só para teste local.',
    );
  }

  // WhatsApp oficial: número PRÓPRIO da CNH. O token pode ser o mesmo do app
  // do Reconstrua (CNH_META_TOKEN vazio ⇒ usa META_WHATSAPP_TOKEN).
  const token = env['CNH_META_TOKEN'] || env['META_WHATSAPP_TOKEN'] || '';
  const phoneNumberId = env['CNH_META_PHONE_NUMBER_ID'] ?? '';
  const gateway =
    token !== '' && phoneNumberId !== ''
      ? new MetaCloudGateway(
          new FetchMetaHttp(),
          { token, phoneNumberId, graphVersion: env['META_GRAPH_VERSION'] },
          clock,
          (m) => {
            log('meta', m);
          },
        )
      : null;
  if (gateway === null)
    log('aviso', 'CNH_META_PHONE_NUMBER_ID/token ausentes — a AHRI não envia mensagens.');

  // A IA: o mesmo provedor do Reconstrua (Anthropic), com retentativa.
  const chave = env['ANTHROPIC_API_KEY'] ?? '';
  const modelo = env['CNH_ANTHROPIC_MODEL'] || env['ANTHROPIC_MODEL'] || 'claude-sonnet-5';
  const llm =
    chave !== ''
      ? new CompletionComRetentativa(new AnthropicCompletion(new FetchHttpClient(), chave, modelo))
      : null;
  if (llm === null)
    log('aviso', 'ANTHROPIC_API_KEY ausente — a AHRI responde só pela reserva do roteiro.');

  const modeloFollowup = env['CNH_META_TEMPLATE_FOLLOWUP'] ?? '';
  const idiomaFollowup = env['CNH_META_TEMPLATE_IDIOMA'] || 'pt_BR';

  const atendimento = new AtendimentoCnh({
    json,
    clock,
    enviar: async (chatId, texto) => {
      if (gateway === null) throw new Error('WhatsApp da CNH não configurado');
      const recibo = await gateway.sendText(chatId, texto);
      if (recibo.providerMessageId === '') throw new Error('a Meta recusou o envio');
    },
    enviarTemplateFollowup:
      gateway !== null && modeloFollowup !== ''
        ? async (chatId, nome) => {
            const ok = await gateway.sendTemplate(chatId, modeloFollowup, idiomaFollowup, [
              nome.trim().split(/\s+/)[0] || 'tudo bem',
            ]);
            if (!ok) throw new Error('a Meta recusou o modelo de follow-up');
          }
        : null,
    completar:
      llm !== null
        ? async (system, user) => (await llm.complete(system, user, { maxTokens: 1_500 })).text
        : null,
    escritorio: {
      advogadoCurto: env['CNH_ADVOGADO_CURTO'] || ESCRITORIO_CNH_PADRAO.advogadoCurto,
      advogadoCompleto: env['CNH_ADVOGADO_COMPLETO'] || ESCRITORIO_CNH_PADRAO.advogadoCompleto,
      area: env['CNH_AREA'] || ESCRITORIO_CNH_PADRAO.area,
    },
    pausa: (ms) => new Promise((r) => setTimeout(r, ms)),
    observar: log,
  });

  const app = buildCnhServer({
    atendimento,
    env,
    phoneNumberId,
    baixarMidia: gateway !== null ? (id) => gateway.baixarMidia(id) : null,
    integracoes: {
      whatsapp: gateway !== null,
      ia: llm !== null,
      modeloFollowup: modeloFollowup === '' ? null : modeloFollowup,
    },
    log,
  });
  const port = Number(env['CNH_PORT'] ?? '3140');
  await app.listen({ host: '0.0.0.0', port });
  log(
    'pronto',
    `porta ${String(port)} · WhatsApp ${gateway ? 'ok' : 'desligado'} · IA ${llm ? modelo : 'desligada'}`,
  );
}

main().catch((e: unknown) => {
  process.stderr.write(
    `[cnh] falha ao subir: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`,
  );
  process.exitCode = 1;
});
