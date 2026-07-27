// ─────────────────────────────────────────────────────────────────────────────
// REVÍNCULO DO HISCON (decreto 2026-07-27, caso Roberto 5521976790767) — quando
// o CNIS REGISTRADO aponta ao anexo ERRADO (a pessoa mandou outro arquivo antes,
// e o HISCON verdadeiro chegou depois), o problema não é de leitura: é de VÍNCULO.
//
// candidatos(): SÓ LEITURA — para cada cliente cujo HISCON registrado NÃO produz
// uma leitura V2 conferida, varre os OUTROS anexos PDF da mesma conversa e lista
// os que o leitor lê com auditoria CONFERIDA (com beneficiário e data, para o
// dono reconhecer o arquivo certo).
//
// aplicar(): ATO EXPLÍCITO do dono, caso a caso — reverifica o candidato do
// zero, exige que o anexo pertença ÀQUELA conversa, guarda BACKUP do vínculo e
// do texto antigos (reversível) e então religa documentId → sha do PDF certo.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { parseHisconDetalhado } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { DocumentTextCache } from '../reading/document-text-cache.js';
import { lerHisconParaComparacao, type LeituraComparada } from '../reading/pdf-text-extractor.js';

const NS_ONBOARDING = 'onboarding-documental';
const NS_REF_MENSAGEM = 'media-message-ref'; // messageId → { sha256, mime }
const NS_BACKUP_VINCULO = 'document-link-backup'; // vínculo antigo (reversível)
const NS_BACKUP_TEXTO = 'document-text-backup'; // mesmo ns do aplicar da releitura
const NS_AUDITORIA = 'revinculo-hiscon'; // trilha do ato (quem religou o quê)

/** O vínculo documentId → mídia, agora também com escrita (o religamento). */
export interface LinksRevinculo {
  byDocumentId(documentId: string): Promise<{
    readonly documentId?: string;
    readonly messageId?: string;
    readonly sha256: string;
    readonly mime?: string;
  } | null>;
  save(link: {
    documentId: string;
    messageId: string;
    sha256: string;
    mime: string;
  }): Promise<void>;
}

export interface CandidatoRevinculo {
  readonly sha256: string;
  readonly messageId: string;
  /** Quando o anexo chegou na conversa (ISO) — ajuda o dono a reconhecê-lo. */
  readonly em: string | null;
  readonly contratos: number;
  readonly ativos: number;
  readonly suspensos: number;
  readonly declarado: { readonly ativos: number; readonly suspensos: number } | null;
  /** O NOME no cabeçalho do PDF — a prova de que é o HISCON da pessoa certa. */
  readonly beneficiario: string | null;
}

export interface LinhaRevinculo {
  readonly chatId: string;
  /** Por que o HISCON registrado hoje não serve. */
  readonly motivoAtual: string;
  readonly candidatos: readonly CandidatoRevinculo[];
}

export interface RelatorioRevinculo {
  readonly geradoEm: string;
  readonly totalProblemas: number;
  readonly comCandidato: number;
  readonly linhas: readonly LinhaRevinculo[];
}

export type ResultadoAplicar =
  | {
      readonly ok: true;
      readonly contratos: number;
      readonly beneficiario: string | null;
    }
  | { readonly ok: false; readonly motivo: string };

/** Upload manual: dry-run (aplicado=false) mostra o que o PDF é ANTES de gravar. */
export type ResultadoUpload =
  | {
      readonly ok: true;
      readonly aplicado: boolean;
      readonly contratos: number;
      readonly ativos: number;
      readonly suspensos: number;
      readonly declarado: { readonly ativos: number; readonly suspensos: number } | null;
      readonly beneficiario: string | null;
    }
  | { readonly ok: false; readonly motivo: string };

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // mesmo teto da captura de mídia
const MAGIC_PDF: readonly number[] = [0x25, 0x50, 0x44, 0x46]; // %PDF

interface OnboardingPersistido {
  readonly chatId?: string;
  readonly recebidos?: readonly { readonly codigo?: string; readonly documentId?: string }[];
}

interface EntradaConversa {
  readonly kind?: string;
  readonly at?: string;
  readonly meta?: Readonly<Record<string, string>>;
}

