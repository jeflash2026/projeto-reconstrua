// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · testes do NÚCLEO (Decreto 2026-07-24, item 14).
// Dados FICTÍCIOS e anonimizados. Provam as regras inegociáveis: nunca inventar,
// nunca concluir fraude, travar por inconsistência, exigir o perito humano.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ContratoHiscon, HisconExtraido } from '../pericia/hiscon-parser.js';
import {
  NAO_APRESENTADO,
  NAO_VERIFICAVEL,
  campoSeguro,
  termosProibidosEncontrados,
  textoSeguro,
} from './linguagem-segura.js';
import { podeTransitar, exigeMarcaDagua } from './caso-pericial.js';
import { novoAchadoAutomatico, temCriticoAberto } from './achado.js';
import { fichasDoHiscon } from './fichas-contrato.js';
import { verificarConsistencia, consistente } from './consistencia.js';
import { gerarMinuta, MARCA_DAGUA, type EntradaMinuta } from './minuta.js';
import { validarAprovacaoPerito, podeEmitir } from './revisao-perito.js';

function contrato(over: Partial<ContratoHiscon>): ContratoHiscon {
  return {
    contrato: '123456789',
    bancoCodigo: '001',
    bancoNome: 'BANCO EXEMPLO',
    situacao: 'Ativo',
    origemAverbacao: 'Nova',
    dataInclusao: null,
    competenciaInicio: '03/2024',
    competenciaFim: '02/2028',
    qtdeParcelas: 48,
    valorParcela: 200,
    valorEmprestado: 8000,
    ...over,
  } as ContratoHiscon;
}
function hiscon(contratos: ContratoHiscon[]): HisconExtraido {
  return {
    beneficiario: 'FULANO DE TAL',
    numeroBeneficio: '1234567890',
    situacaoBeneficio: null,
    bancoPagamento: null,
    contratos,
    margens: undefined,
  } as unknown as HisconExtraido;
}

describe('Linguagem segura — nunca inventar, nunca concluir fraude', () => {
  it('ausência ⇒ frase canônica exata', () => {
    expect(campoSeguro(null)).toBe(NAO_APRESENTADO);
    expect(campoSeguro('')).toBe(NAO_APRESENTADO);
    expect(campoSeguro(null, 'nao-verificavel')).toBe(NAO_VERIFICAVEL);
    expect(campoSeguro('BANCO X')).toBe('BANCO X'); // presente ⇒ transcreve
    expect(campoSeguro(1234)).toBe('1234');
  });
  it('detecta e bloqueia conclusões jurídicas proibidas', () => {
    expect(textoSeguro('Elementos técnicos consistentes.')).toBe(true);
    expect(termosProibidosEncontrados('Conclui-se que houve fraude no contrato.')).toContain(
      'fraude',
    );
    expect(textoSeguro('a assinatura é falsa')).toBe(false);
    expect(textoSeguro('nulidade do contrato')).toBe(false);
  });
});

describe('Fichas por contrato — a partir do HISCON', () => {
  it('um HISCON com vários contratos ⇒ uma ficha por contrato', () => {
    const fichas = fichasDoHiscon(
      hiscon([contrato({ contrato: '111' }), contrato({ contrato: '222' })]),
    );
    expect(fichas).toHaveLength(2);
    expect(fichas[0]?.classificacao).toBe('CONTRATO_IDENTIFICADO');
  });
  it('contrato sem número ⇒ NECESSITA_REVISAO_HUMANA (não inventa número)', () => {
    const fichas = fichasDoHiscon(hiscon([contrato({ contrato: 'CONFERIR-NO-HISCON-1' })]));
    expect(fichas[0]?.classificacao).toBe('NECESSITA_REVISAO_HUMANA');
    expect(fichas[0]?.contrato).toBe(NAO_APRESENTADO);
  });
  it('refinanciamento e dados incompletos são classificados sem concluir fraude', () => {
    expect(
      fichasDoHiscon(hiscon([contrato({ origemAverbacao: 'Refinanciamento' })]))[0]?.classificacao,
    ).toBe('POSSIVEL_REFINANCIAMENTO');
    expect(fichasDoHiscon(hiscon([contrato({ valorEmprestado: null })]))[0]?.classificacao).toBe(
      'CONTRATO_COM_DADOS_INCOMPLETOS',
    );
  });
});

describe('Consistência — travas críticas de emissão', () => {
  const base = {
    nomeCliente: 'Fulano',
    cpf: '11144477735',
    numeroBeneficio: '1234567890',
    banco: 'Banco A',
    cnpjBanco: '00000000000191',
    numeroContrato: '111',
    numeroProcesso: '0001',
  };
  it('banco divergente ⇒ erro crítico e emissão bloqueada', () => {
    const erros = verificarConsistencia(base, { ...base, banco: 'Banco B' });
    expect(erros).toHaveLength(1);
    expect(erros[0]?.mensagem).toContain('instituições financeiras divergentes');
    expect(consistente(base, { ...base, banco: 'Banco B' })).toBe(false);
  });
  it('CPF, cliente, contrato e processo divergentes são pegos', () => {
    expect(verificarConsistencia(base, { ...base, cpf: '52998224725' })).toHaveLength(1);
    expect(verificarConsistencia(base, { ...base, nomeCliente: 'Outro' })).toHaveLength(1);
    expect(verificarConsistencia(base, { ...base, numeroContrato: '999' })).toHaveLength(1);
    expect(verificarConsistencia(base, { ...base, numeroProcesso: '9999' })).toHaveLength(1);
  });
  it('ausência de um lado NÃO é divergência (é pendência)', () => {
    expect(verificarConsistencia(base, { ...base, banco: null })).toHaveLength(0);
  });
});

