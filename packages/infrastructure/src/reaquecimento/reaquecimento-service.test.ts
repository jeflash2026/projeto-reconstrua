// ─────────────────────────────────────────────────────────────────────────────
// Testes do ReaquecimentoService — lista só os FRIOS (24h+, não concluídos),
// reaquecer exige lead válido + guardrails, envia a mensagem do estágio e
// registra a tentativa; NADA dispara sem a chamada explícita (autorização).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { novaJornada, type FatosDaJornada, type JornadaRecord } from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { ReaquecimentoService } from './reaquecimento-service.js';

const NOW = new Date('2026-07-22T12:00:00.000Z');
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

function fatosDe(registro: JornadaRecord, docs = 0, completos = false): FatosDaJornada {
  return {
    registro,
    docsRecebidos: docs,
    docsCompletos: completos,
    proximoDocumento: 'comprovante de endereço',
    ultimoRegistrado: null,
    ultimoRegistroEm: null,
  };
}

function harness(leads: Record<string, FatosDaJornada>): {
  service: ReaquecimentoService;
  enviados: { chatId: string; texto: string }[];
  json: InMemoryJsonStore;
} {
  const json = new InMemoryJsonStore();
  for (const chatId of Object.keys(leads)) void json.put('jornada', chatId, { chatId });
  const enviados: { chatId: string; texto: string }[] = [];
  const service = new ReaquecimentoService({
    json,
    jornada: {
      fatos: (chatId) => {
        const f = leads[chatId];
        if (!f) return Promise.reject(new Error('sem jornada'));
        return Promise.resolve(f);
      },
    },
    enviar: (chatId, texto) => {
      enviados.push({ chatId, texto });
      return Promise.resolve();
    },
    clock: new TestClock(),
  });
  return { service, enviados, json };
}

const ONTEM = new Date(NOW.getTime() - 30 * 3_600_000);
const AGORA_MESMO = new Date(NOW.getTime() - 3_600_000);

describe('ReaquecimentoService', () => {
  it('lista só os FRIOS: 24h+ parados e jornada não concluída', async () => {
    const { service } = harness({
      frio: fatosDe({ ...novaJornada('frio', ONTEM), nome: 'Denise' }, 2),
      quente: fatosDe(novaJornada('quente', AGORA_MESMO)),
      concluido: fatosDe(novaJornada('concluido', ONTEM), 4, true),
    });
    const leads = await service.leadsFrios();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      chatId: 'frio',
      nome: 'Denise',
      estagio: 'DOCS_PARCIAIS',
      podeReaquecer: true,
    });
  });

  it('reaquecer AUTORIZADO envia a mensagem do estágio e registra a tentativa', async () => {
    const { service, enviados } = harness({
      frio: fatosDe({ ...novaJornada('frio', ONTEM), nome: 'Denise Rondora' }, 2),
    });
    const r = await service.reaquecer('frio');
    expect(r).toMatchObject({ ok: true, estagio: 'DOCS_PARCIAIS' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.texto).toContain('Olá, Denise!');
    expect(enviados[0]?.texto).toContain('comprovante de endereço');
    // A tentativa registrada aparece na lista e BLOQUEIA nova tentativa <24h.
    const leads = await service.leadsFrios();
    expect(leads[0]).toMatchObject({ tentativas: 1, podeReaquecer: false });
    const denovo = await service.reaquecer('frio');
    expect(denovo.ok).toBe(false);
    expect(enviados).toHaveLength(1); // NÃO enviou de novo
  });

  it('lead inexistente e jornada concluída são recusados', async () => {
    const { service, enviados } = harness({
      concluido: fatosDe(novaJornada('concluido', ONTEM), 4, true),
    });
    expect((await service.reaquecer('fantasma')).ok).toBe(false);
    expect((await service.reaquecer('concluido')).ok).toBe(false);
    expect(enviados).toHaveLength(0);
  });
});

