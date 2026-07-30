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
  interpretarComandoCobrancaCpf,
  interpretarComandoDistribuicao,
  interpretarComandoMensagem,
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

/** Cliente com HISCON legível AINDA SEM CPF (alvo da cobrança). */
export interface PendenteCpf {
  readonly chatId: string;
  readonly nome: string;
  readonly telefone: string;
}

/** Plano de COBRANÇA DE CPF aguardando a confirmação do fundador. */
export interface CobrancaPendente {
  readonly id: string;
  readonly criadoEm: string;
  readonly tipo: 'cobranca-cpf';
  readonly itens: readonly PendenteCpf[];
}

/** MENSAGEM DITADA pelo dono aguardando confirmação (decreto 2026-07-30):
 *  com os automáticos desligados, este é o canal proativo — texto EXATO. */
export interface MensagemPendente {
  readonly id: string;
  readonly criadoEm: string;
  readonly tipo: 'mensagem-cliente';
  readonly chatId: string;
  readonly nome: string;
  readonly texto: string;
}

export interface JarvisResposta {
  readonly resposta: string;
  /** Presente quando a pergunta era um COMANDO: o plano aguardando confirmação. */
  readonly plano?: PlanoPendente & { readonly advogados: readonly AdvogadoOpcao[] };
  /** Presente quando o comando era a COBRANÇA DE CPF (confirmação própria). */
  readonly cobranca?: CobrancaPendente;
  /** Presente quando o comando era MENSAGEM DITADA (confirmação própria). */
  readonly mensagem?: MensagemPendente;
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
  /** Clientes com HISCON legível AINDA SEM CPF (alvo da cobrança). */
  readonly pendentesCpf: () => Promise<readonly PendenteCpf[]>;
  /** DISPARA a cobrança de CPF de UM cliente — a MESMA rotina da aba Clientes
   *  (ReaquecimentoService.cobrarCpf: trava de 24h + claim-then-send). */
  readonly cobrarCpf: (chatId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Resolve o cliente citado no comando de MENSAGEM (nome do cadastro ou
   *  número com DDD). null = nenhum casou. */
  readonly resolverDestinatario: (
    termo: string,
  ) => Promise<{ chatId: string; nome: string } | null>;
  /** ENVIA a mensagem ditada — o MESMO trilho manual do admin (gateway +
   *  memória da conversa; a AHRI fica ciente do que foi dito). */
  readonly enviarAoCliente: (chatId: string, texto: string) => Promise<void>;
  /** Narração pela LLM (system, user) → texto. null = offline (determinístico). */
  readonly narrar: ((system: string, user: string) => Promise<string>) | null;
}

function resumoDoPlanoTexto(p: PlanoDistribuicao, advogadoNome: string | null): string {
  const linhas = p.itens
    .map(
      (i) =>
        `• ${i.nome} — ${String(i.contratos)} contrato(s), peso ${String(i.peso)} (${String(i.ativos)} ativo(s), ${String(i.suspensos)} suspenso(s), ${String(i.outros)} outro(s))`,
    )
    .join('\n');
  const destino = advogadoNome !== null ? ` para ${advogadoNome}` : '';
  return (
    `Montei o plano${destino}: ${String(p.itens.length)} cliente(s), peso ${String(p.totalPeso)} contado (alvo: ${String(p.alvo)}) com ${String(p.totalContratos)} contrato(s) reais no envio.\n` +
    'A contagem segue a régua dos lotes: a cada 3 contratos do MESMO banco conta 1 (9 do BMB = 3), com teto de 10 por cliente — mas TODOS os contratos do cliente vão juntos, priorizando quem tem mais ativos.\n\n' +
    `${linhas}\n\n` +
    (p.totalPeso < p.alvo
      ? `Atenção: só encontrei peso ${String(p.totalPeso)} elegível — não há clientes suficientes na fase 1 completa sem advogado para chegar a ${String(p.alvo)}.\n\n`
      : '') +
    'Confira o resumo, escolha (ou confirme) o advogado responsável e clique em CONFIRMAR para eu executar. Nada é movido sem a sua confirmação.'
  );
}

export class JarvisRuntime {
  constructor(private readonly deps: JarvisDeps) {}

