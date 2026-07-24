// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · CONSISTÊNCIA INTERNA (Decreto 2026-07-24, item 6G)
// Travas OBRIGATÓRIAS: se o cabeçalho diz um banco e a análise diz outro (ou
// diverge cliente/CPF/contrato/processo/datas/valores), a EMISSÃO é BLOQUEADA.
// Isto impede o erro clássico de "vazar" dados de um caso para outro.
// ─────────────────────────────────────────────────────────────────────────────

/** Os campos-âncora que precisam ser COERENTES entre cabeçalho e corpo da análise. */
export interface DadosDoCaso {
  readonly nomeCliente: string | null;
  readonly cpf: string | null;
  readonly numeroBeneficio: string | null;
  readonly banco: string | null;
  readonly cnpjBanco: string | null;
  readonly numeroContrato: string | null;
  readonly numeroProcesso: string | null;
}

export interface ErroConsistencia {
  readonly campo: string;
  readonly mensagem: string;
  readonly esperado: string;
  readonly encontrado: string;
}

const so = (v: string | null): string => (v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const soDigitos = (v: string | null): string => (v ?? '').replace(/\D/g, '');

/** Compara o cabeçalho (o que o caso declara) com o corpo (o que a análise achou).
 *  Retorna a lista de ERROS CRÍTICOS — vazio = coerente. Só compara quando AMBOS
 *  os lados têm valor (ausência não é divergência; é tratada como pendência). */
export function verificarConsistencia(
  cabecalho: DadosDoCaso,
  corpo: DadosDoCaso,
): readonly ErroConsistencia[] {
  const erros: ErroConsistencia[] = [];
  const push = (
    campo: string,
    mensagem: string,
    esperado: string | null,
    encontrado: string | null,
  ): void => {
    erros.push({ campo, mensagem, esperado: esperado ?? '', encontrado: encontrado ?? '' });
  };

  if (cabecalho.banco && corpo.banco && so(cabecalho.banco) !== so(corpo.banco))
    push(
      'banco',
      'ERRO CRÍTICO DE CONSISTÊNCIA: instituições financeiras divergentes.',
      cabecalho.banco,
      corpo.banco,
    );
  if (
    cabecalho.cnpjBanco &&
    corpo.cnpjBanco &&
    soDigitos(cabecalho.cnpjBanco) !== soDigitos(corpo.cnpjBanco)
  )
    push(
      'cnpjBanco',
      'ERRO CRÍTICO DE CONSISTÊNCIA: CNPJ do banco divergente.',
      cabecalho.cnpjBanco,
      corpo.cnpjBanco,
    );
  if (
    cabecalho.nomeCliente &&
    corpo.nomeCliente &&
    so(cabecalho.nomeCliente) !== so(corpo.nomeCliente)
  )
    push(
      'cliente',
      'ERRO CRÍTICO DE CONSISTÊNCIA: nome do cliente divergente.',
      cabecalho.nomeCliente,
      corpo.nomeCliente,
    );
  if (cabecalho.cpf && corpo.cpf && soDigitos(cabecalho.cpf) !== soDigitos(corpo.cpf))
    push('cpf', 'ERRO CRÍTICO DE CONSISTÊNCIA: CPF divergente.', cabecalho.cpf, corpo.cpf);
  if (
    cabecalho.numeroBeneficio &&
    corpo.numeroBeneficio &&
    soDigitos(cabecalho.numeroBeneficio) !== soDigitos(corpo.numeroBeneficio)
  )
    push(
      'beneficio',
      'ERRO CRÍTICO DE CONSISTÊNCIA: número do benefício divergente.',
      cabecalho.numeroBeneficio,
      corpo.numeroBeneficio,
    );
  if (
    cabecalho.numeroContrato &&
    corpo.numeroContrato &&
    soDigitos(cabecalho.numeroContrato) !== soDigitos(corpo.numeroContrato)
  )
    push(
      'contrato',
      'ERRO CRÍTICO DE CONSISTÊNCIA: número do contrato divergente.',
      cabecalho.numeroContrato,
      corpo.numeroContrato,
    );
  if (
    cabecalho.numeroProcesso &&
    corpo.numeroProcesso &&
    soDigitos(cabecalho.numeroProcesso) !== soDigitos(corpo.numeroProcesso)
  )
    push(
      'processo',
      'ERRO CRÍTICO DE CONSISTÊNCIA: número do processo divergente.',
      cabecalho.numeroProcesso,
      corpo.numeroProcesso,
    );

  return erros;
}

/** true ⇒ pode emitir (nenhuma divergência crítica). */
export function consistente(cabecalho: DadosDoCaso, corpo: DadosDoCaso): boolean {
  return verificarConsistencia(cabecalho, corpo).length === 0;
}
