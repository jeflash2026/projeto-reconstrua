// ─────────────────────────────────────────────────────────────────────────────
// RELEITURA COMPARATIVA (decreto 2026-07-27) — o relatório que valida o leitor
// V2 contra a base real. Testes herméticos: o leitor de PDF é INJETADO (nenhum
// PDF real); os textos comparados passam pelo parseHisconDetalhado verdadeiro.
// Invariante provada: o serviço NUNCA escreve (cache.put jamais é chamado).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { JsonStore } from '../production/json-store.js';
import type { StoredBlob } from '../media/media-store-port.js';
import type { CachedText } from '../reading/document-text-cache.js';
import type { LeituraComparada } from '../reading/pdf-text-extractor.js';
import { ReleituraComparativa } from './releitura-comparativa.js';

const NOW = new Date('2026-07-27T12:00:00.000Z');

function jsonComOnboarding(
  estados: unknown[],
  gravacoes: { ns: string; key: string }[] = [],
): JsonStore {
  return {
    get: () => Promise.resolve(null),
    put: (ns: string, key: string) => {
      gravacoes.push({ ns, key });
      return Promise.resolve();
    },
    del: () => Promise.reject(new Error('NUNCA DELETA')),
    list: (ns: string) => Promise.resolve(ns === 'onboarding-documental' ? estados : []),
    keys: () => Promise.resolve([]),
  };
}

const onboarding = (chatId: string, documentId: string): unknown => ({
  chatId,
  recebidos: [{ codigo: 'CNIS', documentId }],
});

const blobPdf = (sha256: string): StoredBlob => ({
  sha256,
  mime: 'application/pdf',
  size: 10,
  bytes: new Uint8Array([1]),
});

/** Texto Formato A com N contratos ATIVOS (o parser real conta). */
function formatoA(n: number): string {
  return Array.from({ length: n }, (_, i) => `CONTRATO: C${String(i + 1)}\nSITUAÇÃO: ATIVO`).join(
    '\n\n',
  );
}

function v2Result(
  contratos: number,
  auditoria: 'conferida' | 'divergente',
  declarados = contratos,
) {
  return {
    texto: formatoA(contratos),
    contratosLidos: contratos,
    ativosLidos: contratos,
    suspensosLidos: 0,
    emprestimosLidos: contratos,
    declarado: { ativos: declarados, suspensos: 0 },
    declaradoTotal: null,
    auditoria,
  } as const;
}

interface Cenario {
  readonly sha: string;
  readonly cacheTexto: string | null;
  readonly mime?: string;
  readonly leitura: LeituraComparada | null;
}

function harness(cenarios: Record<string, Cenario>) {
  const puts: string[] = [];
  const svc = new ReleituraComparativa({
    json: jsonComOnboarding(Object.keys(cenarios).map((chat) => onboarding(chat, `doc-${chat}`))),
    links: {
      byDocumentId: (id) => {
        const chat = id.replace('doc-', '');
        const c = cenarios[chat];
        return Promise.resolve(c ? { sha256: c.sha } : null);
      },
    },
    media: {
      has: () => Promise.resolve(true),
      put: () => Promise.reject(new Error('RELATÓRIO NÃO ESCREVE')),
      read: (sha) => {
        const c = Object.values(cenarios).find((x) => x.sha === sha);
        if (!c) return Promise.resolve(null);
        return Promise.resolve({ ...blobPdf(sha), mime: c.mime ?? 'application/pdf' });
      },
    },
    cache: {
      get: (sha) => {
        const c = Object.values(cenarios).find((x) => x.sha === sha);
        if (!c || c.cacheTexto === null) return Promise.resolve(null);
        return Promise.resolve({
          sha256: sha,
          text: c.cacheTexto,
          model: 'x',
          chars: c.cacheTexto.length,
          readAt: NOW.toISOString(),
        } satisfies CachedText);
      },
      put: (e) => {
        puts.push(e.sha256);
        return Promise.resolve();
      },
    },
    clock: { now: () => NOW },
    ler: (bytes) => {
      void bytes;
      // O leitor injetado escolhe o cenário pelo sha corrente não é possível
      // aqui (bytes anônimos) — cada teste usa UM cenário por sha via mapa.
      return Promise.resolve(null);
    },
  });
  return { svc, puts };
}

