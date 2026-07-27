// ─────────────────────────────────────────────────────────────────────────────
// REVÍNCULO DO HISCON (caso Roberto 5521976790767) — testes herméticos: leitor
// injetado, stores em memória. Invariantes provadas:
//   • candidatos() NUNCA escreve (só leitura);
//   • aplicar() reverifica do zero, exige anexo DA conversa, faz backup do
//     vínculo e do texto antes de religar;
//   • um sha de OUTRA conversa jamais é religado (proteção entre clientes).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { JsonStore } from '../production/json-store.js';
import { InMemoryJsonStore } from '../production/json-store.js';
import type { StoredBlob } from '../media/media-store-port.js';
import type { LeituraComparada } from '../reading/pdf-text-extractor.js';
import type { CachedText } from '../reading/document-text-cache.js';
import { RevinculoHiscon } from './revinculo-hiscon.js';

const NOW = new Date('2026-07-27T15:00:00.000Z');

/** Texto Formato A com N contratos ATIVOS + beneficiário (o parser real conta;
 *  o nome vem na linha logo após o título "EMPRÉSTIMO CONSIGNADO"). */
function formatoA(n: number, beneficiario = 'ROBERTO DO NASCIMENTO DUARTE'): string {
  const contratos = Array.from(
    { length: n },
    (_, i) => `CONTRATO: C${String(i + 1)}\nSITUAÇÃO: ATIVO`,
  ).join('\n\n');
  return `HISTÓRICO DE EMPRÉSTIMO CONSIGNADO\n${beneficiario}\n\n${contratos}`;
}

function v2(contratos: number, auditoria: 'conferida' | 'divergente', beneficiario?: string) {
  return {
    texto: formatoA(contratos, beneficiario),
    contratosLidos: contratos,
    ativosLidos: contratos,
    suspensosLidos: 0,
    emprestimosLidos: contratos,
    declarado: { ativos: contratos, suspensos: 0 },
    declaradoTotal: null,
    auditoria,
  } as const;
}

interface Blobs {
  readonly [sha: string]: { mime: string; leitura: LeituraComparada | null };
}

/** Monta o mundo: onboarding + conversas + refs + blobs + links, tudo real
 *  (InMemoryJsonStore) — o leitor resolve pelo PRIMEIRO byte do blob (índice). */
function mundo(opts: {
  onboarding: { chatId: string; documentId: string }[];
  links: Record<string, string>; // documentId → sha
  conversas: Record<string, { messageId: string; sha?: string; mime?: string }[]>;
  blobs: Blobs;
}) {
  const json: JsonStore = new InMemoryJsonStore();
  for (const o of opts.onboarding)
    void json.put('onboarding-documental', o.chatId, {
      chatId: o.chatId,
      recebidos: [{ codigo: 'CNIS', documentId: o.documentId }],
    });
  for (const [chatId, entradas] of Object.entries(opts.conversas)) {
    entradas.forEach((e, i) => {
      void json.put(`conv:${chatId}`, `k${String(i)}`, {
        kind: 'inbound',
        at: NOW.toISOString(),
        meta: { messageId: e.messageId },
      });
      if (e.sha !== undefined)
        void json.put('media-message-ref', e.messageId, {
          messageId: e.messageId,
          sha256: e.sha,
          mime: e.mime ?? 'application/pdf',
        });
    });
  }

  const shas = Object.keys(opts.blobs);
  const links = new Map<string, { documentId: string; messageId: string; sha256: string }>();
  for (const [documentId, sha] of Object.entries(opts.links))
    links.set(documentId, { documentId, messageId: 'm-original', sha256: sha });

  const cachePuts: CachedText[] = [];
  const svc = new RevinculoHiscon({
    json,
    links: {
      byDocumentId: (id) => Promise.resolve(links.get(id) ?? null),
      save: (l) => {
        links.set(l.documentId, l);
        return Promise.resolve();
      },
    },
    media: {
      has: () => Promise.resolve(true),
      put: () => Promise.reject(new Error('NUNCA GRAVA BLOB')),
      read: (sha) => {
        const b = opts.blobs[sha];
        if (!b) return Promise.resolve(null);
        return Promise.resolve({
          sha256: sha,
          mime: b.mime,
          size: 1,
          bytes: new Uint8Array([shas.indexOf(sha) + 1]),
        } satisfies StoredBlob);
      },
    },
    cache: {
      get: () => Promise.resolve(null),
      put: (e) => {
        cachePuts.push(e);
        return Promise.resolve();
      },
    },
    clock: { now: () => NOW },
    ler: (bytes) => {
      const sha = shas[(bytes[0] ?? 0) - 1];
      return Promise.resolve(sha !== undefined ? (opts.blobs[sha]?.leitura ?? null) : null);
    },
  });
  return { svc, json, links, cachePuts };
}

