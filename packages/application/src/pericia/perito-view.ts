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
  /** Decreto 2026-07-27: o CPF da jornada — a fila da perícia exige a FASE 1
   *  completa (CPF + HISCON). Ausente ⇒ temCpf=false em todos (fail-closed). */
  readonly cpfDe?: (chatId: string) => Promise<string | null>;
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
  /** Decreto 2026-07-27: fase 1 completa exige CPF + HISCON — a fila da perícia
   *  filtra por esta flag; quem falta CPF fica na aba Clientes (cobrança). */
  readonly temCpf: boolean;
  /** O CPF em si (só dígitos) — o perito precisa dele para protocolar o pedido
   *  administrativo nos bancos. null enquanto o cliente não informou. */
  readonly cpf: string | null;
}

/** CPF com a máscara oficial (000.000.000-00) — OBRIGATÓRIO na planilha: o
 *  Excel transforma 11 dígitos crus em notação científica (5,29982E+10) e
 *  descarta o zero à esquerda — o perito recebia "CPF inválido" em tudo.
 *  Com a máscara a célula é TEXTO e o número chega íntegro. */
export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf; // fora do padrão: entrega como veio (nunca inventa)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
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

  /** Decreto 2026-07-27: o CPF vai JUNTO no estudo — o perito precisa dele para
   *  protocolar o pedido administrativo nos bancos. Coluna na frente de cada
   *  linha; sem CPF registrado, a célula declara "NÃO INFORMADO" (Lei 9). */
  private async comCpf(plan: Planilha, chatId: string): Promise<Planilha> {
    const cpf = (await this.deps.cpfDe?.(chatId).catch(() => null)) ?? null;
    return {
      ...plan,
      colunas: ['CPF do cliente', ...plan.colunas],
      linhas: plan.linhas.map((l) => [cpf !== null ? formatarCpf(cpf) : 'NÃO INFORMADO', ...l]),
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
      conteudo: this.deps.exporter.gerar(await this.comCpf(plan, c.chatId)),
    };
  }

  /** Lote: TODA a fila do perito, um arquivo POR CLIENTE (nunca misturado).
   *  Decreto 2026-07-27: mesma régua da fila — só a fase 1 completa (CPF). */
  async planilhasDaFila(now?: Date): Promise<readonly PlanilhaGerada[]> {
    const fila = await this.fila(now);
    const out: PlanilhaGerada[] = [];
    for (const cliente of fila) {
      if (
        this.deps.cpfDe !== undefined &&
        (await this.deps.cpfDe(cliente.chatId).catch(() => null)) === null
      )
        continue;
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
        // Decreto 2026-07-27: o LOTE cobre só a FASE 1 completa (CPF + HISCON)
        // — mesma régua da fila. (Caso real: o zip trazia 103 quando a fila do
        // perito tinha 73 — os 30 sem CPF entravam no download.)
        if (
          this.deps.cpfDe !== undefined &&
          (await this.deps.cpfDe(cliente.chatId).catch(() => null)) === null
        )
          continue;
        const c = await this.contratosDoResumo(cliente, now);
        if (c.detalhado.contratos.length === 0) continue;
        const plan = planilhaDeContratosDetalhada(`Contratos — ${c.quem}`, c.detalhado, ref);
        out.push({
          clienteId: c.clienteId,
          quem: c.quem,
          nomeArquivo: `contratos-${c.clienteId}.${this.deps.exporter.extensao}`,
          mime: this.deps.exporter.mime,
          conteudo: this.deps.exporter.gerar(await this.comCpf(plan, c.chatId)),
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
      // Decreto 2026-07-27: CPF junto (o perito protocola o pedido com ele) — e
      // a planilha GERAL cobre só a fase 1 completa, mesma régua da fila.
      const cpf = (await this.deps.cpfDe?.(cliente.chatId).catch(() => null)) ?? null;
      if (this.deps.cpfDe !== undefined && cpf === null) continue;
      const c = await this.contratosDoResumo(cliente, now);
      if (c.detalhado.contratos.length === 0) continue;
      const plan = planilhaDeContratosDetalhada(cliente.quem, c.detalhado, ref);
      for (const linha of plan.linhas)
        linhas.push([cliente.quem, cpf !== null ? formatarCpf(cpf) : 'NÃO INFORMADO', ...linha]);
    }
    const planilha: Planilha = {
      nome: 'Contratos — todos os clientes',
      colunas: ['Cliente', 'CPF do cliente', ...COLUNAS_CONTRATOS_DETALHADA],
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
      const cpf = (await this.deps.cpfDe?.(cliente.chatId).catch(() => null)) ?? null;
      out.push({
        clienteId: cliente.clienteId,
        chatId: cliente.chatId,
        quem: cliente.quem,
        totalContratos: c.detalhado.contratos.length,
        status: cliente.status,
        ultimoContatoAt: cliente.ultimoContatoAt,
        temCpf: cpf !== null,
        cpf,
      });
    }
    return out.sort(
      (a, b) => (b.ultimoContatoAt?.getTime() ?? 0) - (a.ultimoContatoAt?.getTime() ?? 0),
    );
  }
}
