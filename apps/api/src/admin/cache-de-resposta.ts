// ─────────────────────────────────────────────────────────────────────────────
// CACHE DE RESPOSTA GET (2026-08-24, "o sistema todo está sobrecarregado") — o
// Admin tem ~40 rotas de leitura e só meia dúzia tinha cache; cada clique do
// painel varria a base inteira num processo SINGLE-THREAD, e enquanto a
// varredura corria nada mais andava (nem a AHRI, nem a secretária).
//
// Este módulo cacheia a RESPOSTA PRONTA (o JSON serializado) de toda rota GET
// de leitura, num único lugar, com o regime que já provou funcionar no Centro
// de Comando (memo-curto):
//   • TTL — a mesma varredura não se repete a cada clique/refresh;
//   • REQUENTAR — valor vencido sai NA HORA e a recomputação corre por trás
//     (re-injeção interna da própria rota); a página nunca espera a varredura;
//   • INVALIDAÇÃO — qualquer ação do painel derruba tudo (o clique do Admin
//     reflete na hora); o cache só serve leituras repetidas entre ações.
//
// O que NUNCA entra no cache (freshness ou natureza binária):
//   • /admin/humanizado/* — mesa e chat em tempo real (memo próprio; mensagens
//     de cliente chegam por webhook e não passam por aqui);
//   • /admin/clients/* — detalhe/dossiê por cliente (cache por chave próprio,
//     5–15s, mais fresco que este);
//   • anexos, zips, planilhas, QR, logs, health, config — binários ou vivos.
// Além da lista, só respostas 200 com content-type JSON são guardadas — um
// download que escape da lista jamais é cacheado por engano.
//
// SEGURANÇA: o hook é registrado DEPOIS do requireBearer (mesma fase onRequest,
// ordem de registro) — requisição sem Bearer morre no 401 antes de ver o cache.
// ─────────────────────────────────────────────────────────────────────────────
import type { FastifyInstance } from 'fastify';

export interface CacheDeResposta {
  /** Derruba tudo (sem argumento) ou só as URLs com o prefixo dado. */
  invalidar(prefixo?: string): void;
}

export interface CacheDeRespostaOpcoes {
  /** Idade em que o valor deixa de ser "fresco" (padrão 30s). */
  readonly ttlMs?: number;
  /** Idade máxima em que o vencido ainda sai na hora enquanto requenta
   *  (padrão 5min); além disso a leitura volta a ser fria. */
  readonly maxIdadeMs?: number;
  /** Relógio injetável (testes determinísticos). */
  readonly agora?: () => number;
}

/** Nunca cacheáveis por PREFIXO de rota. */
const PREFIXOS_VIVOS = [
  '/admin/humanizado/',
  '/admin/clients/',
  // A RESPOSTA varia pelo header x-pericia-papel (mascaramento LGPD por papel):
  // cachear por URL serviria o dado do administrador ao auditor — nunca entra.
  '/admin/pericia-digital/',
  '/admin/logs',
  '/admin/health',
  '/admin/config',
  '/admin/bootstrap',
  '/admin/whatsapp/',
] as const;

/** Nunca cacheáveis por TRECHO (downloads e derivados binários). */
const TRECHOS_BINARIOS = ['/anexo/', '/content', 'zip', '/pacote', '/planilha', '/qr'] as const;

/** Só o que passa aqui pode ser guardado. Exportado para o teste fixar a regra. */
export function urlCacheavel(url: string): boolean {
  const caminho = url.split('?')[0] ?? '';
  if (!caminho.startsWith('/admin/')) return false;
  if (PREFIXOS_VIVOS.some((p) => caminho.startsWith(p))) return false;
  if (TRECHOS_BINARIOS.some((t) => caminho.includes(t))) return false;
  return true;
}

/** Resposta maior que isto não é guardada (proteção de memória). */
const LIMITE_CORPO = 6 * 1024 * 1024;
/** Teto de URLs distintas guardadas; estourou, a mais velha sai. */
const LIMITE_ENTRADAS = 300;

const MARCA_REQUENTE = 'x-cache-requentar';

interface Entrada {
  em: number;
  corpo: string;
  tipo: string;
}

export function instalarCacheDeResposta(
  app: FastifyInstance,
  opcoes?: CacheDeRespostaOpcoes,
): CacheDeResposta {
  const ttlMs = opcoes?.ttlMs ?? 30_000;
  const maxIdadeMs = opcoes?.maxIdadeMs ?? 5 * 60_000;
  const agora = opcoes?.agora ?? Date.now;
  const guardadas = new Map<string, Entrada>();
  const emRequente = new Set<string>();

  // Recomputa a rota POR DENTRO (inject) com a marca que fura o cache; a
  // resposta nova cai no onSend e substitui a velha. Voo único por URL.
  const requentar = (url: string, authorization: string | undefined): void => {
    if (emRequente.has(url)) return;
    emRequente.add(url);
    void app
      .inject({
        method: 'GET',
        url,
        headers: {
          ...(authorization !== undefined ? { authorization } : {}),
          [MARCA_REQUENTE]: '1',
        },
      })
      .catch(() => undefined)
      .finally(() => {
        emRequente.delete(url);
      });
  };

  app.addHook('onRequest', (request, reply, done) => {
    if (request.method !== 'GET' || request.headers[MARCA_REQUENTE] !== undefined) {
      done();
      return;
    }
    const entrada = guardadas.get(request.url);
    if (entrada === undefined || !urlCacheavel(request.url)) {
      done();
      return;
    }
    const idade = agora() - entrada.em;
    if (idade >= maxIdadeMs) {
      guardadas.delete(request.url);
      done();
      return;
    }
    if (idade >= ttlMs) requentar(request.url, request.headers.authorization);
    // Servir daqui encerra o ciclo (o handler não roda); o header marca o
    // acerto para o onSend NÃO regravar a entrada (regravar renovaria o
    // carimbo e o valor nunca venceria).
    void reply
      .header('content-type', entrada.tipo)
      .header('x-cache', idade >= ttlMs ? 'requentado' : 'fresco')
      .send(entrada.corpo);
  });

  app.addHook('onSend', (request, reply, payload, done) => {
    const servidoDoCache = reply.getHeader('x-cache') !== undefined;
    if (
      request.method === 'GET' &&
      !servidoDoCache &&
      reply.statusCode === 200 &&
      urlCacheavel(request.url) &&
      typeof payload === 'string' &&
      payload.length <= LIMITE_CORPO
    ) {
      const tipo = reply.getHeader('content-type');
      if (typeof tipo === 'string' && tipo.includes('application/json')) {
        if (guardadas.size >= LIMITE_ENTRADAS && !guardadas.has(request.url)) {
          const maisVelha = guardadas.keys().next().value;
          if (maisVelha !== undefined) guardadas.delete(maisVelha);
        }
        guardadas.set(request.url, { em: agora(), corpo: payload, tipo });
      }
    }
    done(null, payload);
  });

  return {
    invalidar(prefixo?: string): void {
      if (prefixo === undefined) {
        guardadas.clear();
        return;
      }
      for (const url of guardadas.keys()) {
        if (url.startsWith(prefixo)) guardadas.delete(url);
      }
    },
  };
}
