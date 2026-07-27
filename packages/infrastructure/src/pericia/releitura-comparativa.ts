// ─────────────────────────────────────────────────────────────────────────────
// RELEITURA COMPARATIVA DO HISCON (decreto 2026-07-27) — o RELATÓRIO que valida
// o leitor posicional V2 contra a base REAL antes de qualquer reprocessamento.
//
// Para cada cliente com HISCON (CNIS) registrado: pega o PDF ORIGINAL no media
// store (content-addressed por sha256), roda os DOIS leitores posicionais lado
// a lado e compara com a LEITURA EM CACHE (a que a produção usa hoje). O
// veredicto diz onde o V2 confirma, melhora ou diverge.
//
// SÓ LEITURA — invariante absoluta: nada aqui escreve no document-text cache
// nem em qualquer estado do cliente ("nunca DELETE document-text de leve").
// Reprocessar alguém é decisão do DONO, caso a caso, à luz deste relatório.
// ─────────────────────────────────────────────────────────────────────────────
import { parseHisconDetalhado } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { DocumentTextCache } from '../reading/document-text-cache.js';
import { lerHisconParaComparacao, type LeituraComparada } from '../reading/pdf-text-extractor.js';

const NS_ONBOARDING = 'onboarding-documental';

/** O vínculo documentId → sha256 (o JsonDocumentLinkStore real satisfaz). */
export interface LinkPorDocumento {
  byDocumentId(documentId: string): Promise<{ readonly sha256: string } | null>;
}

export type VeredictoReleitura =
  | 'CONFERIDO_IGUAL' // V2 auditado pelo documento e igual ao cache — tudo certo
  | 'CONFERIDO_DIFERENTE' // V2 auditado pelo documento, mas o CACHE difere — leitura atual suspeita
  | 'V2_DIVERGENTE' // V2 não bateu com o quantitativo declarado — conferir no PDF
  | 'SEM_QUANTITATIVO' // documento sem o quantitativo ⇒ sem conferência automática
  | 'V2_NAO_LEU' // o V2 não reconheceu a tabela neste PDF
  | 'IMAGEM' // o "HISCON" é imagem (lido por Vision) — releitura posicional não se aplica
  | 'PDF_ILEGIVEL' // o PDF não abriu (corrompido/escaneado)
  | 'SEM_PDF' // sem blob no media store
  | 'SEM_VINCULO'; // sem vínculo documento→mídia

export interface LinhaReleitura {
  readonly chatId: string;
  readonly cliente: string | null;
  readonly veredicto: VeredictoReleitura;
  /** Leitura EM PRODUÇÃO hoje (cache): contratos e ativos+suspensos. */
  readonly contratosCache: number | null;
  readonly ativosSuspensosCache: number | null;
  /** Leitor NOVO (V2): contratos, ativos+suspensos, auditoria e o declarado. */
  readonly contratosV2: number | null;
  readonly ativosSuspensosV2: number | null;
  readonly declarado: { readonly ativos: number; readonly suspensos: number } | null;
  /** Leitor V1 re-rodado agora (referência). */
  readonly contratosV1: number | null;
}

export interface RelatorioReleitura {
  readonly geradoEm: string;
  readonly totalClientes: number;
  readonly resumo: Readonly<Partial<Record<VeredictoReleitura, number>>>;
  readonly linhas: readonly LinhaReleitura[];
}

interface OnboardingPersistido {
  readonly chatId?: string;
  readonly recebidos?: readonly { readonly codigo?: string; readonly documentId?: string }[];
}

export interface ReleituraDeps {
  readonly json: JsonStore;
  readonly links: LinkPorDocumento;
  readonly media: MediaStorePort;
  readonly cache: DocumentTextCache;
  readonly clock: { now(): Date };
  /** Leitor injetável (testes). Default: o leitor posicional real. */
  readonly ler?: (bytes: Uint8Array) => Promise<LeituraComparada | null>;
}

/** Contratos e ativos+suspensos de um texto Formato A/B — pelo parser REAL. */
function medir(texto: string): { contratos: number; ativosSuspensos: number } {
  const h = parseHisconDetalhado(texto);
  return {
    contratos: h.contratos.length,
    ativosSuspensos: h.contratos.filter(
      (c) => c.situacao !== null && /^(ATIVO|SUSPENS)/i.test(c.situacao),
    ).length,
  };
}

export class ReleituraComparativa {
  constructor(private readonly deps: ReleituraDeps) {}