  /** A conversa do fundador: comando ⇒ plano com confirmação; senão, resposta
   *  fundamentada no dossiê (LLM narra; sem LLM, resumo determinístico). */
  async perguntar(pergunta: string): Promise<JarvisResposta> {
    // MENSAGEM DITADA primeiro: "mande a mensagem para Maria: seus 20 contratos…"
    // não pode cair na distribuição nem na cobrança pelo conteúdo do texto.
    const mensagem = interpretarComandoMensagem(pergunta);
    if (mensagem !== null) return this.montarMensagem(mensagem.destinatario, mensagem.texto);
    const comando = interpretarComandoDistribuicao(pergunta);
    if (comando !== null)
      return this.montarPlano(pergunta, comando.contratos, comando.advogadoNome);
    if (interpretarComandoCobrancaCpf(pergunta)) return this.montarCobranca();

    const dossier = await this.deps.dossier();
    const ficha = await this.deps.fichaPorTermo(pergunta).catch(() => null);
    const fatos: Record<string, unknown> = { ...dossier };
    if (ficha !== null) fatos['clienteCitado'] = ficha;

    if (this.deps.narrar === null) {
      return { resposta: this.respostaDeterministica(fatos) };
    }
    const system =
      'Você é a AHRI, assistente executiva do fundador do Projeto Reconstrua (revisão de consignado do INSS). ' +
      'Tom: executivo, claro e caloroso na medida — como uma diretora de operações de confiança. NUNCA use emojis. ' +
      'Responda EXATAMENTE o que foi perguntado, com números à frente; use listas curtas quando ajudarem e valores em reais no formato R$ 1.234,56. ' +
      'Use EXCLUSIVAMENTE os FATOS fornecidos (Read Models reais): PROIBIDO inventar dados, nomes ou valores; se o fato não está no dossiê, diga com naturalidade que ainda não está registrado e o que você TEM de mais próximo. ' +
      'Nomes de clientes podem vir com ruído de captura — apresente-os limpos. ' +
      'Feche, quando fizer sentido, com UMA sugestão de próximo passo. ' +
      'Você não executa nada nesta resposta, mas TEM poderes administrativos com confirmação: se o assunto pedir, ofereça — "mova N contratos para o advogado X" (distribuição), "cobre o CPF dos clientes que faltam" (cobrança em lote) ou "mande a mensagem para <cliente>: <texto>" (mensagem ditada, enviada EXATAMENTE como o fundador escrever). Nunca diga que não consegue disparar mensagens: o fundador só precisa dar o comando e confirmar o plano. ' +
      'IMPORTANTE (decreto 2026-07-30): mensagens automáticas proativas foram DESLIGADAS — todo contato proativo com cliente passa por comando + confirmação do fundador.';
    const user = `PERGUNTA DO FUNDADOR: ${pergunta}\n\nFATOS (JSON):\n${JSON.stringify(fatos)}`;
    // Caso real 2026-07-29: uma falha pontual do narrador despejava JSON cru na
    // tela. Agora: UMA nova tentativa; persistindo, um RESUMO legível (nunca JSON).
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      try {
        const texto = (await this.deps.narrar(system, user)).trim();
        if (texto !== '') return { resposta: texto };
      } catch {
        /* tenta de novo; depois cai no resumo legível */
      }
    }
    return { resposta: this.respostaDeterministica(fatos) };
  }

  /** Monta o plano de COBRANÇA DE CPF: lista nominal dos clientes com HISCON
   *  legível ainda sem CPF, aguardando a confirmação do fundador. */
  private async montarCobranca(): Promise<JarvisResposta> {
    const itens = await this.deps.pendentesCpf();
    if (itens.length === 0) {
      return {
        resposta:
          'Boa notícia: não há ninguém para cobrar — todos os clientes com HISCON legível já têm o CPF registrado.',
      };
    }
    const pendente: CobrancaPendente = {
      id: `cobranca-${String(Date.now())}`,
      criadoEm: this.deps.clock.now().toISOString(),
      tipo: 'cobranca-cpf',
      itens,
    };
    await this.deps.json.put(NS_PLANO, pendente.id, pendente);
    const linhas = itens.map((i) => `• ${i.nome} — ${i.telefone}`).join('\n');
    return {
      resposta:
        `Encontrei ${String(itens.length)} cliente(s) com o HISCON legível e ainda SEM o CPF registrado:\n\n${linhas}\n\n` +
        'Se você confirmar, eu envio a cada um o pedido do CPF pelo WhatsApp — o mesmo texto da cobrança da aba Clientes, respeitando a trava de 24 horas (quem já foi cobrado hoje é pulado automaticamente). Nada é enviado sem a sua confirmação.',
      cobranca: pendente,
    };
  }

