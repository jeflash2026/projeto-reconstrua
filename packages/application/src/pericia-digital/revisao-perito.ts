// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · REVISÃO OBRIGATÓRIA DO PERITO (Decreto 2026-07-24,
// itens 9 e 10). A automação NUNCA aprova nem emite sozinha: é preciso um perito
// humano identificado, que declara responsabilidade, confirma o exame e assina.
// A trava de emissão reúne TODAS as condições de segurança em um só ponto.
// ─────────────────────────────────────────────────────────────────────────────
import { STATUS_APROVADOS, type StatusPericia } from './caso-pericial.js';
import { temCriticoAberto, type Achado } from './achado.js';
import type { ErroConsistencia } from './consistencia.js';

/** O que o perito precisa fornecer para APROVAR (item 10). */
export interface DadosAprovacaoPerito {
  readonly nomeCompleto: string;
  readonly cpf: string;
  readonly qualificacao: string;
  readonly especialidades: string;
  readonly registroProfissional: string | null;
  readonly curriculoResumido: string;
  readonly declaracaoResponsabilidade: boolean;
  readonly confirmouExameDosArquivos: boolean;
}

export interface ResultadoAprovacao {
  readonly ok: boolean;
  readonly faltando: readonly string[];
}

/** Valida a aprovação do perito — todos os campos obrigatórios + declarações. */
export function validarAprovacaoPerito(d: DadosAprovacaoPerito): ResultadoAprovacao {
  const faltando: string[] = [];
  if (d.nomeCompleto.trim() === '') faltando.push('nome completo');
  if (d.cpf.replace(/\D/g, '').length !== 11) faltando.push('CPF válido');
  if (d.qualificacao.trim() === '') faltando.push('qualificação profissional');
  if (d.especialidades.trim() === '') faltando.push('especialidades');
  if (d.curriculoResumido.trim() === '') faltando.push('currículo resumido');
  if (!d.declaracaoResponsabilidade) faltando.push('declaração de responsabilidade');
  if (!d.confirmouExameDosArquivos) faltando.push('confirmação de exame dos arquivos');
  return { ok: faltando.length === 0, faltando };
}

/** Entradas da TRAVA de emissão — o portão único antes de liberar ao advogado. */
export interface ContextoEmissao {
  readonly status: StatusPericia;
  readonly achados: readonly Achado[];
  readonly errosConsistencia: readonly ErroConsistencia[];
  /** Termos proibidos que escaparam para a minuta (deve ser vazio). */
  readonly bloqueiosMinuta: readonly string[];
  readonly assinadaPorPerito: boolean;
}

export interface ResultadoEmissao {
  readonly pode: boolean;
  readonly motivos: readonly string[];
}

/** A automação pode EMITIR a versão final? Só quando TUDO abaixo é verdade. */
export function podeEmitir(ctx: ContextoEmissao): ResultadoEmissao {
  const motivos: string[] = [];
  if (!STATUS_APROVADOS.includes(ctx.status))
    motivos.push('o caso não está aprovado/assinado pelo perito');
  if (!ctx.assinadaPorPerito) motivos.push('a minuta não foi assinada por um perito humano');
  if (temCriticoAberto(ctx.achados)) motivos.push('há achado CRÍTICO em aberto');
  if (ctx.errosConsistencia.length > 0)
    motivos.push(`há ${String(ctx.errosConsistencia.length)} erro(s) crítico(s) de consistência`);
  if (ctx.bloqueiosMinuta.length > 0)
    motivos.push('a minuta contém termo de conclusão jurídica proibido');
  return { pode: motivos.length === 0, motivos };
}
