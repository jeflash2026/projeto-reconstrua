// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE COGNITIVA + PAINEL DO ADVOGADO (GO-LIVE 13A) — testes: a timeline
// conta a história do caso na ordem narrativa, só com evidência real, cada item
// com responsável/origem/fonte e fatos expansíveis nos passos cognitivos; o card
// do advogado resume o caso (confiança/hipótese/próxima ação/urgência) e abre o
// DOSSIÊ. Tudo derivado dos Read Models; nada inventado.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { montarTimelineCognitiva, type TimelineCognitivaInputs } from './timeline-cognitiva.js';
import { resumirCaso, ordenarCasos, type ResumoCasoInputs, type CartaoCaso } from './painel-advogado.js';

function tlInputs(over: Partial<TimelineCognitivaInputs> = {}): TimelineCognitivaInputs {
  return {
    conversaIniciadaEm: new Date('2026-07-18T10:00:00Z'), totalMensagens: 6,
    beneficio: 'aposentadoria', fatosAprendidos: ['beneficio=aposentadoria', 'problema_principal=cartao_rmc'],
    documentos: [{ label: 'HISCON', em: new Date('2026-07-18T11:00:00Z'), reconhecidoComo: 'hiscon' }],
    contratos: ['contrato Banco X'],
    raciocinio: { totalHipoteses: 2, principal: 'EST-CONSIG-CARTAO-RMC-001', fatosDaPrincipal: ['problema_principal=cartao_rmc'] },
    decisao: { strategyRef: 'EST-CONSIG-CARTAO-RMC-001', confianca: 'alta', em: new Date('2026-07-18T11:05:00Z') },
    missao: { missionId: 'M-1', criadaEm: new Date('2026-07-18T11:06:00Z'), advogado: 'dra. ana', recebidaEm: new Date('2026-07-18T11:07:00Z') },
    dossieAtualizadoEm: new Date('2026-07-18T11:08:00Z'),
    encerradoEm: null, feedback: null,
    ...over,
  };
}

describe('13A · Timeline Cognitiva — a história do caso', () => {
  it('narra na ORDEM (cliente → benefício → doc → reader → contratos → knowledge → reasoning → mind → missão → advogado → dossiê)', () => {
    const tl = montarTimelineCognitiva(tlInputs());
    const cats = tl.map((i) => i.categoria);
    expect(cats).toEqual(['cliente', 'beneficio', 'documento', 'reader', 'contrato', 'knowledge', 'reasoning', 'mind', 'missao', 'advogado', 'dossie']);
    expect(tl[0]?.ordem).toBe(1);
    expect(tl.every((i, idx) => i.ordem === idx + 1)).toBe(true);
  });

  it('cada item tem responsável, origem e FONTE; HISCON é reconhecido', () => {
    const tl = montarTimelineCognitiva(tlInputs());
    for (const i of tl) {
      expect(i.responsavel.length).toBeGreaterThan(0);
      expect(i.fonte.startsWith('read-model')).toBe(true);
    }
    expect(tl.find((i) => i.categoria === 'documento')?.titulo).toBe('HISCON recebido');
    expect(tl.find((i) => i.categoria === 'advogado')?.responsavel).toBe('dra. ana');
  });

  it('passos COGNITIVOS expõem os fatos utilizados (expansível); técnicos não', () => {
    const tl = montarTimelineCognitiva(tlInputs());
    expect(tl.find((i) => i.categoria === 'knowledge')?.fatosUtilizados).toContain('problema_principal=cartao_rmc');
    expect(tl.find((i) => i.categoria === 'mind')?.fatosUtilizados).toContain('problema_principal=cartao_rmc');
    expect(tl.find((i) => i.categoria === 'documento')?.fatosUtilizados).toBeNull();
  });

  it('só emite passos com EVIDÊNCIA — sem documento/decisão, não inventa', () => {
    const tl = montarTimelineCognitiva(tlInputs({ documentos: [], contratos: [], raciocinio: null, decisao: null, missao: null, dossieAtualizadoEm: null }));
    expect(tl.some((i) => i.categoria === 'documento')).toBe(false);
    expect(tl.some((i) => i.categoria === 'mind')).toBe(false);
    expect(tl.some((i) => i.categoria === 'cliente')).toBe(true); // a conversa existiu
  });

  it('encerramento e feedback entram quando ocorrem (append-only)', () => {
    const tl = montarTimelineCognitiva(tlInputs({ encerradoEm: new Date('2026-07-19T09:00:00Z'), feedback: { em: new Date('2026-07-19T09:01:00Z'), decisao: 'confirmada' } }));
    expect(tl.at(-2)?.categoria).toBe('encerramento');
    expect(tl.at(-1)?.categoria).toBe('feedback');
    expect(tl.at(-1)?.descricao).toContain('confirmada');
  });
});

