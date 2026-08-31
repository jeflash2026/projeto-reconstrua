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
  interpretarComandoRelatorio,
  pesoDoCliente,
  planejarDistribuicao,
  type ClienteElegivel,
} from './jarvis.js';
import { acharEstadoNoTexto } from '../jornada/jornada-comercial.js';

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

describe('interpretarComandoRelatorio (decreto 2026-07-30)', () => {
  it('o pedido real do fundador vira comando com UF e recorte fase 1', () => {
    const r = interpretarComandoRelatorio(
      'preciso que voce gere um relatorio contendo nome e telefone desses 25 clientes de são paulo com hiscon e cpf ja enviado',
      acharEstadoNoTexto,
    );
    expect(r).toEqual({ uf: 'SP', recorte: 'fase1' });
  });
  it('variações: sigla, sem estado, sem cpf', () => {
    expect(
      interpretarComandoRelatorio('lista dos clientes de SC com hiscon', acharEstadoNoTexto),
    ).toEqual({ uf: 'SC', recorte: 'hiscon' });
    expect(
      interpretarComandoRelatorio('me dá a lista dos clientes sem cpf', acharEstadoNoTexto),
    ).toEqual({ uf: null, recorte: 'sem-cpf' });
  });
  it('sem gatilho de relatório/lista, não é comando (pergunta segue livre)', () => {
    expect(
      interpretarComandoRelatorio('quantos clientes tenho em são paulo?', acharEstadoNoTexto),
    ).toBe(null);
    expect(
      interpretarComandoRelatorio('mova 20 contratos para o Cornélio', acharEstadoNoTexto),
    ).toBe(null);
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
  it('SEM teto (decreto 2026-07-30): todo contrato da janela vale', () => {
    expect(pesoDoCliente({ A: 30, B: 30, C: 30 })).toBe(30); // 10+10+10, sem corte
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
  it('ATIVOS primeiro; quem cruza o alvo entra inteiro (SEM teto de peso)', () => {
    const plano = planejarDistribuicao(
      [
        cliente('Almerinda', 10, 2, 8, { BMB: 12, ITAU: 8 }), // ⌈12/3⌉+⌈8/3⌉ = 7
        cliente('Bruna', 7, 1, 0), // 8 bancos de 1 ⇒ peso 8
        cliente('Dora', 1, 0, 0), // fora (alvo já cruzado)
      ],
      12,
    );
    expect(plano.itens.map((i) => i.nome)).toEqual(['Almerinda', 'Bruna']);
    expect(plano.itens[0]).toMatchObject({ contratos: 20, peso: 7 });
    expect(plano.totalPeso).toBe(15);
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

// ── CADASTRO DE PROCESSOS no Painel Jurídico (decreto 2026-08-31) — o dono
// cola "Nome:" + linhas "BANCO - nº CNJ" no Jarvis; parse 100% determinístico.
import { interpretarComandoProcessosJuridico } from './jarvis.js';

describe('interpretarComandoProcessosJuridico', () => {
  it('lê o bloco REAL do dono (Taís): 12 bancos, TAB e espaços variados', () => {
    const texto = [
      'Add os seguintes processos ao perfil do cliente',
      '',
      'Taís Regina Caetano da Silva: ',
      '',
      'BANCO ABIGANK -  4005177-19.2026.8.26.0533',
      'BANCO BRB - 4005179-86.2026.8.26.0533',
      'BANCO C6 -\t4005180-71.2026.8.26.0533',
      'BANCO ITAU -  4005194-55.2026.8.26.0533',
    ].join('\n');
    const cmd = interpretarComandoProcessosJuridico(texto);
    expect(cmd).not.toBeNull();
    expect(cmd?.clientes).toHaveLength(1);
    expect(cmd?.clientes[0]?.nome).toBe('Taís Regina Caetano da Silva');
    expect(cmd?.clientes[0]?.processos).toHaveLength(4);
    expect(cmd?.clientes[0]?.processos[0]).toEqual({
      banco: 'BANCO ABIGANK',
      numero: '4005177-19.2026.8.26.0533',
    });
    expect(cmd?.clientes[0]?.processos[2]?.banco).toBe('BANCO C6');
    expect(cmd?.semCliente).toBe(0);
  });

  it('vários clientes no mesmo texto: cada "Nome:" abre um grupo', () => {
    const cmd = interpretarComandoProcessosJuridico(
      'Maria da Silva Santos:\nBANCO PAN - 4005195-40.2026.8.26.0533\n\n' +
        'João Pereira Souza:\nBANCO SAFRA - 4005202-32.2026.8.26.0533',
    );
    expect(cmd?.clientes.map((c) => c.nome)).toEqual([
      'Maria da Silva Santos',
      'João Pereira Souza',
    ]);
    expect(cmd?.clientes[1]?.processos[0]?.banco).toBe('BANCO SAFRA');
  });

  it('processo sem nome de cliente acima conta em semCliente (nada é chutado)', () => {
    const cmd = interpretarComandoProcessosJuridico('BANCO PAN - 4005195-40.2026.8.26.0533');
    expect(cmd?.clientes).toHaveLength(0);
    expect(cmd?.semCliente).toBe(1);
  });

  it('texto sem nº CNJ NÃO é comando (pergunta livre segue ao narrador)', () => {
    expect(interpretarComandoProcessosJuridico('quantos clientes temos hoje?')).toBeNull();
    expect(
      interpretarComandoProcessosJuridico('mande a mensagem para Maria: seu processo avançou'),
    ).toBeNull();
  });
});

// Caso REAL 2026-08-31: o dono colou TUDO NUMA LINHA SÓ e o parser por linha
// não reconheceu — o texto caiu no narrador, que inventou uma "confirmação".
describe('interpretarComandoProcessosJuridico — colagem INLINE (uma linha só)', () => {
  it('lê a colagem real da Taís: preâmbulo + nome + 12 bancos na mesma linha', () => {
    const texto =
      'adicione no jurídico: Taís Regina Caetano da Silva:   BANCO ABIGANK -  4005177-19.2026.8.26.0533 ' +
      'BANCO BRB - 4005179-86.2026.8.26.0533 BANCO C6 -      4005180-71.2026.8.26.0533 ' +
      'BANCO CETELEM -  4005182-41.2026.8.26.0533 BANCO DAYCOVAL -  4005192-85.2026.8.26.0533 ' +
      'BANCO FACTA -   4005193-70.2026.8.26.0533 BANCO ITAU -  4005194-55.2026.8.26.0533 ' +
      'BANCO PAN -  4005195-40.2026.8.26.0533 BANCO PARATI -    4005199-77.2026.8.26.0533 ' +
      'BANCO PICPAY -  4005201-47.2026.8.26.0533 BANCO SAFRA - 4005202-32.2026.8.26.0533 ' +
      'BANCO SEGURO - 4005203-17.2026.8.26.0533';
    const cmd = interpretarComandoProcessosJuridico(texto);
    expect(cmd?.clientes).toHaveLength(1);
    expect(cmd?.clientes[0]?.nome).toBe('Taís Regina Caetano da Silva');
    expect(cmd?.clientes[0]?.processos).toHaveLength(12);
    expect(cmd?.clientes[0]?.processos.map((p) => p.banco)).toEqual([
      'BANCO ABIGANK',
      'BANCO BRB',
      'BANCO C6',
      'BANCO CETELEM',
      'BANCO DAYCOVAL',
      'BANCO FACTA',
      'BANCO ITAU',
      'BANCO PAN',
      'BANCO PARATI',
      'BANCO PICPAY',
      'BANCO SAFRA',
      'BANCO SEGURO',
    ]);
    expect(cmd?.clientes[0]?.processos[11]?.numero).toBe('4005203-17.2026.8.26.0533');
    expect(cmd?.semCliente).toBe(0);
  });

  it('banco numa linha e o nº CNJ na linha de baixo — o banco não se perde', () => {
    const cmd = interpretarComandoProcessosJuridico(
      'Maria da Silva Santos:\nBANCO PAN -\n4005195-40.2026.8.26.0533',
    );
    expect(cmd?.clientes[0]?.processos[0]).toEqual({
      banco: 'BANCO PAN',
      numero: '4005195-40.2026.8.26.0533',
    });
  });
});