describe('varreduraRetomada (conversas caídas — automática, com guardrails)', () => {
  function harnessRetomada(
    leads: Record<string, FatosDaJornada>,
    semResposta: Record<string, number | null>,
  ) {
    const json = new InMemoryJsonStore();
    for (const chatId of Object.keys(leads)) void json.put('jornada', chatId, { chatId });
    const enviados: { chatId: string; texto: string }[] = [];
    const service = new ReaquecimentoService({
      json,
      jornada: {
        fatos: (chatId) => {
          const f = leads[chatId];
          if (!f) return Promise.reject(new Error('sem jornada'));
          return Promise.resolve(f);
        },
      },
      enviar: (chatId, texto) => {
        enviados.push({ chatId, texto });
        return Promise.resolve();
      },
      clock: new TestClock(),
      minutosSemResposta: (chatId) => Promise.resolve(semResposta[chatId] ?? null),
    });
    return { service, enviados };
  }

  it('retoma SÓ a conversa caída (30min+ sem resposta); respondida e recente ficam quietas', async () => {
    const { service, enviados } = harnessRetomada(
      {
        caida: fatosDe({ ...novaJornada('caida', ONTEM), nome: 'Maria' }, 1),
        respondida: fatosDe(novaJornada('respondida', ONTEM), 1),
        recente: fatosDe(novaJornada('recente', ONTEM), 1),
      },
      { caida: 45, respondida: null, recente: 10 },
    );
    const n = await service.varreduraRetomada(NOW);
    expect(n).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.chatId).toBe('caida');
    expect(enviados[0]?.texto).toContain('Desculpe a demora');
  });

  it('guardrail: segunda varredura no MESMO dia não reenvia; desistiu nunca é retomado automaticamente', async () => {
    const { service, enviados } = harnessRetomada(
      {
        caida: fatosDe({ ...novaJornada('caida', ONTEM), nome: 'M' }, 1),
        desistente: fatosDe({ ...novaJornada('desistente', ONTEM), desistiu: true }, 1),
      },
      { caida: 45, desistente: 90 },
    );
    await service.varreduraRetomada(NOW);
    const n2 = await service.varreduraRetomada(NOW);
    expect(n2).toBe(0);
    expect(enviados).toHaveLength(1); // só a caída, só uma vez
    expect(enviados.some((e) => e.chatId === 'desistente')).toBe(false);
  });

  // ── FOLLOW-UP DE CPF (caso real 51 9109-4367: mensagem DUPLICADA às 09:02) ──
  const NOVE_BRT = new Date('2026-07-27T12:30:00.000Z'); // 09:30 em São Paulo

  it('varreduraCpf: só quem entregou o HISCON e não tem CPF; nunca repete', async () => {
    const { service, enviados } = harness({
      'sem-cpf': fatosDe(novaJornada('sem-cpf', ONTEM), 1, true),
      'com-cpf': fatosDe({ ...novaJornada('com-cpf', ONTEM), cpf: '52998224725' }, 1, true),
      incompleto: fatosDe(novaJornada('incompleto', ONTEM), 0, false),
    });
    expect(await service.varreduraCpf(NOVE_BRT)).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.chatId).toBe('sem-cpf');
    expect(enviados[0]?.texto).toContain('CPF');
    // Segunda varredura no mesmo dia ⇒ nada (registro já existe).
    expect(await service.varreduraCpf(NOVE_BRT)).toBe(0);
    expect(enviados).toHaveLength(1);
  });

  it('varreduraCpf: REGISTRA antes de enviar e varreduras SIMULTÂNEAS não duplicam', async () => {
    // Reproduz o 09:02 duplicado: dois ticks disparam a varredura ao mesmo
    // tempo. A trava de reentrância + claim-then-send garantem UM envio.
    const json = new InMemoryJsonStore();
    await json.put('jornada', 'cliente', { chatId: 'cliente' });
    const enviados: string[] = [];
    const service = new ReaquecimentoService({
      json,
      jornada: {
        fatos: () => Promise.resolve(fatosDe(novaJornada('cliente', ONTEM), 1, true)),
      },
      enviar: async (chatId) => {
        // CLAIM-BEFORE-SEND: no momento do envio, o registro JÁ deve existir.
        expect(await json.get('followup-cpf', chatId)).not.toBe(null);
        await new Promise((r) => setTimeout(r, 20)); // envio lento (janela da corrida)
        enviados.push(chatId);
      },
      clock: new TestClock(),
    });
    const [a, b] = await Promise.all([
      service.varreduraCpf(NOVE_BRT),
      service.varreduraCpf(NOVE_BRT),
    ]);
    expect(a + b).toBe(1); // exatamente UM envio, nunca dois
    expect(enviados).toHaveLength(1);
  });

  it('varreduraCpf: fora da janela das 09:00 (BRT) não dispara', async () => {
    const { service, enviados } = harness({
      'sem-cpf': fatosDe(novaJornada('sem-cpf', ONTEM), 1, true),
    });
    const QUINZE_BRT = new Date('2026-07-27T18:00:00.000Z');
    expect(await service.varreduraCpf(QUINZE_BRT)).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  // ── COBRANÇA MANUAL DE CPF (decreto 2026-07-27: lote na aba Clientes) ──────
  it('cobrarCpf: envia a mensagem canônica a quem tem HISCON sem CPF; regras duras', async () => {
    const { service, enviados } = harness({
      'sem-cpf': fatosDe(novaJornada('sem-cpf', ONTEM), 1, true),
      'com-cpf': fatosDe({ ...novaJornada('com-cpf', ONTEM), cpf: '52998224725' }, 1, true),
      'sem-hiscon': fatosDe(novaJornada('sem-hiscon', ONTEM), 0, false),
    });
    // Elegível: envia e registra.
    expect(await service.cobrarCpf('sem-cpf')).toEqual({ ok: true });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.texto).toContain('CPF');
    // Trava de 24h: segunda cobrança no mesmo dia é recusada.
    const denovo = await service.cobrarCpf('sem-cpf');
    expect(denovo.ok).toBe(false);
    if (!denovo.ok) expect(denovo.error).toContain('24h');
    // CPF já registrado e HISCON ausente são recusas — nunca spam.
    expect((await service.cobrarCpf('com-cpf')).ok).toBe(false);
    expect((await service.cobrarCpf('sem-hiscon')).ok).toBe(false);
    expect(enviados).toHaveLength(1); // só o primeiro envio aconteceu
  });
});
