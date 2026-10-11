// ESLint flat config. The rules are ported from qd-mobile/.eslintrc.cjs so both
// codebases follow the same conventions.
//
// Same as mobile: eslint recommended, typescript-eslint recommended (type-aware
// parsing), react recommended + jsx-runtime, react-hooks recommended, import
// recommended, i18next recommended, prettier recommended, and every rule in the
// "ported from qd-mobile" block below with the same severity and options.
// Not ported (no meaning on the web): the `@react-native` shared config and the
// `react-native/*`, `ft-flow/*` and `eslint-comments/*` rules.
// Added for the web: `jsx-a11y` recommended, and `import.meta.env` in the
// configuration restriction (mobile restricts `process.env`).
// Adapted: `plugin:jest/recommended` becomes the Vitest plugin's recommended set;
// the `import/*` rules come from eslint-plugin-import-x (the maintained fork:
// eslint-plugin-import does not run on ESLint 10), registered under the same
// `import` name so rule names and options are identical to mobile.
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import i18next from 'eslint-plugin-i18next';
import { importX } from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ENV_MESSAGE = 'Read configuration through src/core/env.ts.';

// eslint-plugin-import-x under the `import` name: its recommended rules, renamed.
const importRecommended = {
  plugins: { import: importX },
  rules: Object.fromEntries(
    Object.entries(importX.flatConfigs.recommended.rules).map(
      ([name, value]) => [name.replace('import-x/', 'import/'), value],
    ),
  ),
};

export default tseslint.config(
  {
    // Like mobile (`ignorePatterns: ['*.js']`): only TypeScript is linted.
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      '.yarn/',
      'public/',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  importRecommended,
  i18next.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        // Mobile uses 'detect'; eslint-plugin-react 7.37 cannot detect the version
        // on ESLint 10 (it calls a removed API), so it is stated here. Keep it in
        // step with the react version in package.json.
        version: '19.3',
      },
      'import-x/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    // Ported from qd-mobile/.eslintrc.cjs.
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-named-as-default': 'off',
      'react/prop-types': 'off',
      'no-console': [
        'error',
        {
          allow: ['info', 'error'],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        { name: 'react', importNames: ['default'] },
        { name: 'react-redux', importNames: ['useDispatch', 'useSelector'] },
      ],
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              'aria-label',
              'title',
              'alt',
              'label',
              'text',
              'description',
              'placeholder',
            ],
          },
          'should-validate-template': true,
        },
      ],
    },
  },
  {
    // Configuration is read once, in src/core/env.ts (validated with zod).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/core/env.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: ENV_MESSAGE,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.type='MetaProperty'][property.name='env']",
          message: ENV_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    plugins: { vitest },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      'i18next/no-literal-string': 'off',
    },
  },
  {
    // The legal documents keep their text word for word as literal JSX: long legal
    // copy is not worth moving to the translation file. Only these two files.
    files: [
      'src/screens/PrivacyPolicy/PrivacyPolicyContent.tsx',
      'src/screens/TermsAndConditions/TermsAndConditionsContent.tsx',
    ],
    rules: {
      'i18next/no-literal-string': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
);