describe('Ciclo de vida — revisão humana obrigatória', () => {
  it('transições respeitam a máquina de estados (não pula a revisão)', () => {
    expect(podeTransitar('MINUTA_GERADA', 'EM_REVISAO_PELO_PERITO')).toBe(true);
    expect(podeTransitar('MINUTA_GERADA', 'ASSINADO')).toBe(false); // não pula o perito
    expect(podeTransitar('EM_REVISAO_PELO_PERITO', 'APROVADO_PELO_PERITO')).toBe(true);
  });
  it('marca d’água exigida enquanto não aprovada', () => {
    expect(exigeMarcaDagua('MINUTA_GERADA')).toBe(true);
    expect(exigeMarcaDagua('APROVADO_PELO_PERITO')).toBe(false);
  });
});

function entradaMinuta(over: Partial<EntradaMinuta> = {}): EntradaMinuta {
  return {
    status: 'MINUTA_GERADA',
    numeroCaso: 'C-001',
    geradoEm: '2026-07-24',
    cliente: { nome: 'Fulano', cpf: '11144477735', beneficio: '1234567890' },
    banco: 'Banco A',
    numeroProcesso: null,
    objeto: 'Análise técnica dos contratos consignados.',
    documentosExaminados: ['hiscon.pdf'],
    documentosNaoApresentados: ['Contrato eletrônico original'],
    resumoCustodia: [],
    ferramentas: ['Parser HISCON interno'],
    fichas: fichasDoHiscon(hiscon([contrato({})])),
    achados: [],
    quesitos: [{ pergunta: 'Há IP registrado?', resposta: null }],
    conclusaoSugerida: 'E',
    limitacoes: ['Análise limitada aos documentos apresentados.'],
    perito: null,
    ...over,
  };
}

describe('Minuta — 26 seções, marca d’água, sem conclusão proibida', () => {
  it('gera 26 seções com marca d’água e sem termos proibidos', () => {
    const m = gerarMinuta(entradaMinuta());
    expect(m.secoes).toHaveLength(26);
    expect(m.marcaDagua).toBe(MARCA_DAGUA);
    expect(m.texto).toContain(MARCA_DAGUA);
    expect(m.bloqueios).toHaveLength(0);
    // Ausências viram a frase canônica, não invenção.
    expect(m.texto).toContain(NAO_APRESENTADO);
  });
  it('aprovada ⇒ sem marca d’água', () => {
    expect(gerarMinuta(entradaMinuta({ status: 'APROVADO_PELO_PERITO' })).marcaDagua).toBeNull();
  });
});

describe('Emissão — o portão único de segurança', () => {
  const achadoCritico = novoAchadoAutomatico({
    id: 'a1',
    titulo: 'Divergência de valor',
    descricao: 'x',
    categoria: 'financeiro',
    gravidade: 'CRITICO',
    tipoFato: 'INCONSISTENCIA',
    criadoEm: '2026-07-24',
  });
  it('bloqueia emissão sem perito, com crítico aberto ou com inconsistência', () => {
    expect(temCriticoAberto([achadoCritico])).toBe(true);
    const r = podeEmitir({
      status: 'MINUTA_GERADA',
      achados: [achadoCritico],
      errosConsistencia: [{ campo: 'banco', mensagem: 'x', esperado: 'A', encontrado: 'B' }],
      bloqueiosMinuta: [],
      assinadaPorPerito: false,
    });
    expect(r.pode).toBe(false);
    expect(r.motivos.length).toBeGreaterThanOrEqual(3);
  });
  it('libera só quando aprovado, assinado, sem crítico e consistente', () => {
    const r = podeEmitir({
      status: 'ASSINADO',
      achados: [],
      errosConsistencia: [],
      bloqueiosMinuta: [],
      assinadaPorPerito: true,
    });
    expect(r.pode).toBe(true);
  });
  it('aprovação do perito exige todos os campos e declarações', () => {
    expect(
      validarAprovacaoPerito({
        nomeCompleto: '',
        cpf: '123',
        qualificacao: '',
        especialidades: '',
        registroProfissional: null,
        curriculoResumido: '',
        declaracaoResponsabilidade: false,
        confirmouExameDosArquivos: false,
      }).ok,
    ).toBe(false);
    expect(
      validarAprovacaoPerito({
        nomeCompleto: 'Perito Fulano',
        cpf: '11144477735',
        qualificacao: 'Perito em documentoscopia',
        especialidades: 'Documentos eletrônicos',
        registroProfissional: 'CREA 123',
        curriculoResumido: '10 anos de experiência.',
        declaracaoResponsabilidade: true,
        confirmouExameDosArquivos: true,
      }).ok,
    ).toBe(true);
  });
});
