// ─────────────────────────────────────────────────────────────────────────────
// INTÉRPRETE DO JARVIS (2026-09-17) — a leitura da LLM só vira comando depois
// de VALIDADA: nº de processo tem de estar no texto do dono, mensagem ditada
// tem de ser trecho literal, e JSON torto cai na reserva determinística.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { entradaDoInterprete, lerIntencaoJarvis, type TurnoConversa } from './jarvis-interprete.js';
import { interpretarComandoProcessosJuridico } from './jarvis.js';

// O caso real do dono: tudo numa linha só, sem dois-pontos depois do nome.
const FRANCISCO =
  'ahri adicione no juridico: FRANCISCO NUNES DA SILVA Banco Mercantil do Brasil - 4002326-40.2026.8.26.0619   ' +
  'Banco Bradesco S.A 4029409-91.2026.8.26.0405  Banco Mercantil do Brasil S.A 4002327-25.2026.8.26.0619';

const LEITURA_FRANCISCO = JSON.stringify({
  acao: 'cadastrar_processos',
  clientes: [
    {
      nome: 'FRANCISCO NUNES DA SILVA',
      processos: [
        { banco: 'Banco Mercantil do Brasil', numero: '4002326-40.2026.8.26.0619' },
        { banco: 'Banco Bradesco S.A', numero: '4029409-91.2026.8.26.0405' },
        { banco: 'Banco Mercantil do Brasil S.A', numero: '4002327-25.2026.8.26.0619' },
      ],
    },
  ],
});

describe('lerIntencaoJarvis · cadastro de processos', () => {
  it('o caso real: um cliente, três processos, cada banco no seu número', () => {
    const i = lerIntencaoJarvis(LEITURA_FRANCISCO, FRANCISCO);
    expect(i?.acao).toBe('cadastrar_processos');
    if (i?.acao !== 'cadastrar_processos') return;
    expect(i.comando.clientes).toHaveLength(1);
    expect(i.comando.clientes[0]?.nome).toBe('Francisco Nunes da Silva');
    expect(i.comando.clientes[0]?.processos).toEqual([
      { banco: 'Banco Mercantil do Brasil', numero: '4002326-40.2026.8.26.0619' },
      { banco: 'Banco Bradesco S.A', numero: '4029409-91.2026.8.26.0405' },
      { banco: 'Banco Mercantil do Brasil S.A', numero: '4002327-25.2026.8.26.0619' },
    ]);
    expect(i.comando.semCliente).toBe(0);
  });

  it('JSON com texto em volta (cercas de código) ainda é lido', () => {
    const i = lerIntencaoJarvis('```json\n' + LEITURA_FRANCISCO + '\n```', FRANCISCO);
    expect(i?.acao).toBe('cadastrar_processos');
  });

  it('nº INVENTADO (fora do texto do dono) derruba a leitura inteira', () => {
    const inventada = LEITURA_FRANCISCO.replace('4029409-91', '4029409-99');
    expect(lerIntencaoJarvis(inventada, FRANCISCO)).toBeNull();
  });

  it('nº colado que ficou SEM cliente na leitura ⇒ inválida (nada some calado)', () => {
    const parcial = JSON.stringify({
      acao: 'cadastrar_processos',
      clientes: [
        {
          nome: 'Francisco Nunes da Silva',
          processos: [{ banco: 'Banco Mercantil', numero: '4002326-40.2026.8.26.0619' }],
        },
      ],
    });
    expect(lerIntencaoJarvis(parcial, FRANCISCO)).toBeNull();
  });

  it('"cadastra esses aí": os números podem vir da fala anterior do dono', () => {
    const historico: TurnoConversa[] = [
      { de: 'dono', texto: FRANCISCO.replace('ahri adicione no juridico: ', '') },
      { de: 'ahri', texto: 'De quem são esses processos?' },
    ];
    const i = lerIntencaoJarvis(LEITURA_FRANCISCO, 'são do francisco, cadastra', historico);
    expect(i?.acao).toBe('cadastrar_processos');
  });
});

