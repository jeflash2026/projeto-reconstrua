// ─────────────────────────────────────────────────────────────────────────────
// CNH SERVER (Reconstrua CNH, 2026-09-18) — o serviço PRÓPRIO do funil de CNH
// (contêiner cnh-api). Três portas de entrada, tudo sob /cnh-api:
//
//   • /cnh-api/webhook/meta — o webhook oficial do número da CNH (verificação
//     GET da Meta; POST com ?token=<CNH_META_VERIFY_TOKEN>);
//   • /cnh-api/webhook/encaminhado — o repasse da API do Reconstrua quando o
//     número da CNH está no MESMO app Meta (header x-cnh-encaminhamento);
//   • /cnh-api/admin/* — o painel da CNH (Bearer CNH_API_TOKEN, fail-closed).
//
// Webhook: ACK imediato. Cada mensagem é gravada na hora e a resposta da AHRI
// sai depois de alguns segundos de silêncio (junta as bolhas do cliente).
// ─────────────────────────────────────────────────────────────────────────────
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import {
  mapMetaStatuses,
  mapMetaWebhook,
  type AtendimentoCnh,
  type TipoMensagemCnh,
} from '@reconstrua/infrastructure';
import { bearerToken, requireBearer, secretsMatch } from '../auth/bearer-guard.js';

export interface CnhServerDeps {
  readonly atendimento: AtendimentoCnh;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** O phone_number_id do número da CNH: payload de outro número é ignorado. */
  readonly phoneNumberId: string;
  /** Baixa a mídia de uma mensagem (painel). null = Meta não configurada. */
  readonly baixarMidia:
    | ((mediaId: string) => Promise<{ readonly bytes: Uint8Array; readonly mime: string } | null>)
    | null;
  /** Estado das integrações para a tela de configuração do painel. */
  readonly integracoes: {
    readonly whatsapp: boolean;
    readonly ia: boolean;
    readonly modeloFollowup: string | null;
  };
  /** Silêncio antes de responder (junta as bolhas). Produção ~6 s; testes 0. */
  readonly esperaRespostaMs?: number;
  readonly log?: (evento: string, detalhe: string) => void;
}

const TIPO_POR_KIND: Readonly<Record<string, TipoMensagemCnh>> = {
  text: 'texto',
  audio: 'audio',
  image: 'imagem',
  pdf: 'documento',
  document: 'documento',
};

const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const lista = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const textoOuNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, 200) : null;

/** Anúncio "clique para o WhatsApp" de cada mensagem (campo `referral` que a
 *  Meta manda na primeira mensagem vinda de um anúncio), por id da mensagem. */
export function anunciosDoPayload(
  payload: unknown,
): ReadonlyMap<string, { readonly titulo: string | null; readonly url: string | null }> {
  const mapa = new Map<string, { titulo: string | null; url: string | null }>();
  for (const entry of lista(objeto(payload)?.['entry'])) {
    for (const change of lista(objeto(entry)?.['changes'])) {
      for (const m of lista(objeto(objeto(change)?.['value'])?.['messages'])) {
        const msg = objeto(m);
        const referral = objeto(msg?.['referral']);
        const id = textoOuNull(msg?.['id']);
        if (id === null || referral === null) continue;
        mapa.set(id, {
          titulo: textoOuNull(referral['headline']),
          url: textoOuNull(referral['source_url']),
        });
      }
    }
  }
  return mapa;
}

function autorDe(request: FastifyRequest): string {
  const body = (request.body ?? {}) as { autor?: unknown };
  return typeof body.autor === 'string' && body.autor.trim() !== ''
    ? body.autor.trim().slice(0, 60)
    : 'Painel CNH';
}

