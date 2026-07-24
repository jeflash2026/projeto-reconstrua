import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { PericiaFluxoService } from './pericia-fluxo-service.js';

function clockDe(refs: { now: Date }) {
  return { now: () => refs.now };
}

describe('PericiaFluxoService', () => {
  it('baixar inicia a perícia (idempotente) e começa os 10 dias', async () => {
    const refs = { now: new Date('2026-07-24T12:00:00Z') };
    const svc = new PericiaFluxoService({ json: new InMemoryJsonStore(), clock: clockDe(refs) });

    const a = await svc.iniciar('c1@w', 'cli-1', 'Maria');
    expect(a).toEqual({ ok: true, jaEstava: false });
    // Idempotente: baixar de novo NÃO reinicia o prazo.
    const b = await svc.iniciar('c1@w', 'cli-1', 'Maria');
    expect(b.jaEstava).toBe(true);

    const emAndamento = await svc.emAndamento();
    expect(emAndamento).toHaveLength(1);
    expect(emAndamento[0]?.diasRestantes).toBe(10); // no instante do início: 10 dias cheios
    expect(emAndamento[0]?.expirado).toBe(false);
  });

  it('credenciais e resposta do banco são guardadas', async () => {
    const refs = { now: new Date('2026-07-24T12:00:00Z') };
    const svc = new PericiaFluxoService({ json: new InMemoryJsonStore(), clock: clockDe(refs) });
    await svc.iniciar('c1@w', 'cli-1', 'Maria');
    await svc.salvarCredenciais('c1@w', {
      email: 'maria@x.com',
      senha: 'segredo1',
      provedor: 'Meu INSS',
    });
    await svc.salvarRespostaBanco('c1@w', 'Banco negou; segue para judicial.');
    const r = await svc.registro('c1@w');
    expect(r?.credenciais?.email).toBe('maria@x.com');
    expect(r?.respostaBanco?.texto).toBe('Banco negou; segue para judicial.');
    // Sem perícia iniciada, salvar credenciais recusa.
    expect((await svc.salvarCredenciais('inexistente', r!.credenciais!)).ok).toBe(false);
  });

  it('após 10 dias vira CONCLUÍDA (sai de andamento, entra em concluídas)', async () => {
    const refs = { now: new Date('2026-07-24T12:00:00Z') };
    const svc = new PericiaFluxoService({ json: new InMemoryJsonStore(), clock: clockDe(refs) });
    await svc.iniciar('c1@w', 'cli-1', 'Maria');
    // Avança 11 dias.
    refs.now = new Date('2026-08-04T12:00:00Z');
    expect(await svc.emAndamento()).toHaveLength(0);
    const concluidas = await svc.concluidas();
    expect(concluidas).toHaveLength(1);
    expect(concluidas[0]?.expirado).toBe(true);
  });
});
