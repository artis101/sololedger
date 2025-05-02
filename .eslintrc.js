module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  rules: {
    // Disallow explicit 'any' type
    '@typescript-eslint/no-explicit-any': 'warn',

    // Enforce consistent use of type imports
    '@typescript-eslint/consistent-type-imports': 'off',

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
  },
  // Allow JavaScript files to be checked with TypeScript rules
  overrides: [
    {
      files: ['*.js'],
      rules: {
        // Disable TypeScript-specific rules in JS files
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    }
  ],
};