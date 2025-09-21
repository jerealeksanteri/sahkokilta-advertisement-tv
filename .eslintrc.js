module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  plugins: ['jest'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Code quality rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Style rules (handled by Prettier, but some logical ones)
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    
    // Jest specific rules
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-console': 'off', // Allow console in tests
      },
    },
  ],
};