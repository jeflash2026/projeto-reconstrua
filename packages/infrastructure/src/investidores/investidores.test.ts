// PAINEL DE INVESTIDORES (2026-09-16) — referência R$ 10.000/processo, parte da
// empresa 50%, desfecho real lançado no Jurídico, iniciais (LGPD), acesso por CPF.
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import { JuridicoService, type AndamentoProcesso } from '../juridico/juridico-service.js';
import type { EntregaAoAdvogado } from '../juridico/pastas-advogado.js';
import {
  faseDoProcesso,
  iniciaisDoNome,
  numeroCnj,
  processosParaValor,
  selecionarProcessos,
  type ProcessoCandidato,
} from './carteira-investidor.js';
import { InvestidoresService } from './investidores-service.js';

describe('regras puras', () => {
  it('iniciais sem partículas; nº CNJ formatado', () => {
    expect(iniciaisDoNome('Maria Aparecida dos Santos')).toBe('M. A. S.');
    expect(iniciaisDoNome('TAÍS REGINA CAETANO DA SILVA')).toBe('T. R. C. S.');
    expect(numeroCnj('40051771920268260533')).toBe('4005177-19.2026.8.26.0533');
  });

  it('valor pedido vira quantidade de processos (R$ 10.000 cada)', () => {
    expect(processosParaValor(250_000)).toBe(25);
    expect(processosParaValor(254_000)).toBe(25);
    expect(processosParaValor(3_000)).toBe(1);
  });

  it('seleção espalha por advogado, cliente e banco; sem advogado fica por último', () => {
    const c = (
      numero: string,
      clienteId: string,
      advogado: string | null,
      banco: string,
      em: string,
    ): ProcessoCandidato => ({
      numero,
      clienteId,
      clienteNome: clienteId,
      bancos: [banco],
      advogado,
      cadastradoEm: em,
    });
    const escolha = selecionarProcessos(
      [
        c('p1', 'ana', 'Gracielle', 'PAN', '2026-08-01'),
        c('p2', 'ana', 'Gracielle', 'BMG', '2026-08-02'),
        c('p3', 'joao', 'Gracielle', 'PAN', '2026-08-03'),
        c('p4', 'rui', 'Cornélio', 'C6', '2026-08-04'),
        c('p5', 'sem', null, 'ITAU', '2026-07-01'),
      ],
      3,
    );
    expect(escolha.map((e) => e.numero)).toEqual(['p1', 'p4', 'p3']);
  });

  it('fase: desfecho manda; execução; sentença (não "conclusos para sentença"); distribuição', () => {
    const andamento = (nomes: string[], emExecucao = false): AndamentoProcesso =>
      ({
        numero: 'x',
        emExecucao,
        movimentos: nomes.map((nome) => ({ nome, dataHora: '2026-09-01T12:00:00.000Z' })),
      }) as unknown as AndamentoProcesso;
    expect(faseDoProcesso(null, null)).toBe('distribuido');
    expect(faseDoProcesso(andamento(['DJEN · Lista de distribuição']), null)).toBe('distribuido');
    expect(faseDoProcesso(andamento(['Conclusos para sentença']), null)).toBe('andamento');
    expect(faseDoProcesso(andamento(['Julgado procedente o pedido']), null)).toBe('sentenca');
    expect(faseDoProcesso(andamento(['Petição'], true), null)).toBe('execucao');
  });
});