export function buildCnhServer(deps: CnhServerDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });
  const { atendimento, env } = deps;
  const espera = deps.esperaRespostaMs ?? 6_000;
  const timers = new Map<string, NodeJS.Timeout>();

  /** Agenda a resposta do lead depois do silêncio (cada mensagem reinicia). */
  const agendarResposta = (leadId: string): void => {
    const anterior = timers.get(leadId);
    if (anterior !== undefined) clearTimeout(anterior);
    timers.set(
      leadId,
      setTimeout(() => {
        timers.delete(leadId);
        void atendimento.responder(leadId).catch((e: unknown) => {
          deps.log?.('responder-falhou', e instanceof Error ? e.message : 'falha');
        });
      }, espera),
    );
  };

  /** Processa um payload da Meta (direto ou repassado). */
  const processar = (payload: unknown): void => {
    const anuncios = anunciosDoPayload(payload);
    for (const inbound of mapMetaWebhook(payload)) {
      if (inbound.phoneNumberId !== null && inbound.phoneNumberId !== deps.phoneNumberId) continue;
      const e = inbound.envelope;
      // Reação, edição e exclusão não são fala nova do cliente.
      if (e.kind === 'reaction' || e.kind === 'edit' || e.kind === 'delete') continue;
      void atendimento
        .receber({
          messageId: e.messageId,
          chatId: e.chatId,
          texto: e.text,
          tipo: TIPO_POR_KIND[e.kind] ?? 'outro',
          mediaId: inbound.mediaId,
          nomeArquivo: e.fileName,
          em: e.timestamp,
          anuncio: anuncios.get(e.messageId) ?? null,
        })
        .then((r) => {
          if (r.responder) agendarResposta(r.leadId);
        })
        .catch((err: unknown) => {
          deps.log?.('receber-falhou', err instanceof Error ? err.message : 'falha');
        });
    }
    for (const s of mapMetaStatuses(payload)) {
      if (
        s.status === 'failed' &&
        (s.phoneNumberId === null || s.phoneNumberId === deps.phoneNumberId)
      )
        deps.log?.(
          'entrega-falhou',
          `chat=${s.chatId} code=${String(s.codigo ?? '')} ${s.titulo ?? ''}`,
        );
    }
  };

  // ── Webhook oficial ────────────────────────────────────────────────────────
  const verifyToken = env['CNH_META_VERIFY_TOKEN'] ?? '';
  app.get('/cnh-api/webhook/meta', (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    if (
      verifyToken !== '' &&
      q['hub.mode'] === 'subscribe' &&
      q['hub.verify_token'] === verifyToken
    )
      return reply.type('text/plain').send(q['hub.challenge'] ?? '');
    return reply.code(403).send({ error: 'verificação recusada' });
  });
  app.post('/cnh-api/webhook/meta', (request, reply) => {
    const q = (request.query as { token?: string } | undefined)?.token;
    const presented = bearerToken(request) ?? (typeof q === 'string' ? q : null);
    if (verifyToken === '' || presented === null || !secretsMatch(presented, verifyToken))
      return reply.code(401).send({ error: 'webhook não autenticado' });
    processar(request.body);
    return { ok: true };
  });

  // ── Repasse da API do Reconstrua (mesmo app Meta) ───────────────────────────
  const segredoRepasse = env['CNH_ENCAMINHAMENTO_SEGREDO'] ?? '';
  app.post('/cnh-api/webhook/encaminhado', (request, reply) => {
    const h = request.headers['x-cnh-encaminhamento'];
    if (segredoRepasse === '' || typeof h !== 'string' || !secretsMatch(h, segredoRepasse))
      return reply.code(401).send({ error: 'repasse não autenticado' });
    processar(request.body);
    return { ok: true };
  });

  app.get('/cnh-api/health', () => ({ ok: true, servico: 'reconstrua-cnh' }));

  // ── Painel (Bearer) ─────────────────────────────────────────────────────────
  requireBearer(app, {
    secret: env['CNH_API_TOKEN'] ?? '',
    protect: (path) => path.startsWith('/cnh-api/admin'),
  });

  const idDe = (request: FastifyRequest): string =>
    ((request.params as { id?: string }).id ?? '').replace(/\D/g, '');

  app.get('/cnh-api/admin/config', () => deps.integracoes);
  app.get('/cnh-api/admin/resumo', () => atendimento.resumo());
  app.get('/cnh-api/admin/leads', async () => ({ leads: await atendimento.listar() }));
  app.get('/cnh-api/admin/leads/:id', async (request, reply) => {
    const lead = await atendimento.obter(idDe(request));
    return lead === null ? reply.code(404).send({ error: 'lead não encontrado' }) : lead;
  });
  app.post('/cnh-api/admin/leads/:id/mensagem', (request) => {
    const body = (request.body ?? {}) as { texto?: unknown };
    return atendimento.mensagemDaEquipe(
      idDe(request),
      typeof body.texto === 'string' ? body.texto.slice(0, 4_000) : '',
      autorDe(request),
    );
  });
  app.post('/cnh-api/admin/leads/:id/assumir', (request) =>
    atendimento.assumir(idDe(request), autorDe(request)),
  );
  app.post('/cnh-api/admin/leads/:id/devolver', (request) =>
    atendimento.devolverParaAhri(idDe(request), autorDe(request)),
  );
  app.post('/cnh-api/admin/leads/:id/etapa', (request) => {
    const body = (request.body ?? {}) as { etapa?: unknown };
    return atendimento.moverEtapa(
      idDe(request),
      typeof body.etapa === 'string' ? body.etapa : '',
      autorDe(request),
    );
  });
  app.post('/cnh-api/admin/leads/:id/contrato', (request) =>
    atendimento.marcarContratoEnviado(idDe(request), autorDe(request)),
  );
  app.post('/cnh-api/admin/leads/:id/pagamento', (request) =>
    atendimento.marcarPagamento(idDe(request), autorDe(request)),
  );
  app.post('/cnh-api/admin/leads/:id/descartar', (request) => {
    const body = (request.body ?? {}) as { motivo?: unknown };
    return atendimento.descartar(
      idDe(request),
      typeof body.motivo === 'string' ? body.motivo : 'outro',
      autorDe(request),
    );
  });
  app.post('/cnh-api/admin/leads/:id/reabrir', (request) =>
    atendimento.reabrir(idDe(request), autorDe(request)),
  );
  app.post('/cnh-api/admin/leads/:id/visto', (request) => atendimento.marcarVisto(idDe(request)));
  app.get('/cnh-api/admin/followups', async () => ({
    followups: await atendimento.followupsDevidos(),
  }));
  app.post('/cnh-api/admin/followups/enviar', async (request) => {
    const body = (request.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((i): i is string => typeof i === 'string').slice(0, 200)
      : [];
    return { resultados: await atendimento.enviarFollowups(ids, autorDe(request)) };
  });

  /** Mídia do cliente (foto da carta do DETRAN, documento): só o que está na
   *  conversa DAQUELE lead é servido — nunca um mediaId arbitrário. */
  app.get('/cnh-api/admin/leads/:id/midia/:mediaId', async (request, reply) => {
    const mediaId = (request.params as { mediaId?: string }).mediaId ?? '';
    const lead = await atendimento.obter(idDe(request));
    if (lead === null || !lead.conversa.some((m) => m.mediaId === mediaId))
      return reply.code(404).send({ error: 'mídia não encontrada' });
    if (deps.baixarMidia === null)
      return reply.code(503).send({ error: 'WhatsApp não configurado' });
    const midia = await deps.baixarMidia(mediaId);
    if (midia === null) return reply.code(502).send({ error: 'a Meta não entregou a mídia' });
    return reply
      .type(midia.mime)
      .header('cache-control', 'private, max-age=300')
      .send(Buffer.from(midia.bytes));
  });

  return app;
}
