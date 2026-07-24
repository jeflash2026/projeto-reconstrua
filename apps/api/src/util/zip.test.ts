import { describe, it, expect } from 'vitest';
import { zipStore, nomeArquivoSeguro } from './zip.js';

// Lê o método STORE do primeiro arquivo de um zip gerado por zipStore, provando
// que o conteúdo é recuperável byte a byte (STORE = sem compressão, então basta
// fatiar; usamos só as assinaturas e tamanhos para localizar os dados).
function primeiroConteudo(zip: Buffer): string {
  expect(zip.readUInt32LE(0)).toBe(0x04034b50); // assinatura do 1º header local
  const nomeLen = zip.readUInt16LE(26);
  const tam = zip.readUInt32LE(22); // tamanho descomprimido
  const inicio = 30 + nomeLen;
  return zip.subarray(inicio, inicio + tam).toString('utf8');
}

describe('zipStore', () => {
  it('gera um .zip válido (assinaturas PK) e o conteúdo é recuperável (STORE)', () => {
    const zip = zipStore([
      { name: 'Maria.csv', content: 'banco,contrato\nBB,123' },
      { name: 'João.csv', content: 'banco,contrato\nCEF,987' },
    ]);
    // EOCD no fim, com 2 entradas.
    const eocd = zip.length - 22;
    expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocd + 10)).toBe(2);
    // Primeiro arquivo recuperado íntegro.
    expect(primeiroConteudo(zip)).toBe('banco,contrato\nBB,123');
  });

  it('zip vazio ainda é um arquivo válido (0 entradas)', () => {
    const zip = zipStore([]);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(0);
  });
});

describe('nomeArquivoSeguro', () => {
  it('remove separadores/reservados e limita tamanho; usa fallback se vazio', () => {
    expect(nomeArquivoSeguro('Maria/do\\Rócio: 2024', 'x')).toBe('Maria do Rócio 2024');
    expect(nomeArquivoSeguro('   ', 'cliente-1')).toBe('cliente-1');
  });
});
