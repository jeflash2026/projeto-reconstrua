// ─────────────────────────────────────────────────────────────────────────────
// CPF JÁ CADASTRADO (2026-09-22) — quem já é cliente e escreve de outro número
// não pode ser tratado como gente nova (pedido do dono, caso real do teste:
// informou um CPF com cadastro e a AHRI pediu o HISCON de novo).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { outroCadastroComOCpf, primeiroNome } from './cpf-ja-cadastrado.js';

const base = [
  { chatId: '5516999990000@s.whatsapp.net', cpf: '16392961828', nome: 'Maria Aparecida da Silva' },
  { chatId: '5511988887777@s.whatsapp.net', cpf: null, nome: 'João' },
];
const json = { list: () => Promise.resolve(base) } as never;

describe('outroCadastroComOCpf', () => {
  it('acha o cadastro anterior mesmo com o CPF formatado', async () => {
    const achado = await outroCadastroComOCpf(
      json,
      '163.929.618-28',
      '5517996332346@s.whatsapp.net',
    );
    expect(achado?.chatId).toBe('5516999990000@s.whatsapp.net');
    expect(achado?.nome).toBe('Maria Aparecida da Silva');
  });

  it('ignora o cadastro da PRÓPRIA conversa (senão todo cliente viraria "outro")', async () => {
    expect(
      await outroCadastroComOCpf(json, '16392961828', '5516999990000@s.whatsapp.net'),
    ).toBeNull();
  });

  it('CPF novo não acha nada', async () => {
    expect(
      await outroCadastroComOCpf(json, '11122233344', '5517996332346@s.whatsapp.net'),
    ).toBeNull();
  });

  it('número incompleto não procura (evita casar por engano)', async () => {
    expect(await outroCadastroComOCpf(json, '1639296', '5517996332346@s.whatsapp.net')).toBeNull();
  });

  it('falha de leitura não derruba o atendimento', async () => {
    const quebrado = { list: () => Promise.reject(new Error('banco fora')) } as never;
    expect(await outroCadastroComOCpf(quebrado, '16392961828', 'x@s.whatsapp.net')).toBeNull();
  });
});

describe('primeiroNome', () => {
  it('devolve só o primeiro nome (é com ele que a AHRI confirma quem é)', () => {
    expect(primeiroNome('Maria Aparecida da Silva')).toBe('Maria');
    expect(primeiroNome('  ')).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});