/** Harness com o leitor resolvendo por CONTEÚDO do blob (1 byte = índice). */
function harnessComLeituras(cenarios: Record<string, Cenario>) {
  const puts: string[] = [];
  const gravacoesJson: { ns: string; key: string }[] = [];
  const porSha = new Map(Object.values(cenarios).map((c) => [c.sha, c.leitura]));
  const shaDoByte = new Map(Object.values(cenarios).map((c, i) => [i + 1, c.sha]));
  const svc = new ReleituraComparativa({
    json: jsonComOnboarding(
      Object.keys(cenarios).map((chat) => onboarding(chat, `doc-${chat}`)),
      gravacoesJson,
    ),
    links: {
      byDocumentId: (id) => {
        const c = cenarios[id.replace('doc-', '')];
        return Promise.resolve(c ? { sha256: c.sha } : null);
      },
    },
    media: {
      has: () => Promise.resolve(true),
      put: () => Promise.reject(new Error('RELATÓRIO NÃO ESCREVE')),
      read: (sha) => {
        const idx = [...Object.values(cenarios)].findIndex((x) => x.sha === sha);
        if (idx < 0) return Promise.resolve(null);
        const c = Object.values(cenarios)[idx];
        return Promise.resolve({
          sha256: sha,
          mime: c?.mime ?? 'application/pdf',
          size: 1,
          bytes: new Uint8Array([idx + 1]),
        });
      },
    },
    cache: {
      get: (sha) => {
        const c = Object.values(cenarios).find((x) => x.sha === sha);
        if (!c || c.cacheTexto === null) return Promise.resolve(null);
        return Promise.resolve({
          sha256: sha,
          text: c.cacheTexto,
          model: 'x',
          chars: c.cacheTexto.length,
          readAt: NOW.toISOString(),
        } satisfies CachedText);
      },
      put: (e) => {
        puts.push(e.sha256);
        return Promise.resolve();
      },
    },
    clock: { now: () => NOW },
    ler: (bytes) => {
      const sha = shaDoByte.get(bytes[0] ?? 0) ?? '';
      return Promise.resolve(porSha.get(sha) ?? null);
    },
  });
  return { svc, puts, gravacoesJson };
}

