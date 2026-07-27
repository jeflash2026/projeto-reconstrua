// ─────────────────────────────────────────────────────────────────────────────
// Rede de segurança (caso Isaú 2026-07-25): em ANÁLISE, a AHRI jamais cobra um
// documento por iniciativa própria. Se o LLM for puxado de volta ao HISCON num
// follow-up, a trava substitui a fala por um aviso correto de andamento.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  pareceCobrancaDeDocumento,
  politicaDaMissao,
  revisarFalaEmAnalise,
  MENSAGEM_ANALISE_EM_ANDAMENTO,
} from './sales-conversation-policy.js';
import type { ConversationContextView } from './ports.js';

function view(
  missao: ConversationContextView['missaoDaConversa'] = 'ANALISE_ADMINISTRATIVA',
  pendenciaDocumental: ConversationContextView['pendenciaDocumental'] = null,
): ConversationContextView {
  return { missaoDaConversa: missao, pendenciaDocumental } as ConversationContextView;
}

// A mensagem real que a AHRI mandou ao Isaú (já em análise).
const FALA_ISAU =
  'Isaú, então vamos por partes. No app Meu INSS, entra em "Extrato de Empréstimos Consignados" ' +
  'e toca na opção para gerar o extrato. Depois procura o ícone de compartilhar ou baixar. ' +
  'Assim que baixar, me manda aqui mesmo como anexo.';

describe('rede de segurança da ANÁLISE', () => {
  it('detecta cobrança/ensino de documento (não a mera menção)', () => {
    expect(pareceCobrancaDeDocumento(FALA_ISAU)).toBe(true);
    expect(pareceCobrancaDeDocumento('Pode me enviar o HISCON em PDF por aqui?')).toBe(true);
    expect(pareceCobrancaDeDocumento('Ainda estou aguardando o seu extrato para começar.')).toBe(
      true,
    );
    // menção positiva NÃO é cobrança
    expect(pareceCobrancaDeDocumento('Recebi o seu HISCON, obrigada! Já está em análise.')).toBe(
      false,
    );
    expect(pareceCobrancaDeDocumento('Seu caso segue em análise, dentro do prazo.')).toBe(false);
  });

  it('em ANÁLISE sem pedido ativo: cobrança vira o aviso de andamento', () => {
    expect(revisarFalaEmAnalise(FALA_ISAU, view())).toBe(MENSAGEM_ANALISE_EM_ANDAMENTO);
  });

  it('em ANÁLISE, fala legítima (sem cobrança) passa intacta', () => {
    const ok = 'Seu caso segue em análise, dentro do prazo. Te aviso assim que houver novidade.';
    expect(revisarFalaEmAnalise(ok, view())).toBe(ok);
  });

  it('DocumentRequest ATIVO do advogado é legítimo — passa intacto', () => {
    const comPedido = view('ANALISE_ADMINISTRATIVA', {
      documentName: 'comprovante de residência',
      requestedBy: 'Dr. Juliano',
      prioridade: 'alta',
      total: 1,
    });
    expect(revisarFalaEmAnalise(FALA_ISAU, comPedido)).toBe(FALA_ISAU);
  });

  it('fora de ANÁLISE (onboarding), a cobrança do HISCON é CORRETA — passa intacta', () => {
    expect(revisarFalaEmAnalise(FALA_ISAU, view('ONBOARDING_DOCUMENTAL'))).toBe(FALA_ISAU);
    expect(revisarFalaEmAnalise(FALA_ISAU, view('LEAD'))).toBe(FALA_ISAU);
  });

  // Caso 51 9109-4367 (2026-07-27): o LLM NEGOU o pedido de CPF do sistema.
  it('o reforço de ANÁLISE informa o LLM sobre o estado do CPF', () => {
    const base = view();
    const comCpf = politicaDaMissao({ ...base, cpfRegistrado: true });
    expect(comCpf.reforco).toContain('JÁ ESTÁ REGISTRADO');
    const semCpf = politicaDaMissao({ ...base, cpfRegistrado: false });
    expect(semCpf.reforco).toContain('JAMAIS diga que não pedimos o CPF');
    const semFonte = politicaDaMissao({ ...base, cpfRegistrado: null });
    expect(semFonte.reforco).not.toContain('CPF do cliente');
  });
});
