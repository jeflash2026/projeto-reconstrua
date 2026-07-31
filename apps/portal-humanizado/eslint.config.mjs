// Flat config LOCAL do portal: herda o config raiz do monorepo e adiciona os
// ignores próprios de um app Next (artefatos gerados e configs .mjs sem projeto TS).
import rootConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['.next/**', 'next-env.d.ts', 'next.config.mjs', 'eslint.config.mjs'],
  },
  ...rootConfig,
];
