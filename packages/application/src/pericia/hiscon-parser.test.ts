// ─────────────────────────────────────────────────────────────────────────────
// PARSER DO HISCON — testes com o TEXTO REAL transcrito em produção (HISCON da
// primeira cliente, 21/07/2026). O fixture é um recorte fiel do documento:
// cabeçalho do benefício, margens e blocos de contrato — incluindo o contrato
// MIGRADO (origem "Migrado do contrato ... CBC: ...").
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  agruparPorBanco,
  contratosDaJanela,
  contratosMigrados,
  contratosParaPedidoAdministrativo,
  dataCurta,
  dinheiro,
  indiciosDeEstrategias,
  mapaDeMigracoes,
  parseHisconDetalhado,
} from './hiscon-parser.js';

const HISCON_REAL = `Instituto Nacional do Seguro Social

HISTÓRICO DE
EMPRÉSTIMO CONSIGNADO

ISABEL MARQUES CALDEIRA RODRIGUES

Benefício

APOSENTADORIA POR IDADE
Nº Benefício: 186.472.726-5
Situação: ATIVO
Pago em: BANCO BRADESCO S A
Meio: Conta Corrente

Quantitativo de Empréstimos por Situação

SITUAÇÃO | QUANTIDADE
ATIVOS | 7

Margem para Empréstimo/Cartão e Resumo Financeiro

VALORES DO BENEFÍCIO
BASE DE CÁLCULO | R$1.621,00
MÁXIMO DE COMPROMETIMENTO PERMITIDO | R$648,40
TOTAL COMPROMETIDO | R$648,40
MARGEM EXTRAPOLADA*** | R$0,00

EMPRÉSTIMOS BANCÁRIOS
CONTRATOS ATIVOS E SUSPENSOS*

CONTRATO: 0328380631IMC
BANCO: 753 - NOVO BANCO CONTINENTAL S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Migrado do contrato 0328380631IMC CBC: 329
DATA INCLUSÃO: 27/02/26
COMPETÊNCIA INÍCIO DE DESCONTO: 03/2026
COMPETÊNCIA FIM DE DESCONTO: 02/2034
QTDE PARCELAS: 96
VALOR PARCELA: R$36,05
VALOR EMPRESTADO: R$1.586,62
VALOR LIBERADO: R$1.533,80
IOF: R$52,82
CET MENSAL: 1,97
CET ANUAL: 26,44
TAXA JUROS MENSAL: 1,85
TAXA JUROS ANUAL: 24,60
VALOR PAGO**:
DATA PRIMEIRO DESCONTO: 10/04/26

CONTRATO: 0123528811531
BANCO: 237 - BANCO BRADESCO S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Averbação nova
DATA INCLUSÃO: 15/04/25
COMPETÊNCIA INÍCIO DE DESCONTO: 05/2025
COMPETÊNCIA FIM DE DESCONTO: 04/2033
QTDE PARCELAS: 96
VALOR PARCELA: R$89,57
VALOR EMPRESTADO: R$3.929,55
VALOR LIBERADO: R$3.798,29
IOF: R$131,26
CET MENSAL: 1,97
CET ANUAL: 26,44
TAXA JUROS MENSAL: 1,85
TAXA JUROS ANUAL: 24,60
VALOR PAGO**:
DATA PRIMEIRO DESCONTO: 02/06/25

CONTRATO: 202504100819034
BANCO: 012 - BANCO INBURSA SA
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Averbação por Refinanciamento
DATA INCLUSÃO: 10/04/25
QTDE PARCELAS: 96
VALOR PARCELA: R$207,91
VALOR EMPRESTADO: R$9.763,33
VALOR LIBERADO:
TAXA JUROS MENSAL: 1,65
TAXA JUROS ANUAL: 21,70
VALOR PAGO**: R$0,01
DATA PRIMEIRO DESCONTO: 10/06/25

CONTRATO: 0123998106IMC
BANCO: 329 - QI SOCIEDADE DE CREDITO DIRETO S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Averbação nova
DATA INCLUSÃO: 27/01/25
QTDE PARCELAS: 84
VALOR PARCELA: R$37,10
TAXA JUROS MENSAL: 1,79

CONTRATO: 575062747
BANCO: 389 - BANCO MERCANTIL DO BRASIL S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Averbação por Refinanciamento
DATA INCLUSÃO: 02/02/24
QTDE PARCELAS: 84
VALOR PARCELA: R$70,96
TAXA JUROS MENSAL: 1,62
VALOR PAGO**: R$139,75
DATA PRIMEIRO DESCONTO: 10/03/24
`;

