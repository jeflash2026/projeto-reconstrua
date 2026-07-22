// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE ESTRATÉGIAS — CONSIGNADO INSS (GO-LIVE 10A · matriz ampliada 11A).
// O lado do DOMÍNIO: as hipóteses jurídicas que o motor genérico avalia.
//
// GO-LIVE 11A — DOMAIN INTELLIGENCE: cada estratégia declara agora a matriz
// completa — fatos mínimos (requer), fatos que elevam confiança (reforca),
// riscos, documentos ESPERADOS e OPCIONAIS, ações seguintes (proximaAcao +
// prioridades), CRITÉRIOS DE EXCLUSÃO e CRITÉRIO DE PRIORIDADE (número).
//
// Todo texto é AUTORADO (o motor nunca escreve); toda condição é serializável e
// auditável. Os fatos vêm da Truth Layer (caseExists/stateCode/…) e do
// Conversation Knowledge (beneficio/problema_principal/… — 9G/11A).
// ─────────────────────────────────────────────────────────────────────────────
import type { CatalogoDeEstrategias } from './strategic-reasoning.js';

const BENEFICIO_INSS = {
  fact: 'beneficio',
  op: 'in',
  value: ['aposentadoria', 'pensao', 'bpc'],
} as const;
const ENCERRADA = { fact: 'stateCode', op: 'eq', value: 'ENCERRADA' } as const; // usado como EXCLUSÃO

