import { defineWorkspace } from 'vitest/config';

// Projetos de teste do monorepo.
// - unit:        invariantes puras do domínio (um teste por invariante do Livro Mestre).
// - integration: adaptadores de infraestrutura (event store, projeções, outbox).
// - conformance: suíte de conformidade ao Canon (espelha os "Critérios de Auditoria"
//                de cada capítulo — R9/G9). Bloqueia merge se falhar.
// - e2e:         ciclos ponta a ponta (nascimento → auditoria de uma missão).
export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['packages/**/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'integration',
      include: ['packages/**/src/**/*.itest.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'conformance',
      include: ['tests/conformance/**/*.test.ts'],
      environment: 'node',
      // A suite ainda nao tem arquivos (.gitkeep desde o 1o commit) — sem isto,
      // 'No test files found' derrubava o job Conformidade em TODO push.
      passWithNoTests: true,
    },
  },
  {
    test: {
      name: 'e2e',
      include: ['tests/e2e/**/*.test.ts'],
      environment: 'node',
    },
  },
]);