// O cenário do Roberto: o CNIS registrado aponta a um PDF que o leitor NÃO
// reconhece; o HISCON verdadeiro chegou como OUTRO anexo da mesma conversa.
const CHAT = '5521976790767@s.whatsapp.net';
function cenarioRoberto() {
  return mundo({
    onboarding: [{ chatId: CHAT, documentId: 'doc-cnis' }],
    links: { 'doc-cnis': 'sha-errado' },
    conversas: {
      [CHAT]: [
        { messageId: 'm-errado', sha: 'sha-errado' },
        { messageId: 'm-foto', sha: 'sha-foto', mime: 'image/jpeg' },
        { messageId: 'm-certo', sha: 'sha-certo' },
        { messageId: 'm-so-texto' }, // inbound sem anexo — ignorado
      ],
    },
    blobs: {
      'sha-errado': { mime: 'application/pdf', leitura: { v2: null, v1Texto: null } },
      'sha-foto': { mime: 'image/jpeg', leitura: null },
      'sha-certo': { mime: 'application/pdf', leitura: { v2: v2(41, 'conferida'), v1Texto: null } },
    },
  });
}

describe('RevinculoHiscon — candidatos (só leitura)', () => {
  it('acha o HISCON verdadeiro entre os anexos da conversa, com beneficiário', async () => {
    const { svc } = cenarioRoberto();
    const r = await svc.candidatos();
    expect(r.totalProblemas).toBe(1);
    expect(r.comCandidato).toBe(1);
    const linha = r.linhas[0];
    expect(linha?.chatId).toBe(CHAT);
    expect(linha?.motivoAtual).toBe('leitor não reconheceu a tabela');
    expect(linha?.candidatos).toHaveLength(1); // a foto e o texto NÃO entram
    expect(linha?.candidatos[0]).toMatchObject({
      sha256: 'sha-certo',
      messageId: 'm-certo',
      contratos: 41,
      beneficiario: 'ROBERTO DO NASCIMENTO DUARTE',
    });
  });

  it('cliente cujo registrado JÁ lê conferido fica FORA do relatório', async () => {
    const { svc } = mundo({
      onboarding: [{ chatId: 'ok', documentId: 'doc-ok' }],
      links: { 'doc-ok': 'sha-bom' },
      conversas: { ok: [{ messageId: 'm1', sha: 'sha-bom' }] },
      blobs: {
        'sha-bom': { mime: 'application/pdf', leitura: { v2: v2(5, 'conferida'), v1Texto: null } },
      },
    });
    const r = await svc.candidatos();
    expect(r.totalProblemas).toBe(0);
  });

  it('problema SEM candidato aparece com a lista vazia (dono vê que não achou)', async () => {
    const { svc } = mundo({
      onboarding: [{ chatId: 'so-foto', documentId: 'doc-x' }],
      links: { 'doc-x': 'sha-img' },
      conversas: { 'so-foto': [{ messageId: 'm1', sha: 'sha-img', mime: 'image/jpeg' }] },
      blobs: { 'sha-img': { mime: 'image/jpeg', leitura: null } },
    });
    const r = await svc.candidatos();
    expect(r.totalProblemas).toBe(1);
    expect(r.comCandidato).toBe(0);
    expect(r.linhas[0]?.motivoAtual).toBe('o registrado é uma IMAGEM');
    expect(r.linhas[0]?.candidatos).toHaveLength(0);
  });

  it('INVARIANTE: candidatos() nunca escreve (cache e vínculos intactos)', async () => {
    const { svc, links, cachePuts } = cenarioRoberto();
    const antes = links.get('doc-cnis');
    await svc.candidatos();
    expect(cachePuts).toHaveLength(0);
    expect(links.get('doc-cnis')).toBe(antes);
  });
});

