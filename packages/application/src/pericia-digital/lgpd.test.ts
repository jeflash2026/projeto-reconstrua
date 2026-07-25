import { describe, it, expect } from 'vitest';
import {
  veDadoCompleto,
  mascararCpf,
  mascararDocumento,
  mascararBeneficio,
  mascararTelefone,
  mascararNome,
  redigirPii,
  projetarDados,
  anonimizarDados,
  ROTULO_ANONIMIZADO,
} from './lgpd.js';

describe('LGPD — minimização e mascaramento por papel (projeção de leitura)', () => {
  it('papéis de operação veem o dado completo; os demais, mascarado', () => {
    expect(veDadoCompleto('perito')).toBe(true);
    expect(veDadoCompleto('administrador')).toBe(true);
    expect(veDadoCompleto('assistente')).toBe(true);
    expect(veDadoCompleto('advogado')).toBe(false);
    expect(veDadoCompleto('auditor')).toBe(false);
    expect(veDadoCompleto('visualizador')).toBe(false);
    expect(veDadoCompleto(null)).toBe(false);
  });

  it('mascara CPF preservando 3 primeiros e 2 últimos', () => {
    expect(mascararCpf('123.456.789-05')).toBe('123.XXX.XXX-05');
    expect(mascararCpf('12345678905')).toBe('123.XXX.XXX-05');
    expect(mascararCpf('123')).toBe('***');
    expect(mascararCpf(null)).toBe(null);
  });

  it('mascara documento, benefício, telefone e nome', () => {
    expect(mascararDocumento('12.345.678-9')).toBe('12******9');
    expect(mascararBeneficio('1234567890')).toBe('*******890');
    expect(mascararTelefone('11987654321')).toBe('(11) *******21');
    expect(mascararNome('Maria José da Silva')).toBe('Maria J. D. S.');
    expect(mascararNome('Ana')).toBe('Ana');
    expect(mascararNome(null)).toBe(null);
  });

  it('redige PII solta em texto livre sem afirmar nada', () => {
    const t = 'Contato 123.456.789-05, tel (11) 98765-4321, CEP 01310-100.';
    const r = redigirPii(t);
    expect(r).toContain('[CPF OCULTO]');
    expect(r).toContain('[TELEFONE OCULTO]');
    expect(r).toContain('[CEP OCULTO]');
    expect(r).not.toContain('123.456.789-05');
  });

  it('projetarDados mascara só para papel restrito', () => {
    const dados = {
      nomeCliente: 'João Pedro Souza',
      cpf: '12345678905',
      numeroBeneficio: '1234567',
    };
    expect(projetarDados(dados, 'perito')).toEqual(dados);
    const mascarado = projetarDados(dados, 'visualizador');
    expect(mascarado.cpf).toBe('123.XXX.XXX-05');
    expect(mascarado.nomeCliente).toBe('João P. S.'); // "João Pedro Souza"
    expect(mascarado.numeroBeneficio).toBe('****567');
  });

  it('anonimizar preserva a estrutura mas remove a pessoa', () => {
    const r = anonimizarDados({ nomeCliente: 'Fulano', cpf: '12345678905', numeroBeneficio: '1' });
    expect(r.nomeCliente).toBe(ROTULO_ANONIMIZADO);
    expect(r.cpf).toBe(null);
    expect(r.numeroBeneficio).toBe(null);
  });
});
