// ─────────────────────────────────────────────────────────────────────────────
// DOCS DA EQUIPE (decreto 2026-07-30) — a fase 2 HUMANA da coleta: o time do
// dono colhe PROCURAÇÃO ASSINADA, RG e COMPROVANTE DE ENDEREÇO dos clientes
// que a AHRI concluiu na fase 1 e anexa ao cadastro pelo Painel Admin.
//
// Os bytes vão para o MESMO media store content-addressed (sha256) dos
// documentos do WhatsApp; o vínculo fica em ns 'docs-equipe' (um registro por
// chat, lista de anexos). O Portal do Advogado lê daqui a aba de documentos do
// cliente destinado. Validação na entrada: PDF/JPEG/PNG por magic bytes, 20MB.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';

const NS = 'docs-equipe';
const MAX_BYTES = 20 * 1024 * 1024;

export type TipoDocEquipe = 'procuracao' | 'rg' | 'comprovante' | 'extrato_credito' | 'outro';

export const ROTULO_DOC_EQUIPE: Readonly<Record<TipoDocEquipe, string>> = {
  procuracao: 'Procuração assinada',
  rg: 'RG',
  comprovante: 'Comprovante de endereço',
  // Decreto 2026-08-05: 4º documento OBRIGATÓRIO da fase 2 — prova os
  // descontos recentes direto na fonte do benefício.
  extrato_credito: 'Extrato de crédito do INSS (últimos 3 meses)',
  outro: 'Outro documento',
};

const MAGIC: ReadonlyArray<{ mime: string; bytes: readonly number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

export interface DocEquipe {
  readonly id: string;
  readonly tipo: TipoDocEquipe;
  readonly rotulo: string;
  readonly nome: string;
  readonly mime: string;
  readonly sha256: string;
  readonly size: number;
  readonly em: string;
}

interface Persisted {
  readonly chatId: string;
  readonly docs: readonly DocEquipe[];
}

export interface DocsEquipeDeps {
  readonly json: JsonStore;
  readonly media: MediaStorePort;
  readonly clock: Clock;
}

export class DocsEquipeService {
  constructor(private readonly deps: DocsEquipeDeps) {}

  private async registro(chatId: string): Promise<Persisted> {
    const raw = (await this.deps.json.get(NS, chatId)) as Persisted | null;
    return raw ?? { chatId, docs: [] };
  }

  /** Anexa um documento colhido pelo time (Painel Admin). Valida magic + 20MB. */
  async anexar(
    chatId: string,
    tipo: TipoDocEquipe,
    nomeBruto: string,
    base64: string,
  ): Promise<{ ok: true; doc: DocEquipe } | { ok: false; error: string }> {
    let bytes: Buffer;
    try {
      const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
      bytes = Buffer.from(clean, 'base64');
    } catch {
      return { ok: false, error: 'arquivo inválido' };
    }
    if (bytes.length === 0) return { ok: false, error: 'arquivo vazio' };
    if (bytes.length > MAX_BYTES) return { ok: false, error: 'arquivo acima de 20 MB' };
    const assinatura = MAGIC.find((m) => m.bytes.every((b, i) => bytes[i] === b));
    if (assinatura === undefined)
      return { ok: false, error: 'formato não aceito — envie PDF, JPG ou PNG' };

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!(await this.deps.media.has(sha256))) {
      await this.deps.media.put({
        sha256,
        mime: assinatura.mime,
        size: bytes.length,
        bytes: new Uint8Array(bytes),
      });
    }
    const nome = nomeBruto.replace(/[^\w.\- ()]/g, '').slice(0, 120) || `${tipo}.pdf`;
    const doc: DocEquipe = {
      id: `de-${Date.now().toString(36)}-${sha256.slice(0, 8)}`,
      tipo,
      rotulo: ROTULO_DOC_EQUIPE[tipo],
      nome,
      mime: assinatura.mime,
      sha256,
      size: bytes.length,
      em: this.deps.clock.now().toISOString(),
    };
    const atual = await this.registro(chatId);
    await this.deps.json.put(NS, chatId, {
      chatId,
      docs: [...atual.docs, doc],
    } satisfies Persisted);
    return { ok: true, doc };
  }

  /** Os documentos do time deste cliente (Painel Admin e Portal do Advogado). */
  async listar(chatId: string): Promise<readonly DocEquipe[]> {
    return (await this.registro(chatId)).docs;
  }

  /** Bytes de UM documento (download) — só via o registro do próprio chat. */
  async baixar(
    chatId: string,
    id: string,
  ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null> {
    const doc = (await this.registro(chatId)).docs.find((d) => d.id === id);
    if (doc === undefined) return null;
    const blob = await this.deps.media.read(doc.sha256);
    if (blob === null) return null;
    return { nome: doc.nome, mime: doc.mime, bytes: blob.bytes };
  }

  /** Remove UM anexo do registro (o blob content-addressed permanece — pode
   *  estar deduplicado com outros usos; nunca apagamos bytes). */
  async remover(chatId: string, id: string): Promise<boolean> {
    const atual = await this.registro(chatId);
    const restante = atual.docs.filter((d) => d.id !== id);
    if (restante.length === atual.docs.length) return false;
    await this.deps.json.put(NS, chatId, { chatId, docs: restante } satisfies Persisted);
    return true;
  }
}
