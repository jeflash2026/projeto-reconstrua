// ─────────────────────────────────────────────────────────────────────────────
// CPF JÁ CADASTRADO (2026-09-22, pedido do dono) — a pessoa manda um CPF que já
// tem cadastro, mas está escrevendo de OUTRO número.
//
// Antes disso, a AHRI tratava como gente nova: registrava o CPF e pedia o HISCON
// de novo a quem já é cliente — às vezes a quem já tem processo distribuído.
// Aqui o sistema descobre que aquele CPF já existe, e o atendimento passa a
// reconhecer a pessoa.
//
// O que este módulo NÃO faz, de propósito: unir os atendimentos. Juntar dois
// números é decisão de gente (a mesa tem o botão de transferência) — e contar o
// caso para quem só digitou um número seria vazar dado de outra pessoa. Aqui só
// se DESCOBRE o fato; quem decide o que dizer é o pacote de contexto, que manda
// confirmar a identidade primeiro.
// ─────────────────────────────────────────────────────────────────────────────
import type { JsonStore } from '../production/json-store.js';

const NS_JORNADA = 'jornada';

export interface CadastroComOMesmoCpf {
  /** O chat do cadastro ANTERIOR (é nele que o histórico e os documentos estão). */
  readonly chatId: string;
  readonly nome: string | null;
}

const soDigitos = (v: string): string => v.replace(/\D/g, '');

/** O PRIMEIRO nome do cadastro — é o que a AHRI usa para confirmar quem é. */
export function primeiroNome(nome: string | null): string | null {
  if (nome === null) return null;
  const parte = nome.trim().split(/\s+/u)[0] ?? '';
  return parte === '' ? null : parte;
}

/**
 * Procura OUTRO atendimento com o mesmo CPF. Devolve `null` quando o CPF é novo,
 * quando o único cadastro é o desta própria conversa, ou quando a leitura falha
 * (best-effort: um erro aqui nunca pode derrubar o atendimento).
 */
export async function outroCadastroComOCpf(
  json: Pick<JsonStore, 'list'>,
  cpf: string,
  chatIdAtual: string,
): Promise<CadastroComOMesmoCpf | null> {
  const alvo = soDigitos(cpf);
  if (alvo.length !== 11) return null;
  try {
    const registros = (await json.list(NS_JORNADA)) as readonly {
      chatId?: string;
      cpf?: string | null;
      nome?: string | null;
    }[];
    for (const r of registros) {
      const chatId = r.chatId ?? '';
      if (chatId === '' || chatId === chatIdAtual) continue;
      if (r.cpf == null || soDigitos(r.cpf) !== alvo) continue;
      return { chatId, nome: r.nome ?? null };
    }
    return null;
  } catch {
    return null;
  }
}
