// ─────────────────────────────────────────────────────────────────────────────
// CARTÕES EM FALTA NA BASE (caso REAL Luiz Carlos da Cunha, 2026-09-28) — a
// varredura que encontra, em TODA a base, os clientes cujo HISCON tem cartão
// só na tabela mensal "DESCONTOS DE CARTÃO" e cuja leitura em cache saiu sem
// RMC/RCC nenhum. Cada cartão perdido é 1 processo a menos no guia, dossiê
// menor e abate menor no advogado.
//
// A operação é ADITIVA e reversível, e é o que a torna segura: nada da leitura
// de EMPRÉSTIMOS é tocado (o texto atual vai inteiro para o novo), os cartões
// são ACRESCENTADOS ao fim, e o texto anterior fica no backup
// ('document-text-backup'). Por isso ela não depende da auditoria do leitor
// posicional: não estamos re-lendo a tabela de empréstimos, estamos devolvendo
// o que nunca foi lido.
//
// Quem já tem cartão na leitura é PULADO — jamais dois cartões para o mesmo.
// ─────────────────────────────────────────────────────────────────────────────
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { DocumentTextCache } from '../reading/document-text-cache.js';
import { extrairTextoLinearDePdf } from '../reading/pdf-text-extractor.js';
import {
  blocosDeCartao,
  cartoesDoHistoricoMensal,
  jaTemCartoes,
} from '../reading/cartoes-do-historico.js';

const NS_ONBOARDING = 'onboarding-documental';
const NS_BACKUP = 'document-text-backup';

export interface LinkPorDocumentoCartao {
  byDocumentId(documentId: string): Promise<{ readonly sha256: string } | null>;
}

interface OnboardingPersistido {
  readonly chatId?: string;
  readonly recebidos?: readonly { readonly codigo?: string; readonly documentId?: string }[];
}

export type ResultadoCartoes =
  | 'CARTOES_ENCONTRADOS' // o HISCON tem cartão no histórico e a leitura não tinha
  | 'JA_TEM_CARTOES' // a leitura já traz cartão — nada a fazer
  | 'SEM_CARTOES_NO_DOCUMENTO' // o documento não tem histórico de cartão
  | 'SEM_TEXTO_EM_CACHE' // nunca foi lido (o fluxo normal lê quando precisar)
  | 'SEM_PDF' // HISCON em imagem ou sem blob no acervo
  | 'PDF_ILEGIVEL' // o PDF não abriu
  | 'SEM_VINCULO';

export interface LinhaCartoes {
  readonly chatId: string;
  readonly resultado: ResultadoCartoes;
  /** Quantos cartões (RMC/RCC) o histórico revelou — cada um vale 1 processo. */
  readonly cartoes: number;
  readonly modalidades: readonly string[];
  /** true quando o texto em cache foi de fato substituído nesta execução. */
  readonly aplicado: boolean;
}

export interface RelatorioCartoes {
  readonly geradoEm: string;
  readonly clientes: number;
  readonly comCartoesEmFalta: number;
  readonly cartoesEncontrados: number;
  readonly aplicados: number;
  readonly linhas: readonly LinhaCartoes[];
}

export interface CartoesEmFaltaDeps {
  readonly json: JsonStore;
  readonly links: LinkPorDocumentoCartao;
  readonly media: MediaStorePort;
  readonly cache: DocumentTextCache;
  readonly clock: { now(): Date };
  /** Leitor injetável (testes). Default: a extração linear real do PDF. */
  readonly lerLinear?: (bytes: Uint8Array) => Promise<string | null>;
}

export class CartoesEmFaltaService {
  constructor(private readonly deps: CartoesEmFaltaDeps) {}

  /** Varre a base. `aplicar: false` (padrão) só relata — nada é gravado. */
  async varrer(opcoes: { aplicar?: boolean } = {}): Promise<RelatorioCartoes> {
    const aplicar = opcoes.aplicar === true;
    const ler = this.deps.lerLinear ?? extrairTextoLinearDePdf;
    const estados = (await this.deps.json.list(NS_ONBOARDING)) as OnboardingPersistido[];
    const linhas: LinhaCartoes[] = [];

    for (const estado of estados) {
      const chatId = estado.chatId ?? null;
      const cnis = estado.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
      if (chatId === null || cnis?.documentId === undefined) continue;

      const registrar = (resultado: ResultadoCartoes): void => {
        linhas.push({ chatId, resultado, cartoes: 0, modalidades: [], aplicado: false });
      };

      const link = await this.deps.links.byDocumentId(cnis.documentId).catch(() => null);
      if (link === null) {
        registrar('SEM_VINCULO');
        continue;
      }
      const atual = await this.deps.cache.get(link.sha256).catch(() => null);
      if (atual === null) {
        // Sem leitura em cache não há o que complementar: quando o sistema
        // precisar do texto, ele lê com o leitor NOVO e os cartões já entram.
        registrar('SEM_TEXTO_EM_CACHE');
        continue;
      }
      if (jaTemCartoes(atual.text)) {
        registrar('JA_TEM_CARTOES');
        continue;
      }
      const blob = await this.deps.media.read(link.sha256).catch(() => null);
      if (blob === null || blob.mime !== 'application/pdf') {
        registrar('SEM_PDF');
        continue;
      }
      const linear = await ler(blob.bytes).catch(() => null);
      if (linear === null) {
        registrar('PDF_ILEGIVEL');
        continue;
      }
      const cartoes = cartoesDoHistoricoMensal(linear);
      if (cartoes.length === 0) {
        registrar('SEM_CARTOES_NO_DOCUMENTO');
        continue;
      }

      let aplicado = false;
      if (aplicar) {
        // BACKUP uma vez (reversível) e só então o texto novo: o antigo INTEIRO
        // mais os cartões que faltavam. Nada da leitura de empréstimos muda.
        const jaTemBackup = await this.deps.json.get(NS_BACKUP, link.sha256);
        if (jaTemBackup === null)
          await this.deps.json.put(NS_BACKUP, link.sha256, {
            sha256: link.sha256,
            texto: atual.text,
            model: atual.model,
            substituidoEm: this.deps.clock.now().toISOString(),
          });
        const texto = `${atual.text}\n\n${blocosDeCartao(cartoes)}`;
        await this.deps.cache.put({
          sha256: link.sha256,
          text: texto,
          model: `${atual.model}+cartoes-do-historico`,
          chars: texto.length,
          readAt: this.deps.clock.now().toISOString(),
        });
        aplicado = true;
      }

      linhas.push({
        chatId,
        resultado: 'CARTOES_ENCONTRADOS',
        cartoes: cartoes.length,
        modalidades: cartoes.map((c) => `${c.modalidade} ${c.banco}`),
        aplicado,
      });
    }

    const emFalta = linhas.filter((l) => l.resultado === 'CARTOES_ENCONTRADOS');
    return {
      geradoEm: this.deps.clock.now().toISOString(),
      clientes: linhas.length,
      comCartoesEmFalta: emFalta.length,
      cartoesEncontrados: emFalta.reduce((s, l) => s + l.cartoes, 0),
      aplicados: emFalta.filter((l) => l.aplicado).length,
      linhas,
    };
  }
}
