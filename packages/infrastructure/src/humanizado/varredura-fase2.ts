// ─────────────────────────────────────────────────────────────────────────────
// VARREDURA DA FASE 2 (decreto do dono, 2026-08-11) — clientes que CONFIRMARAM
// o interesse e mesmo assim não apareceram na mesa do Atendimento Humanizado
// (caso REAL Oracio "e muitos outros"). Dinheiro parado: o cliente disse SIM e
// ninguém foi buscar os documentos dele.
//
// A mesa exige DUAS coisas ao mesmo tempo:
//   1) o cliente ter cadastro próprio (clienteId ≠ chatId);
//   2) existir um parecer com `confirmadoEm` GRAVADO SOB ESSE clienteId.
//
// Quando o SIM do cliente não vira `confirmadoEm` (varredura do nascimento que
// não passou, parecer gravado sob outra chave, cadastro que nasceu depois), o
// cliente some da mesa mesmo tendo confirmado. Este serviço acha TODOS esses
// casos de uma vez e REPARA — sem enviar mensagem nenhuma (decreto
// anti-automático: reparo é dado, não conversa).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS_PARECER = 'parecer-enviado';
const NS_LIBERACAO = 'liberacao-portal';

/** O diagnóstico de UM cliente na fronteira da fase 2. */
export interface LinhaVarredura {
  readonly chatId: string;
  readonly clienteId: string;
  readonly nome: string;
  /** Existe parecer para ele (em qualquer chave)? */
  readonly temParecer: boolean;
  /** A chave sob a qual o parecer está gravado (revela a chave trocada). */
  readonly chaveParecer: string | null;
  readonly confirmadoEm: string | null;
  /** O cliente disse SIM na conversa depois do parecer? */
  readonly disseSim: boolean;
  readonly naMesa: boolean;
  /** O que está faltando, em português — e se dá para reparar sozinho. */
  readonly situacao:
    | 'na-mesa'
    | 'confirmou-sem-registro'
    | 'parecer-em-chave-errada'
    | 'sem-cadastro'
    | 'aguardando-sim'
    | 'sem-parecer';
  readonly reparavel: boolean;
}

export interface ResumoVarredura {
  readonly verificados: number;
  readonly naMesa: number;
  readonly forasDaMesaComSim: number;
  readonly linhas: readonly LinhaVarredura[];
}

interface ParecerRegistro {
  readonly clienteId?: string;
  readonly chatId?: string;
  readonly enviadoEm?: string;
  readonly contratos?: number;
  readonly indicios?: number;
  readonly confirmadoEm?: string | null;
}

export interface VarreduraFase2Deps {
  readonly json: JsonStore;
  readonly clock: Clock;
  /** A lista única de clientes (chatId + clienteId + nome). */
  readonly clientes: () => Promise<readonly { chatId: string; clienteId: string; nome: string }[]>;
  /** O cliente disse SIM depois deste instante? (mesma régua do nascimento) */
  readonly disseSimApos: (chatId: string, desde: Date) => Promise<boolean>;
  /** Invalida o cache da mesa para o reparo aparecer na hora. */
  readonly invalidarMesa?: () => void;
}

export class VarreduraFase2 {
  constructor(private readonly deps: VarreduraFase2Deps) {}

  /** Lê TODOS os pareceres uma vez e indexa por clienteId e por chatId — é
   *  assim que a chave trocada aparece (parecer gravado sob o chat). */
  private async pareceres(): Promise<{
    porChave: Map<string, ParecerRegistro>;
    porChat: Map<string, { chave: string; registro: ParecerRegistro }>;
  }> {
    const brutos = (await this.deps.json.list(NS_PARECER).catch(() => [])) as readonly unknown[];
    const porChave = new Map<string, ParecerRegistro>();
    const porChat = new Map<string, { chave: string; registro: ParecerRegistro }>();
    for (const raw of brutos) {
      const r = raw as ParecerRegistro;
      const chave = r.clienteId ?? '';
      if (chave !== '') porChave.set(chave, r);
      if (typeof r.chatId === 'string' && r.chatId !== '')
        porChat.set(r.chatId, { chave, registro: r });
    }
    return { porChave, porChat };
  }