  /** O relatório completo. `limite` corta a varredura (diagnóstico rápido). */
  async compararTodos(limite?: number): Promise<RelatorioReleitura> {
    const ler = this.deps.ler ?? lerHisconParaComparacao;
    const estados = (await this.deps.json.list(NS_ONBOARDING)) as OnboardingPersistido[];
    const linhas: LinhaReleitura[] = [];

    for (const estado of estados) {
      if (limite !== undefined && linhas.length >= limite) break;
      const chatId = estado.chatId ?? null;
      const cnis = estado.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
      if (chatId === null || cnis?.documentId === undefined) continue; // sem HISCON ⇒ fora do relatório

      const linha = await this.analisar(chatId, cnis.documentId, ler);
      linhas.push(linha);
    }

    const resumo: Partial<Record<VeredictoReleitura, number>> = {};
    for (const l of linhas) resumo[l.veredicto] = (resumo[l.veredicto] ?? 0) + 1;
    // Cache suspeito primeiro — é o que o dono precisa olhar.
    const ordem: readonly VeredictoReleitura[] = [
      'CONFERIDO_DIFERENTE',
      'V2_DIVERGENTE',
      'V2_NAO_LEU',
      'SEM_QUANTITATIVO',
      'PDF_ILEGIVEL',
      'SEM_PDF',
      'SEM_VINCULO',
      'IMAGEM',
      'CONFERIDO_IGUAL',
    ];
    linhas.sort((a, b) => ordem.indexOf(a.veredicto) - ordem.indexOf(b.veredicto));

    return {
      geradoEm: this.deps.clock.now().toISOString(),
      totalClientes: linhas.length,
      resumo,
      linhas,
    };
  }

  private async analisar(
    chatId: string,
    documentId: string,
    ler: (bytes: Uint8Array) => Promise<LeituraComparada | null>,
  ): Promise<LinhaReleitura> {
    const vazio = {
      contratosCache: null,
      ativosSuspensosCache: null,
      contratosV2: null,
      ativosSuspensosV2: null,
      declarado: null,
      contratosV1: null,
    };

    const link = await this.deps.links.byDocumentId(documentId).catch(() => null);
    if (link === null) return { chatId, cliente: null, veredicto: 'SEM_VINCULO', ...vazio };

    // A leitura EM PRODUÇÃO hoje (o texto que o dossiê/perícia usam).
    const cacheado = await this.deps.cache.get(link.sha256).catch(() => null);
    const medidaCache = cacheado !== null ? medir(cacheado.text) : null;
    const clienteCache =
      cacheado !== null ? parseHisconDetalhado(cacheado.text).beneficiario : null;
    const base = {
      contratosCache: medidaCache?.contratos ?? null,
      ativosSuspensosCache: medidaCache?.ativosSuspensos ?? null,
    };

    const blob = await this.deps.media.read(link.sha256).catch(() => null);
    if (blob === null)
      return { chatId, cliente: clienteCache, veredicto: 'SEM_PDF', ...vazio, ...base };
    if (blob.mime !== 'application/pdf')
      return { chatId, cliente: clienteCache, veredicto: 'IMAGEM', ...vazio, ...base };

    const leitura = await ler(blob.bytes);
    if (leitura === null)
      return { chatId, cliente: clienteCache, veredicto: 'PDF_ILEGIVEL', ...vazio, ...base };

    const medidaV1 = leitura.v1Texto !== null ? medir(leitura.v1Texto) : null;
    if (leitura.v2 === null) {
      return {
        chatId,
        cliente: clienteCache,
        veredicto: 'V2_NAO_LEU',
        ...vazio,
        ...base,
        contratosV1: medidaV1?.contratos ?? null,
      };
    }

    const v2 = leitura.v2;
    const cliente = clienteCache ?? parseHisconDetalhado(v2.texto).beneficiario;
    const veredicto: VeredictoReleitura =
      v2.auditoria === 'conferida'
        ? medidaCache !== null && medidaCache.contratos === v2.contratosLidos
          ? 'CONFERIDO_IGUAL'
          : 'CONFERIDO_DIFERENTE'
        : v2.auditoria === 'divergente'
          ? 'V2_DIVERGENTE'
          : 'SEM_QUANTITATIVO';

    return {
      chatId,
      cliente,
      veredicto,
      ...base,
      contratosV2: v2.contratosLidos,
      ativosSuspensosV2: v2.ativosLidos + v2.suspensosLidos,
      declarado: v2.declarado,
      contratosV1: medidaV1?.contratos ?? null,
    };
  }
}
