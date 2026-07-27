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

    const agora = this.deps.clock.now().toISOString();

    // BACKUP do vínculo antigo (uma vez; reversível) e religamento.
    const vinculoAntigo = await this.deps.links.byDocumentId(cnis.documentId).catch(() => null);
    const jaTemBackup = await this.deps.json.get(NS_BACKUP_VINCULO, cnis.documentId);
    if (jaTemBackup === null)
      await this.deps.json.put(NS_BACKUP_VINCULO, cnis.documentId, {
        documentId: cnis.documentId,
        chatId,
        vinculoAntigo,
        substituidoEm: agora,
      });
    await this.deps.links.save({
      documentId: cnis.documentId,
      messageId,
      sha256,
      mime: 'application/pdf',
    });

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
      text: leitura.v2.texto,
      model: 'hiscon-posicional-v2',
      chars: leitura.v2.texto.length,
      readAt: agora,
    });

    // Trilha do ato (auditável).
    await this.deps.json.put(NS_AUDITORIA, chatId, {
      chatId,
      documentId: cnis.documentId,
      de: vinculoAntigo?.sha256 ?? null,
      para: sha256,
      em: agora,
    });

    const parsed = parseHisconDetalhado(leitura.v2.texto);
    return { ok: true, contratos: parsed.contratos.length, beneficiario: parsed.beneficiario };
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
