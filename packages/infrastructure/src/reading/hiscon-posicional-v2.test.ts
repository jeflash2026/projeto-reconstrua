// ─────────────────────────────────────────────────────────────────────────────
// LEITOR POSICIONAL V2 (decreto 2026-07-27) — fixtures sintéticas do template
// oficial do INSS, com a FRAGMENTAÇÃO real das células ("154712"+"1759",
// "R$2.786"+",94") e a auditoria contra o quantitativo da página 1. A saída é
// validada PONTA A PONTA pelo parseHisconDetalhado — o mesmo parser da
// produção — garantindo que nada a jusante muda.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseHisconDetalhado } from '@reconstrua/application';
import {
  escolherLeituraHiscon,
  reconstruirHisconPosicionalV2,
  type ItemPdf,
  type PaginaPdf,
} from './hiscon-posicional-v2.js';

/** Item cujo CENTRO x cai exatamente em `cx` (viewport identidade nos testes —
 *  as coordenadas já são topo-esquerda; o produto real aplica o viewport). */
function cel(cx: number, y: number, s: string, w = 10): ItemPdf {
  return { str: s, transform: [1, 0, 0, 1, cx - w / 2, y], width: w };
}
const IDENT = [1, 0, 0, 1, 0, 0];
const pagina = (itens: ItemPdf[]): PaginaPdf => ({ itens, viewportTransform: IDENT });

/** Página 1 (retrato): título, nome, benefício e o QUANTITATIVO declarado.
 *  `excluidosDeclarados` liga a linha EXCLUÍDO (⇒ o TOTAL passa a ser conferível). */
function pagina1(ativosDeclarados: number, excluidosDeclarados: number | null = null): PaginaPdf {
  return pagina([
    cel(300, 20, 'Instituto Nacional do Seguro Social', 200),
    cel(300, 40, 'HISTÓRICO DE EMPRÉSTIMO CONSIGNADO', 220),
    cel(300, 60, 'MARIA DO ROCIO MIRANDA', 160),
    cel(300, 80, 'Benefício', 60),
    cel(300, 100, 'Nº Benefício 123.456.789-0', 150),
    cel(300, 120, 'Situação: ATIVO', 90),
    cel(300, 140, 'Quantitativo de Empréstimos por Situação', 230),
    cel(300, 160, `ATIVO ${String(ativosDeclarados)}`, 60),
    cel(300, 175, 'SUSPENSO 0', 70),
    ...(excluidosDeclarados !== null
      ? [cel(300, 190, `EXCLUÍDO ${String(excluidosDeclarados)}`, 70)]
      : []),
  ]);
}

/** Página de EMPRÉSTIMOS (paisagem já normalizada): 2 contratos ativos, com as
 *  células fragmentadas exatamente como o pdf.js entrega. */
function paginaEmprestimos(): PaginaPdf {
  return pagina([
    cel(400, 10, 'CONTRATOS ATIVOS E SUSPENSOS', 200),
    // Cabeçalho da tabela (o corpo começa abaixo dele) — o PORTÃO DO TEMPLATE
    // exige estes rótulos nas posições esperadas, incluindo um do lado direito.
    cel(25, 30, 'CONTRATO', 30),
    cel(54, 30, 'BANCO', 22),
    cel(80, 30, 'SITUAÇÃO', 30),
    cel(265, 30, 'PARCELA', 28),
    cel(308, 30, 'EMPRESTADO', 40),
    // ── Registro 1 (âncora 03/2024) — células fragmentadas em duas linhas ──
    cel(25, 48, '154712', 24),
    cel(25, 56, '1759', 16),
    cel(54, 48, '254 - PARANÁ', 40),
    cel(54, 56, 'BANCO', 24),
    cel(80, 50, 'Ativo', 20),
    cel(108, 48, 'Averbação', 36),
    cel(108, 56, 'nova', 18),
    cel(138, 50, '10/03/24', 30),
    cel(170, 50, '03/2024', 28), // ÂNCORA
    cel(205, 50, '02/2032', 28),
    cel(235, 50, '96', 10),
    cel(265, 48, 'R$2.786', 26),
    cel(265, 56, ',94', 12),
    cel(308, 50, 'R$6.650,18', 36),
    cel(470, 50, '1,80', 16),
    // ── Registro 2 (âncora 05/2023) ──
    cel(25, 90, '22-871682438/21', 50),
    cel(54, 90, '935 - FACTA', 40),
    cel(80, 90, 'Ativo', 20),
    cel(170, 90, '05/2023', 28), // ÂNCORA
    cel(265, 90, 'R$100,00', 30),
    // Nota de rodapé — tudo daqui para baixo fica FORA.
    cel(200, 120, '* Valor Pago é aproximado', 120),
  ]);
}