describe('parseHisconDetalhado · o documento REAL da produção', () => {
  const extraido = parseHisconDetalhado(HISCON_REAL);

  it('benefício: nome, número, situação e banco pagador', () => {
    expect(extraido.beneficiario).toBe('ISABEL MARQUES CALDEIRA RODRIGUES');
    expect(extraido.numeroBeneficio).toBe('186.472.726-5');
    expect(extraido.bancoPagamento).toBe('BANCO BRADESCO S A');
  });

  it('margens: base, comprometimento e extrapolada', () => {
    expect(extraido.margens.baseCalculo).toBeCloseTo(1621.0);
    expect(extraido.margens.maximoComprometimento).toBeCloseTo(648.4);
    expect(extraido.margens.totalComprometido).toBeCloseTo(648.4);
    expect(extraido.margens.extrapolada).toBeCloseTo(0);
  });

  it('extrai os 5 contratos com banco, valores, taxas e datas', () => {
    expect(extraido.contratos).toHaveLength(5);
    const bradesco = extraido.contratos.find((c) => c.contrato === '0123528811531');
    expect(bradesco).toMatchObject({
      bancoCodigo: '237',
      bancoNome: 'BANCO BRADESCO S A',
      situacao: 'Ativo',
      migrado: false,
      qtdeParcelas: 96,
    });
    expect(bradesco?.valorParcela).toBeCloseTo(89.57);
    expect(bradesco?.valorEmprestado).toBeCloseTo(3929.55);
    expect(bradesco?.taxaJurosMensal).toBeCloseTo(1.85);
    expect(bradesco?.dataInclusao?.toISOString().slice(0, 10)).toBe('2025-04-15');
  });

  it('MIGRADO: detectado pela ORIGEM DA AVERBAÇÃO, com o contrato de origem e o CBC', () => {
    const migrado = extraido.contratos.find((c) => c.contrato === '0328380631IMC');
    expect(migrado?.migrado).toBe(true);
    expect(migrado?.migradoDoContrato).toBe('0328380631IMC');
    expect(migrado?.migradoDoCbc).toBe('329');
    expect(contratosMigrados(extraido.contratos).map((c) => c.contrato)).toEqual(['0328380631IMC']);
  });

  it('MAPA da migração: DE contrato@banco de origem (CBC resolvido pelo documento) → PARA o atual', () => {
    const mapa = mapaDeMigracoes(extraido.contratos);
    expect(mapa).toHaveLength(1);
    expect(mapa[0]).toMatchObject({
      deContrato: '0328380631IMC',
      deBancoCodigo: '329',
      // 329 aparece no próprio HISCON como QI SOCIEDADE DE CREDITO DIRETO S A.
      deBancoNome: 'QI SOCIEDADE DE CREDITO DIRETO S A',
      paraContrato: '0328380631IMC',
      paraBancoCodigo: '753',
      paraBancoNome: 'NOVO BANCO CONTINENTAL S A',
    });
  });

  it('fila do PERITO = não migrados (pedido administrativo)', () => {
    const fila = contratosParaPedidoAdministrativo(extraido.contratos);
    expect(fila).toHaveLength(4);
    expect(fila.every((c) => !c.migrado)).toBe(true);
  });

  it('agrupamento por banco (ordem alfabética)', () => {
    const bancos = agruparPorBanco(extraido.contratos);
    expect(bancos.map((b) => b.bancoNome)).toEqual([
      'BANCO BRADESCO S A',
      'BANCO INBURSA SA',
      'BANCO MERCANTIL DO BRASIL S A',
      'NOVO BANCO CONTINENTAL S A',
      'QI SOCIEDADE DE CREDITO DIRETO S A',
    ]);
  });

  it('janela de 5 anos: contrato de 2024 dentro; VALOR PAGO vazio ⇒ null', () => {
    const hoje = new Date('2026-07-21T00:00:00Z');
    expect(contratosDaJanela(extraido.contratos, hoje, 5)).toHaveLength(5);
    // Janela de 1 ano (corte 21/07/2025): só o contrato de 02/2026 permanece.
    expect(contratosDaJanela(extraido.contratos, hoje, 1)).toHaveLength(1);
    const semPago = extraido.contratos.find((c) => c.contrato === '0123528811531');
    expect(semPago?.valorPago).toBeNull();
  });

  it('indícios: refinanciamento (2 contratos) e comprometimento no teto; juros SÓ com teto configurado', () => {
    const indicios = indiciosDeEstrategias(extraido);
    const refs = indicios.map((i) => i.estrategiaRef);
    expect(refs).toContain('EST-CONSIG-PORTABILIDADE-001');
    expect(refs).toContain('EST-CONSIG-SUPERENDIVIDAMENTO-001');
    expect(refs).not.toContain('EST-CONSIG-JUROS-001');
    const refin = indicios.find((i) => i.estrategiaRef === 'EST-CONSIG-PORTABILIDADE-001');
    expect(refin?.contratos).toEqual(['202504100819034', '575062747']);

    const comTeto = indiciosDeEstrategias(extraido, { tetoJurosMensal: 1.8 });
    const juros = comTeto.find((i) => i.estrategiaRef === 'EST-CONSIG-JUROS-001');
    expect(juros?.contratos).toEqual(['0328380631IMC', '0123528811531']);
  });
});

