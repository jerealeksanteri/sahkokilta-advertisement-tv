module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'modules/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/MagicMirror/**',
    '!**/coverage/**',
    '!**/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
};