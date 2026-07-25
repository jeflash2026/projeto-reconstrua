import { describe, it, expect } from 'vitest';
import {
  PAPEIS_PERICIA,
  podePapel,
  podePapelBruto,
  papelPericia,
  papelDeHumanRole,
} from './autorizacao.js';

describe('RBAC da perícia — matriz papel × ação (fail-closed)', () => {
  it('só o perito aprova e assina', () => {
    for (const p of PAPEIS_PERICIA) {
      const esperado = p === 'perito';
      expect(podePapel(p, 'aprovar')).toBe(esperado);
      expect(podePapel(p, 'assinar')).toBe(esperado);
    }
  });

  it('advogado/auditor/visualizador nunca mutam a análise', () => {
    for (const p of ['advogado', 'auditor', 'visualizador'] as const) {
      expect(podePapel(p, 'gerar_minuta')).toBe(false);
      expect(podePapel(p, 'iniciar_analise')).toBe(false);
      expect(podePapel(p, 'registrar_documento')).toBe(false);
      expect(podePapel(p, 'liberar')).toBe(false);
      // …mas leem
      expect(podePapel(p, 'ler')).toBe(true);
    }
  });

  it('assistente anexa documento e lê, mas não aprova/assina/libera', () => {
    expect(podePapel('assistente', 'registrar_documento')).toBe(true);
    expect(podePapel('assistente', 'ler')).toBe(true);
    expect(podePapel('assistente', 'aprovar')).toBe(false);
    expect(podePapel('assistente', 'liberar')).toBe(false);
  });

  it('administrador orquestra o ciclo, mas não aprova/assina como perito', () => {
    expect(podePapel('administrador', 'criar')).toBe(true);
    expect(podePapel('administrador', 'gerar_minuta')).toBe(true);
    expect(podePapel('administrador', 'liberar')).toBe(true);
    expect(podePapel('administrador', 'aprovar')).toBe(false);
    expect(podePapel('administrador', 'assinar')).toBe(false);
  });

  it('só o auditor (e o perito) veem a trilha de custódia além do administrador', () => {
    expect(podePapel('auditor', 'ver_custodia')).toBe(true);
    expect(podePapel('perito', 'ver_custodia')).toBe(true);
    expect(podePapel('administrador', 'ver_custodia')).toBe(true);
    expect(podePapel('advogado', 'ver_custodia')).toBe(false);
    expect(podePapel('visualizador', 'ver_custodia')).toBe(false);
  });

  it('papel nulo ou desconhecido nega tudo (fail-closed)', () => {
    expect(podePapel(null, 'ler')).toBe(false);
    expect(podePapelBruto('root', 'ler')).toBe(false);
    expect(podePapelBruto('', 'ler')).toBe(false);
    expect(podePapelBruto(undefined, 'ler')).toBe(false);
  });

  it('papelPericia normaliza caixa e espaços; recusa o desconhecido', () => {
    expect(papelPericia('  PERITO ')).toBe('perito');
    expect(papelPericia('Advogado')).toBe('advogado');
    expect(papelPericia('gerente')).toBe(null);
    expect(papelPericia(null)).toBe(null);
  });

  it('mapeia o papel do diretório operacional para o papel de perícia', () => {
    expect(papelDeHumanRole('administrador')).toBe('administrador');
    expect(papelDeHumanRole('perito')).toBe('perito');
    expect(papelDeHumanRole('advogado')).toBe('advogado');
    expect(papelDeHumanRole('operador')).toBe('assistente');
    expect(papelDeHumanRole('supervisor')).toBe('auditor');
    expect(papelDeHumanRole('desconhecido')).toBe(null);
  });
});
