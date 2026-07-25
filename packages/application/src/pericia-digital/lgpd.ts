// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · LGPD (Decreto 2026-07-24, Fase 5)
// Minimização e mascaramento de dados pessoais por papel. Puro. Regras:
//  • O DADO NUNCA É INVENTADO nem alterado no armazenamento — mascarar é uma
//    projeção de LEITURA. O original imutável (e a custódia) permanecem intactos.
//  • Papéis RESTRITOS (visualizador/auditor/advogado) recebem o CPF/RG/benefício
//    e telefones MASCARADOS. Papéis que operam a análise (perito/administrador/
//    assistente) veem o dado completo, pois precisam dele para o trabalho.
//  • redigirPii varre texto livre (ex.: minuta) e mascara CPFs/telefones/CEPs
//    que apareçam soltos, sem afirmar nada sobre eles.
//  • anonimizar() prepara a projeção de EXCLUSÃO/ANONIMIZAÇÃO preservando a
//    cadeia de custódia (nunca apaga o histórico; mascara o conteúdo pessoal).
// ─────────────────────────────────────────────────────────────────────────────
import type { PapelPericia } from './autorizacao.js';

/** Papéis que enxergam o dado pessoal COMPLETO (operam a análise/atendimento). */
const PAPEIS_DADO_COMPLETO: readonly PapelPericia[] = ['administrador', 'perito', 'assistente'];

/** O papel vê o dado pessoal completo? Caso contrário, recebe o mascarado. */
export function veDadoCompleto(papel: PapelPericia | null): boolean {
  return papel !== null && PAPEIS_DADO_COMPLETO.includes(papel);
}

const SO_DIGITOS = /\D+/g;

/** Mascara um CPF preservando os 3 primeiros e os 2 últimos dígitos:
 *  "12345678905" → "123.XXX.XXX-05". Sem 11 dígitos, devolve o rótulo genérico. */
export function mascararCpf(cpf: string | null): string | null {
  if (cpf === null) return null;
  const d = cpf.replace(SO_DIGITOS, '');
  if (d.length !== 11) return '***';
  return `${d.slice(0, 3)}.XXX.XXX-${d.slice(9, 11)}`;
}

/** Mascara RG/documento genérico: mostra os 2 primeiros e 1 último dígito. */
export function mascararDocumento(valor: string | null): string | null {
  if (valor === null) return null;
  const d = valor.replace(SO_DIGITOS, '');
  if (d.length < 4) return '***';
  return `${d.slice(0, 2)}${'*'.repeat(d.length - 3)}${d.slice(-1)}`;
}

/** Mascara nº de benefício (mostra os 3 últimos dígitos). */
export function mascararBeneficio(valor: string | null): string | null {
  if (valor === null) return null;
  const d = valor.replace(SO_DIGITOS, '');
  if (d.length < 4) return '***';
  return `${'*'.repeat(d.length - 3)}${d.slice(-3)}`;
}

/** Mascara telefone brasileiro (mostra DDD e os 2 últimos dígitos). */
export function mascararTelefone(valor: string | null): string | null {
  if (valor === null) return null;
  const d = valor.replace(SO_DIGITOS, '');
  if (d.length < 6) return '***';
  const ddd = d.slice(0, 2);
  return `(${ddd}) ${'*'.repeat(d.length - 4)}${d.slice(-2)}`;
}

/** Mascara um nome próprio: primeiro nome + iniciais dos demais (M. S. S.). */
export function mascararNome(nome: string | null): string | null {
  if (nome === null) return null;
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return null;
  const [primeiro, ...resto] = partes;
  const iniciais = resto.map((p) => `${p[0]?.toUpperCase() ?? ''}.`).join(' ');
  return iniciais === '' ? (primeiro ?? '') : `${primeiro ?? ''} ${iniciais}`;
}

// Varredura de PII solta em texto livre (sem afirmar nada — só oculta).
const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RE_TELEFONE = /\b\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;
const RE_CEP = /\b\d{5}-?\d{3}\b/g;

/** Redige CPFs/telefones/CEPs que apareçam soltos num texto (ex.: minuta exibida
 *  a papel restrito). Não classifica nem conclui — apenas oculta o dado. */
export function redigirPii(texto: string): string {
  return texto
    .replace(RE_CPF, '[CPF OCULTO]')
    .replace(RE_CEP, '[CEP OCULTO]')
    .replace(RE_TELEFONE, '[TELEFONE OCULTO]');
}

/** Dados-âncora de um caso, na forma mínima que a projeção LGPD manipula. */
export interface DadosPessoais {
  readonly nomeCliente: string | null;
  readonly cpf: string | null;
  readonly numeroBeneficio: string | null;
}

/** Projeção de leitura dos dados-âncora conforme o papel (mascara se restrito). */
export function projetarDados(dados: DadosPessoais, papel: PapelPericia | null): DadosPessoais {
  if (veDadoCompleto(papel)) return dados;
  return {
    nomeCliente: mascararNome(dados.nomeCliente),
    cpf: mascararCpf(dados.cpf),
    numeroBeneficio: mascararBeneficio(dados.numeroBeneficio),
  };
}

/** ANONIMIZAÇÃO (direito de exclusão sob LGPD, art. 18): substitui o conteúdo
 *  pessoal por rótulos, SEM apagar a estrutura nem a cadeia de custódia — a
 *  perícia permanece auditável, mas deixa de expor a pessoa. */
export const ROTULO_ANONIMIZADO = 'DADO ANONIMIZADO A PEDIDO DO TITULAR (LGPD art. 18)';

export function anonimizarDados(_dados: DadosPessoais): DadosPessoais {
  return { nomeCliente: ROTULO_ANONIMIZADO, cpf: null, numeroBeneficio: null };
}