describe('Leitor posicional V2 — template + âncoras + auditoria', () => {
  it('lê os contratos com cada valor no campo certo (ponta a ponta pelo parser real)', () => {
    const r = reconstruirHisconPosicionalV2([pagina1(2), paginaEmprestimos()]);
    expect(r).not.toBe(null);
    expect(r?.contratosLidos).toBe(2);
    expect(r?.auditoria).toBe('conferida');
    expect(r?.texto).toContain('AUDITORIA DA LEITURA: conferida');

    const h = parseHisconDetalhado(r?.texto ?? '');
    expect(h.beneficiario).toBe('MARIA DO ROCIO MIRANDA');
    expect(h.numeroBeneficio).toBe('123.456.789-0');
    expect(h.contratos).toHaveLength(2);

    const c1 = h.contratos[0];
    expect(c1?.contrato).toBe('1547121759'); // fragmentos juntos SEM espaço
    expect(c1?.bancoCodigo).toBe('254');
    expect(c1?.bancoNome).toBe('PARANÁ BANCO'); // resolvido pelo dicionário
    expect(c1?.situacao).toBe('ATIVO');
    expect(c1?.origemAverbacao).toBe('Averbação nova');
    expect(c1?.competenciaInicio).toBe('03/2024');
    expect(c1?.competenciaFim).toBe('02/2032');
    expect(c1?.qtdeParcelas).toBe(96);
    expect(c1?.valorParcela).toBe(2786.94); // "R$2.786"+",94" remontado
    expect(c1?.valorEmprestado).toBe(6650.18);
    expect(c1?.taxaJurosMensal).toBe(1.8);

    const c2 = h.contratos[1];
    expect(c2?.contrato).toBe('22-871682438/21');
    expect(c2?.bancoNome).toBe('FACTA FINANCEIRA');
    expect(c2?.valorParcela).toBe(100);
    // O que NÃO está no documento fica null — nunca vaza de outra coluna.
    expect(c2?.valorEmprestado).toBe(null);
    expect(c2?.qtdeParcelas).toBe(null);
  });

  it('AUDITORIA diverge quando o lido difere do declarado — nunca falha em silêncio', () => {
    const r = reconstruirHisconPosicionalV2([pagina1(3), paginaEmprestimos()]);
    expect(r?.auditoria).toBe('divergente');
    expect(r?.texto).toContain('DIVERGÊNCIA — o documento declara 3 ativo(s)');
  });

  it('página sem tabela nem contratos ⇒ null (o chamador segue o fluxo normal)', () => {
    expect(reconstruirHisconPosicionalV2([pagina1(2)])).toBe(null);
    expect(reconstruirHisconPosicionalV2([pagina([cel(100, 50, 'Conta de luz', 60)])])).toBe(null);
  });

  it('REGRESSÃO (base real 2026-07-27): a MATRIZ ROTACIONADA é rejeitada — nunca fatiada', () => {
    // Layout do V1: rótulos na faixa ESQUERDA (x<135), cada COLUNA é um contrato.
    // Sem cabeçalho nas posições do template (nada no lado direito), o V2 deve
    // recusar a página inteira — antes ele fatiava e "criava" dezenas de contratos.
    const matriz = pagina([
      cel(400, 10, 'CONTRATOS ATIVOS E SUSPENSOS', 200),
      cel(60, 40, 'BANCO', 22),
      cel(60, 60, 'SITUAÇÃO', 30),
      cel(70, 80, 'INÍCIO DE DESCONTO', 60),
      cel(70, 100, 'QTDE PARCELAS', 46),
      // Valores espalhados — datas MM/AAAA em vários X (uma por contrato-coluna).
      cel(170, 80, '03/2024', 28),
      cel(240, 80, '05/2023', 28),
      cel(310, 80, '01/2022', 28),
      cel(170, 100, '96', 10),
      cel(240, 100, '84', 10),
    ]);
    expect(reconstruirHisconPosicionalV2([pagina1(2), matriz])).toBe(null);
  });

  it('REGRESSÃO: total declarado (excluídos) trava registros a mais — divergente', () => {
    // Documento declara 2 ativos + 1 excluído = 3 no total; a leitura achou só 2
    // empréstimos ⇒ mesmo com ativos batendo, a auditoria NÃO pode conferir.
    const r = reconstruirHisconPosicionalV2([pagina1(2, 1), paginaEmprestimos()]);
    expect(r?.declaradoTotal).toBe(3);
    expect(r?.emprestimosLidos).toBe(2);
    expect(r?.auditoria).toBe('divergente');
    expect(r?.texto).toContain('total declarado 3 × lidos 2');
    // E quando o total BATE, segue conferida.
    const ok = reconstruirHisconPosicionalV2([pagina1(2, 0), paginaEmprestimos()]);
    expect(ok?.declaradoTotal).toBe(2);
    expect(ok?.auditoria).toBe('conferida');
  });

  it('escolha: V2 conferido vence; divergente perde para o V1 que bate com o declarado', () => {
    const conferido = reconstruirHisconPosicionalV2([pagina1(2), paginaEmprestimos()]);
    expect(escolherLeituraHiscon(conferido, 'CONTRATO: X\nSITUAÇÃO: ATIVO\n')).toBe(
      conferido?.texto,
    );
    // Declarado 3; V2 leu 2 ativos (dist 1). Um V1 com 3 ativos (dist 0) vence.
    const divergente = reconstruirHisconPosicionalV2([pagina1(3), paginaEmprestimos()]);
    const v1TresAtivos = [
      'CONTRATO: A\nSITUAÇÃO: ATIVO',
      'CONTRATO: B\nSITUAÇÃO: ATIVO',
      'CONTRATO: C\nSITUAÇÃO: ATIVO',
    ].join('\n\n');
    expect(escolherLeituraHiscon(divergente, v1TresAtivos)).toBe(v1TresAtivos);
    // Sem V1, o V2 divergente ainda vale (com o aviso de auditoria no texto).
    expect(escolherLeituraHiscon(divergente, null)).toBe(divergente?.texto);
    // V2 nulo ⇒ V1.
    expect(escolherLeituraHiscon(null, 'v1')).toBe('v1');
  });

  it('normaliza a ROTAÇÃO da página paisagem (viewport ≠ identidade)', () => {
    // Página "rotacionada": os itens em espaço PDF; o viewport [0,1,1,0,0,0]
    // troca x↔y — o V2 precisa ler como se estivesse de pé.
    const rot = (cx: number, y: number, s: string, w = 10): ItemPdf => ({
      str: s,
      transform: [1, 0, 0, 1, y, cx - w / 2], // x e y trocados no espaço do PDF
      width: w,
    });
    const paginaRotacionada: PaginaPdf = {
      viewportTransform: [0, 1, 1, 0, 0, 0],
      itens: [
        rot(400, 10, 'CONTRATOS ATIVOS E SUSPENSOS', 200),
        rot(25, 30, 'CONTRATO', 30),
        rot(54, 30, 'BANCO', 22),
        rot(80, 30, 'SITUAÇÃO', 30),
        rot(308, 30, 'EMPRESTADO', 40),
        rot(25, 50, '871682438', 30),
        rot(54, 50, '318 - BMG', 30),
        rot(80, 50, 'Ativo', 20),
        rot(170, 50, '01/2025', 28),
        rot(265, 50, 'R$250,00', 30),
      ],
    };
    const r = reconstruirHisconPosicionalV2([paginaRotacionada]);
    expect(r?.contratosLidos).toBe(1);
    const h = parseHisconDetalhado(r?.texto ?? '');
    expect(h.contratos[0]?.contrato).toBe('871682438');
    expect(h.contratos[0]?.bancoNome).toBe('BANCO BMG');
    expect(h.contratos[0]?.valorParcela).toBe(250);
  });

  it('cartão RMC/RCC: seção pela coluna TIPO; desconto vira a parcela', () => {
    const cartao = pagina([
      cel(400, 10, 'DESCONTOS DE CARTÃO', 150),
      cel(49, 30, 'CONTRATO', 30),
      cel(205, 30, 'BANCO', 22),
      cel(280, 30, 'SITUAÇÃO', 30),
      cel(500, 30, 'DESCONTO', 40),
      cel(49, 50, '99887766', 30),
      cel(125, 50, 'RMC', 20),
      cel(205, 50, '318 - BMG', 36),
      cel(280, 50, 'Ativo', 20),
      cel(340, 50, '06/2024', 28), // ÂNCORA (competência)
      cel(500, 50, 'R$85,00', 26),
    ]);
    const r = reconstruirHisconPosicionalV2([pagina1(2), paginaEmprestimos(), cartao]);
    // Cartão NÃO entra na auditoria (o quantitativo declara EMPRÉSTIMOS).
    expect(r?.auditoria).toBe('conferida');
    const h = parseHisconDetalhado(r?.texto ?? '');
    expect(h.contratos).toHaveLength(3);
    const rmc = h.contratos.find((c) => c.contrato === '99887766');
    expect(rmc?.modalidade).toBe('RMC');
    expect(rmc?.valorParcela).toBe(85);
    expect(rmc?.bancoNome).toBe('BANCO BMG');
  });
});