export const ESTRATEGIAS_CONSIGNADO_INSS: CatalogoDeEstrategias = [
  {
    ref: 'EST-CONSIG-REVISAO-001',
    hipotese: 'Revisão contratual de consignado — descontos não reconhecidos pelo beneficiário',
    requer: [
      { fact: 'problema_principal', op: 'eq', value: 'descontos_nao_reconhecidos' },
      BENEFICIO_INSS,
    ],
    reforca: [
      { fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' },
      { fact: 'documentacao_mencionada', op: 'eq', value: 'hiscon' },
      { fact: 'multiplos_bancos', op: 'eq', value: 'true' },
    ],
    riscos: [
      {
        quando: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
        risco:
          'Existem contratos em múltiplas instituições — mapear TODOS os vínculos antes de qualquer medida',
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
        justificativa:
          'múltiplos bancos exigem confirmação de todos os contratos ativos antes da revisão',
      },
      {
        quando: [{ fact: 'documentacao_mencionada', op: 'neq', value: 'hiscon' }],
        acao: 'Orientar a obtenção do HISCON (histórico de consignados)',
        justificativa: 'o HISCON é a base documental da revisão de consignado',
      },
    ],
    documentosEsperados: ['HISCON', 'extrato de empréstimos consignados do INSS'],
    documentosOpcionais: ['cópia dos contratos', 'extrato bancário'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 60,
    proximaAcao:
      'Validar documentação complementar (HISCON + extrato INSS) e vincular os contratos por instituição',
    fundamento:
      'Revisão de consignado — Lei 10.820/2003 + CDC (cobrança indevida); prática do escritório',
  },
  {
    ref: 'EST-CONSIG-NAO-CONTRATADO-001',
    hipotese:
      'Empréstimo não contratado — indício de contratação fraudulenta em nome do beneficiário',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'emprestimo_nao_contratado' }],
    reforca: [
      { fact: 'tempo_do_problema', op: 'eq', value: 'recente' },
      { fact: 'documentacao_mencionada', op: 'eq', value: 'hiscon' },
    ],
    riscos: [
      {
        quando: [{ fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' }],
        risco:
          'Contratação antiga não contestada — reunir evidência de que o cliente nunca usufruiu do valor',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Levantar o contrato contestado junto à instituição (cópia + assinatura)',
        justificativa:
          'a prova da não contratação nasce do confronto com o contrato apresentado pelo banco',
      },
    ],
    documentosEsperados: ['HISCON', 'contrato contestado (cópia + assinatura)'],
    documentosOpcionais: ['boletim de ocorrência', 'extrato bancário'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 80,
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
    documentosEsperados: ['contratos por instituição', 'HISCON'],
    documentosOpcionais: ['simulação de recálculo dos encargos'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 40,
    proximaAcao: 'Coletar contratos e calcular a diferença de encargos por instituição',
    fundamento: 'Teto de juros do consignado INSS (Instrução Normativa/CNPS) + CDC',
  },
  {
    ref: 'EST-CONSIG-CARTAO-RMC-001',
    hipotese:
      'Cartão consignado / RMC vendido como empréstimo — desconto de reserva de margem indevido',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'cartao_rmc' }],
    reforca: [
      BENEFICIO_INSS,
      { fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' },
      { fact: 'multiplos_bancos', op: 'eq', value: 'true' },
    ],
    riscos: [
      {
        quando: [{ fact: 'tempo_do_problema', op: 'eq', value: 'mais_de_2_anos' }],
        risco:
          'RMC antiga — valores descontados acumulados podem ser altos; dimensionar o ressarcimento',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Confirmar se há contrato de CARTÃO consignado (RMC) vinculado ao benefício, e não empréstimo',
        justificativa:
          'o desvio típico é o desconto de reserva de margem apresentado ao cliente como empréstimo',
      },
    ],
    documentosEsperados: ['HISCON', 'extrato da RMC / cartão consignado', 'contrato do cartão'],
    documentosOpcionais: ['faturas do cartão consignado'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 70,
    proximaAcao:
      'Reunir HISCON + extrato de RMC e demonstrar o desvio de empréstimo para cartão consignado',
    fundamento:
      'Venda casada de cartão RMC como empréstimo — CDC art. 39, V + entendimento consumerista',
  },
  {
    ref: 'EST-CONSIG-MARGEM-001',
    hipotese: 'Extrapolação de margem consignável — descontos além do limite legal do benefício',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'margem_extrapolada' }],
    reforca: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }, BENEFICIO_INSS],
    riscos: [
      {
        quando: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
        risco:
          'Vários contratos somados podem comprometer a subsistência — avaliar superendividamento',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Calcular o total descontado vs. a margem legal (35% + 5% de cartão) sobre o benefício',
        justificativa:
          'a extrapolação se demonstra pelo somatório dos descontos contra a margem consignável',
      },
    ],
    documentosEsperados: ['HISCON', 'extrato de margem consignável (Meu INSS)'],
    documentosOpcionais: ['contracheque', 'extrato de pagamento do benefício'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 55,
    proximaAcao: 'Levantar a margem consignável e o somatório de descontos por contrato',
    fundamento: 'Limite de margem consignável — Lei 10.820/2003 art. 6º e regulamentos do INSS',
  },
  {
    ref: 'EST-CONSIG-TARIFAS-001',
    hipotese: 'Encargos não contratados — seguro prestamista/tarifas embutidas no consignado',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'tarifas_indevidas' }],
    reforca: [{ fact: 'documentacao_mencionada', op: 'eq', value: 'contrato' }],
    prioridades: [
      {
        quando: [],
        acao: 'Identificar seguros/tarifas embutidos e não solicitados na discriminação do contrato',
        justificativa: 'a cobrança de serviço não solicitado é vedada e enseja restituição',
      },
    ],
    documentosEsperados: ['contrato com discriminação de tarifas/seguros'],
    documentosOpcionais: ['HISCON', 'extrato bancário'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 35,
    proximaAcao:
      'Obter o contrato e destacar encargos não contratados (seguro prestamista/tarifas)',
    fundamento: 'Cobrança de serviços não solicitados — CDC art. 39, III e art. 51',
  },
  {
    ref: 'EST-CONSIG-PORTABILIDADE-001',
    hipotese: 'Portabilidade/refinanciamento indevido — operação sem anuência do beneficiário',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'portabilidade_indevida' }],
    reforca: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
    riscos: [
      {
        quando: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }],
        risco:
          'Cadeia de portabilidades entre bancos — reconstituir a ordem cronológica dos contratos',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Comparar o contrato de ORIGEM com o de DESTINO (taxa, prazo, saldo devedor)',
        justificativa:
          'a irregularidade aparece no confronto entre a operação original e a portada/refinanciada',
      },
    ],
    documentosEsperados: ['HISCON', 'contratos de origem e destino da portabilidade'],
    documentosOpcionais: ['extrato bancário'],
    criteriosDeExclusao: [ENCERRADA],
    prioridade: 45,
    proximaAcao: 'Levantar os contratos de origem e destino da portabilidade/refinanciamento',
    fundamento: 'Portabilidade/refinanciamento sem anuência — Resolução CMN + CDC',
  },
  {
    ref: 'EST-CONSIG-SUPERENDIVIDAMENTO-001',
    hipotese: 'Superendividamento — comprometimento do benefício ameaça o mínimo existencial',
    requer: [{ fact: 'problema_principal', op: 'eq', value: 'superendividamento' }],
    reforca: [{ fact: 'multiplos_bancos', op: 'eq', value: 'true' }, BENEFICIO_INSS],
    riscos: [
      {
        quando: [],
        risco:
          'Comprometimento da subsistência — preservar o mínimo existencial é prioridade absoluta',
      },
    ],
    prioridades: [
      {
        quando: [],
        acao: 'Mapear TODAS as dívidas consignadas e o percentual de comprometimento da renda',
        justificativa: 'a repactuação exige o quadro completo do endividamento sobre o benefício',
      },
    ],
    documentosEsperados: ['HISCON', 'extrato de todos os descontos no benefício'],
    documentosOpcionais: ['orçamento familiar', 'contracheque'],
    prioridade: 90,
    proximaAcao: 'Consolidar todos os contratos e propor repactuação (Lei do Superendividamento)',
    fundamento: 'Superendividamento — Lei 14.181/2021 (repactuação e mínimo existencial) + CDC',
  },
];