describe('13A · Painel do Advogado — cada card é um CASO', () => {
  function caso(over: Partial<ResumoCasoInputs> = {}): ResumoCasoInputs {
    return {
      chatId: '5511999@c', clienteNome: 'João', status: 'em atendimento', tempoParadoMs: 1 * 24 * 60 * 60 * 1000,
      advogadoResponsavel: 'dra. ana',
      dossie: {
        grauConfianca: 'alta',
        hipoteses: [{ posicao: 1, ref: 'EST-CONSIG-CARTAO-RMC-001', hipotese: 'Cartão RMC vendido como empréstimo', confianca: 'alta', prioridade: 70, justificativa: 'x', fundamento: 'y' }],
        proximasAcoes: ['Reunir HISCON + extrato de RMC'],
        documentosPendentes: ['extrato da RMC'],
        missionId: 'M-1',
      },
      ...over,
    };
  }

  it('resume o caso: confiança, hipótese, próxima ação, docs, missão, responsável; abre o DOSSIÊ', () => {
    const c = resumirCaso(caso());
    expect(c.grauConfianca).toBe('alta');
    expect(c.principalHipotese).toContain('Cartão RMC');
    expect(c.proximaAcao).toContain('HISCON');
    expect(c.documentosPendentes).toEqual(['extrato da RMC']);
    expect(c.missionId).toBe('M-1');
    expect(c.advogadoResponsavel).toBe('dra. ana');
    expect(c.dossieDisponivel).toBe(true);
    expect(c.href).toBe('/clientes/5511999%40c'); // abre o cliente ⇒ dossiê no topo
  });

  it('URGÊNCIA determinística: muito parado ⇒ alta; docs pendentes ⇒ ao menos média', () => {
    expect(resumirCaso(caso({ tempoParadoMs: 6 * 24 * 60 * 60 * 1000 })).urgencia).toBe('alta');
    expect(resumirCaso(caso({ tempoParadoMs: 1 * 60 * 60 * 1000 })).urgencia).toBe('media'); // docs pendentes
  });

  it('sem tese sustentável ⇒ dossiê indisponível (nada inventado)', () => {
    const c = resumirCaso(caso({ dossie: { grauConfianca: null, hipoteses: [], proximasAcoes: [], documentosPendentes: [], missionId: null } }));
    expect(c.dossieDisponivel).toBe(false);
    expect(c.principalHipotese).toBeNull();
    expect(c.urgencia).toBe('baixa'); // 1 dia parado, sem docs pendentes
  });

  it('ordena por urgência (alta antes) e depois mais parados', () => {
    const casos: CartaoCaso[] = [
      resumirCaso(caso({ chatId: 'a', tempoParadoMs: 1 * 60 * 60 * 1000, dossie: { grauConfianca: 'alta', hipoteses: [], proximasAcoes: [], documentosPendentes: [], missionId: null } })),
      resumirCaso(caso({ chatId: 'b', tempoParadoMs: 6 * 24 * 60 * 60 * 1000, dossie: { grauConfianca: 'alta', hipoteses: [], proximasAcoes: [], documentosPendentes: [], missionId: null } })),
    ];
    expect(ordenarCasos(casos).map((c) => c.chatId)).toEqual(['b', 'a']); // b é urgência alta
  });
});
