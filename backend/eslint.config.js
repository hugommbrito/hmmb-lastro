// @ts-check
// ADR-008: ESLint flat + typescript-eslint type-aware + Prettier. As regras específicas do
// Lastro (assertion proibida, parseFloat/Number proibidos, descrição obrigatória em
// eslint-disable) ficam no bloco de TypeScript abaixo.
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // server.js é o spike S1 e sai na F0-20.
  globalIgnores(['dist/', 'coverage/', 'server.js']),
  js.configs.recommended,
  eslintComments.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // ADR-008: exceção a uma regra só com eslint-disable-next-line e descrição.
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unused-disable': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // ADR-008: assertion mecanizada; a exceção exige eslint-disable-next-line com descrição.
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Módulos e controllers do NestJS são classes vazias decoradas.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // ADR-008: dinheiro nunca passa por float. Vale para todo o src/; infra que precise de
      // Number(...) opta por sair com eslint-disable-next-line e descrição.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='parseFloat']",
          message: 'parseFloat perde precisão; dinheiro usa decimal.js (ADR-008).',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='Number'][callee.property.name='parseFloat']",
          message: 'Number.parseFloat perde precisão; dinheiro usa decimal.js (ADR-008).',
        },
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='Number']",
          message:
            'Number(...) é proibido nos módulos de domínio; dinheiro usa decimal.js (ADR-008).',
        },
      ],
    },
  },
  prettier,
]);
