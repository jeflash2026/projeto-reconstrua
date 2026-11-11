// A EXTENSÃO do arquivo servido ao advogado: o defeito que já voltou duas vezes
// (caso Cornélio 2026-08-18, caso MARIA GORETE 2026-11-11). Um arquivo sem
// extensão desce e não abre em programa nenhum — para quem recebe, é o mesmo
// que não ter recebido.
import { describe, it, expect } from 'vitest';
import { extensaoDoMime, nomeComExtensao } from './zip.js';

describe('extensaoDoMime', () => {
  it('cobre os três formatos que o sistema aceita', () => {
    expect(extensaoDoMime('application/pdf')).toBe('pdf');
    expect(extensaoDoMime('image/png')).toBe('png');
    expect(extensaoDoMime('image/jpeg')).toBe('jpg');
  });

  it('qualquer outra imagem vira jpg; o resto vira bin', () => {
    expect(extensaoDoMime('image/webp')).toBe('jpg');
    expect(extensaoDoMime('application/octet-stream')).toBe('bin');
  });
});

describe('nomeComExtensao', () => {
  it('põe a extensão do mime quando o nome não tem nenhuma', () => {
    expect(
      nomeComExtensao('Comprovante de endereço - comprovante-556798743285', 'image/jpeg'),
    ).toBe('Comprovante de endereço - comprovante-556798743285.jpg');
  });

  it('não mexe no nome que já tem extensão', () => {
    expect(nomeComExtensao('procuracao.pdf', 'application/pdf')).toBe('procuracao.pdf');
    expect(nomeComExtensao('RG - JOSE.PNG', 'image/png')).toBe('RG - JOSE.PNG');
  });

  it('ponto no meio do nome não conta como extensão', () => {
    expect(nomeComExtensao('RG do Sr. Jose', 'image/jpeg')).toBe('RG do Sr. Jose.jpg');
  });

  it('o mime manda, não o que o nome alega', () => {
    // O time salva a foto do WhatsApp e o explorador não dá extensão nenhuma;
    // o magic byte já disse que é JPEG antes de chegar aqui.
    expect(nomeComExtensao('comprovante-556798743285', 'image/jpeg')).toBe(
      'comprovante-556798743285.jpg',
    );
  });
});
