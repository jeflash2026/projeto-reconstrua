// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE 9C — RELACIONAMENTO ≠ ONBOARDING. A prova decretada: um simples "Olá"
// NÃO gera nenhuma suposição operacional (nem missão, nem cadastro, nem coleta).
// Onboarding só nasce de FATO: pedido percebido (service_request) ou documento.
// Pipeline REAL (percepção→Brain→missão→resposta) com os doubles determinísticos.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { InboundEnvelope } from '@reconstrua/application';
import { buildFacts, emptySnapshot, PACOTE_SEM_CASO } from '@reconstrua/application';
import { assembleAdvogadoOperation, FakeSleeper, InMemoryConversationGateway } from '../index.js';

class TestClock implements Clock {
  private t = new Date('2026-07-19T12:00:00.000Z');
  now(): Date { return new Date(this.t.getTime()); }
  advance(ms: number): void { this.t = new Date(this.t.getTime() + ms); }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid { this.n += 1; return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`); }
}

const CHAT = '5517996332346@s.whatsapp.net';
function envelope(text: string, messageId: string): InboundEnvelope {
  return {
    messageId, chatId: CHAT, from: CHAT, kind: 'text', text,
    mediaUrl: null, mediaMimeType: null, fileName: null, location: null, contact: null,
    reactionEmoji: null, reactionToMessageId: null, editedText: null, deletedMessageId: null,
    silenceMs: null, timestamp: new Date('2026-07-19T12:00:00.000Z'),
  };
}

function harness() {
  const clock = new TestClock();
  const gateway = new InMemoryConversationGateway(clock);
  const op = assembleAdvogadoOperation({ clock, uuid: new SeqUuid(), gateway, sleeper: new FakeSleeper(clock) });
  return { op, gateway };
}

describe('GO-LIVE 9C · "Olá" não promove relacionamento a onboarding', () => {
  it('"Olá" (e conversa social) ⇒ ZERO missões; a AHRI responde como quem acabou de conhecer', async () => {
    const { op, gateway } = harness();
    await op.conversation.receive(envelope('Olá', 'M1'));
    await op.conversation.receive(envelope('oi, tudo bem?', 'M2'));
    await op.projector.refresh();

    // NENHUMA suposição operacional: missão não existe.
    expect(op.projector.missions()).toHaveLength(0);
    // A relação vive: a AHRI respondeu (conversa), sem operação.
    expect(gateway.texts().length).toBeGreaterThanOrEqual(1);
  });

  // GO-LIVE 9D — a MENOR resposta verdadeira: "Olá" gera APENAS a saudação.
  it('9D: "Olá" ⇒ UMA única mensagem, sem NENHUMA palavra operacional', async () => {
    const { op, gateway } = harness();
    await op.conversation.receive(envelope('Olá', 'M1'));

    const textos = gateway.texts();
    expect(textos).toHaveLength(1); // uma saudação — nada mais
    // Nenhuma etapa operacional inventada na resposta:
    expect(textos[0]).not.toMatch(/cadastro|registro|coleta|document|análise|analis|qualifica|processo|organizando/i);
  });

  it('PEDIDO ("quero dar entrada na aposentadoria") ⇒ missão nasce (onboarding por FATO)', async () => {
    const { op } = harness();
    await op.conversation.receive(envelope('Olá', 'M1'));
    await op.projector.refresh();
    expect(op.projector.missions()).toHaveLength(0); // ainda relação

    await op.conversation.receive(envelope('quero dar entrada na minha aposentadoria', 'M2'));
    await op.projector.refresh();
    expect(op.projector.missions()).toHaveLength(1); // fato ⇒ onboarding
  });

  it('DOCUMENTO sem atendimento aberto ⇒ missão nasce (pedido implícito por artefato)', async () => {
    const { op } = harness();
    await op.conversation.receive({ ...envelope('', 'M1'), kind: 'pdf', text: null, fileName: 'rg.pdf', mediaMimeType: 'application/pdf' });
    await op.projector.refresh();
    expect(op.projector.missions()).toHaveLength(1);
  });
});

describe('GO-LIVE 9C · fatos e ausência declarada', () => {
  const TEXTO = { kind: 'text', sentiment: 'neutral', urgency: 'normal', hasArtifacts: false, artifactCount: 0, silenceMs: null } as const;

  it('onboardingExists/Phase/Truth derivam SÓ do snapshot (domínio)', () => {
    const sem = buildFacts({ ...TEXTO, purpose: 'greeting' }, emptySnapshot('c1'), { turnCount: 9, lastOutboundAgoMs: 5 });
    expect(sem['onboardingExists']).toBe(false);
    expect(sem['onboardingPhase']).toBe('inexistente'); // 9 turnos de conversa NÃO mudam isso
    const cadastro = buildFacts(TEXTO, { ...emptySnapshot('m1'), caseExists: true }, { turnCount: 2, lastOutboundAgoMs: null });
    expect(cadastro['onboardingPhase']).toBe('cadastro');
    const qualificado = buildFacts(TEXTO, { ...emptySnapshot('m1'), caseExists: true, truthEstablished: true }, { turnCount: 2, lastOutboundAgoMs: null });
    expect(qualificado['onboardingPhase']).toBe('qualificado');
    expect(qualificado['onboardingTruth']).toBe(true);
  });

  it('perceptPurpose ausente/degrade ⇒ unknown ⇒ onboarding NÃO dispara (fail-safe)', () => {
    const f = buildFacts(TEXTO, emptySnapshot('c1'), { turnCount: 1, lastOutboundAgoMs: null });
    expect(f['perceptPurpose']).toBe('unknown');
  });

  it('a ausência de onboarding é FATO declarado no pacote (nunca silêncio p/ o LLM)', () => {
    expect(PACOTE_SEM_CASO).toContain('nenhum cadastro ou atendimento foi iniciado');
    expect(PACOTE_SEM_CASO).toContain('nada está sendo organizado, coletado ou analisado');
    expect(PACOTE_SEM_CASO).toContain('apenas conversando');
  });
});
