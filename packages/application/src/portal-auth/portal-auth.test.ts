// ─────────────────────────────────────────────────────────────────────────────
// AUTH RUNTIME COMPARTILHADO (GO-LIVE-04) — auditoria de segurança automatizada:
// tokens (assinatura/uso/expiração/segredo), senhas (hash forte/verificação) e o
// provider do advogado (convite→senha→login) com TODO caminho fail-closed:
// cadastro público impossível, criação pela URL impossível, credencial forjada
// impossível, erro único no login (nunca vaza qual fator falhou).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { StaffMember, StaffStore } from '../admin-portal/staff-directory.js';
import { assinarTokenPortal, validarTokenPortal } from './auth-tokens.js';
import { hashSenha, verificarSenha } from './senha.js';
import {
  AdvogadoAuthRuntime,
  type CredencialPortal,
  type CredenciaisStore,
} from './advogado-auth.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const SECRET = 'segredo-do-portal';

describe('Tokens assinados por USO (base comum de todos os portais)', () => {
  it('emite e valida; sujeito atravessa íntegro', () => {
    const t = assinarTokenPortal('adv-1', 'convite-advogado', 7, NOW, SECRET);
    expect(validarTokenPortal(t, 'convite-advogado', NOW, SECRET)).toBe('adv-1');
  });
  it('FAIL-CLOSED: uso errado, segredo errado, expirado, adulterado, vazio ⇒ null', () => {
    const t = assinarTokenPortal('adv-1', 'convite-advogado', 7, NOW, SECRET);
    expect(validarTokenPortal(t, 'sessao-admin', NOW, SECRET)).toBeNull(); // uso errado
    expect(validarTokenPortal(t, 'convite-advogado', NOW, 'outro')).toBeNull(); // segredo errado
    const depois = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect(validarTokenPortal(t, 'convite-advogado', depois, SECRET)).toBeNull(); // expirado
    const [p] = t.split('.');
    expect(validarTokenPortal(`${p ?? ''}.deadbeef`, 'convite-advogado', NOW, SECRET)).toBeNull(); // MAC adulterado
    expect(validarTokenPortal('', 'convite-advogado', NOW, SECRET)).toBeNull();
    expect(validarTokenPortal(t, 'convite-advogado', NOW, '')).toBeNull(); // sem segredo no servidor
  });
});

describe('Senhas (scrypt + salt; nunca em claro)', () => {
  it('hash verifica a senha certa e rejeita a errada; salts únicos', () => {
    const h1 = hashSenha('minha-senha-forte');
    const h2 = hashSenha('minha-senha-forte');
    expect(h1).not.toBe(h2); // salt aleatório
    expect(h1.startsWith('s1:')).toBe(true);
    expect(h1).not.toContain('minha-senha-forte');
    expect(verificarSenha('minha-senha-forte', h1)).toBe(true);
    expect(verificarSenha('outra', h1)).toBe(false);
    expect(verificarSenha('', h1)).toBe(false);
    expect(verificarSenha('x', 'lixo-nao-versionado')).toBe(false);
  });
});

function harness(members: StaffMember[]) {
  const creds = new Map<string, CredencialPortal>();
  const staff: StaffStore = {
    save: () => Promise.resolve(),
    byId: (id) => Promise.resolve(members.find((m) => m.id === id) ?? null),
    byRole: () => Promise.resolve([]),
    all: () => Promise.resolve(members),
    byCpf: (cpf) => Promise.resolve(members.find((m) => (m.cpf ?? null) === cpf) ?? null),
  };
  const credenciais: CredenciaisStore = {
    load: (id) => Promise.resolve(creds.get(id) ?? null),
    save: (c) => {
      creds.set(c.sujeitoId, c);
      return Promise.resolve();
    },
  };
  return { auth: new AdvogadoAuthRuntime({ staff, credenciais, secret: SECRET }), creds };
}

