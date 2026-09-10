// ─────────────────────────────────────────────────────────────────────────────
// PASTAS POR ADVOGADO (2026-09-10) — no Painel Jurídico, cada advogado é uma
// pasta: quantos clientes o Admin ENTREGOU a ele (a atribuição real, a mesma
// do painel do advogado), quantos já têm processo distribuído cadastrado aqui
// e quais ainda aguardam o nº do processo. O cruzamento Admin × Jurídico é
// pelo NOME (sem acento, caixa ou pontuação) — o cadastro do jurídico não
// guarda o chat do cliente. Cliente do jurídico sem entrega correspondente vai
// para "sem advogado": quase sempre é o nome escrito diferente.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClienteJuridico, ContratoJuridico } from './juridico-service.js';

export interface EntregaAoAdvogado {
  readonly advogadoId: string;
  readonly advogado: string;
  readonly chatId: string;
  /** Nome do cliente no Admin (cadastro da jornada). */
  readonly nome: string;
  readonly entregueEm: string | null;
}

export interface ClienteNaPasta {
  /** Nome do cadastro do jurídico quando casou; senão, o do Admin. */
  readonly nome: string;
  readonly chatId: string;
  readonly entregueEm: string | null;
  /** Cadastro correspondente no jurídico (null = ainda não cadastrado aqui). */
  readonly juridicoClienteId: string | null;
  /** Processos (nº CNJ distintos, fora os excluídos). */
  readonly processos: number;
}

export interface PastaAdvogado {
  readonly advogadoId: string;
  readonly advogado: string;
  readonly entregues: number;
  readonly comProcesso: number;
  readonly aguardando: number;
  /** Aguardando o nº primeiro (é o que pede ação), depois por nome. */
  readonly clientes: readonly ClienteNaPasta[];
}

export interface PastasJuridico {
  readonly pastas: readonly PastaAdvogado[];
  readonly semAdvogado: readonly {
    readonly clienteId: string;
    readonly nome: string;
    readonly processos: number;
  }[];
}

/** "TAÍS  Regina-Caetano" → "tais regina caetano". */
export function chaveDeNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function montarPastasPorAdvogado(
  entregas: readonly EntregaAoAdvogado[],
  clientes: readonly ClienteJuridico[],
  contratos: readonly ContratoJuridico[],
): PastasJuridico {
  const processosPorCliente = new Map<string, Set<string>>();
  for (const c of contratos) {
    if (c.status === 'excluido') continue;
    const processos = processosPorCliente.get(c.clienteId) ?? new Set<string>();
    processos.add(c.processoNumero.replace(/\D/g, ''));
    processosPorCliente.set(c.clienteId, processos);
  }
  const qtd = (clienteId: string): number => processosPorCliente.get(clienteId)?.size ?? 0;

  const clientePorNome = new Map<string, ClienteJuridico>();
  for (const c of clientes) {
    const k = chaveDeNome(c.nome);
    const atual = clientePorNome.get(k);
    // Homônimo no jurídico: fica o cadastro que tem processo.
    if (atual === undefined || qtd(c.id) > qtd(atual.id)) clientePorNome.set(k, c);
  }

  const casados = new Set<string>();
  const porAdvogado = new Map<string, { advogado: string; clientes: ClienteNaPasta[] }>();
  for (const e of entregas) {
    const pasta = porAdvogado.get(e.advogadoId) ?? { advogado: e.advogado, clientes: [] };
    porAdvogado.set(e.advogadoId, pasta);
    if (pasta.clientes.some((x) => x.chatId === e.chatId)) continue;
    const doJuridico = clientePorNome.get(chaveDeNome(e.nome)) ?? null;
    if (doJuridico !== null) casados.add(doJuridico.id);
    pasta.clientes.push({
      nome: doJuridico?.nome ?? e.nome,
      chatId: e.chatId,
      entregueEm: e.entregueEm,
      juridicoClienteId: doJuridico?.id ?? null,
      processos: doJuridico === null ? 0 : qtd(doJuridico.id),
    });
  }

  const pastas = [...porAdvogado.entries()]
    .map(([advogadoId, p]) => {
      const comProcesso = p.clientes.filter((c) => c.processos > 0).length;
      return {
        advogadoId,
        advogado: p.advogado,
        entregues: p.clientes.length,
        comProcesso,
        aguardando: p.clientes.length - comProcesso,
        clientes: [...p.clientes].sort(
          (a, b) =>
            Number(a.processos > 0) - Number(b.processos > 0) ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
        ),
      };
    })
    .sort((a, b) => a.advogado.localeCompare(b.advogado, 'pt-BR'));

  const semAdvogado = clientes
    .filter((c) => !casados.has(c.id))
    .map((c) => ({ clienteId: c.id, nome: c.nome, processos: qtd(c.id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { pastas, semAdvogado };
}
