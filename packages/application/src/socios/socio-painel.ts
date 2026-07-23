// ─────────────────────────────────────────────────────────────────────────────
// PAINEL DO SÓCIO (Decreto 2026-07-23) — a visão que o sócio vê ao entrar: quanto
// lhe cabe do potencial recuperável hoje, com o rateio de referência transparente.
// Tudo DERIVADO em leitura do potencial total (fonte: a perícia de todos os HISCON)
// e da participação (bps) gravada no cadastro. Nada aqui escreve.
// ─────────────────────────────────────────────────────────────────────────────
import {
  BPS_TOTAL,
  RATEIO_REFERENCIA,
  formatarCpf,
  percentualLegivel,
  rateioDoSocio,
  type Socio,
} from './socio-model.js';

export interface FatiaRateio {
  readonly rotulo: string;
  readonly percentual: string;
  readonly valor: number;
}

export interface PainelSocio {
  readonly cpf: string;
  readonly nome: string;
  readonly percentualBps: number;
  readonly percentual: string;
  /** Base do rateio: o potencial recuperável total (100%) da carteira hoje. */
  readonly potencialTotal: number;
  /** O que cabe a ESTE sócio (fatia dele do potencial total). */
  readonly meuValor: number;
  /** O rateio de referência (cliente/advogado/AHRI) com valores — transparência. */
  readonly rateioReferencia: readonly FatiaRateio[];
  /** Quantos clientes com HISCON legível compõem a base (contexto do número). */
  readonly clientes: number;
}

/** Monta a visão do sócio: seu valor + o rateio de referência sobre o potencial total. */
export function montarPainelDoSocio(
  socio: Socio,
  potencialTotal: number,
  clientes: number,
): PainelSocio {
  return {
    cpf: formatarCpf(socio.cpf),
    nome: socio.nome,
    percentualBps: socio.percentualBps,
    percentual: percentualLegivel(socio.percentualBps),
    potencialTotal,
    meuValor: rateioDoSocio(potencialTotal, socio.percentualBps),
    rateioReferencia: [
      {
        rotulo: 'Cliente',
        percentual: percentualLegivel(RATEIO_REFERENCIA.cliente),
        valor: rateioDoSocio(potencialTotal, RATEIO_REFERENCIA.cliente),
      },
      {
        rotulo: 'Advogado sócio',
        percentual: percentualLegivel(RATEIO_REFERENCIA.advogadoSocio),
        valor: rateioDoSocio(potencialTotal, RATEIO_REFERENCIA.advogadoSocio),
      },
      {
        rotulo: 'AHRI (empresa)',
        percentual: percentualLegivel(RATEIO_REFERENCIA.ahriEmpresa),
        valor: rateioDoSocio(potencialTotal, RATEIO_REFERENCIA.ahriEmpresa),
      },
    ],
    clientes,
  };
}

/** Linha do sócio na visão do ADMIN (lista de cadastro/participação). */
export interface SocioResumoAdmin {
  readonly cpf: string;
  readonly nome: string;
  readonly percentualBps: number;
  readonly percentual: string;
  readonly ativo: boolean;
  /** O sócio já criou senha pelo link? (fila de "aguardando cadastro"). */
  readonly temSenha: boolean;
  /** Valor estimado que cabe a ele hoje (fatia do potencial total). */
  readonly valorEstimado: number;
}

/** Soma das participações cadastradas (bps) — deve fechar em ≤ 100% da AHRI. */
export function somaParticipacoes(socios: readonly Socio[]): number {
  return socios.reduce((acc, s) => acc + (s.ativo ? s.percentualBps : 0), 0);
}

export { BPS_TOTAL };