describe('helpers puros', () => {
  it('dinheiro e dataCurta', () => {
    expect(dinheiro('R$1.586,62')).toBeCloseTo(1586.62);
    expect(dinheiro('')).toBeNull();
    expect(dataCurta('27/02/26')?.toISOString().slice(0, 10)).toBe('2026-02-27');
    expect(dataCurta('27/02/1998')?.toISOString().slice(0, 10)).toBe('1998-02-27');
  });
});

// ── FORMATO B do Meu INSS (2026-07-22): contrato em UMA linha, campos "|" ─────
// Texto REAL de produção (Rosângela) — antes dava 0 contratos; agora parseia.
const HISCON_FORMATO_B = `Instituto Nacional do Seguro Social
HISTÓRICO DE
EMPRÉSTIMO CONSIGNADO
ROSANGELA APARECIDA RODRIGUES

EMPRÉSTIMOS BANCÁRIOS
CONTRATOS ATIVOS E SUSPENSOS*

Contrato: 0149457174 | Banco: 079 - PICPAY BANK | Situação: Ativo | Origem da Averbação: Averbação nova | Data Inclusão: 02/2026 | Início de Desconto: 02/02/26 | Fim de Desconto: 01/2034 | Qtde Parcelas: 96 | Valor Parcela: R$25,29 | Emprestado: R$1.186,15 | Liberado: R$1.146,95 | IOF: R$39,20 | CET Mensal: 1,76 | CET Anual: 23,62 | Taxa Juros Mensal: 1,69 | Taxa Juros Anual: 22,28 | Valor Pago: | Primeiro Desconto: 20/03/26
Contrato: 0143875351 | Banco: 079 - PICPAY BANK | Situação: Ativo | Origem da Averbação: Averbação por Refinanciamento | Data Inclusão: 11/2025 | Início de Desconto: 21/10/25 | Fim de Desconto: 10/2033 | Qtde Parcelas: 96 | Valor Parcela: R$506,00 | Emprestado: R$23.446,55 | IOF: R$36,91 | CET Mensal: 1,68 | CET Anual: 22,52 | Taxa Juros Mensal: 1,75 | Taxa Juros Anual: 23,14 | Valor Pago: R$22.368,93 | Primeiro Desconto: 20/12/25
`;

describe('Formato B (pipe) — mesmo parser lê os dois layouts', () => {
  it('extrai os contratos, banco, parcela e competência do Formato B', () => {
    const e = parseHisconDetalhado(HISCON_FORMATO_B);
    expect(e.beneficiario).toBe('ROSANGELA APARECIDA RODRIGUES');
    expect(e.contratos).toHaveLength(2);
    const [c1, c2] = e.contratos;
    expect(c1?.contrato).toBe('0149457174');
    expect(c1?.bancoCodigo).toBe('079');
    expect(c1?.bancoNome).toBe('PICPAY BANK');
    expect(c1?.situacao).toBe('Ativo');
    expect(c1?.valorParcela).toBeCloseTo(25.29);
    expect(c1?.qtdeParcelas).toBe(96);
    expect(c1?.competenciaInicio).toBe('02/02/26');
    expect(c2?.valorParcela).toBeCloseTo(506);
  });

  it('potencial de recuperação computa (competência dd/mm/aa do Formato B)', async () => {
    const { potencialDeRecuperacao } = await import('./potencial-recuperacao.js');
    const e = parseHisconDetalhado(HISCON_FORMATO_B);
    const pot = potencialDeRecuperacao(e.contratos, new Date('2026-07-22T00:00:00Z'));
    // C1: 02/2026→07/2026 = 6 × 25,29 = 151,74 ; C2: 10/2025→07/2026 = 10 × 506 = 5060
    expect(pot.total).toBeCloseTo(5211.74, 2);
    expect(pot.contratosSemValor).toBe(0);
  });
});

describe('helpers — datas dos dois formatos', () => {
  it('dataCurta aceita mm/aaaa (Formato B) além de dd/mm/aa', () => {
    expect(dataCurta('02/2026')?.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(dataCurta('10/02/26')?.toISOString().slice(0, 10)).toBe('2026-02-10');
  });
});
