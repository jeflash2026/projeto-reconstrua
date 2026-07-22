// Flat ESLint config (ESLint 9). Reconstrua monorepo.
// Regras de fronteira arquitetural (Hexagonal/DDD) são verificadas por convenção
// e reforçadas em CI; ver docs/CONVENTIONS.md.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      // Params/vars prefixados com `_` são intencionalmente não usados: um adapter
      // pode não consumir um argumento que o port (interface) exige de outro. A
      // convenção `^_` preserva a fidelidade da assinatura ao contrato sem falso positivo.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'error',
    },
  },
  {
    // Arquivos de configuração e testes: relaxa exigências desnecessárias.
    files: ['**/*.config.*', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  prettier,
);