function member(over: Partial<StaffMember>): StaffMember {
  return {
    id: 'adv-1',
    role: 'advogado',
    name: 'Ana Lima',
    email: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe('AdvogadoAuthRuntime · convite → senha → login (fail-closed em tudo)', () => {
  it('fluxo completo: convite do escritório → cria senha → login individual', async () => {
    const { auth, creds } = harness([member({})]);
    const convite = await auth.emitirConvite('adv-1', NOW);
    expect(convite).not.toBeNull();
    const definida = await auth.definirSenha(convite ?? '', 'senha-da-ana-123', NOW);
    expect(definida.ok).toBe(true);
    expect(creds.get('adv-1')?.hash).not.toContain('senha-da-ana-123'); // nunca em claro
    const login = await auth.login('adv-1', 'senha-da-ana-123');
    expect(login).toEqual({ ok: true, advogadoId: 'adv-1', nome: 'Ana Lima' });
  });

  it('LOGIN por CPF resolve ao membro (retorno = id interno; id ainda funciona)', async () => {
    const { auth } = harness([member({ id: 'adv-9', cpf: '22192008848', name: 'Juliano' })]);
    const convite = await auth.emitirConvite('adv-9', NOW); // convite segue pelo id interno
    await auth.definirSenha(convite ?? '', 'senha-do-juliano-1', NOW);
    // Entra pelo CPF (com pontuação) — o retorno é sempre o id interno.
    expect(await auth.login('221.920.088-48', 'senha-do-juliano-1')).toEqual({
      ok: true,
      advogadoId: 'adv-9',
      nome: 'Juliano',
    });
    // Retrocompat: o id interno também continua entrando.
    expect((await auth.login('adv-9', 'senha-do-juliano-1')).ok).toBe(true);
    // CPF de outro não entra.
    expect((await auth.login('11144477735', 'senha-do-juliano-1')).ok).toBe(false);
  });

  it('NUNCA cadastro público: convite só para advogado JÁ cadastrado e ATIVO', async () => {
    const { auth } = harness([member({ active: false }), member({ id: 'op-1', role: 'operador' })]);
    expect(await auth.emitirConvite('nao-existe', NOW)).toBeNull();
    expect(await auth.emitirConvite('adv-1', NOW)).toBeNull(); // inativo
    expect(await auth.emitirConvite('op-1', NOW)).toBeNull(); // papel errado
  });

  it('NUNCA criação pela URL: definir senha exige convite VÁLIDO', async () => {
    const { auth } = harness([member({})]);
    expect((await auth.definirSenha('token-forjado', 'senha-longa-123', NOW)).ok).toBe(false);
    const expirado = assinarTokenPortal(
      'adv-1',
      'convite-advogado',
      7,
      new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000),
      SECRET,
    );
    expect((await auth.definirSenha(expirado, 'senha-longa-123', NOW)).ok).toBe(false);
    const curto = await auth.emitirConvite('adv-1', NOW);
    expect((await auth.definirSenha(curto ?? '', '1234567', NOW)).ok).toBe(false); // senha curta
  });

  it('LOGIN nega com erro ÚNICO: sem credencial, senha errada, inexistente, inativo', async () => {
    const { auth } = harness([member({}), member({ id: 'adv-2', active: false })]);
    const semCredencial = await auth.login('adv-1', 'qualquer');
    const inexistente = await auth.login('fantasma', 'qualquer');
    const inativo = await auth.login('adv-2', 'qualquer');
    for (const r of [semCredencial, inexistente, inativo]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('credenciais inválidas'); // nunca vaza o fator
    }
    const convite = await auth.emitirConvite('adv-1', NOW);
    await auth.definirSenha(convite ?? '', 'senha-correta-123', NOW);
    const errada = await auth.login('adv-1', 'senha-errada');
    expect(errada.ok).toBe(false);
  });

  it('GO-LIVE-04.1 — CONVITE NÃO É REUTILIZÁVEL: morto após a senha criada; redefinir exige convite NOVO', async () => {
    const { auth } = harness([member({})]);
    const convite = await auth.emitirConvite('adv-1', NOW);
    expect((await auth.definirSenha(convite ?? '', 'primeira-senha-123', NOW)).ok).toBe(true);
    // Reuso do MESMO convite (vazado) para trocar a senha ⇒ NEGA:
    const reuso = await auth.definirSenha(
      convite ?? '',
      'senha-do-atacante',
      new Date(NOW.getTime() + 60_000),
    );
    expect(reuso.ok).toBe(false);
    if (!reuso.ok) expect(reuso.error).toContain('já foi utilizado');
    // A senha original permanece:
    expect((await auth.login('adv-1', 'primeira-senha-123')).ok).toBe(true);
    // Convite NOVO (emitido DEPOIS da senha) permite redefinição legítima:
    const DEPOIS = new Date(NOW.getTime() + 2 * 60_000);
    const novo = await auth.emitirConvite('adv-1', DEPOIS);
    expect((await auth.definirSenha(novo ?? '', 'senha-redefinida-123', DEPOIS)).ok).toBe(true);
    expect((await auth.login('adv-1', 'senha-redefinida-123')).ok).toBe(true);
  });

  it('FAIL-CLOSED: servidor sem segredo ⇒ nenhum convite nasce', async () => {
    const staff: StaffStore = {
      save: () => Promise.resolve(),
      byId: () => Promise.resolve(member({})),
      byRole: () => Promise.resolve([]),
      all: () => Promise.resolve([]),
    };
    const auth = new AdvogadoAuthRuntime({
      staff,
      credenciais: { load: () => Promise.resolve(null), save: () => Promise.resolve() },
      secret: '',
    });
    expect(await auth.emitirConvite('adv-1', NOW)).toBeNull();
  });
});