describe('InvestidoresService', () => {
  const CPF = '52998224725';
  const TAIS = '4005177-19.2026.8.26.0533';
  const GILDETE = '4002387-95.2026.8.26.0619';
  const HELIO = '4019982-84.2026.8.26.0562';

  async function montar(): Promise<{
    juridico: JuridicoService;
    investidores: InvestidoresService;
    relogio: { t: Date };
  }> {
    const json = new InMemoryJsonStore();
    const relogio = { t: new Date('2026-09-16T13:00:00.000Z') };
    const clock = { now: () => relogio.t };
    const juridico = new JuridicoService({ json, media: {} as MediaStorePort, clock });
    const cadastrar = async (nome: string, numero: string, banco: string): Promise<void> => {
      const c = await juridico.criarCliente({ nome }, 'teste');
      if (!c.ok) throw new Error('cliente');
      await juridico.criarProcesso(
        { clienteId: c.valor, numero, bancos: [{ banco, contratos: [{ numero: 's/nº' }] }] },
        'teste',
      );
    };
    await cadastrar('Taís Regina Caetano da Silva', TAIS, 'AGIBANK');
    await cadastrar('Gildete dos Santos Teixeira', GILDETE, 'PAN');
    await cadastrar('Hélio Fontes', HELIO, 'BMG');
    const entregas: EntregaAoAdvogado[] = [
      {
        advogadoId: 'g',
        advogado: 'Gracielle',
        chatId: 'c1',
        nome: 'TAIS REGINA CAETANO DA SILVA',
        entregueEm: null,
      },
      {
        advogadoId: 'c',
        advogado: 'Cornélio',
        chatId: 'c2',
        nome: 'GILDETE DOS SANTOS TEIXEIRA',
        entregueEm: null,
      },
    ];
    const investidores = new InvestidoresService({
      json,
      clock,
      secret: 'segredo',
      juridico,
      entregas: () => Promise.resolve(entregas),
    });
    await investidores.cadastrar({ cpf: '529.982.247-25', nome: 'João Investidor' });
    return { juridico, investidores, relogio };
  }

  it('convite → senha → login por CPF; convite não reutilizável; erro genérico', async () => {
    const { investidores, relogio } = await montar();
    const token = await investidores.emitirConvite(CPF);
    expect(token).not.toBeNull();
    expect(
      await investidores.definirSenha(token ?? '', '11144477735', 'senha-forte'),
    ).toMatchObject({
      ok: false,
    });
    relogio.t = new Date('2026-09-16T13:05:00.000Z');
    expect(await investidores.definirSenha(token ?? '', CPF, 'senha-forte')).toMatchObject({
      ok: true,
    });
    expect(await investidores.definirSenha(token ?? '', CPF, 'outra-senha')).toMatchObject({
      ok: false,
      error: 'este convite já foi utilizado — peça um novo link',
    });
    expect(await investidores.login(CPF, 'senha-forte')).toMatchObject({ ok: true });
    expect(await investidores.login(CPF, 'errada')).toEqual({
      ok: false,
      error: 'credenciais inválidas',
    });
  });

  it('proposta → alocação exclusiva → painel com iniciais, referência e advogado', async () => {
    const { investidores } = await montar();
    const proposta = await investidores.propostaCarteira(2);
    expect(proposta.disponiveis).toBe(3);
    // Com advogado primeiro (Hélio não foi entregue a ninguém).
    expect(proposta.itens.map((i) => i.numero).sort()).toEqual([GILDETE, TAIS].sort());
    const r = await investidores.alocar(CPF, [TAIS, GILDETE], 20_000, 'founder-console');
    expect(r).toMatchObject({ ok: true, valor: { alocados: 2, indisponiveis: [] } });
    // Nunca duas vezes.
    expect(await investidores.alocar(CPF, [TAIS], null, 'x')).toMatchObject({ ok: false });
    expect((await investidores.propostaCarteira(5)).disponiveis).toBe(1);

    const painel = await investidores.painel(CPF);
    expect(painel?.totais).toMatchObject({
      processos: 2,
      valorAtual: 10_000,
      referencia: 10_000,
      aReceber: 10_000,
      realizado: 0,
      valorDosProcessos: 20_000,
    });
    const tais = painel?.processos.find((p) => p.numero === TAIS);
    expect(tais).toMatchObject({
      iniciais: 'T. R. C. S.',
      advogado: 'Gracielle',
      fase: 'distribuido',
    });
    expect(tais).not.toHaveProperty('clienteNome');
    expect(JSON.stringify(painel)).not.toContain('Caetano');
    // O Admin vê o nome.
    expect((await investidores.painel(CPF, true))?.processos[0]).toHaveProperty('clienteNome');
  });

  it('desfecho real: pago acima e abaixo da referência, perdido e correção entram no extrato', async () => {
    const { juridico, investidores, relogio } = await montar();
    await investidores.alocar(CPF, [TAIS, GILDETE, HELIO], 30_000, 'founder-console');

    relogio.t = new Date('2026-09-17T10:00:00.000Z');
    expect(
      await juridico.registrarResultado(
        TAIS,
        { situacao: 'pago', valorRecebido: '14.000,00' },
        'Dono',
      ),
    ).toMatchObject({ ok: true });
    await juridico.registrarResultado(GILDETE, { situacao: 'perdido' }, 'Dono');
    await juridico.registrarResultado(HELIO, { situacao: 'pago', valorRecebido: 8_000 }, 'Dono');
    relogio.t = new Date('2026-09-18T10:00:00.000Z');
    await juridico.registrarResultado(HELIO, { situacao: 'pago', valorRecebido: 9_000 }, 'Dono');

    const painel = await investidores.painel(CPF);
    // Taís 7.000 + Gildete 0 + Hélio 4.500.
    expect(painel?.totais).toMatchObject({
      valorAtual: 11_500,
      realizado: 11_500,
      aReceber: 0,
      ajuste: -3_500,
      pagos: 2,
      perdidos: 1,
    });
    expect(painel?.extrato.map((l) => [l.tipo, l.valor])).toEqual([
      ['correcao', 500],
      ['pago', 2_000],
      ['perdido', -5_000],
      ['pago', -1_000],
      ['carteira', 15_000],
    ]);
    // Processo com desfecho não sai da carteira.
    expect(await investidores.retirar(CPF, TAIS, 'teste', 'x')).toMatchObject({ ok: false });
  });

  it('retirar processo em curso: volta a ficar disponível e o extrato registra', async () => {
    const { investidores } = await montar();
    await investidores.alocar(CPF, [TAIS], null, 'x');
    expect(await investidores.retirar(CPF, TAIS, 'alocado por engano', 'Dono')).toEqual({
      ok: true,
    });
    expect(await investidores.investidorDoProcesso(TAIS)).toBeNull();
    const painel = await investidores.painel(CPF);
    expect(painel?.totais.processos).toBe(0);
    expect(painel?.extrato[0]).toMatchObject({ tipo: 'retirado', valor: -5_000 });
  });

  it('resultado do processo valida os dados e desfaz com "em andamento"', async () => {
    const { juridico } = await montar();
    expect(await juridico.registrarResultado(TAIS, { situacao: 'pago' }, 'Dono')).toMatchObject({
      ok: false,
    });
    expect(
      await juridico.registrarResultado(
        '0000000-00.0000.0.00.0000',
        { situacao: 'perdido' },
        'Dono',
      ),
    ).toMatchObject({ ok: false, error: 'processo não encontrado' });
    await juridico.registrarResultado(TAIS, { situacao: 'perdido', data: '2026-09-10' }, 'Dono');
    const desfeito = await juridico.registrarResultado(TAIS, { situacao: 'em-andamento' }, 'Dono');
    expect(desfeito).toMatchObject({ ok: true, valor: { situacao: 'em-andamento', data: null } });
    expect((await juridico.resultadoDoProcesso(TAIS))?.historico).toHaveLength(2);
  });
});