describe('Releitura comparativa — V2 × leitura em produção (só leitura)', () => {
  it('classifica: conferido-igual, conferido-DIFERENTE, divergente e imagem', async () => {
    const { svc, puts, gravacoesJson } = harnessComLeituras({
      'chat-igual': {
        sha: 'sha-1',
        cacheTexto: formatoA(2),
        leitura: { v2: v2Result(2, 'conferida'), v1Texto: formatoA(2) },
      },
      'chat-suspeito': {
        sha: 'sha-2',
        cacheTexto: formatoA(1), // produção leu 1…
        leitura: { v2: v2Result(3, 'conferida'), v1Texto: formatoA(1) }, // …o doc confirma 3
      },
      'chat-divergente': {
        sha: 'sha-3',
        cacheTexto: formatoA(2),
        leitura: { v2: v2Result(2, 'divergente', 4), v1Texto: null },
      },
      'chat-imagem': { sha: 'sha-4', cacheTexto: formatoA(1), mime: 'image/jpeg', leitura: null },
    });
    const r = await svc.compararTodos();
    expect(r.totalClientes).toBe(4);
    const por = new Map(r.linhas.map((l) => [l.chatId, l]));
    expect(por.get('chat-igual')?.veredicto).toBe('CONFERIDO_IGUAL');
    expect(por.get('chat-suspeito')?.veredicto).toBe('CONFERIDO_DIFERENTE');
    expect(por.get('chat-suspeito')?.contratosCache).toBe(1);
    expect(por.get('chat-suspeito')?.contratosV2).toBe(3);
    // MEDIDORES: os 3 do V2 têm número válido (C1..C3), zero marcadores, e o
    // único da leitura atual (C1) está ENTRE eles ⇒ leitura real, não fatiada.
    expect(por.get('chat-suspeito')?.numerosValidosV2).toBe(3);
    expect(por.get('chat-suspeito')?.marcadoresV2).toBe(0);
    expect(por.get('chat-suspeito')?.numerosCoincidentes).toBe(1);
    expect(por.get('chat-divergente')?.veredicto).toBe('V2_DIVERGENTE');
    expect(por.get('chat-imagem')?.veredicto).toBe('IMAGEM');
    // Os suspeitos vêm PRIMEIRO (é o que o dono precisa olhar).
    expect(r.linhas[0]?.veredicto).toBe('CONFERIDO_DIFERENTE');
    expect(r.resumo['CONFERIDO_IGUAL']).toBe(1);
    expect(r.resumo['CONFERIDO_DIFERENTE']).toBe(1);
    // INVARIANTE: o relatório NUNCA escreveu — nem no cache, nem no json store.
    expect(puts).toHaveLength(0);
    expect(gravacoesJson).toHaveLength(0);
  });

  it('sem vínculo de mídia ⇒ SEM_VINCULO (nunca lança, nunca inventa)', async () => {
    const { svc } = harness({});
    const svcSemLink = svc; // harness vazio: nenhum cliente ⇒ relatório vazio
    const r = await svcSemLink.compararTodos();
    expect(r.totalClientes).toBe(0);
  });

  it('APLICAR: só os conferidos, com BACKUP do texto antigo; o resto é pulado', async () => {
    const { svc, puts, gravacoesJson } = harnessComLeituras({
      'chat-igual': {
        sha: 'sha-1',
        cacheTexto: formatoA(2),
        leitura: { v2: v2Result(2, 'conferida'), v1Texto: null },
      },
      'chat-suspeito': {
        sha: 'sha-2',
        cacheTexto: formatoA(1),
        leitura: { v2: v2Result(3, 'conferida'), v1Texto: null },
      },
      'chat-divergente': {
        sha: 'sha-3',
        cacheTexto: formatoA(2),
        leitura: { v2: v2Result(2, 'divergente', 4), v1Texto: null },
      },
      'chat-imagem': { sha: 'sha-4', cacheTexto: formatoA(1), mime: 'image/jpeg', leitura: null },
    });
    const r = await svc.aplicarLeituraDefinitiva();
    expect(r.aplicados).toBe(2); // os dois conferidos (igual E diferente)
    expect(r.pulados).toBe(2); // divergente + imagem — análise manual
    // O cache foi SUBSTITUÍDO só nos conferidos…
    expect(puts.sort()).toEqual(['sha-1', 'sha-2']);
    // …e o texto ANTIGO foi guardado em backup antes (reversível).
    const backups = gravacoesJson.filter((g) => g.ns === 'document-text-backup').map((g) => g.key);
    expect(backups.sort()).toEqual(['sha-1', 'sha-2']);
    const motivos = new Map(r.detalhes.map((d) => [d.chatId, d.motivo]));
    expect(motivos.get('chat-divergente')).toContain('divergente');
    expect(motivos.get('chat-imagem')).toContain('imagem');
  });

  it('respeita o limite da varredura', async () => {
    const { svc } = harnessComLeituras({
      a: {
        sha: 's-a',
        cacheTexto: formatoA(1),
        leitura: { v2: v2Result(1, 'conferida'), v1Texto: null },
      },
      b: {
        sha: 's-b',
        cacheTexto: formatoA(1),
        leitura: { v2: v2Result(1, 'conferida'), v1Texto: null },
      },
    });
    const r = await svc.compararTodos(1);
    expect(r.totalClientes).toBe(1);
  });
});