  /** Monta o plano de MENSAGEM DITADA (decreto 2026-07-30): destinatário
   *  resolvido no cadastro + o texto EXATO, aguardando a confirmação. */
  private async montarMensagem(destinatario: string, texto: string): Promise<JarvisResposta> {
    const cliente = await this.deps.resolverDestinatario(destinatario).catch(() => null);
    if (cliente === null) {
      return {
        resposta:
          `Não encontrei o cliente "${destinatario}" no cadastro. ` +
          'Diga o nome como está registrado ou o número com DDD (ex.: 48 99999-9999) e repita o comando.',
      };
    }
    const pendente: MensagemPendente = {
      id: `mensagem-${String(Date.now())}`,
      criadoEm: this.deps.clock.now().toISOString(),
      tipo: 'mensagem-cliente',
      chatId: cliente.chatId,
      nome: cliente.nome,
      texto,
    };
    await this.deps.json.put(NS_PLANO, pendente.id, pendente);
    return {
      resposta:
        `Mensagem pronta para ${cliente.nome} (${cliente.chatId.split('@')[0] ?? ''}), exatamente assim:\n\n` +
        `"${texto}"\n\n` +
        'Confira o texto e clique em CONFIRMAR para eu enviar — nada sai sem a sua confirmação.',
      mensagem: pendente,
    };
  }

  /** ENVIO DA MENSAGEM DITADA (só após a confirmação explícita do fundador). */
  async enviarMensagem(planoId: string): Promise<{ ok: boolean; erro?: string }> {
    const pendente = (await this.deps.json.get(NS_PLANO, planoId)) as MensagemPendente | null;
    if (pendente === null || pendente.tipo !== 'mensagem-cliente')
      return { ok: false, erro: 'mensagem não encontrada ou expirada — dite de novo' };
    const idadeMin =
      (this.deps.clock.now().getTime() - new Date(pendente.criadoEm).getTime()) / 60_000;
    if (idadeMin > VALIDADE_PLANO_MIN)
      return { ok: false, erro: 'mensagem expirada — dite de novo' };
    try {
      await this.deps.enviarAoCliente(pendente.chatId, pendente.texto);
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'falha no envio' };
    }
    // O plano morre após o envio (confirmar duas vezes não duplica).
    await this.deps.json.del(NS_PLANO, planoId).catch(() => undefined);
    return { ok: true };
  }

  /** EXECUÇÃO DA COBRANÇA (só após a confirmação explícita do fundador). */
  async cobrar(
    planoId: string,
  ): Promise<{ ok: boolean; enviados: number; pulados: number; erros: readonly string[] }> {
    const pendente = (await this.deps.json.get(NS_PLANO, planoId)) as CobrancaPendente | null;
    if (pendente === null || pendente.tipo !== 'cobranca-cpf')
      return {
        ok: false,
        enviados: 0,
        pulados: 0,
        erros: ['plano de cobrança não encontrado ou expirado — peça de novo'],
      };
    const idadeMin =
      (this.deps.clock.now().getTime() - new Date(pendente.criadoEm).getTime()) / 60_000;
    if (idadeMin > VALIDADE_PLANO_MIN)
      return { ok: false, enviados: 0, pulados: 0, erros: ['plano expirado — peça de novo'] };

    const erros: string[] = [];
    let enviados = 0;
    for (const item of pendente.itens) {
      const r = await this.deps
        .cobrarCpf(item.chatId)
        .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'falha' }));
      if (r.ok) enviados += 1;
      else erros.push(`${item.nome}: ${r.error ?? 'falha no envio'}`);
    }
    // O plano morre após a execução (confirmar duas vezes não duplica).
    await this.deps.json.del(NS_PLANO, planoId).catch(() => undefined);
    return { ok: true, enviados, pulados: erros.length, erros };
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
    const pendente = (await this.deps.json.get(NS_PLANO, planoId)) as
      (PlanoPendente & { tipo?: string }) | null;
    // Planos TIPADOS (cobrança de CPF/mensagem ditada) têm execução própria.
    if (pendente === null || pendente.tipo !== undefined)
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

  /** Sem LLM: um RESUMO legível dos números principais (nunca JSON cru, nunca
   *  silêncio — caso real 2026-07-29: o despejo de JSON assustava na tela). */
  private respostaDeterministica(fatos: Record<string, unknown>): string {
    const n = (chave: string): string => {
      const v = fatos[chave];
      return typeof v === 'number' ? String(v) : '—';
    };
    return (
      'O meu narrador de linguagem falhou agora — repita a pergunta em instantes para a resposta completa. ' +
      'Enquanto isso, os números principais dos registros:\n\n' +
      `• Clientes no total: ${n('clientesTotal')}\n` +
      `• Fase 1 completa (CPF + HISCON): ${n('fase1CompletaCpfMaisHiscon')}\n` +
      `• Com HISCON aguardando CPF: ${n('comHisconAindaSemCpf')}\n` +
      `• Contratos totais lidos: ${n('contratosTotais')}\n` +
      `• Perícias em andamento (10 dias): ${n('periciasEmAndamento10Dias')}`
    );
  }
}
