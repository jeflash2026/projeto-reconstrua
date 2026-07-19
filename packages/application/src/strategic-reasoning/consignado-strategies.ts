// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE ESTRATÉGIAS — CONSIGNADO INSS (GO-LIVE 10A). O lado do DOMÍNIO:
// as hipóteses, prioridades, riscos e ações que o motor genérico avalia.
//
// Todo texto aqui é AUTORADO (o motor nunca escreve linguagem); toda condição é
// serializável e auditável (mesmo formato das Regras Operacionais do Brain).
// Os fatos referenciados vêm da Truth Layer (caseExists/casePhase/…) e do
// Conversation Knowledge (beneficio/problema_principal/… — 9G).
// ─────────────────────────────────────────────────────────────────────────────
import type { CatalogoDeEstrategias } from './strategic-reasoning.js';

export const ESTRATEGIAS_CONSIGNADO_INSS: CatalogoDeEstrategias = [
  {
    ref: 'EST-CONSIG-REVISAO-001',
    hipotese: 'Revisão contratual de consignado — descontos não reconhecidos pelo beneficiário',
    requer: [
      { fact: 'problema_principal', op: 'eq', value: 'descontos_nao_reconhecidos' },
      { fact: 'beneficio', op: 'in', value: ['aposentadoria', 'pensao', 'bpc'] },
    ],
    reforca: [
      { fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' },
      { fact: 'documentacao_mencionada', op: 'eq', value: 'hiscon' },
      { fact: 'multiplos_bancos', op: 'eq', value: 'true' },
    ],
    riscos: [
      {
        quando: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
        risco: 'Existem contratos em múltiplas instituições — mapear TODOS os vínculos antes de qualquer medida',
      },
      {
        quando: [{ fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' }],
        risco: 'Problema antigo — atenção a prazos prescricionais na análise jurídica',
      },
    ],
    oportunidades: [
      {
        quando: [{ fact: 'documentacao_mencionada', op: 'eq', value: 'hiscon' }],
        oportunidade: 'Cliente já possui HISCON — a análise de vínculos pode começar imediatamente',
      },
    ],
    prioridades: [
      {
        quando: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
        acao: 'Solicitar extrato INSS para confirmar vínculos',
        justificativa: 'múltiplos bancos exigem confirmação de todos os contratos ativos antes da revisão',
      },
      {
        quando: [{ fact: 'documentacao_mencionada', op: 'neq', value: 'hiscon' }],
        acao: 'Orientar a obtenção do HISCON (histórico de consignados)',
        justificativa: 'o HISCON é a base documental da revisão de consignado',
      },
    ],
    proximaAcao: 'Validar documentação complementar (HISCON + extrato INSS) e vincular os contratos por instituição',
    fundamento: 'Revisão de consignado — Lei 10.820/2003 + CDC (cobrança indevida); prática do escritório',
  },
  {
    ref: 'EST-CONSIG-NAO-CONTRATADO-001',
    hipotese: 'Empréstimo não contratado — indício de contratação fraudulenta em nome do beneficiário',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'emprestimo_nao_contratado' }],
    reforca: [
      { fact: 'tempo_do_problema', op: 'eq', value: 'recente' },
      { fact: 'documentacao_mencionada', op: 'eq', value: 'hiscon' },
    ],
    riscos: [
      {
        quando: [{ fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' }],
        risco: 'Contratação antiga não contestada — reunir evidência de que o cliente nunca usufruiu do valor',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Levantar o contrato contestado junto à instituição (cópia + assinatura)',
        justificativa: 'a prova da não contratação nasce do confronto com o contrato apresentado pelo banco',
      },
    ],
    proximaAcao: 'Reunir HISCON + contrato contestado e registrar a negativa formal do cliente',
    fundamento: 'Fraude em consignado — CDC art. 14 (responsabilidade objetiva) + Súmula 479/STJ',
  },
  {
    ref: 'EST-CONSIG-JUROS-001',
    hipotese: 'Revisão de encargos — juros do consignado acima do teto/abusivos',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'juros_abusivos' }],
    reforca: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
    prioridades: [
      {
        quando: [],
        acao: 'Levantar taxas contratadas por contrato e comparar ao teto vigente do consignado INSS',
        justificativa: 'a abusividade se demonstra contra o teto oficial de juros do período',
      },
    ],
    proximaAcao: 'Coletar contratos e calcular a diferença de encargos por instituição',
    fundamento: 'Teto de juros do consignado INSS (Instrução Normativa/CNPS) + CDC',
  },
];