interface RefMensagem {
  readonly sha256?: string;
  readonly mime?: string;
}

export interface RevinculoDeps {
  readonly json: JsonStore;
  readonly links: LinksRevinculo;
  readonly media: MediaStorePort;
  readonly cache: DocumentTextCache;
  readonly clock: { now(): Date };
  /** Leitor injetável (testes). Default: o leitor posicional real. */
  readonly ler?: (bytes: Uint8Array) => Promise<LeituraComparada | null>;
}

export class RevinculoHiscon {
  constructor(private readonly deps: RevinculoDeps) {}

  /** SÓ LEITURA: os clientes-problema e os anexos certos achados na conversa. */
  async candidatos(): Promise<RelatorioRevinculo> {
    const ler = this.deps.ler ?? lerHisconParaComparacao;
    const estados = (await this.deps.json.list(NS_ONBOARDING)) as OnboardingPersistido[];
    const linhas: LinhaRevinculo[] = [];

    for (const estado of estados) {
      const chatId = estado.chatId ?? null;
      const cnis = estado.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
      if (chatId === null || cnis?.documentId === undefined) continue;

      const atual = await this.situacaoAtual(cnis.documentId, ler);
      if (atual.motivo === null) continue; // o registrado lê conferido ⇒ nada a religar

      const candidatos = await this.varrerConversa(chatId, atual.sha256, ler);
      linhas.push({ chatId, motivoAtual: atual.motivo, candidatos });
    }

    return {
      geradoEm: this.deps.clock.now().toISOString(),
      totalProblemas: linhas.length,
      comCandidato: linhas.filter((l) => l.candidatos.length > 0).length,
      linhas,
    };
  }

  /** ATO DO DONO: religa o CNIS do chat ao PDF (sha256) escolhido no relatório.
   *  NADA é confiado do painel: o candidato é reverificado do zero e precisa
   *  PERTENCER à conversa; vínculo e texto antigos ganham backup antes. */
  async aplicar(chatId: string, sha256: string): Promise<ResultadoAplicar> {
    const ler = this.deps.ler ?? lerHisconParaComparacao;
    const estado = (await this.deps.json.get(NS_ONBOARDING, chatId)) as OnboardingPersistido | null;
    const cnis = estado?.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
    if (cnis?.documentId === undefined)
      return { ok: false, motivo: 'este chat não tem HISCON registrado' };

    // O anexo precisa PERTENCER a esta conversa (nunca religar o PDF de outro cliente).
    const messageId = await this.messageIdDoSha(chatId, sha256);
    if (messageId === null) return { ok: false, motivo: 'este anexo não pertence a esta conversa' };

    const blob = await this.deps.media.read(sha256).catch(() => null);
    if (blob === null || blob.mime !== 'application/pdf')
      return { ok: false, motivo: 'o anexo escolhido não é um PDF no acervo' };
    const leitura = await ler(blob.bytes);
    if (leitura === null || leitura.v2 === null)
      return { ok: false, motivo: 'o leitor não reconheceu a tabela deste anexo' };
    if (leitura.v2.auditoria !== 'conferida')
      return {
        ok: false,
        motivo: `auditoria ${leitura.v2.auditoria} — não religa sem conferência`,
      };

    await this.religar(chatId, cnis.documentId, sha256, messageId, leitura.v2.texto, 'conversa');

    const parsed = parseHisconDetalhado(leitura.v2.texto);
    return { ok: true, contratos: parsed.contratos.length, beneficiario: parsed.beneficiario };
  }

  /** UPLOAD MANUAL (ato do dono): o PDF vem do WhatsApp DELE — casos em que o
   *  anexo original nunca teve os bytes capturados no acervo. Dry-run
   *  (confirmar=false) valida e mostra o beneficiário SEM gravar nada; só a
   *  confirmação grava o blob (content-addressed), religa com backup e deixa
   *  trilha com origem 'upload-admin'. */
  async upload(chatId: string, pdfBase64: string, confirmar: boolean): Promise<ResultadoUpload> {
    const ler = this.deps.ler ?? lerHisconParaComparacao;
    const estado = (await this.deps.json.get(NS_ONBOARDING, chatId)) as OnboardingPersistido | null;
    const cnis = estado?.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
    if (cnis?.documentId === undefined)
      return { ok: false, motivo: 'este chat não tem HISCON registrado' };

    const bytes = decodificarBase64(pdfBase64);
    if (bytes === null || bytes.length === 0)
      return { ok: false, motivo: 'arquivo vazio ou inválido' };
    if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, motivo: 'PDF acima de 20 MB' };
    if (!MAGIC_PDF.every((b, i) => bytes[i] === b))
      return { ok: false, motivo: 'o arquivo enviado não é um PDF' };

