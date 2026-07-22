// ─────────────────────────────────────────────────────────────────────────────
// JORNADA COMERCIAL — testes da MÁQUINA DE ESTADOS (decreto 2026-07-20).
// Determinismo total: mesmo estado + mesma entrada ⇒ mesma resposta. Os casos
// incluem os diálogos EXATOS que falharam nas rodadas reais de teste.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  capturarIdentificacao,
  ehAdiamento,
  ehDesistencia,
  pareceNome,
  derivarEtapa,
  ehSaudacaoPura,
  interpretarInteresse,
  novaJornada,
  responderTurno,
  type FatosDaJornada,
  type JornadaRecord,
} from './jornada-comercial.js';

const NOW = new Date('2026-07-20T21:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';

function fatos(
  over: Partial<JornadaRecord> = {},
  docs: Partial<Omit<FatosDaJornada, 'registro'>> = {},
): FatosDaJornada {
  return {
    registro: { ...novaJornada(CHAT, NOW), ...over },
    docsRecebidos: docs.docsRecebidos ?? 0,
    docsCompletos: docs.docsCompletos ?? false,
    proximoDocumento: docs.proximoDocumento ?? 'RG (frente e verso) ou CNH',
    ultimoRegistrado: docs.ultimoRegistrado ?? null,
    ultimoRegistroEm: docs.ultimoRegistroEm ?? null,
  };
}

const texto = (t: string, primeiro = false) => ({
  tipo: 'texto' as const,
  texto: t,
  primeiroContato: primeiro,
  timestamp: NOW,
});
const documento = { tipo: 'documento' as const, texto: '', primeiroContato: false, timestamp: NOW };

describe('derivação PURA da etapa (nunca armazenada, nunca dessincroniza)', () => {
  it('sem nome/cidade ⇒ IDENTIFICACAO; com ambos sem consentimento ⇒ CONSENTIMENTO; consentiu ⇒ TRIAGEM; docs completos ⇒ CONCLUIDA', () => {
    expect(derivarEtapa(fatos())).toBe('IDENTIFICACAO');
    expect(derivarEtapa(fatos({ nome: 'Isabel' }))).toBe('IDENTIFICACAO'); // falta cidade
    expect(derivarEtapa(fatos({ nome: 'Isabel', cidade: 'Santa Ernestina' }))).toBe(
      'CONSENTIMENTO',
    );
    expect(
      derivarEtapa(fatos({ nome: 'Isabel', cidade: 'Santa Ernestina', consentiu: true })),
    ).toBe('TRIAGEM');
    expect(derivarEtapa(fatos({}, { docsCompletos: true }))).toBe('CONCLUIDA');
  });
  it('documento já enviado = consentimento implícito ⇒ TRIAGEM manda', () => {
    expect(derivarEtapa(fatos({}, { docsRecebidos: 1 }))).toBe('TRIAGEM');
  });
});

describe('captura DETERMINÍSTICA de nome e cidade (os diálogos reais)', () => {
  it('"Isabel, sou de santa ernestina- SP" ⇒ nome E cidade', () => {
    const c = capturarIdentificacao('Isabel, sou de santa ernestina- SP', {
      nome: null,
      cidade: null,
    });
    expect(c.nome).toBe('Isabel');
    expect(c.cidade).toContain('santa ernestina');
  });
  it('"Isabel" ⇒ só o nome; a cidade vem na mensagem seguinte', () => {
    expect(capturarIdentificacao('Isabel', { nome: null, cidade: null })).toEqual({
      nome: 'Isabel',
      cidade: null,
    });
    expect(capturarIdentificacao('Santa Ernestina', { nome: 'Isabel', cidade: null }).cidade).toBe(
      'Santa Ernestina',
    );
  });
  it('"Me chamo Isabel Marques" ⇒ nome sem o prefixo', () => {
    expect(
      capturarIdentificacao('Me chamo Isabel Marques', { nome: null, cidade: null }).nome,
    ).toBe('Isabel Marques');
  });
  it('REGRESSÃO 11ª rodada: "Isabel Rodrigues eu sou de santa ernestina" (SEM vírgula) ⇒ nome E cidade separados pelo conector', () => {
    const c = capturarIdentificacao('Isabel Rodrigues eu sou de santa ernestina', {
      nome: null,
      cidade: null,
    });
    expect(c.nome).toBe('Isabel Rodrigues');
    expect(c.cidade).toBe('santa ernestina');
  });
  it('"Maria moro em Campinas" ⇒ conector "moro em" também separa', () => {
    const c = capturarIdentificacao('Maria moro em Campinas', { nome: null, cidade: null });
    expect(c.nome).toBe('Maria');
    expect(c.cidade).toBe('Campinas');
  });
  it('saudação pura NÃO captura nada ("Boa noite" não é nome)', () => {
    expect(ehSaudacaoPura('Boa noite')).toBe(true);
    expect(capturarIdentificacao('boa tarde', { nome: null, cidade: null })).toEqual({
      nome: null,
      cidade: null,
    });
  });
});

describe('interesse DETERMINÍSTICO', () => {
  it('sim/quero/pode ⇒ sim; não/depois ⇒ nao; resto ⇒ incerto', () => {
    expect(interpretarInteresse('sim')).toBe('sim');
    expect(interpretarInteresse('quero sim, pode fazer')).toBe('sim');
    expect(interpretarInteresse('não, obrigada')).toBe('nao');
    expect(interpretarInteresse('como funciona o pagamento?')).toBe('incerto');
  });
});

describe('respostas AUTORADAS por etapa (a LLM não participa)', () => {
  it('primeiro contato ⇒ boas-vindas completas (apresentação + nome e cidade)', () => {
    expect(responderTurno(fatos(), texto('Boa noite', true))).toBe(MENSAGENS_JORNADA.boasVindas);
  });
  it('REGRESSÃO da rodada real: só o nome veio ⇒ "Prazer, Isabel! E de qual cidade você fala?"', () => {
    const r = responderTurno(fatos({ nome: 'Isabel', ultimaCaptura: 'nome' }), texto('Isabel'));
    expect(r).toBe(MENSAGENS_JORNADA.pedirCidade('Isabel'));
  });
  it('identificação recém-completa ⇒ explicação SEM promessas terminando na pergunta de interesse', () => {
    const r = responderTurno(
      fatos({ nome: 'Isabel', cidade: 'Santa Ernestina', ultimaCaptura: 'cidade' }),
      texto('Santa Ernestina'),
    );
    expect(r).toContain('irregularidade');
    expect(r).toContain('gratuita e sem compromisso');
    expect(r).toContain('interesse em fazer essa análise?');
    expect(r).not.toMatch(/garant|promet/i);
  });
  it('consentiu ⇒ inicia a triagem pedindo o PRIMEIRO documento (RG f/v ou CNH)', () => {
    const r = responderTurno(
      fatos({
        nome: 'Isabel',
        cidade: 'Santa Ernestina',
        consentiu: true,
        ultimaCaptura: 'consentimento',
      }),
      texto('sim'),
    );
    expect(r).toContain('três documentos, um por vez');
    expect(r).toContain('RG (frente e verso) ou CNH');
  });
  it('recusa ⇒ despedida gentil, sem insistência', () => {
    const r = responderTurno(
      fatos({ nome: 'Isabel', cidade: 'X', recusou: true }),
      texto('não quero'),
    );
    expect(r).toBe(MENSAGENS_JORNADA.recusa);
  });
  it('TRIAGEM: texto ⇒ reafirma o documento aguardado (do estado, nunca inventado)', () => {
    const r = responderTurno(
      fatos(
        { nome: 'Isabel', cidade: 'X', consentiu: true },
        { docsRecebidos: 1, proximoDocumento: 'o VERSO do RG (a parte de trás do documento)' },
      ),
      texto('to sem saber o que mandar'),
    );
    expect(r).toContain('Estou aguardando: o VERSO do RG');
  });
  it('DOCUMENTO com registro AINDA processando ⇒ ack (a progressão tardia fala depois)', () => {
    const r = responderTurno(fatos({ nome: 'Isabel', cidade: 'X', consentiu: true }), documento);
    expect(r).toBe(MENSAGENS_JORNADA.ackDocumento);
  });

  it('DECRETO DE DIAGNÓSTICO: registro do turno JÁ concluído ⇒ a resposta fala o FATO — "Recebi a frente do RG. Agora envie o verso."', () => {
    const f = fatos(
      { nome: 'Isabel', cidade: 'X', consentiu: true },
      {
        docsRecebidos: 1,
        proximoDocumento: 'o VERSO do RG (a parte de trás do documento)',
        ultimoRegistrado: 'a primeira face do RG',
        ultimoRegistroEm: new Date(NOW.getTime() + 5000), // registrou DEPOIS do envio ⇒ fresco
      },
    );
    const r = responderTurno(f, documento);
    expect(r).toContain('Registrado: a primeira face do RG');
    expect(r).toContain('Agora preciso de: o VERSO do RG');
  });

  it('registro do turno concluído + documentação COMPLETA ⇒ despedida da jornada', () => {
    const f = fatos(
      { nome: 'Isabel', cidade: 'X', consentiu: true },
      {
        docsCompletos: true,
        ultimoRegistrado: 'HISCON',
        ultimoRegistroEm: new Date(NOW.getTime() + 5000),
      },
    );
    const r = responderTurno(f, documento);
    expect(r).toContain('Registrado: HISCON');
    expect(r).toContain('documentação inicial está completa');
  });

  it('registro ANTIGO (de outro turno) não conta como fresco ⇒ ack', () => {
    const f = fatos(
      { nome: 'Isabel', cidade: 'X', consentiu: true },
      {
        docsRecebidos: 1,
        ultimoRegistrado: 'a primeira face do RG',
        ultimoRegistroEm: new Date(NOW.getTime() - 60000),
      },
    );
    expect(responderTurno(f, documento)).toBe(MENSAGENS_JORNADA.ackDocumento);
  });
  it('comprovante em nome do CÔNJUGE oferecido quando a pessoa diz que não tem no nome', () => {
    const r = responderTurno(
      fatos(
        { nome: 'I', cidade: 'X', consentiu: true },
        { docsRecebidos: 1, proximoDocumento: 'comprovante de endereço' },
      ),
      texto('não tenho comprovante no meu nome'),
    );
    expect(r).toContain('cônjuge também vale');
  });
  it('pergunta de DIREITO ⇒ resposta canônica prefixada, em qualquer etapa', () => {
    const r = responderTurno(fatos({ nome: 'I', cidade: 'X' }), texto('tenho direito?'));
    expect(r).toContain('somente conseguimos afirmar após analisar gratuitamente o seu HISCON');
  });
  it('CONCLUIDA ⇒ resposta vazia (a conversa normal/LLM assume)', () => {
    expect(responderTurno(fatos({}, { docsCompletos: true }), texto('obrigada'))).toBe('');
  });
  it('DETERMINISMO: mesma entrada, mesma resposta — sempre', () => {
    const f = fatos({ nome: 'Isabel', ultimaCaptura: 'nome' });
    const e = texto('Isabel');
    expect(responderTurno(f, e)).toBe(responderTurno(f, e));
  });
});

// ── CASO DENISE (2026-07-21, primeira cliente real após o go-live) ───────────
describe('caso Denise — adiamento entendido como humano (nunca repetir a cobrança)', () => {
  const emTriagem = (over: Partial<JornadaRecord> = {}) =>
    fatos(
      { nome: 'Denise', cidade: 'Anastácio - MS', consentiu: true, ...over },
      { docsRecebidos: 2, proximoDocumento: 'comprovante de endereço' },
    );

  it('"Olha poso deixa p amanha nao estou em casa" ⇒ acolhimento (não a cobrança)', () => {
    const r = responderTurno(
      emTriagem({ avisosDeAdiamento: 1 }),
      texto('Olha poso deixa p amanha nao estou em casa'),
    );
    expect(r).toBe(MENSAGENS_JORNADA.adiamentoOk('comprovante de endereço'));
    expect(r).not.toContain('Estou aguardando');
  });

  it('repetição ("So amanhã ok" / "Cedo logo cedo te envio") ⇒ "Combinado!" curto', () => {
    expect(responderTurno(emTriagem({ avisosDeAdiamento: 2 }), texto('So amanhã ok'))).toBe(
      MENSAGENS_JORNADA.adiamentoOkCurto,
    );
    expect(
      responderTurno(emTriagem({ avisosDeAdiamento: 3 }), texto('Cedo logo cedo te envio')),
    ).toBe(MENSAGENS_JORNADA.adiamentoOkCurto);
  });

  it('detector de adiamento cobre as variações reais', () => {
    for (const t of [
      'posso deixar pra amanhã?',
      'só amanhã ok',
      'mais tarde te mando',
      'quando eu chegar envio',
      'não estou em casa',
      'hoje não consigo',
      'assim que puder te envio',
      'logo cedo te envio',
    ]) {
      expect(ehAdiamento(t)).toBe(true);
    }
    expect(ehAdiamento('segue o comprovante')).toBe(false);
    expect(ehAdiamento('ok')).toBe(false);
  });
});

describe('caso Denise — a primeira mensagem NUNCA vira nome', () => {
  it('"Olá! Posso ter mais informações sobre isso?" não parece nome (captura rejeita)', () => {
    expect(pareceNome('Olá! Posso ter mais informações sobre isso?')).toBe(false);
    expect(
      capturarIdentificacao('Olá! Posso ter mais informações sobre isso?', {
        nome: null,
        cidade: null,
      }),
    ).toEqual({ nome: null, cidade: null });
  });
  it('nomes reais continuam passando (inclusive com pontuação de digitação)', () => {
    expect(pareceNome('Denise.rondora ferreira')).toBe(true);
    expect(
      capturarIdentificacao('Denise.rondora ferreira', { nome: null, cidade: null }).nome,
    ).toBe('Denise.rondora ferreira');
    expect(pareceNome('Isabel Marques Caldeira Rodrigues')).toBe(true);
  });
  it('frases de funil/perguntas nunca viram nome', () => {
    for (const t of [
      'quero saber sobre a análise',
      'como funciona?',
      'tenho uma dúvida sobre o consignado',
      'pode me passar informações',
    ]) {
      expect(capturarIdentificacao(t, { nome: null, cidade: null }).nome).toBeNull();
    }
  });
});

// ── CASO LUCAS (2026-07-22, cliente real PERDIDO por trava robótica) ─────────
describe('caso Lucas — desconfiança, desistência e perguntas tratadas como humano', () => {
  const emTriagem = (over: Partial<JornadaRecord> = {}) =>
    fatos(
      { nome: 'Lucas', cidade: 'Guaramirim', consentiu: true, ...over },
      { docsRecebidos: 0, proximoDocumento: 'RG (frente e verso) ou CNH' },
    );

  it('"Cara de golpe isso" ⇒ resposta de SEGURANÇA (nunca cobrança de documento) — em QUALQUER etapa', () => {
    expect(responderTurno(emTriagem(), texto('Cara de golpe isso'))).toBe(
      MENSAGENS_JORNADA.seguranca,
    );
    // Também na identificação e no consentimento.
    expect(responderTurno(fatos(), texto('isso é golpe?'))).toBe(MENSAGENS_JORNADA.seguranca);
    expect(
      responderTurno(fatos({ nome: 'Lucas', cidade: 'Guaramirim' }), texto('parece fraude')),
    ).toBe(MENSAGENS_JORNADA.seguranca);
  });

  it('a mensagem de segurança é profissional: gratuita, sem senhas, site oficial, LGPD — e sem emojis', () => {
    const m = MENSAGENS_JORNADA.seguranca;
    expect(m).toContain('gratuita');
    expect(m).toContain('senhas');
    expect(m).toContain('projetoreconstrua.com.br');
    expect(m).toContain('LGPD');
  });

  it('"Na verdade vou deixar quieto" ⇒ despedida respeitosa; a cobrança CESSA', () => {
    expect(ehDesistencia('Na verdade vou deixar quieto')).toBe(true);
    expect(responderTurno(emTriagem(), texto('Na verdade vou deixar quieto'))).toBe(
      MENSAGENS_JORNADA.despedidaRespeitosa,
    );
  });

  it('depois de desistir: "Obrigada" ⇒ cortesia breve; texto livre ⇒ delega ao LLM (nunca cobrança)', () => {
    expect(responderTurno(emTriagem({ desistiu: true }), texto('Obrigada'))).toBe(
      MENSAGENS_JORNADA.socialCurto,
    );
    expect(responderTurno(emTriagem({ desistiu: true }), texto('vou pensar melhor'))).toBe('');
  });

  it('pergunta LIVRE na triagem ⇒ delega à conversa humana (LLM responde e retoma o foco)', () => {
    expect(responderTurno(emTriagem(), texto('quanto tempo demora a análise?'))).toBe('');
    expect(responderTurno(emTriagem(), texto('como vocês ganham dinheiro com isso?'))).toBe('');
  });

  it('agradecimento curto na triagem ⇒ cortesia breve, nunca a cobrança', () => {
    expect(responderTurno(emTriagem(), texto('Obrigada'))).toBe(MENSAGENS_JORNADA.socialCurto);
    expect(responderTurno(emTriagem(), texto('ok'))).toBe(MENSAGENS_JORNADA.socialCurto);
  });

  it('NENHUMA mensagem autorada contém emoji (tom de consultora jurídica)', () => {
    const todas = [
      MENSAGENS_JORNADA.boasVindas,
      MENSAGENS_JORNADA.pedirNomeECidade,
      MENSAGENS_JORNADA.pedirCidade('X'),
      MENSAGENS_JORNADA.pedirNome,
      MENSAGENS_JORNADA.explicacaoConsentimento('X'),
      MENSAGENS_JORNADA.reforcoConsentimento,
      MENSAGENS_JORNADA.recusa,
      MENSAGENS_JORNADA.iniciarTriagem('X'),
      MENSAGENS_JORNADA.aguardandoDocumento('X'),
      MENSAGENS_JORNADA.ackDocumento,
      MENSAGENS_JORNADA.documentoRegistrado('X', 'Y'),
      MENSAGENS_JORNADA.documentoRegistradoCompleto('X'),
      MENSAGENS_JORNADA.comprovanteConjuge,
      MENSAGENS_JORNADA.adiamentoOk('X'),
      MENSAGENS_JORNADA.adiamentoOkCurto,
      MENSAGENS_JORNADA.documentoNaoIdentificado('X'),
      MENSAGENS_JORNADA.seguranca,
      MENSAGENS_JORNADA.despedidaRespeitosa,
      MENSAGENS_JORNADA.socialCurto,
    ];
    for (const m of todas) {
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(m)).toBe(false);
    }
  });
});
