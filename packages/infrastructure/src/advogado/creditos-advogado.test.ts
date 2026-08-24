// CARTEIRA DE CRÉDITOS — isto é dinheiro do parceiro. O estorno nasceu do caso
// real de um cliente encaminhado ao advogado errado: sem ele, o advogado que
// perdeu o cliente continuava pagando por alguém que não tem.
import { describe, expect, it } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { CreditosAdvogadoService } from './creditos-advogado.js';

const clock = { now: () => new Date('2026-08-12T12:00:00.000Z') };
const novo = (): CreditosAdvogadoService =>
  new CreditosAdvogadoService({ json: new InMemoryJsonStore(), clock });

const JOELCIO = { clienteId: 'cli-joelcio', nome: 'JOELCIO ALVES DE OLIVEIRA' };

describe('CreditosAdvogadoService — estorno', () => {
  it('devolve ao advogado antigo exatamente o que foi abatido', async () => {
    const c = novo();
    await c.registrarCompra('adv-errado', 200);
    await c.abaterPorCliente('adv-errado', JOELCIO, 7);
    expect((await c.saldo('adv-errado')).saldo).toBe(193);

    const r = await c.estornarPorCliente('adv-errado', JOELCIO.clienteId, 'transferido');
    expect(r.estornados).toBe(7);

    const saldo = await c.saldo('adv-errado');
    expect(saldo.saldo).toBe(200); // inteiro de novo
    expect(saldo.abatidos).toBe(0);
    expect(saldo.clientesAbatidos).toBe(0); // ele não tem mais este cliente
  });

  it('não estorna duas vezes o mesmo cliente', async () => {
    const c = novo();
    await c.registrarCompra('adv-errado', 100);
    await c.abaterPorCliente('adv-errado', JOELCIO, 5);
    expect((await c.estornarPorCliente('adv-errado', JOELCIO.clienteId, 'x')).estornados).toBe(5);
    expect((await c.estornarPorCliente('adv-errado', JOELCIO.clienteId, 'x')).estornados).toBe(0);
    expect((await c.saldo('adv-errado')).saldo).toBe(100);
  });

  it('não devolve crédito de quem nunca foi abatido', async () => {
    const c = novo();
    await c.registrarCompra('adv-inocente', 50);
    const r = await c.estornarPorCliente('adv-inocente', JOELCIO.clienteId, 'x');
    expect(r.estornados).toBe(0);
    expect((await c.saldo('adv-inocente')).saldo).toBe(50);
  });

  it('a transferência inteira: sai de um, entra no outro', async () => {
    const c = novo();
    await c.registrarCompra('adv-errado', 100);
    await c.registrarCompra('rubens', 100);
    await c.abaterPorCliente('adv-errado', JOELCIO, 7);

    await c.estornarPorCliente('adv-errado', JOELCIO.clienteId, 'transferido para Rubens');
    await c.abaterPorCliente('rubens', JOELCIO, 7);

    expect((await c.saldo('adv-errado')).saldo).toBe(100);
    expect((await c.saldo('rubens')).saldo).toBe(93);
    expect((await c.saldo('rubens')).clientesAbatidos).toBe(1);
  });

  it('o extrato guarda a história inteira — nada é apagado', async () => {
    const c = novo();
    await c.registrarCompra('adv-errado', 100);
    await c.abaterPorCliente('adv-errado', JOELCIO, 7);
    await c.estornarPorCliente('adv-errado', JOELCIO.clienteId, 'transferido para Rubens');

    const extrato = await c.extrato('adv-errado');
    expect(extrato.map((l) => l.tipo).sort()).toEqual(['abate', 'compra', 'estorno']);
    const estorno = extrato.find((l) => l.tipo === 'estorno');
    expect(estorno?.motivo).toBe('transferido para Rubens');
    expect(estorno?.nome).toBe(JOELCIO.nome); // o advogado vê de quem se trata
  });
});

// ── AUDITORIA DE ABATES (2026-08-24, pós-caso Juvenal): a régua mudou e o
// abate idempotente não se corrige sozinho — o ajuste lança a DIFERENÇA.
describe('ajustarPorCliente — o acerto à régua atual', () => {
  it('régua maior ⇒ complemento de abate só da diferença', async () => {
    const c = novo();
    await c.registrarCompra('adv', 100);
    await c.abaterPorCliente('adv', JOELCIO, 3); // a régua antiga
    const r = await c.ajustarPorCliente('adv', JOELCIO, 5, 'auditoria: régua nova (RMC/RCC)');
    expect(r).toEqual({ ok: true, ajuste: 2 });
    const s = await c.saldo('adv');
    expect(s.abatidos).toBe(5);
    expect(s.saldo).toBe(95);
    expect(s.clientesAbatidos).toBe(1); // dois lançamentos, UM cliente
  });

  it('régua menor ⇒ estorno parcial da diferença', async () => {
    const c = novo();
    await c.registrarCompra('adv', 100);
    await c.abaterPorCliente('adv', JOELCIO, 7);
    const r = await c.ajustarPorCliente('adv', JOELCIO, 5, 'auditoria');
    expect(r).toEqual({ ok: true, ajuste: -2 });
    expect((await c.saldo('adv')).abatidos).toBe(5);
  });

  it('já na régua ⇒ nenhum lançamento', async () => {
    const c = novo();
    await c.registrarCompra('adv', 100);
    await c.abaterPorCliente('adv', JOELCIO, 5);
    expect(await c.ajustarPorCliente('adv', JOELCIO, 5, 'x')).toEqual({ ok: true, ajuste: 0 });
    expect((await c.extrato('adv')).length).toBe(2); // compra + abate, nada novo
  });

  it('cliente que NUNCA foi abatido não é ajustado (não é dele)', async () => {
    const c = novo();
    await c.registrarCompra('adv', 100);
    const r = await c.ajustarPorCliente('adv', JOELCIO, 5, 'x');
    expect(r.ok).toBe(false);
    expect((await c.saldo('adv')).saldo).toBe(100);
  });

  it('o ajuste é idempotente: rodar a auditoria duas vezes não lança de novo', async () => {
    const c = novo();
    await c.registrarCompra('adv', 100);
    await c.abaterPorCliente('adv', JOELCIO, 3);
    await c.ajustarPorCliente('adv', JOELCIO, 5, 'auditoria');
    expect(await c.ajustarPorCliente('adv', JOELCIO, 5, 'auditoria')).toEqual({
      ok: true,
      ajuste: 0,
    });
  });
});
