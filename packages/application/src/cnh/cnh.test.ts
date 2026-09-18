// ─────────────────────────────────────────────────────────────────────────────
// RECONSTRUA CNH — as regras do roteiro e a validação de cada turno da AHRI:
// preço só da tabela e só depois da proposta, descarte/proposta/aceite com as
// palavras do roteiro, nenhuma promessa de resultado, etapa só por transição.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import {
  FICHA_CNH_VAZIA,
  proximaPerguntaCnh,
  saudacaoDoHorario,
  textoPropostaCnh,
  textoSaudacaoCnh,
  transicaoPermitida,
  valoresPermitidosCnh,
  type FichaCnh,
} from './funil-cnh.js';
import { entradaDaAhriCnh, lerTurnoCnh, mesclarFichaCnh, valoresCitados } from './ahri-cnh.js';

const MANHA = new Date('2026-09-18T12:00:00.000Z'); // 09h em Brasília
const JOAO: FichaCnh = { ...FICHA_CNH_VAZIA, nome: 'João Pereira', cidade: 'Campinas' };
const QUALIFICADO: FichaCnh = {
  ...JOAO,
  jaTemAdvogado: false,
  situacao: 'aviso-suspensao',
  cartaDetran: 'recente',
  motoristaProfissional: true,
  notificacoesAnteriores: 'nenhuma-ou-poucas',
  temDocumentos: true,
  tipoCaso: 'suspensao',
};
const turno = (o: Record<string, unknown>): string => JSON.stringify(o);

describe('funil CNH — regras', () => {
  it('saudação pelo horário de Brasília e com as palavras do roteiro', () => {
    expect(saudacaoDoHorario(MANHA)).toBe('bom dia');
    expect(saudacaoDoHorario(new Date('2026-09-18T18:00:00.000Z'))).toBe('boa tarde');
    expect(saudacaoDoHorario(new Date('2026-09-19T01:00:00.000Z'))).toBe('boa noite');
    expect(textoSaudacaoCnh(MANHA)[0]).toBe(
      'Olá, bom dia! Aqui é o assistente virtual do escritório do Dr. Glauco Voigt, advogado com atuação em Direito de Trânsito.',
    );
  });

  it('transições: anda para frente pelo roteiro, nunca pula para a proposta', () => {
    expect(transicaoPermitida('recepcao', 'qualificacao')).toBe(true);
    expect(transicaoPermitida('recepcao', 'proposta')).toBe(false);
    expect(transicaoPermitida('viabilidade', 'morno')).toBe(true);
    expect(transicaoPermitida('morno', 'aceito')).toBe(true);
    expect(transicaoPermitida('descartado', 'qualificacao')).toBe(false);
  });

  it('proposta com o valor da tabela e o nome do cliente', () => {
    const p = textoPropostaCnh('cassacao', 'JOÃO PEREIRA');
    expect(p[0]).toBe(
      'João, com base no que conversamos, identifico que seu caso é de CASSAÇÃO. Os honorários para essa atuação são fixos, no valor de R$ 2.000,00, à vista ou parcelados em até 2 vezes.',
    );
    expect(textoPropostaCnh('suspensao', null)[0]).toMatch(/^Com base .* R\$ 1\.500,00/);
    expect(p[2]).toBe('Posso seguir adiante e te encaminhar o contrato para assinatura digital?');
  });

  it('valores permitidos: honorários e as parcelas (2x)', () => {
    expect([...valoresPermitidosCnh()].sort((a, b) => a - b)).toEqual([750, 1_000, 1_500, 2_000]);
    expect(valoresCitados('R$ 1.500,00 ou 2x de R$ 750,00, e R$2000')).toEqual([1_500, 750, 2_000]);
  });

  it('reserva sem IA: a próxima pergunta do roteiro pela ficha', () => {
    expect(proximaPerguntaCnh(FICHA_CNH_VAZIA, 'recepcao', MANHA)[1]).toContain(
      'seu nome e a cidade',
    );
    expect(proximaPerguntaCnh(JOAO, 'recepcao', MANHA)[0]).toContain('já tem algum advogado');
    expect(proximaPerguntaCnh({ ...JOAO, jaTemAdvogado: false }, 'recepcao', MANHA)[0]).toBe(
      'João, me conta brevemente: o que está acontecendo com a sua CNH ou habilitação?',
    );
    const indicacao: FichaCnh = {
      ...QUALIFICADO,
      situacao: 'indicacao-condutor',
      temDocumentos: null,
    };
    expect(proximaPerguntaCnh(indicacao, 'qualificacao', MANHA)[0]).toContain('FICI');
    expect(proximaPerguntaCnh(QUALIFICADO, 'viabilidade', MANHA)[0]).toBe(
      'Posso seguir e te enviar a proposta de honorários?',
    );
  });
});

