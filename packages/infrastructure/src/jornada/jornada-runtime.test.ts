// ─────────────────────────────────────────────────────────────────────────────
// JORNADA COMERCIAL RUNTIME + EXPRESSÃO GOVERNADA — o FUNIL INTEIRO, ponta a
// ponta e determinístico, reproduzindo a conversa real das rodadas de teste:
//   "Boa noite" → boas-vindas → "Isabel" → pede a CIDADE → "Santa Ernestina" →
//   explicação+interesse → "sim" → triagem RG → docs → CONCLUIDA (LLM volta).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { PhrasingRequest } from '@reconstrua/application';
import {
  MENSAGENS_JORNADA,
  ObservabilityRuntime,
  OnboardingDocumentalRuntime,
} from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonOnboardingDocumentalStore } from '../onboarding/json-onboarding-store.js';
import { JornadaComercialRuntime } from './jornada-runtime.js';
import { JourneyGovernedExpression } from './journey-governed-expression.js';

const NOW = new Date('2026-07-20T21:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

function harness() {
  const json = new InMemoryJsonStore();
  const textos: Record<string, string | null> = {};
  const onboarding = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(json),
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: null,
  });
  const jornada = new JornadaComercialRuntime({
    json,
    onboarding,
    observability: new ObservabilityRuntime(),
    clock: new TestClock(),
  });
  const expression = new JourneyGovernedExpression(jornada, {
    phrase: () => Promise.resolve('RESPOSTA-DO-LLM'),
  });

  const request = (
    texto: string | null,
    opts: { turns?: number; arquivo?: boolean } = {},
  ): PhrasingRequest =>
    ({
      intent: {
        id: 'i1',
        chatId: CHAT,
        directive: 'speak',
        speechAct: 'inform',
        topic: 't',
        references: [],
        urgency: 'normal',
        operationalRuleRef: 'RO',
        fundamento: 'f',
        timingHintMs: null,
        formedAt: NOW,
      },
      context: {
        chatId: CHAT,
        session: {
          chatId: CHAT,
          turns: opts.turns ?? 3,
          lastInboundAt: null,
          lastOutboundAt: null,
        },
        recentEntries: [],
        recentOutboundTexts: [],
        lastPercept: {
          envelope: {
            text: texto,
            fileName: opts.arquivo ? 'IMG_1.jpg' : null,
            mediaUrl: opts.arquivo ? 'https://wa/m' : null,
          },
        },
        silenceMs: null,
      },
      avoidPhrases: [],
      styleGuidance: 'qualquer',
    }) as unknown as PhrasingRequest;

  /** Um turno completo: captura (pré-hook) + resposta (expressão governada). */
  const turno = async (texto: string, opts: { turns?: number } = {}): Promise<string> => {
    await jornada.aoReceberTexto(CHAT, texto, NOW);
    return expression.phrase(request(texto, opts));
  };

  return { json, textos, onboarding, jornada, expression, request, turno };
}

describe('o FUNIL REAL, determinístico de ponta a ponta', () => {
  it('reproduz a conversa das rodadas de teste — sem nenhuma decisão de LLM', async () => {
    const h = harness();

    // "Boa noite" (primeiro contato) ⇒ boas-vindas completas.
    expect(await h.turno('Boa noite', { turns: 1 })).toBe(MENSAGENS_JORNADA.boasVindas);
    expect(await h.jornada.etapa(CHAT)).toBe('IDENTIFICACAO');

    // "Isabel" ⇒ a resposta DO DECRETO: "Prazer, Isabel! E de qual cidade você fala?"
    expect(await h.turno('Isabel')).toBe(MENSAGENS_JORNADA.pedirCidade('Isabel'));

    // "Santa Ernestina" ⇒ identificação completa ⇒ explicação + pergunta de interesse.
    const explicacao = await h.turno('Santa Ernestina');
    expect(explicacao).toContain('interesse em fazer essa análise');
    expect(await h.jornada.etapa(CHAT)).toBe('CONSENTIMENTO');

    // "sim" ⇒ consentimento registrado ⇒ triagem começa pelo HISCON (decreto
    // HISCON-ONLY): sem onboarding semeado, o padrão é o HISCON, NUNCA RG/CNH.
    const inicio = await h.turno('sim');
    expect(inicio).toContain('apenas UM documento');
    expect(inicio).toContain('HISCON (histórico de empréstimos consignados do INSS)');
    expect(await h.jornada.etapa(CHAT)).toBe('TRIAGEM');

    // Documento chega ⇒ ack autorado (a progressão automática pede o próximo).
    expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toBe(
      MENSAGENS_JORNADA.ackDocumento,
    );

    // Registra CNH + comprovante + HISCON (a contabilidade real) ⇒ CONCLUIDA.
    h.textos['d1'] = 'carteira nacional de habilitação';
    h.textos['d2'] = 'fatura de energia elétrica';
    h.textos['d3'] = 'histórico de empréstimo consignado';
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'a.jpg', NOW);
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'b.jpg', NOW);
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd3', 'c.pdf', NOW);
    expect(await h.jornada.etapa(CHAT)).toBe('CONCLUIDA');

    // CONCLUIDA ⇒ a expressão DELEGA ao LLM (análise/pós-venda humanizados).
    expect(await h.expression.phrase(h.request('obrigada'))).toBe('RESPOSTA-DO-LLM');
  });

  it('"Isabel, sou de santa ernestina- SP" numa mensagem só ⇒ pula direto para a explicação', async () => {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    const r = await h.turno('Isabel, sou de santa ernestina- SP');
    expect(r).toContain('interesse em fazer essa análise');
  });

  it('recusa ⇒ despedida gentil; novo "sim" depois reativa a triagem', async () => {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    await h.turno('Isabel, de Santa Ernestina');
    expect(await h.turno('não quero agora')).toBe(MENSAGENS_JORNADA.recusa);
    const r = await h.turno('pensei melhor, quero sim');
    expect(r).toContain('apenas UM documento');
  });

  it('falha do store da jornada JAMAIS silencia: delega ao LLM', async () => {
    const json = new InMemoryJsonStore();
    const onboarding = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(json),
      leitor: null,
      pendencias: null,
    });
    const quebrada = new JornadaComercialRuntime({
      json: {
        get: () => Promise.reject(new Error('pg down')),
        put: () => Promise.reject(new Error('pg down')),
        del: () => Promise.reject(new Error('pg down')),
        list: () => Promise.reject(new Error('pg down')),
        keys: () => Promise.reject(new Error('pg down')),
      },
      onboarding,
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
    });
    const expression = new JourneyGovernedExpression(quebrada, {
      phrase: () => Promise.resolve('LLM-FALLBACK'),
    });
    const h = harness();
    expect(await expression.phrase(h.request('oi'))).toBe('LLM-FALLBACK');
  });
});