describe('lerIntencaoJarvis · mensagem ditada', () => {
  const pedido = 'manda pra maria: Oi Maria!\nSeu processo foi distribuído hoje.';

  it('texto literal passa — com as quebras de linha ORIGINAIS', () => {
    const i = lerIntencaoJarvis(
      JSON.stringify({
        acao: 'mensagem',
        destinatario: 'maria',
        texto: 'Oi Maria! Seu processo foi distribuído hoje.',
      }),
      pedido,
    );
    expect(i).toEqual({
      acao: 'mensagem',
      comando: { destinatario: 'maria', texto: 'Oi Maria!\nSeu processo foi distribuído hoje.' },
    });
  });

  it('PARÁFRASE da LLM não passa (o texto sai exatamente como ditado)', () => {
    const i = lerIntencaoJarvis(
      JSON.stringify({
        acao: 'mensagem',
        destinatario: 'maria',
        texto: 'Olá Maria, informamos que o seu processo foi distribuído.',
      }),
      pedido,
    );
    expect(i).toBeNull();
  });
});

describe('lerIntencaoJarvis · demais ações', () => {
  it('carteira, relatório, distribuição, cobrança, esclarecer e responder', () => {
    expect(
      lerIntencaoJarvis(
        '{"acao":"carteira_investidor","investidor":"Arthur","credito":250000,"processos":null}',
        'add 250 mil pro arthur',
      ),
    ).toEqual({
      acao: 'carteira_investidor',
      comando: { valor: 250_000, processos: null, investidorNome: 'Arthur' },
    });
    expect(lerIntencaoJarvis('{"acao":"relatorio","uf":"sp","recorte":"sem-cpf"}', 'x')).toEqual({
      acao: 'relatorio',
      comando: { uf: 'SP', recorte: 'sem-cpf' },
    });
    expect(
      lerIntencaoJarvis('{"acao":"distribuir","contratos":20,"advogado":"Cornélio"}', 'x'),
    ).toEqual({
      acao: 'distribuir',
      comando: { contratos: 20, advogadoNome: 'Cornélio' },
    });
    expect(lerIntencaoJarvis('{"acao":"cobrar_cpf"}', 'x')).toEqual({ acao: 'cobrar_cpf' });
    expect(
      lerIntencaoJarvis('{"acao":"esclarecer","pergunta":"Para qual investidor?"}', 'x'),
    ).toEqual({
      acao: 'esclarecer',
      pergunta: 'Para qual investidor?',
    });
    expect(lerIntencaoJarvis('{"acao":"responder"}', 'oi')).toEqual({ acao: 'responder' });
  });

  it('leituras tortas viram null (a reserva determinística assume)', () => {
    expect(lerIntencaoJarvis('não entendi', 'x')).toBeNull();
    expect(lerIntencaoJarvis('{"acao":"relatorio","uf":"XX","recorte":"hiscon"}', 'x')).toBeNull();
    expect(lerIntencaoJarvis('{"acao":"carteira_investidor","credito":50}', 'x')).toBeNull();
    expect(lerIntencaoJarvis('{"acao":"apagar_tudo"}', 'x')).toBeNull();
    expect(lerIntencaoJarvis('{"acao":"esclarecer","pergunta":""}', 'x')).toBeNull();
  });
});

describe('entradaDoInterprete', () => {
  it('leva a conversa recente antes da mensagem atual', () => {
    const e = entradaDoInterprete('e pro Rodrigo?', [
      { de: 'dono', texto: 'mova 20 contratos para o Cornélio' },
      { de: 'ahri', texto: 'Montei o pacote para o Cornélio.' },
    ]);
    expect(e).toContain('Dono: mova 20 contratos para o Cornélio');
    expect(e).toContain('AHRI: Montei o pacote');
    expect(e.indexOf('MENSAGEM ATUAL DO DONO:\ne pro Rodrigo?')).toBeGreaterThan(
      e.indexOf('AHRI:'),
    );
  });
});

describe('interpretarComandoProcessosJuridico · reserva sem LLM', () => {
  it('o caso real também é lido sem a LLM (nome colado ao banco)', () => {
    const cmd = interpretarComandoProcessosJuridico(FRANCISCO);
    expect(cmd?.semCliente).toBe(0);
    expect(cmd?.clientes).toHaveLength(1);
    expect(cmd?.clientes[0]?.nome).toBe('Francisco Nunes da Silva');
    expect(cmd?.clientes[0]?.processos.map((p) => p.banco)).toEqual([
      'Banco Mercantil do Brasil',
      'Banco Bradesco S.A',
      'Banco Mercantil do Brasil S.A',
    ]);
  });
});
