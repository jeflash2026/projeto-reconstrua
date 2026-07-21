// ─────────────────────────────────────────────────────────────────────────────
// PERITO VIEW (B-R2) — a visão de trabalho do perito na Jornada B: fila DERIVADA
// (PRONTO_AGUARDANDO_PERICIA, já existente na lista única), contratos do cliente
// (textos dos documentos reconhecidos → parseHiscon) e exportação de planilha por
// cliente ou EM LOTE (cada cliente = um arquivo separado).
//
// Somente-leitura; ZERO persistência (o texto já vive no cache document-text; o
// parse é derivado e recomputável). Deps são funções simples ligadas na composição
// de produção a componentes JÁ existentes (projector.allDocuments, DocumentReader).
// Lei 9: documentos sem texto legível são CONTADOS e declarados, nunca omitidos.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientesList, ClienteResumo } from '../clientes/clientes-list.js';
import { parseHiscon, type HisconParse } from './hiscon.js';
import { planilhaDeContratos, type PlanilhaExporter } from './planilha.js';

export interface PeritoDeps {
  readonly clientes: ClientesList;
  /** IDs dos documentos reconhecidos da missão (projector existente). */
  readonly documentosDaMissao: (missionId: string) => Promise<readonly string[]>;
  /** Texto bruto de um documento (DocumentReader existente; null = ilegível). */
  readonly textoDoDocumento: (documentId: string) => Promise<string | null>;
  readonly exporter: PlanilhaExporter;
}

export interface ContratosDoCliente {
  readonly clienteId: string;
  readonly chatId: string;
  readonly quem: string;
  readonly parse: HisconParse;
  /** Transparência (Lei 9): quantos documentos foram lidos e quantos não têm texto. */
  readonly documentosLidos: number;
  readonly documentosSemTexto: number;
}

export interface PlanilhaGerada {
  readonly clienteId: string;
  readonly quem: string;
  readonly nomeArquivo: string;
  readonly mime: string;
  readonly conteudo: string;
}

export class PeritoView {
  constructor(private readonly deps: PeritoDeps) {}

  /** A fila do perito — derivada da lista única (nenhum estado próprio). */
  async fila(now?: Date): Promise<readonly ClienteResumo[]> {
    return (await this.deps.clientes.list(now)).filter(
      (c) => c.status === 'PRONTO_AGUARDANDO_PERICIA',
    );
  }

  /** Contratos organizados do cliente (todas as fontes lidas; merge determinístico). */
  async contratos(clienteId: string, now?: Date): Promise<ContratosDoCliente | null> {
    const cliente = (await this.deps.clientes.list(now)).find((c) => c.clienteId === clienteId);
    if (cliente === undefined) return null;

    const documentIds =
      cliente.missionId !== null ? await this.deps.documentosDaMissao(cliente.missionId) : [];
    const textos: string[] = [];
    let semTexto = 0;
    for (const id of documentIds) {
      const texto = await this.deps.textoDoDocumento(id);
      if (texto === null) semTexto += 1;
      else textos.push(texto);
    }

    // Merge por concatenação: o parser é por linha e ignora o que não é candidato —
    // documentos que não são HISCON contribuem com nada (e nada é inventado).
    const parse = parseHiscon(textos.join('\n'), now ?? new Date());
    return {
      clienteId: cliente.clienteId,
      chatId: cliente.chatId,
      quem: cliente.quem,
      parse,
      documentosLidos: textos.length,
      documentosSemTexto: semTexto,
    };
  }

  /** Planilha de UM cliente (CSV hoje; XLSX = trocar o exporter). */
  async planilha(clienteId: string, now?: Date): Promise<PlanilhaGerada | null> {
    const c = await this.contratos(clienteId, now);
    if (c === null) return null;
    const plan = planilhaDeContratos(`Contratos — ${c.quem}`, c.parse);
    return {
      clienteId: c.clienteId,
      quem: c.quem,
      nomeArquivo: `contratos-${c.clienteId}.${this.deps.exporter.extensao}`,
      mime: this.deps.exporter.mime,
      conteudo: this.deps.exporter.gerar(plan),
    };
  }

  /** Lote: TODA a fila do perito, um arquivo POR CLIENTE (nunca misturado). */
  async planilhasDaFila(now?: Date): Promise<readonly PlanilhaGerada[]> {
    const fila = await this.fila(now);
    const out: PlanilhaGerada[] = [];
    for (const cliente of fila) {
      const gerada = await this.planilha(cliente.clienteId, now);
      if (gerada !== null) out.push(gerada);
    }
    return out;
  }
}