describe('AHRI CNH — validação de cada turno', () => {
  const inicio = { ficha: JOAO, etapa: 'recepcao' as const, propostaEnviada: false };

  it('conversa normal: mensagens da IA, ficha mesclada, etapa pela transição', () => {
    const t = lerTurnoCnh(
      turno({
        mensagens: [
          'Prazer, João. Antes de tudo: você já tem algum advogado cuidando do seu caso da CNH?',
        ],
        ficha: { jaTemAdvogado: false, situacao: 'aviso-suspensao', campoInventado: 1 },
        etapa: 'qualificacao',
        acao: 'conversar',
      }),
      inicio,
    );
    expect(t?.acao).toBe('conversar');
    expect(t?.etapa).toBe('qualificacao');
    expect(t?.ficha.situacao).toBe('aviso-suspensao');
    expect(t?.ficha).not.toHaveProperty('campoInventado');
  });

  it('etapa que pula o roteiro é ignorada (fica onde estava)', () => {
    const t = lerTurnoCnh(
      turno({ mensagens: ['Ok!'], etapa: 'proposta', acao: 'conversar' }),
      inicio,
    );
    expect(t?.etapa).toBe('recepcao');
  });

  it('descarte sai com o texto do roteiro, não com o da IA', () => {
    const t = lerTurnoCnh(
      turno({ mensagens: ['texto qualquer'], acao: 'descartar', motivo: 'criminal' }),
      inicio,
    );
    expect(t?.etapa).toBe('descartado');
    expect(t?.mensagens[0]).toContain('procurar um advogado criminalista');
    expect(lerTurnoCnh(turno({ acao: 'descartar', motivo: 'inventado' }), inicio)).toBeNull();
  });

  it('proposta: só com o tipo de caso definido e depois da qualificação', () => {
    const cedo = lerTurnoCnh(
      turno({
        mensagens: ['Qual é o seu caso?'],
        acao: 'proposta',
        ficha: { tipoCaso: 'suspensao' },
      }),
      inicio,
    );
    expect(cedo?.acao).toBe('conversar');
    const pronto = lerTurnoCnh(turno({ acao: 'proposta' }), {
      ficha: QUALIFICADO,
      etapa: 'viabilidade',
      propostaEnviada: false,
    });
    expect(pronto?.etapa).toBe('proposta');
    expect(pronto?.mensagens[0]).toContain('R$ 1.500,00');
  });

  it('preço antes da proposta ou valor fora da tabela invalida o turno', () => {
    expect(
      lerTurnoCnh(turno({ mensagens: ['Custa R$ 1.500,00'], acao: 'conversar' }), inicio),
    ).toBeNull();
    const depois = { ficha: QUALIFICADO, etapa: 'proposta' as const, propostaEnviada: true };
    expect(
      lerTurnoCnh(turno({ mensagens: ['Pode ser 2x de R$ 750,00.'], acao: 'conversar' }), depois),
    ).not.toBeNull();
    expect(
      lerTurnoCnh(
        turno({ mensagens: ['Faço por R$ 1.200,00 à vista.'], acao: 'conversar' }),
        depois,
      ),
    ).toBeNull();
  });

  it('promessa de resultado invalida o turno', () => {
    expect(
      lerTurnoCnh(
        turno({ mensagens: ['Pode ficar tranquilo, eu garanto que a CNH volta.'] }),
        inicio,
      ),
    ).toBeNull();
    // "não há garantia" é o que o roteiro manda dizer — passa.
    expect(
      lerTurnoCnh(
        turno({ mensagens: ['Cada caso depende dos documentos, não há garantia de resultado.'] }),
        inicio,
      ),
    ).not.toBeNull();
  });

  it('aceite só depois de uma proposta enviada; transferência e morno', () => {
    const semProposta = lerTurnoCnh(turno({ mensagens: ['Ótimo!'], acao: 'aceite' }), {
      ficha: QUALIFICADO,
      etapa: 'viabilidade',
      propostaEnviada: false,
    });
    expect(semProposta?.acao).toBe('conversar');
    const aceite = lerTurnoCnh(turno({ acao: 'aceite' }), {
      ficha: QUALIFICADO,
      etapa: 'proposta',
      propostaEnviada: true,
    });
    expect(aceite?.etapa).toBe('aceito');
    expect(aceite?.mensagens[0]).toBe(
      'Perfeito, João! Vou te encaminhar o contrato e o link de pagamento para assinatura digital.',
    );
    const urgente = lerTurnoCnh(turno({ acao: 'transferir', urgente: true }), inicio);
    expect(urgente).toMatchObject({ etapa: 'transferido', urgente: true });
    const morno = lerTurnoCnh(turno({ mensagens: ['Sem problema, João.'], acao: 'morno' }), {
      ficha: QUALIFICADO,
      etapa: 'viabilidade',
      propostaEnviada: false,
    });
    expect(morno?.etapa).toBe('morno');
  });

  it('JSON torto ou vazio ⇒ null', () => {
    expect(lerTurnoCnh('não sei', inicio)).toBeNull();
    expect(lerTurnoCnh(turno({ mensagens: [], acao: 'conversar' }), inicio)).toBeNull();
    expect(lerTurnoCnh(turno({ acao: 'apagar' }), inicio)).toBeNull();
  });

  it('mesclar ficha: tipos errados não entram', () => {
    const f = mesclarFichaCnh(JOAO, {
      motoristaProfissional: 'sim',
      tipoCaso: 'multa',
      cidade: 'Jundiaí',
    });
    expect(f.motoristaProfissional).toBeNull();
    expect(f.tipoCaso).toBeNull();
    expect(f.cidade).toBe('Jundiaí');
  });

  it('a entrada da IA leva etapa, ficha e as últimas falas', () => {
    const e = entradaDaAhriCnh(inicio, [{ de: 'cliente', texto: 'minha cnh foi suspensa' }], MANHA);
    expect(e).toContain('ETAPA ATUAL: recepcao');
    expect(e).toContain('"nome":"João Pereira"');
    expect(e).toContain('Cliente: minha cnh foi suspensa');
  });
});
