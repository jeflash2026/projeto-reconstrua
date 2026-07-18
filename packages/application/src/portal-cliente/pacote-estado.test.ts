// ─────────────────────────────────────────────────────────────────────────────
// PACOTE DE ESTADO (PC-R4) — testes: fatos essenciais presentes, o LINK como
// consequência condicional (nunca antes do nascimento), limites explícitos ao
// LLM e NEGAÇÃO de vazamento (o teto do dizível é o mesmo do Portal).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { AcompanhamentoCliente } from './acompanhamento.js';
import { pacoteDeEstado } from './pacote-estado.js';

const VIEW: AcompanhamentoCliente = {
  clienteId: 'cli-1',
  quem: 'Maria',
  presenca: 'atenta',
  fraseAbertura: 'Seu processo está em andamento — e eu acompanho cada movimentação.',
  ondeEsta: 'Processo em andamento',
  agora: 'A advogada Ana Lima está conduzindo o seu processo.',
  proximoPasso: 'Cada movimentação importante aparece aqui — e eu também aviso você no WhatsApp.',
  precisaFazerAlgo: 'Nada por enquanto — estou cuidando de tudo.',
  quantoTempo: 'Cada processo tem o seu próprio ritmo.',
  etapas: [],
  estimativaDias: 12,
  estimativaAte: null,
  advogado: { nome: 'Ana Lima' },
  processo: { numero: '0001234-55.2026.4.04.7000' },
  atualizacoes: [
    { quando: new Date('2026-07-17T10:00:00.000Z'), texto: 'Protocolamos a petição inicial do seu processo.' },
  ],
  documentosRecebidos: ['Documento de identidade'],
  whatsapp: '554137989737',
};

describe('pacoteDeEstado · fatos e limites', () => {
  it('contém os fatos essenciais e os limites explícitos ao LLM', () => {
    const p = pacoteDeEstado(VIEW, 'https://x/portal?t=abc');
    expect(p).toContain('NUNCA invente');
    expect(p).toContain('NUNCA prometa');
    expect(p).toContain('Processo em andamento');
    expect(p).toContain('Ana Lima');
    expect(p).toContain('0001234-55.2026.4.04.7000');
    expect(p).toContain('petição inicial');
    expect(p).toContain('Documento de identidade');
  });

  it('LINK é consequência: com nascimento → instrução condicional com o endereço exato', () => {
    const p = pacoteDeEstado(VIEW, 'https://x/portal?t=abc');
    expect(p).toContain('https://x/portal?t=abc');
    expect(p).toContain('se ela não precisar, não ofereça');
  });

  it('SEM nascimento → proibição explícita de mencionar portal/link (nunca prematuro)', () => {
    const p = pacoteDeEstado(VIEW, null);
    expect(p).not.toContain('http');
    expect(p).toContain('NÃO mencione portal nem link');
  });

  it('NEGAÇÃO de vazamento: nada interno entra no pacote', () => {
    const p = pacoteDeEstado(VIEW, null);
    for (const proibido of ['AGUARDANDO_', 'PRONTO_', 'EM_PROCESSO', 'modalidade', 'missionId', 'clienteId', 'cli-1']) {
      expect(p, `vazou: ${proibido}`).not.toContain(proibido);
    }
  });
});
