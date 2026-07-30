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
  interpretarComandoMensagem,
  pesoDoCliente,
  planejarDistribuicao,
  type ClienteElegivel,
} from './jarvis.js';

function cliente(
  nome: string,
  ativos: number,
  suspensos = 0,
  outros = 0,
  porBanco?: Readonly<Record<string, number>>,
): ClienteElegivel {
  // Sem porBanco explícito, cada contrato num banco próprio (peso = contratos,
  // até o teto) — o caso "vários bancos com 1 contrato cada".
  const total = ativos + suspensos + outros;
  const bancos: Record<string, number> = {};
  if (porBanco === undefined) for (let i = 0; i < total; i += 1) bancos[`B${String(i)}`] = 1;
  return {
    chatId: `${nome}@w`,
    missionId: `m-${nome}`,
    nome,
    ativos,
    suspensos,
    outros,
    porBanco: porBanco ?? bancos,
  };
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

describe('interpretarComandoMensagem (decreto 2026-07-30)', () => {
  it('reconhece o comando e preserva o texto EXATO ditado pelo dono', () => {
    expect(
      interpretarComandoMensagem('mande a mensagem para Maria Aparecida: Bom dia! Tudo certo?'),
    ).toEqual({ destinatario: 'Maria Aparecida', texto: 'Bom dia! Tudo certo?' });
    expect(
      interpretarComandoMensagem(
        'ahri, envie uma mensagem pro 48 99999-9999: seu estudo ficou pronto',
      ),
    ).toEqual({ destinatario: '48 99999-9999', texto: 'seu estudo ficou pronto' });
    // Texto citando contratos/CPF NÃO vira distribuição nem cobrança.
    const comCiladas = interpretarComandoMensagem(
      'mande a mensagem para Marileide: seus 20 contratos e o CPF já estão registrados',
    );
    expect(comCiladas?.texto).toBe('seus 20 contratos e o CPF já estão registrados');
  });
  it('sem "mensagem para X:" não é comando de mensagem', () => {
    expect(interpretarComandoMensagem('quantos clientes eu tenho em SP?')).toBe(null);
    expect(interpretarComandoMensagem('mova 20 contratos para o advogado Cornélio')).toBe(null);
    expect(interpretarComandoMensagem('cobre o cpf dos clientes que faltam')).toBe(null);
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

describe('pesoDoCliente — lotes de 3 por banco (decreto 2026-07-30)', () => {
  it('a régua do dono: 9 contratos do BMB = 3 lotes = peso 3 (todos os 9 vão)', () => {
    expect(pesoDoCliente({ BMB: 9 })).toBe(3);
    expect(pesoDoCliente({ BMB: 20 })).toBe(7); // ⌈20/3⌉
    expect(pesoDoCliente({ BMB: 1 })).toBe(1);
    expect(pesoDoCliente({ BMB: 4 })).toBe(2); // 3+1 ⇒ 2 lotes
    expect(pesoDoCliente({ BMB: 3, ITAU: 3, BRADESCO: 2 })).toBe(3);
    expect(pesoDoCliente({})).toBe(0);
  });
  it('teto de 10 por cliente vale sobre o PESO', () => {
    expect(pesoDoCliente({ A: 30, B: 30, C: 30 })).toBe(10); // 10+10+10 ⇒ teto
  });
});

describe('planejarDistribuicao — alvo em PESO, cliente vai INTEIRO', () => {
  it('caso do decreto: 9 do mesmo banco enviam 9 contratos mas contam 3', () => {
    const plano = planejarDistribuicao(
      [cliente('Humberto', 9, 0, 0, { BMB: 9 }), cliente('Ana', 2, 0, 0, { ITAU: 2 })],
      4,
    );
    // Humberto: peso 3 (9 contratos vão TODOS); Ana: peso 1 ⇒ total peso 4.
    expect(plano.itens.map((i) => i.nome)).toEqual(['Humberto', 'Ana']);
    expect(plano.itens[0]).toMatchObject({ contratos: 9, peso: 3 });
    expect(plano.totalContratos).toBe(11);
    expect(plano.totalPeso).toBe(4);
  });
  it('ATIVOS primeiro; quem cruza o alvo entra inteiro; teto de peso 10', () => {
    const plano = planejarDistribuicao(
      [
        cliente('Almerinda', 10, 2, 150), // 162 bancos distintos ⇒ peso teto 10
        cliente('Bruna', 7, 1, 0), // peso 8
        cliente('Dora', 1, 0, 0), // fora (alvo já cruzado)
      ],
      15,
    );
    expect(plano.itens.map((i) => i.nome)).toEqual(['Almerinda', 'Bruna']);
    expect(plano.itens[0]).toMatchObject({ contratos: 162, peso: 10 });
    expect(plano.totalPeso).toBe(18);
    expect(plano.elegiveisRestantes).toBe(1);
  });
  it('sem elegíveis suficientes, entrega o que há (nunca inventa)', () => {
    const plano = planejarDistribuicao([cliente('Ana', 2)], 20);
    expect(plano.totalPeso).toBe(2);
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
