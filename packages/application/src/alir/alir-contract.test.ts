// ─────────────────────────────────────────────────────────────────────────────
// ALIR — CONTRATO OFICIAL (W1-01B · B-1). Testes do contrato: fábrica vazia,
// integridade do registry de campos e os INVARIANTES CONSTITUCIONAIS do ALIR
// (100% reconstruível; nunca fonte de verdade → não duplica dado).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  emptyALIR,
  ALIR_FIELDS,
  ALIR_CLASSIFICATIONS,
  ALIR_OWNERS,
  ALIR_SECTIONS,
  ALIR_SCHEMA_VERSION,
  alirFieldByPath,
} from './alir-contract.js';

describe('ALIR · emptyALIR (fábrica vazia)', () => {
  const now = new Date('2026-07-18T12:00:00.000Z');
  const alir = emptyALIR('cli-1', '55410000@c.us', now);

  it('carrega identidade da raiz e cabeçalho do esquema', () => {
    expect(alir.clienteId).toBe('cli-1');
    expect(alir.chatId).toBe('55410000@c.us');
    expect(alir.schemaVersion).toBe(ALIR_SCHEMA_VERSION);
    expect(alir.projectedAt).toBe(now);
    expect(alir.contentHash).toBeNull();
  });

  it('não inventa nada: computados neutros e listas vazias', () => {
    expect(alir.healthScore).toBeNull();
    expect(alir.operational.proximaAcao).toBeNull();
    expect(alir.operational.timeline).toEqual([]);
    expect(alir.operational.decisoes).toEqual([]);
    expect(alir.operational.documentos.enviados).toEqual([]);
    expect(alir.operational.documentos.pendentes).toEqual([]);
    expect(alir.operational.missao.truthEstablished).toBe(false);
    expect(alir.operational.missao.terminalState).toBeNull();
    expect(alir.core.pessoa.personId).toBeNull();
    expect(alir.core.pessoa.atributos).toEqual([]);
  });

  it('todas as EXTENSIONS começam como slots nulos (sem produtor hoje)', () => {
    expect(alir.extensions.pericia).toBeNull();
    expect(alir.extensions.estagioComercial).toBeNull();
    expect(alir.extensions.comercial).toBeNull();
    expect(alir.extensions.financeiro).toBeNull();
    expect(alir.extensions.escritorio).toBeNull();
    expect(alir.extensions.portalCliente).toBeNull();
  });
});

describe('ALIR · registry de campos (metadados obrigatórios)', () => {
  it('todo campo possui as 5 dimensões obrigatórias e valores válidos', () => {
    for (const f of ALIR_FIELDS) {
      expect(f.path.length, `path vazio`).toBeGreaterThan(0);
      expect(f.description.length, `sem descrição: ${f.path}`).toBeGreaterThan(0);
      expect(ALIR_CLASSIFICATIONS, `classificação inválida: ${f.path}`).toContain(f.classification);
      expect(ALIR_OWNERS, `owner inválido: ${f.path}`).toContain(f.owner);
      expect(ALIR_SECTIONS, `seção inválida: ${f.path}`).toContain(f.section);
      expect(f.origin.length, `sem origem: ${f.path}`).toBeGreaterThan(0);
      expect(typeof f.reconstructable, `reconstructable não-booleano: ${f.path}`).toBe('boolean');
    }
  });

  it('paths são únicos', () => {
    const paths = ALIR_FIELDS.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('cada seção do Aggregate está representada no registry', () => {
    for (const section of ALIR_SECTIONS) {
      expect(ALIR_FIELDS.some((f) => f.section === section), `seção sem campos: ${section}`).toBe(true);
    }
  });

  it('alirFieldByPath localiza e retorna null para inexistente', () => {
    expect(alirFieldByPath('operational.missao.stateCode')?.classification).toBe('DERIVADO');
    expect(alirFieldByPath('nao.existe')).toBeNull();
  });
});

describe('ALIR · invariantes constitucionais', () => {
  it('INV-ALIR-1 — todo campo é RECONSTRUÍVEL (o ALIR nunca é verdade perdível)', () => {
    for (const f of ALIR_FIELDS) {
      expect(f.reconstructable, `campo não reconstruível: ${f.path}`).toBe(true);
    }
  });

  it('INV-ALIR-2 — o ALIR não duplica verdade: `alir-runtime` só é dono de CALCULADO', () => {
    for (const f of ALIR_FIELDS) {
      if (f.owner === 'alir-runtime') {
        expect(f.classification, `alir-runtime dono de não-CALCULADO: ${f.path}`).toBe('CALCULADO');
      }
    }
  });

  it('INV-ALIR-3 — dado armazenado (CANÔNICO/DERIVADO/TEMPORÁRIO/EXTERNO) nunca pertence ao ALIR', () => {
    const stored = ['CANONICO', 'DERIVADO', 'TEMPORARIO', 'EXTERNO'];
    for (const f of ALIR_FIELDS) {
      if (stored.includes(f.classification)) {
        expect(f.owner, `dado armazenado com owner ALIR: ${f.path}`).not.toBe('alir-runtime');
      }
    }
  });

  it('INV-ALIR-4 — EXTENSIONS são slots sem produtor (pending-producer) e origem declarada', () => {
    const ext = ALIR_FIELDS.filter((f) => f.section === 'EXTENSIONS');
    expect(ext.length).toBeGreaterThan(0);
    for (const f of ext) {
      expect(f.owner, `extension com produtor real inesperado: ${f.path}`).toBe('pending-producer');
      expect(f.origin.startsWith('ausente'), `extension sem ausência declarada: ${f.path}`).toBe(true);
    }
  });
});
