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
});