describe('RevinculoHiscon — aplicar (ato do dono)', () => {
  it('religa ao PDF certo com BACKUP do vínculo, texto V2 no cache e trilha', async () => {
    const { svc, json, links, cachePuts } = cenarioRoberto();
    const r = await svc.aplicar(CHAT, 'sha-certo');
    expect(r).toMatchObject({
      ok: true,
      contratos: 41,
      beneficiario: 'ROBERTO DO NASCIMENTO DUARTE',
    });
    // O vínculo agora aponta ao sha certo, na MESMA identidade documental.
    expect(links.get('doc-cnis')).toMatchObject({
      documentId: 'doc-cnis',
      messageId: 'm-certo',
      sha256: 'sha-certo',
    });
    // Backup do vínculo antigo (reversível) + trilha do ato.
    expect(await json.get('document-link-backup', 'doc-cnis')).toMatchObject({
      chatId: CHAT,
      vinculoAntigo: { sha256: 'sha-errado' },
    });
    expect(await json.get('revinculo-hiscon', CHAT)).toMatchObject({
      de: 'sha-errado',
      para: 'sha-certo',
    });
    // O texto V2 já ficou no cache do sha novo (a produção usa direto).
    expect(cachePuts).toHaveLength(1);
    expect(cachePuts[0]).toMatchObject({ sha256: 'sha-certo', model: 'hiscon-posicional-v2' });
  });

  it('RECUSA um sha que não pertence à conversa (anexo de OUTRO cliente)', async () => {
    const { svc, links } = mundo({
      onboarding: [{ chatId: 'a', documentId: 'doc-a' }],
      links: { 'doc-a': 'sha-a' },
      conversas: {
        a: [{ messageId: 'ma', sha: 'sha-a' }],
        b: [{ messageId: 'mb', sha: 'sha-b' }],
      },
      blobs: {
        'sha-a': { mime: 'application/pdf', leitura: { v2: null, v1Texto: null } },
        'sha-b': { mime: 'application/pdf', leitura: { v2: v2(9, 'conferida'), v1Texto: null } },
      },
    });
    const r = await svc.aplicar('a', 'sha-b'); // sha-b é da conversa "b"!
    expect(r).toMatchObject({ ok: false, motivo: 'este anexo não pertence a esta conversa' });
    expect(links.get('doc-a')?.sha256).toBe('sha-a'); // nada mudou
  });

  it('RECUSA candidato que não lê conferido (reverificação do zero)', async () => {
    const { svc, links } = mundo({
      onboarding: [{ chatId: 'c', documentId: 'doc-c' }],
      links: { 'doc-c': 'sha-ruim' },
      conversas: {
        c: [
          { messageId: 'm1', sha: 'sha-ruim' },
          { messageId: 'm2', sha: 'sha-div' },
        ],
      },
      blobs: {
        'sha-ruim': { mime: 'application/pdf', leitura: { v2: null, v1Texto: null } },
        'sha-div': { mime: 'application/pdf', leitura: { v2: v2(3, 'divergente'), v1Texto: null } },
      },
    });
    const r = await svc.aplicar('c', 'sha-div');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('auditoria divergente');
    expect(links.get('doc-c')?.sha256).toBe('sha-ruim');
  });

  it('RECUSA chat sem HISCON registrado', async () => {
    const { svc } = cenarioRoberto();
    const r = await svc.aplicar('quem-nao-existe', 'sha-certo');
    expect(r).toMatchObject({ ok: false, motivo: 'este chat não tem HISCON registrado' });
  });
});
