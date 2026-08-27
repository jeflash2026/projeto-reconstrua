// ─────────────────────────────────────────────────────────────────────────────
// CORVO CLIENT — o contrato HTTP do envio: 200 E 201 são sucesso (o remerge de
// cliente existente responde 200 — em produção isso marcava ERRO num envio que
// deu certo); 400/401/413 permanentes; 409 pede chave nova; 5xx transitório.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { CorvoClient } from './corvo-client.js';

const CORPO_OK = {
  importacaoId: 'imp-1',
  modo: 'mesclar',
  clientes: [],
  contratos_novos: 0,
  ignorados: [],
  leitura_hiscon: { status: 'OK' },
};

function clientCom(status: number, corpo: unknown = CORPO_OK): CorvoClient {
  const fetchFalso = (): Promise<Response> =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(corpo),
      text: () => Promise.resolve(JSON.stringify(corpo)),
    } as unknown as Response);
  return new CorvoClient({ baseUrl: 'https://corvo.teste', apiKey: 'k' }, fetchFalso);
}

describe('CorvoClient.enviarZip — status do contrato', () => {
  it('201 (criação) é sucesso', async () => {
    const r = await clientCom(201).enviarZip(Buffer.from('PK'), 'key-1');
    expect(r.ok).toBe(true);
  });

  it('REGRESSÃO (produção 2026-08-27): 200 (remerge de cliente existente) é sucesso', async () => {
    const r = await clientCom(200).enviarZip(Buffer.from('PK'), 'key-1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.corpo.importacaoId).toBe('imp-1');
  });

  it('400 é permanente; 409 pede chave nova; 500 é transitório', async () => {
    const r400 = await clientCom(400, { message: 'zip inválido' }).enviarZip(
      Buffer.from('PK'),
      'k',
    );
    expect(r400).toMatchObject({ ok: false, permanente: true, conflitoDeChave: false });
    const r409 = await clientCom(409, {}).enviarZip(Buffer.from('PK'), 'k');
    expect(r409).toMatchObject({ ok: false, permanente: false, conflitoDeChave: true });
    const r500 = await clientCom(500, {}).enviarZip(Buffer.from('PK'), 'k');
    expect(r500).toMatchObject({ ok: false, permanente: false, conflitoDeChave: false });
  });
});
