import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**']
  },

  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // Disallow explicit 'any' type
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow unused vars that start with _
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],

      // Prevent accidental console.log statements in production
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Enforce semicolons
      'semi': ['error', 'always'],

      // Enforce proper spacing
      'no-trailing-spaces': 'error',

      // Prevent accidental debugger statements
      'no-debugger': 'error',
    }
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    rules: {
      // Prevent accidental console.log statements in production
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Enforce semicolons
      'semi': ['error', 'always'],

      // Enforce proper spacing
      'no-trailing-spaces': 'error',

      // Prevent accidental debugger statements
      'no-debugger': 'error',
    }
  }
];