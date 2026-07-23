// ─────────────────────────────────────────────────────────────────────────────
// SÓCIOS — prova do fluxo convite→CPF+senha→login (identidade por CPF) e do rateio.
// Fail-closed em tudo; convite vinculado ao CPF; convite não reutilizável.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import type { CredencialPortal, CredenciaisStore } from '../portal-auth/advogado-auth.js';
import { SocioAuthRuntime } from './socio-auth.js';
import {
  normalizarCpf,
  formatarCpf,
  percentualLegivel,
  rateioDoSocio,
  type Socio,
  type SocioStore,
} from './socio-model.js';
import { montarPainelDoSocio, somaParticipacoes } from './socio-painel.js';

class MemSocios implements SocioStore {
  private readonly m = new Map<string, Socio>();
  add(s: Socio) {
    this.m.set(s.cpf, s);
  }
  byCpf(cpf: string) {
    return Promise.resolve(this.m.get(cpf) ?? null);
  }
  all() {
    return Promise.resolve([...this.m.values()]);
  }
  save(s: Socio) {
    this.m.set(s.cpf, s);
    return Promise.resolve();
  }
}

class MemCred implements CredenciaisStore {
  private readonly m = new Map<string, CredencialPortal>();
  load(id: string) {
    return Promise.resolve(this.m.get(id) ?? null);
  }
  save(c: CredencialPortal) {
    this.m.set(c.sujeitoId, c);
    return Promise.resolve();
  }
}

const CPF = '39053344705'; // 11 dígitos, não todos iguais
const SECRET = 'segredo-do-painel';
const NOW = new Date('2026-07-23T12:00:00Z');

function ambiente(ativo = true) {
  const socios = new MemSocios();
  socios.add({ cpf: CPF, nome: 'Josmael Rodrigues', percentualBps: 500, ativo, criadoEm: NOW });
  const auth = new SocioAuthRuntime({ socios, credenciais: new MemCred(), secret: SECRET });
  return { socios, auth };
}

describe('normalizarCpf / formatarCpf', () => {
  it('aceita 11 dígitos e ignora pontuação', () => {
    expect(normalizarCpf('390.533.447-05')).toBe('39053344705');
  });
  it('rejeita tamanho errado e dígitos repetidos', () => {
    expect(normalizarCpf('123')).toBeNull();
    expect(normalizarCpf('00000000000')).toBeNull();
  });
  it('formata para exibição', () => {
    expect(formatarCpf('39053344705')).toBe('390.533.447-05');
  });
});

describe('SocioAuthRuntime', () => {
  let env: ReturnType<typeof ambiente>;
  beforeEach(() => {
    env = ambiente();
  });

  it('emite convite só para sócio ativo (e não com segredo vazio)', async () => {
    expect(await env.auth.emitirConvite(CPF, NOW)).not.toBeNull();
    const semSegredo = new SocioAuthRuntime({
      socios: env.socios,
      credenciais: new MemCred(),
      secret: '',
    });
    expect(await semSegredo.emitirConvite(CPF, NOW)).toBeNull();
  });

  it('fluxo feliz: convite → define senha confirmando o CPF → login', async () => {
    const token = (await env.auth.emitirConvite(CPF, NOW)) as string;
    const def = await env.auth.definirSenha(token, '390.533.447-05', 'senhaForte1', NOW);
    expect(def).toEqual({ ok: true, cpf: CPF, nome: 'Josmael Rodrigues' });
    const login = await env.auth.login(CPF, 'senhaForte1');
    expect(login).toEqual({ ok: true, cpf: CPF, nome: 'Josmael Rodrigues' });
  });

  it('CPF digitado diferente do convite ⇒ recusa (não cadastra com CPF de outro)', async () => {
    const token = (await env.auth.emitirConvite(CPF, NOW)) as string;
    const r = await env.auth.definirSenha(token, '11144477735', 'senhaForte1', NOW);
    expect(r.ok).toBe(false);
  });

  it('senha curta é recusada', async () => {
    const token = (await env.auth.emitirConvite(CPF, NOW)) as string;
    const r = await env.auth.definirSenha(token, CPF, 'curta', NOW);
    expect(r.ok).toBe(false);
  });

  it('convite não é reutilizável após a senha ser criada', async () => {
    const token = (await env.auth.emitirConvite(CPF, NOW)) as string;
    await env.auth.definirSenha(token, CPF, 'senhaForte1', NOW);
    const depois = new Date(NOW.getTime() + 1000);
    const r = await env.auth.definirSenha(token, CPF, 'outraSenha2', depois);
    expect(r.ok).toBe(false);
  });

  it('login falha com senha errada e com sócio inativo — erro genérico único', async () => {
    const token = (await env.auth.emitirConvite(CPF, NOW)) as string;
    await env.auth.definirSenha(token, CPF, 'senhaForte1', NOW);
    expect((await env.auth.login(CPF, 'errada')).ok).toBe(false);

    const inativo = ambiente(false);
    expect((await inativo.auth.login(CPF, 'qualquer')).ok).toBe(false);
  });

  it('login nega quem nunca criou senha (só cadastro no diretório não basta)', async () => {
    expect((await env.auth.login(CPF, 'qualquer')).ok).toBe(false);
  });
});

describe('rateio e painel do sócio', () => {
  const socio: Socio = {
    cpf: CPF,
    nome: 'Josmael Rodrigues',
    percentualBps: 500,
    ativo: true,
    criadoEm: NOW,
  };

  it('rateioDoSocio: 5% de R$ 100.000 = R$ 5.000', () => {
    expect(rateioDoSocio(100_000, 500)).toBeCloseTo(5_000, 2);
    expect(rateioDoSocio(100_000, 1_000)).toBeCloseTo(10_000, 2);
  });

  it('percentualLegivel formata inteiros e frações', () => {
    expect(percentualLegivel(500)).toBe('5%');
    expect(percentualLegivel(1_000)).toBe('10%');
    expect(percentualLegivel(1_050)).toBe('10,5%');
  });

  it('painel do sócio traz o valor dele + rateio de referência (cliente 60/adv 20/AHRI 20)', () => {
    const p = montarPainelDoSocio(socio, 100_000, 7);
    expect(p.meuValor).toBeCloseTo(5_000, 2);
    expect(p.percentual).toBe('5%');
    expect(p.clientes).toBe(7);
    expect(p.rateioReferencia.map((f) => f.valor)).toEqual([60_000, 20_000, 20_000]);
  });

  it('somaParticipacoes considera só os ativos', () => {
    const jos: Socio = { ...socio, cpf: '39053344705' };
    const jul: Socio = { ...socio, cpf: '11144477735', percentualBps: 500 };
    const dono: Socio = { ...socio, cpf: '52998224725', percentualBps: 1_000, ativo: false };
    expect(somaParticipacoes([jos, jul, dono])).toBe(1_000);
  });
});
