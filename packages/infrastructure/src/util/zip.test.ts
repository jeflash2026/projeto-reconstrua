// A EXTENSÃO do arquivo servido ao advogado: o defeito que já voltou duas vezes
// (caso Cornélio 2026-08-18, caso MARIA GORETE 2026-11-11). Um arquivo sem
// extensão desce e não abre em programa nenhum — para quem recebe, é o mesmo
// que não ter recebido.
import { describe, it, expect } from 'vitest';
import { comNomesUnicos, extensaoDoMime, nomeComExtensao } from './zip.js';

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

// O pacote do cliente juntava três RGs com o MESMO nome: ao extrair no
// Windows, um sobrescrevia o outro e o advogado ficava com um só.
describe('comNomesUnicos', () => {
  const arq = (name: string): { name: string; content: string } => ({ name, content: name });

  it('o primeiro fica intacto; os repetidos ganham (2), (3) antes da extensão', () => {
    const nomes = comNomesUnicos([
      arq('documentos/RG - rg-554792384564.jpg'),
      arq('documentos/RG - rg-554792384564.jpg'),
      arq('documentos/RG - rg-554792384564.jpg'),
      arq('documentos/Comprovante de endereço - comprovante-554792384564.jpg'),
    ]).map((a) => a.name);
    expect(nomes).toEqual([
      'documentos/RG - rg-554792384564.jpg',
      'documentos/RG - rg-554792384564 (2).jpg',
      'documentos/RG - rg-554792384564 (3).jpg',
      'documentos/Comprovante de endereço - comprovante-554792384564.jpg',
    ]);
  });

  it('maiúscula e minúscula contam como o mesmo nome (o Windows não distingue)', () => {
    expect(comNomesUnicos([arq('rg.JPG'), arq('RG.jpg')]).map((a) => a.name)).toEqual([
      'rg.JPG',
      'RG (2).jpg',
    ]);
  });

  it('não colide com um "(2)" que já existia; nome sem extensão também é numerado', () => {
    expect(
      comNomesUnicos([arq('a.pdf'), arq('a (2).pdf'), arq('a.pdf'), arq('sem'), arq('sem')]).map(
        (a) => a.name,
      ),
    ).toEqual(['a.pdf', 'a (2).pdf', 'a (3).pdf', 'sem', 'sem (2)']);
  });

  it('ponto em nome de pasta não vira extensão; o conteúdo vai junto', () => {
    const r = comNomesUnicos([arq('v1.0/doc'), arq('v1.0/doc')]);
    expect(r.map((a) => a.name)).toEqual(['v1.0/doc', 'v1.0/doc (2)']);
    expect(r[1]?.content).toBe('v1.0/doc');
  });
});
