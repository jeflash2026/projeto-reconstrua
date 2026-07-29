// ─────────────────────────────────────────────────────────────────────────────
// JARVIS RUNTIME (decreto 2026-07-29) — a AHRI como assistente do FUNDADOR no
// Founder Console:
//
//  • CONHECIMENTO TOTAL: monta um DOSSIÊ determinístico dos Read Models
//    (clientes por fase, contratos, advogados e carga, perícia em fluxo,
//    potencial financeiro) e, quando a pergunta cita um cliente, anexa a ficha
//    dele (jornada + últimas mensagens da conversa). A LLM só NARRA os fatos
//    fornecidos — proibida de inventar (fallback determinístico sem LLM).
//
//  • PODER ADMINISTRATIVO COM CONFIRMAÇÃO: "mova 20 contratos para o advogado
//    X" gera um PLANO determinístico (fase 1 completa sem advogado, máx. 10
//    contratos/cliente, ATIVOS primeiro), guardado em ns 'jarvis-plano'. NADA
//    executa sem o clique de confirmação do fundador — que também escolhe (ou
//    confirma) o advogado responsável. A execução usa a MESMA atribuição do
//    painel (work.assign + aviso ao advogado pela AHRI).
// ─────────────────────────────────────────────────────────────────────────────
import {
  casarAdvogadoPorNome,
  interpretarComandoDistribuicao,
  planejarDistribuicao,
  type ClienteElegivel,
  type PlanoDistribuicao,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS_PLANO = 'jarvis-plano';
const VALIDADE_PLANO_MIN = 60; // um plano não confirmado morre em 1 hora

export interface AdvogadoOpcao {
  readonly id: string;
  readonly name: string;
  readonly casos: number;
}

export interface PlanoPendente {
  readonly id: string;
  readonly criadoEm: string;
  readonly plano: PlanoDistribuicao;
  readonly advogadoSugeridoId: string | null;
}

export interface JarvisResposta {
  readonly resposta: string;
  /** Presente quando a pergunta era um COMANDO: o plano aguardando confirmação. */
  readonly plano?: PlanoPendente & { readonly advogados: readonly AdvogadoOpcao[] };
}

export interface FichaCliente {
  readonly chatId: string;
  readonly nome: string;
  readonly resumo: Record<string, unknown>;
  readonly ultimasMensagens: readonly string[];
}

export interface JarvisDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
  /** Clientes da FASE 1 completa (CPF+HISCON) AINDA SEM advogado, com a
   *  contagem de contratos na janela por situação. */
  readonly elegiveis: () => Promise<readonly ClienteElegivel[]>;
  /** O DOSSIÊ da plataforma (números derivados dos Read Models). */
  readonly dossier: () => Promise<Record<string, unknown>>;
  /** Advogados ATIVOS com a carga atual (casos atribuídos). */
  readonly advogados: () => Promise<readonly AdvogadoOpcao[]>;
  /** Ficha de um cliente citado na pergunta (null = nenhum casou). */
  readonly fichaPorTermo: (pergunta: string) => Promise<FichaCliente | null>;
  /** ATRIBUI a missão ao advogado — a MESMA rotina do painel (assign+aviso). */
  readonly atribuir: (
    missionId: string,
    advogadoId: string,
    assignedBy: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Narração pela LLM (system, user) → texto. null = offline (determinístico). */
  readonly narrar: ((system: string, user: string) => Promise<string>) | null;
}

function resumoDoPlanoTexto(p: PlanoDistribuicao, advogadoNome: string | null): string {
  const linhas = p.itens
    .map(
      (i) =>
        `• ${i.nome} — ${String(i.contratos)} contrato(s) (${String(i.ativos)} ativo(s), ${String(i.suspensos)} suspenso(s), ${String(i.outros)} outro(s))`,
    )
    .join('\n');
  const destino = advogadoNome !== null ? ` para ${advogadoNome}` : '';
  return (
    `Montei o plano${destino}: ${String(p.itens.length)} cliente(s), ${String(p.totalContratos)} contrato(s) no total (alvo: ${String(p.alvo)}; máximo de 10 por cliente, ativos primeiro).\n\n` +
    `${linhas}\n\n` +
    (p.totalContratos < p.alvo
      ? `Atenção: só encontrei ${String(p.totalContratos)} contrato(s) elegíveis — não há clientes suficientes na fase 1 completa sem advogado para chegar a ${String(p.alvo)}.\n\n`
      : '') +
    'Confira o resumo, escolha (ou confirme) o advogado responsável e clique em CONFIRMAR para eu executar. Nada é movido sem a sua confirmação.'
  );
}

export class JarvisRuntime {
  constructor(private readonly deps: JarvisDeps) {}

  /** A conversa do fundador: comando ⇒ plano com confirmação; senão, resposta
   *  fundamentada no dossiê (LLM narra; sem LLM, resumo determinístico). */
  async perguntar(pergunta: string): Promise<JarvisResposta> {
    const comando = interpretarComandoDistribuicao(pergunta);
    if (comando !== null)
      return this.montarPlano(pergunta, comando.contratos, comando.advogadoNome);

    const dossier = await this.deps.dossier();
    const ficha = await this.deps.fichaPorTermo(pergunta).catch(() => null);
    const fatos: Record<string, unknown> = { ...dossier };
    if (ficha !== null) fatos['clienteCitado'] = ficha;

    if (this.deps.narrar === null) {
      return { resposta: this.respostaDeterministica(fatos) };
    }
    try {
      const system =
        'Você é a AHRI, assistente executiva do fundador do Projeto Reconstrua (revisão de consignado do INSS). ' +
        'Responda em português, direto e útil, COM NÚMEROS, usando EXCLUSIVAMENTE os FATOS fornecidos (Read Models reais). ' +
        'PROIBIDO inventar dados, nomes, valores ou prometer ações. Se o fato não está no dossiê, diga que não está registrado. ' +
        'Sem emojis. Você não executa nada nesta resposta — comandos administrativos têm fluxo próprio de confirmação.';
      const user = `PERGUNTA DO FUNDADOR: ${pergunta}\n\nFATOS (JSON):\n${JSON.stringify(fatos)}`;
      const texto = (await this.deps.narrar(system, user)).trim();
      return { resposta: texto !== '' ? texto : this.respostaDeterministica(fatos) };
    } catch {
      return { resposta: this.respostaDeterministica(fatos) };
    }
  }

  /** EXECUÇÃO (só após a confirmação explícita do fundador, com o advogado). */
  async executar(
    planoId: string,
    advogadoId: string,
    quem: string,
  ): Promise<{
    ok: boolean;
    clientes: number;
    contratos: number;
    erros: readonly string[];
  }> {
    const pendente = (await this.deps.json.get(NS_PLANO, planoId)) as PlanoPendente | null;
    if (pendente === null)
      return {
        ok: false,
        clientes: 0,
        contratos: 0,
        erros: ['plano não encontrado ou expirado — peça de novo'],
      };
    const idadeMin =
      (this.deps.clock.now().getTime() - new Date(pendente.criadoEm).getTime()) / 60_000;
    if (idadeMin > VALIDADE_PLANO_MIN)
      return { ok: false, clientes: 0, contratos: 0, erros: ['plano expirado — peça de novo'] };

    const erros: string[] = [];
    let clientes = 0;
    let contratos = 0;
    for (const item of pendente.plano.itens) {
      const r = await this.deps
        .atribuir(item.missionId, advogadoId, quem)
        .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'falha' }));
      if (r.ok) {
        clientes += 1;
        contratos += item.contratos;
      } else {
        erros.push(`${item.nome}: ${r.error ?? 'falha na atribuição'}`);
      }
    }
    // O plano morre após a execução (confirmar duas vezes não duplica).
    await this.deps.json.del(NS_PLANO, planoId).catch(() => undefined);
    return { ok: erros.length === 0, clientes, contratos, erros };
  }

  private async montarPlano(
    pergunta: string,
    alvo: number,
    advogadoNome: string | null,
  ): Promise<JarvisResposta> {
    const [elegiveis, advogados] = await Promise.all([
      this.deps.elegiveis(),
      this.deps.advogados(),
    ]);
    const plano = planejarDistribuicao(elegiveis, alvo);
    if (plano.itens.length === 0) {
      return {
        resposta:
          'Não encontrei nenhum cliente elegível agora: a distribuição usa clientes com a FASE 1 completa (CPF + HISCON legível) que ainda não têm advogado. ' +
          'Assim que houver clientes nessa condição, é só me pedir de novo.',
      };
    }
    const sugerido = casarAdvogadoPorNome(advogadoNome, advogados);
    const agora = this.deps.clock.now().toISOString();
    const pendente: PlanoPendente = {
      id: `plano-${String(Date.now())}`,
      criadoEm: agora,
      plano,
      advogadoSugeridoId: sugerido?.id ?? null,
    };
    await this.deps.json.put(NS_PLANO, pendente.id, pendente);
    void pergunta;
    return {
      resposta: resumoDoPlanoTexto(plano, sugerido?.name ?? advogadoNome),
      plano: { ...pendente, advogados },
    };
  }

  /** Sem LLM: os números principais, direto do dossiê (nunca silêncio). */
  private respostaDeterministica(fatos: Record<string, unknown>): string {
    return (
      'Estou sem o narrador de linguagem agora, então vão os números direto dos registros:\n\n' +
      JSON.stringify(fatos, null, 2).slice(0, 3500)
    );
  }
}