  /** DIAGNÓSTICO (só leitura): a fronteira inteira da fase 2, cliente a cliente. */
  async diagnosticar(): Promise<ResumoVarredura> {
    const [{ porChave, porChat }, clientes] = await Promise.all([
      this.pareceres(),
      this.deps.clientes(),
    ]);
    const linhas: LinhaVarredura[] = [];
    for (const c of clientes) {
      const temCadastro = c.clienteId !== c.chatId;
      const doCliente = temCadastro ? (porChave.get(c.clienteId) ?? null) : null;
      const doChat = porChat.get(c.chatId) ?? null;
      const registro = doCliente ?? doChat?.registro ?? null;
      const chaveParecer = doCliente !== null ? c.clienteId : (doChat?.chave ?? null);
      if (registro === null) continue; // sem parecer: fora da fronteira da fase 2
      const confirmadoEm = registro.confirmadoEm ?? null;
      // Na mesa = cadastro próprio + parecer confirmado SOB o clienteId.
      const naMesa = temCadastro && doCliente !== null && confirmadoEm !== null;
      const desde = registro.enviadoEm != null ? new Date(registro.enviadoEm) : new Date(0);
      const disseSim =
        confirmadoEm !== null || (await this.deps.disseSimApos(c.chatId, desde).catch(() => false));

      let situacao: LinhaVarredura['situacao'];
      let reparavel = false;
      if (naMesa) situacao = 'na-mesa';
      else if (!disseSim) situacao = 'aguardando-sim';
      else if (!temCadastro) {
        // Confirmou, mas o cadastro nunca nasceu — o nascimento cuida disso na
        // próxima varredura; aqui só sinalizamos (não inventamos clienteId).
        situacao = 'sem-cadastro';
      } else if (doCliente === null && doChat !== null) {
        situacao = 'parecer-em-chave-errada';
        reparavel = true;
      } else {
        situacao = 'confirmou-sem-registro';
        reparavel = true;
      }
      linhas.push({
        chatId: c.chatId,
        clienteId: c.clienteId,
        nome: c.nome,
        temParecer: true,
        chaveParecer,
        confirmadoEm,
        disseSim,
        naMesa,
        situacao,
        reparavel,
      });
    }
    linhas.sort((a, b) => {
      if (a.naMesa !== b.naMesa) return a.naMesa ? 1 : -1; // pendências primeiro
      if (a.reparavel !== b.reparavel) return a.reparavel ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    return {
      verificados: linhas.length,
      naMesa: linhas.filter((l) => l.naMesa).length,
      forasDaMesaComSim: linhas.filter((l) => !l.naMesa && l.disseSim).length,
      linhas,
    };
  }

  /** REPARO: quem disse SIM entra na mesa. Regrava o parecer sob o clienteId
   *  certo e carimba `confirmadoEm`; garante o registro do Portal. NENHUMA
   *  mensagem é enviada — o cliente já foi avisado quando confirmou. */
  async reparar(): Promise<{
    ok: true;
    reparados: number;
    semCadastro: number;
    detalhes: readonly { nome: string; chatId: string; situacao: string }[];
  }> {
    const diagnostico = await this.diagnosticar();
    const agora = this.deps.clock.now().toISOString();
    const { porChave, porChat } = await this.pareceres();
    const detalhes: { nome: string; chatId: string; situacao: string }[] = [];
    let reparados = 0;
    for (const l of diagnostico.linhas) {
      if (!l.reparavel) continue;
      const base = porChave.get(l.clienteId) ?? porChat.get(l.chatId)?.registro ?? null;
      if (base === null) continue;
      // O parecer passa a viver SOB O clienteId (a chave que a mesa lê) com a
      // confirmação carimbada. A chave antiga (chat) fica onde está: nada é
      // apagado — o histórico continua auditável.
      await this.deps.json.put(NS_PARECER, l.clienteId, {
        ...base,
        clienteId: l.clienteId,
        chatId: l.chatId,
        confirmadoEm: base.confirmadoEm ?? agora,
      });
      // O registro do Portal (cadastro) — cria só se faltar.
      if ((await this.deps.json.get(NS_LIBERACAO, l.clienteId).catch(() => null)) === null) {
        await this.deps.json.put(NS_LIBERACAO, l.clienteId, {
          clienteId: l.clienteId,
          chatId: l.chatId,
          comunicadoEm: agora,
          estimativaDiasInformada: 10,
        });
      }
      reparados += 1;
      detalhes.push({ nome: l.nome, chatId: l.chatId, situacao: l.situacao });
    }
    this.deps.invalidarMesa?.();
    return {
      ok: true,
      reparados,
      semCadastro: diagnostico.linhas.filter((l) => l.situacao === 'sem-cadastro').length,
      detalhes,
    };
  }
}
