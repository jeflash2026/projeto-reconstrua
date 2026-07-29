// ─────────────────────────────────────────────────────────────────────────────
// JARVIS (decreto 2026-07-29) — o comando "mova 20 contratos para o advogado X"
// e o plano determinístico: máx. 10 contratos/cliente, ATIVOS primeiro, soma
// até o alvo (o cliente que cruza entra inteiro — nunca fatiamos um cliente).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  casarAdvogadoPorNome,
  interpretarComandoCobrancaCpf,
  interpretarComandoDistribuicao,
  planejarDistribuicao,
  type ClienteElegivel,
} from './jarvis.js';

function cliente(nome: string, ativos: number, suspensos = 0, outros = 0): ClienteElegivel {
  return { chatId: `${nome}@w`, missionId: `m-${nome}`, nome, ativos, suspensos, outros };
}

describe('interpretarComandoDistribuicao', () => {
  it('reconhece o comando do decreto (com e sem advogado citado)', () => {
    expect(
      interpretarComandoDistribuicao('ahri quero que você mova 20 contrato para advogado Cornélio'),
    ).toEqual({ contratos: 20, advogadoNome: 'Cornélio' });
    expect(interpretarComandoDistribuicao('distribua 15 contratos')).toEqual({
      contratos: 15,
      advogadoNome: null,
    });
    expect(interpretarComandoDistribuicao('atribua 8 contratos ao Dr. Rubens')).toEqual({
      contratos: 8,
      advogadoNome: 'Rubens',
    });
  });
  it('pergunta livre NUNCA vira comando', () => {
    for (const t of [
      'quantos clientes eu possuo já com hiscon + cpf prontos para pedido administrativo?',
      'quantos contratos temos no total?',
      'como está o advogado Cornélio?',
    ]) {
      expect(interpretarComandoDistribuicao(t), t).toBe(null);
    }
  });
});

describe('interpretarComandoCobrancaCpf', () => {
  it('reconhece o pedido real do fundador (2026-07-29) e variações', () => {
    for (const t of [
      'consegue disparar mensagem solicitando o cpf para esses 28 clientes que só falta cpf? para completar a fase 1',
      'cobre o cpf dos clientes que faltam',
      'ahri, cobra o CPF de quem já mandou o hiscon',
      'envie uma mensagem pedindo o cpf para quem falta',
      'manda a cobrança de cpf para os pendentes',
    ]) {
      expect(interpretarComandoCobrancaCpf(t), t).toBe(true);
    }
  });
  it('pergunta de CONTAGEM nunca vira disparo', () => {
    for (const t of [
      'quantos clientes já enviaram o cpf?',
      'quantos falta só cpf e já enviou hiscon?',
      'quantos clientes tem com hiscon + cpf completos em sp?',
      'mova 20 contratos para o advogado Cornélio',
    ]) {
      expect(interpretarComandoCobrancaCpf(t), t).toBe(false);
    }
  });
});

describe('planejarDistribuicao', () => {
  it('máx. 10 por cliente, ATIVOS primeiro, soma até o alvo (quem cruza entra inteiro)', () => {
    const plano = planejarDistribuicao(
      [
        cliente('Almerinda', 10, 2, 150), // 10+2+150 ⇒ conta 10 (só ativos)
        cliente('Bruna', 7, 1, 0), // conta 8
        cliente('Carlos', 3, 0, 30), // conta 10 (3 ativos + 7 outros)
        cliente('Dora', 1, 0, 0), // não deve entrar (alvo já cruzado)
      ],
      20,
    );
    // Ordem: mais ATIVOS primeiro ⇒ Almerinda (10) + Bruna (8) = 18 < 20 ⇒
    // Carlos entra inteiro (10) e cruza o alvo ⇒ total 28, Dora fica fora.
    expect(plano.itens.map((i) => i.nome)).toEqual(['Almerinda', 'Bruna', 'Carlos']);
    expect(plano.itens[0]).toMatchObject({ contratos: 10, ativos: 10, suspensos: 0, outros: 0 });
    expect(plano.itens[2]).toMatchObject({ contratos: 10, ativos: 3, outros: 7 });
    expect(plano.totalContratos).toBe(28);
    expect(plano.elegiveisRestantes).toBe(1);
  });
  it('sem elegíveis suficientes, entrega o que há (nunca inventa)', () => {
    const plano = planejarDistribuicao([cliente('Ana', 2)], 20);
    expect(plano.totalContratos).toBe(2);
    expect(plano.itens).toHaveLength(1);
  });
});

describe('casarAdvogadoPorNome', () => {
  const advs = [
    { id: 'a1', name: 'Cornlélio Luiz Figueireiro' },
    { id: 'a2', name: 'Rubens José Maia Silveira Filho' },
  ];
  it('casa por conteúdo e por primeiro nome, sem acentos', () => {
    expect(casarAdvogadoPorNome('Cornélio', advs)?.id).toBe('a1'); // grafia diferente do cadastro? não —
    expect(casarAdvogadoPorNome('Cornlélio', advs)?.id).toBe('a1');
    expect(casarAdvogadoPorNome('rubens', advs)?.id).toBe('a2');
    expect(casarAdvogadoPorNome('Fulano', advs)).toBe(null);
    expect(casarAdvogadoPorNome(null, advs)).toBe(null);
  });
});
