import { describe, it, expect } from 'vitest';
import { ufDoTelefone, DDD_UF, UF_NOME } from './ddd-uf.js';

describe('ufDoTelefone', () => {
  it('resolve a UF pelo DDD do JID brasileiro', () => {
    expect(ufDoTelefone('5517996332346@s.whatsapp.net')).toBe('SP'); // DDD 17
    expect(ufDoTelefone('5521999998888@s.whatsapp.net')).toBe('RJ'); // DDD 21
    expect(ufDoTelefone('5571988887777@s.whatsapp.net')).toBe('BA'); // DDD 71
    expect(ufDoTelefone('55 61 98888-7777')).toBe('DF'); // aceita pontuação
    expect(ufDoTelefone('554898887777')).toBe('SC'); // fixo 8 dígitos (12 total)
  });

  it('null para não-brasileiro, tamanho errado ou DDD desconhecido', () => {
    expect(ufDoTelefone('1234567890')).toBeNull(); // não começa com 55
    expect(ufDoTelefone('55')).toBeNull(); // curto
    expect(ufDoTelefone('5500988887777')).toBeNull(); // DDD 00 inexistente
    expect(ufDoTelefone('')).toBeNull();
  });

  it('todo DDD mapeia para uma UF com nome cadastrado', () => {
    for (const uf of Object.values(DDD_UF)) {
      expect(UF_NOME[uf]).toBeDefined();
    }
    expect(Object.keys(UF_NOME)).toHaveLength(27); // 26 estados + DF
  });
});
