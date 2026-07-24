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
import { parseHisconDetalhado, type HisconExtraido } from './hiscon-parser.js';
import {
  COLUNAS_CONTRATOS_DETALHADA,
  planilhaDeContratos,
  planilhaDeContratosDetalhada,
  type Planilha,
  type PlanilhaExporter,
} from './planilha.js';

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
  /** Decreto Dossiê Pericial: o parse DETALHADO do formato real em blocos
   *  (CONTRATO:/BANCO:/ORIGEM DA AVERBAÇÃO…) — a fonte da planilha quando
   *  encontra contratos; o heurístico acima segue como fallback. */
  readonly detalhado: HisconExtraido;
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

/** Linha da lista "TODOS os clientes com HISCON legível" (Decreto 2026-07-23) —
 *  o perito trabalha a partir da ENTREGA do HISCON, não do status de venda. */
export interface ClienteComHiscon {
  readonly clienteId: string;
  readonly chatId: string;
  readonly quem: string;
  readonly totalContratos: number;
  readonly status: string;
  readonly ultimoContatoAt: Date | null;
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
    // Aceita o id CANÔNICO do cliente OU o chatId — a lista "todos com HISCON" o
    // referencia por chatId, e ambos são únicos (nunca colidem).
    const cliente = (await this.deps.clientes.list(now)).find(
      (c) => c.clienteId === clienteId || c.chatId === clienteId,
    );
    if (cliente === undefined) return null;
    return this.contratosDoResumo(cliente, now);
  }

  /** Núcleo da leitura de contratos a partir de um cliente JÁ resolvido — evita
   *  re-listar todos os clientes por item (o que tornava as varreduras O(n²) e
   *  travava a home do perito). Usado por contratos(), planilhaGeral() e
   *  todosComHiscon(), que listam UMA vez e reaproveitam este núcleo. */
  private async contratosDoResumo(cliente: ClienteResumo, now?: Date): Promise<ContratosDoCliente> {
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
    const textoCompleto = textos.join('\n');
    const parse = parseHiscon(textoCompleto, now ?? new Date());
    const detalhado = parseHisconDetalhado(textoCompleto);
    return {
      clienteId: cliente.clienteId,
      chatId: cliente.chatId,
      quem: cliente.quem,
      parse,
      detalhado,
      documentosLidos: textos.length,
      documentosSemTexto: semTexto,
    };
  }

  /** Planilha de UM cliente (CSV hoje; XLSX = trocar o exporter). */
  async planilha(clienteId: string, now?: Date): Promise<PlanilhaGerada | null> {
    const c = await this.contratos(clienteId, now);
    if (c === null) return null;
    // A planilha vinha VAZIA em produção: o HISCON real é em BLOCOS (o parser
    // heurístico por linha não o reconhece). Detalhado achou contratos ⇒ é a
    // fonte, no formato do documento original (por banco, todos os campos).
    const plan =
      c.detalhado.contratos.length > 0
        ? planilhaDeContratosDetalhada(`Contratos — ${c.quem}`, c.detalhado, now ?? new Date())
        : planilhaDeContratos(`Contratos — ${c.quem}`, c.parse);
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

  /** Lote de TODOS os clientes com HISCON legível — UM CSV por cliente (Decreto
   *  2026-07-23; o dono quer 1 arquivo por pessoa, não tudo num só). Lista uma vez
   *  (O(n)); um cliente problemático NÃO derruba o lote (resiliente ⇒ sem 500). */
  async planilhasDeTodos(now?: Date): Promise<readonly PlanilhaGerada[]> {
    const ref = now ?? new Date();
    const clientes = await this.deps.clientes.list(now);
    const out: PlanilhaGerada[] = [];
    for (const cliente of clientes) {
      try {
        const c = await this.contratosDoResumo(cliente, now);
        if (c.detalhado.contratos.length === 0) continue;
        const plan = planilhaDeContratosDetalhada(`Contratos — ${c.quem}`, c.detalhado, ref);
        out.push({
          clienteId: c.clienteId,
          quem: c.quem,
          nomeArquivo: `contratos-${c.clienteId}.${this.deps.exporter.extensao}`,
          mime: this.deps.exporter.mime,
          conteudo: this.deps.exporter.gerar(plan),
        });
      } catch {
        /* cliente com documento problemático não interrompe o lote inteiro */
      }
    }
    return out;
  }

  /** UM único arquivo com TODOS os clientes que têm HISCON legível — cada linha é
   *  um contrato, com a coluna CLIENTE na frente. Para baixar o estudo inteiro de
   *  uma vez (o dono pediu 2026-07-23). Só o detalhado (formato do documento). */
  async planilhaGeral(now?: Date): Promise<PlanilhaGerada> {
    const ref = now ?? new Date();
    const clientes = await this.deps.clientes.list(now); // lista UMA vez (O(n))
    const linhas: ReadonlyArray<string | number | null>[] = [];
    for (const cliente of clientes) {
      const c = await this.contratosDoResumo(cliente, now);
      if (c.detalhado.contratos.length === 0) continue;
      const plan = planilhaDeContratosDetalhada(cliente.quem, c.detalhado, ref);
      for (const linha of plan.linhas) linhas.push([cliente.quem, ...linha]);
    }
    const planilha: Planilha = {
      nome: 'Contratos — todos os clientes',
      colunas: ['Cliente', ...COLUNAS_CONTRATOS_DETALHADA],
      linhas,
    };
    return {
      clienteId: 'TODOS',
      quem: 'Todos os clientes',
      nomeArquivo: `contratos-todos-clientes.${this.deps.exporter.extensao}`,
      mime: this.deps.exporter.mime,
      conteudo: this.deps.exporter.gerar(planilha),
    };
  }

  /** TODOS os clientes com HISCON legível (Decreto 2026-07-23) — o perito enxerga
   *  todo mundo que já entregou o HISCON, não só a fila de sociedade. Mesma fonte
   *  do CSV geral; cada linha traz nº de contratos e o status atual da jornada. */
  async todosComHiscon(now?: Date): Promise<readonly ClienteComHiscon[]> {
    const clientes = await this.deps.clientes.list(now); // lista UMA vez (O(n))
    const out: ClienteComHiscon[] = [];
    for (const cliente of clientes) {
      const c = await this.contratosDoResumo(cliente, now);
      if (c.detalhado.contratos.length === 0) continue;
      out.push({
        clienteId: cliente.clienteId,
        chatId: cliente.chatId,
        quem: cliente.quem,
        totalContratos: c.detalhado.contratos.length,
        status: cliente.status,
        ultimoContatoAt: cliente.ultimoContatoAt,
      });
    }
    return out.sort(
      (a, b) => (b.ultimoContatoAt?.getTime() ?? 0) - (a.ultimoContatoAt?.getTime() ?? 0),
    );
  }
}
