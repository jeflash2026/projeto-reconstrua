// Flat config LOCAL da landing (design de origem externa): herda o config raiz
// mas relaxa regras de estilo/tipagem estrita — a página é apresentacional e o
// gate de correção fica no typecheck + build do Next.
import rootConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'next.config.ts',
      'eslint.config.mjs',
      'postcss.config.mjs',
      'tailwind.config.ts',
    ],
  },
  ...rootConfig,
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