    // sha ANTES da leitura e uma CÓPIA para o pdf.js (que destaca o buffer).
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const leitura = await ler(bytes.slice());
    if (leitura === null || leitura.v2 === null)
      return { ok: false, motivo: 'o leitor não reconheceu a tabela deste PDF' };
    if (leitura.v2.auditoria !== 'conferida')
      return {
        ok: false,
        motivo: `auditoria ${leitura.v2.auditoria} — não religa sem conferência`,
      };

    const parsed = parseHisconDetalhado(leitura.v2.texto);
    const resultado = {
      ok: true as const,
      contratos: parsed.contratos.length,
      ativos: leitura.v2.ativosLidos,
      suspensos: leitura.v2.suspensosLidos,
      declarado: leitura.v2.declarado,
      beneficiario: parsed.beneficiario,
    };
    if (!confirmar) return { ...resultado, aplicado: false }; // dry-run: NADA gravado

    // Blob no acervo (content-addressed; idempotente por sha).
    if (!(await this.deps.media.has(sha256).catch(() => false)))
      await this.deps.media.put({ sha256, mime: 'application/pdf', size: bytes.length, bytes });
    const messageId = `upload-admin:${this.deps.clock.now().toISOString()}`;
    await this.religar(
      chatId,
      cnis.documentId,
      sha256,
      messageId,
      leitura.v2.texto,
      'upload-admin',
    );
    return { ...resultado, aplicado: true };
  }

  /** O religamento em si: backup do vínculo antigo, documentId→sha novo, texto
   *  V2 no cache (backup do que houver) e trilha auditável com a origem. */
  private async religar(
    chatId: string,
    documentId: string,
    sha256: string,
    messageId: string,
    textoV2: string,
    origem: 'conversa' | 'upload-admin',
  ): Promise<void> {
    const agora = this.deps.clock.now().toISOString();

    // BACKUP do vínculo antigo (uma vez; reversível) e religamento.
    const vinculoAntigo = await this.deps.links.byDocumentId(documentId).catch(() => null);
    const jaTemBackup = await this.deps.json.get(NS_BACKUP_VINCULO, documentId);
    if (jaTemBackup === null)
      await this.deps.json.put(NS_BACKUP_VINCULO, documentId, {
        documentId,
        chatId,
        vinculoAntigo,
        substituidoEm: agora,
      });
    await this.deps.links.save({ documentId, messageId, sha256, mime: 'application/pdf' });

    // Texto V2 no cache do sha NOVO (backup do que houver lá, mesmo padrão da releitura).
    const antigo = await this.deps.cache.get(sha256).catch(() => null);
    if (antigo !== null) {
      const jaTem = await this.deps.json.get(NS_BACKUP_TEXTO, sha256);
      if (jaTem === null)
        await this.deps.json.put(NS_BACKUP_TEXTO, sha256, {
          sha256,
          texto: antigo.text,
          model: antigo.model,
          substituidoEm: agora,
        });
    }
    await this.deps.cache.put({
      sha256,
      text: textoV2,
      model: 'hiscon-posicional-v2',
      chars: textoV2.length,
      readAt: agora,
    });

    // Trilha do ato (auditável).
    await this.deps.json.put(NS_AUDITORIA, chatId, {
      chatId,
      documentId,
      de: vinculoAntigo?.sha256 ?? null,
      para: sha256,
      origem,
      em: agora,
    });
  }

  /** O HISCON registrado lê CONFERIDO? motivo=null se sim; senão, o porquê. */
  private async situacaoAtual(
    documentId: string,
    ler: (bytes: Uint8Array) => Promise<LeituraComparada | null>,
  ): Promise<{ motivo: string | null; sha256: string | null }> {
    const link = await this.deps.links.byDocumentId(documentId).catch(() => null);
    if (link === null) return { motivo: 'sem vínculo de mídia', sha256: null };
    const blob = await this.deps.media.read(link.sha256).catch(() => null);
    if (blob === null) return { motivo: 'PDF não encontrado no acervo', sha256: link.sha256 };
    if (blob.mime !== 'application/pdf')
      return { motivo: 'o registrado é uma IMAGEM', sha256: link.sha256 };
    const leitura = await ler(blob.bytes);
    if (leitura === null) return { motivo: 'PDF ilegível', sha256: link.sha256 };
    if (leitura.v2 === null)
      return { motivo: 'leitor não reconheceu a tabela', sha256: link.sha256 };
    if (leitura.v2.auditoria !== 'conferida')
      return { motivo: `auditoria ${leitura.v2.auditoria}`, sha256: link.sha256 };
    return { motivo: null, sha256: link.sha256 };
  }

  /** Os anexos PDF da conversa (fora o já registrado) que leem CONFERIDO. */
  private async varrerConversa(
    chatId: string,
    shaRegistrado: string | null,
    ler: (bytes: Uint8Array) => Promise<LeituraComparada | null>,
  ): Promise<readonly CandidatoRevinculo[]> {
    const candidatos: CandidatoRevinculo[] = [];
    const vistos = new Set<string>(shaRegistrado !== null ? [shaRegistrado] : []);
    for (const anexo of await this.anexosDaConversa(chatId)) {
      if (vistos.has(anexo.sha256)) continue;
      vistos.add(anexo.sha256);
      if (anexo.mime !== 'application/pdf') continue;
      const blob = await this.deps.media.read(anexo.sha256).catch(() => null);
      if (blob === null || blob.mime !== 'application/pdf') continue;
      const leitura = await ler(blob.bytes);
      if (leitura === null || leitura.v2 === null || leitura.v2.auditoria !== 'conferida') continue;
      const parsed = parseHisconDetalhado(leitura.v2.texto);
      candidatos.push({
        sha256: anexo.sha256,
        messageId: anexo.messageId,
        em: anexo.em,
        contratos: parsed.contratos.length,
        ativos: leitura.v2.ativosLidos,
        suspensos: leitura.v2.suspensosLidos,
        declarado: leitura.v2.declarado,
        beneficiario: parsed.beneficiario,
      });
    }
    return candidatos;
  }

  /** messageId do sha DENTRO desta conversa — null se o anexo não é dela. */
  private async messageIdDoSha(chatId: string, sha256: string): Promise<string | null> {
    for (const anexo of await this.anexosDaConversa(chatId)) {
      if (anexo.sha256 === sha256) return anexo.messageId;
    }
    return null;
  }

  /** Todos os anexos (messageId → blob) recebidos NESTA conversa, na ordem. */
  private async anexosDaConversa(
    chatId: string,
  ): Promise<readonly { messageId: string; sha256: string; mime: string; em: string | null }[]> {
    const entradas = (await this.deps.json.list(`conv:${chatId}`)) as EntradaConversa[];
    const anexos: { messageId: string; sha256: string; mime: string; em: string | null }[] = [];
    for (const entrada of entradas) {
      if (entrada.kind !== 'inbound') continue;
      const messageId = entrada.meta?.['messageId'];
      if (messageId === undefined || messageId === '') continue;
      const ref = (await this.deps.json.get(NS_REF_MENSAGEM, messageId)) as RefMensagem | null;
      if (ref === null || typeof ref.sha256 !== 'string') continue;
      anexos.push({
        messageId,
        sha256: ref.sha256,
        mime: ref.mime ?? '',
        em: typeof entrada.at === 'string' ? entrada.at : null,
      });
    }
    return anexos;
  }
}

/** Base64 (com ou sem prefixo data:) → bytes. null se inválido. */
function decodificarBase64(base64: string): Uint8Array | null {
  try {
    const limpo = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    return new Uint8Array(Buffer.from(limpo, 'base64'));
  } catch {
    return null;
  }
}
