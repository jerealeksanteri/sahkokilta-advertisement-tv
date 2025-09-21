# Sähkökilta Advertisement TV - Test Suite

This directory contains comprehensive test coverage for the Sähkökilta Advertisement TV project, ensuring reliability, performance, and maintainability across all components.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
├── integration/             # Integration tests for component interactions
├── e2e/                     # End-to-end tests using Puppeteer
├── cypress/                 # Cypress E2E tests for full workflows
├── performance/             # Performance tests for Raspberry Pi
├── mocks/                   # Shared mock utilities and fixtures
├── coverage-validator.js    # Coverage validation script
└── README.md               # This file
```

## Test Categories

### Unit Tests (`tests/unit/`)

- **Module Tests**: Individual MagicMirror² modules (Branding, Carousel, Layout Manager)
- **Service Tests**: Core services (Configuration, Content, Error Handler, Logging)
- **Node Helper Tests**: Backend node.js helpers for each module
- **Application Tests**: Main application lifecycle and communication
- **Coverage Tests**: Edge cases and error scenarios for improved coverage

**Coverage Target**: 80% minimum across statements, branches, functions, and lines

### Integration Tests (`tests/integration/`)

- **Application Lifecycle**: Module initialization and shutdown sequences
- **Module Communication**: Inter-module messaging and data flow
- **File Watching**: Hot-reloading and configuration updates
- **Error Handling**: Cross-component error propagation and recovery

### End-to-End Tests (`tests/e2e/`)

- **Puppeteer Tests**: Browser automation for UI interactions
- **Application Workflows**: Complete user scenarios
- **Performance Validation**: Load times and resource usage
- **Error Scenarios**: Graceful degradation testing

### Cypress Tests (`tests/cypress/`)

- **Full Application Workflows**: Complete feature testing
- **Responsive Design**: Multi-viewport testing
- **Hot-Reloading**: Configuration update workflows
- **Accessibility**: WCAG compliance validation
- **Performance**: Real-world usage scenarios

### Performance Tests (`tests/performance/`)

- **Raspberry Pi Simulation**: Hardware-specific performance testing
- **Memory Management**: Memory leak detection and cleanup
- **CPU Optimization**: Performance under resource constraints
- **Network Resilience**: Slow connection handling
- **Thermal Performance**: Sustained load testing

## Running Tests

### All Tests
```bash
npm test                    # Run all unit tests
npm run test:coverage      # Run with coverage report
npm run test:all          # Run all test suites
```

### Specific Test Suites
```bash
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e         # Puppeteer E2E tests
npm run test:performance # Performance tests
npm run test:cypress     # Cypress tests (headless)
npm run test:cypress:open # Cypress tests (interactive)
```

### Coverage Validation
```bash
npm run test:validate     # Validate coverage meets 80% threshold
```

### Watch Mode
```bash
npm run test:watch        # Run tests in watch mode during development
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Environment**: Node.js with jsdom for DOM testing
- **Coverage**: 80% threshold for all metrics
- **Timeout**: 10 seconds default, extended for E2E tests
- **Setup**: Global mocks and utilities in `tests/setup.js`

### Cypress Configuration (`cypress.config.js`)
- **Viewport**: 1920x1080 (TV resolution)
- **Base URL**: http://localhost:3000
- **Timeouts**: 10 seconds for commands, 2 retries in CI
- **Screenshots**: On failure only

## Mock System

The test suite includes a comprehensive mock system (`tests/mocks/`) providing:

- **MockModule**: Base MagicMirror² module simulation
- **MockEventEmitter**: Event system simulation
- **File System Mocks**: fs-extra, path, chokidar mocking
- **Logger Mocks**: Winston logger simulation
- **DOM Mocks**: Browser API simulation
- **Test Utilities**: Helper functions for common test patterns

## Coverage Requirements

All code must meet the following coverage thresholds:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

### Coverage Exclusions
- Node modules
- Test files
- Mock files
- Electron main process files
- MagicMirror² core files

## Performance Benchmarks

### Raspberry Pi 4 Targets
- **Memory Usage**: < 100MB total
- **CPU Usage**: < 50% average
- **Load Time**: < 3 seconds
- **Frame Rate**: > 15 FPS for animations
- **Network Timeout**: 10 seconds max

### Browser Performance
- **First Paint**: < 1 second
- **Interactive**: < 2 seconds
- **Memory Leaks**: < 20% growth over 30 minutes
- **Bundle Size**: < 5MB total

## Continuous Integration

### GitHub Actions Integration
```yaml
- name: Run Tests
  run: |
    npm ci
    npm run test:coverage
    npm run test:e2e
    npm run test:validate
```

### Pre-commit Hooks
```bash
npm run lint:fix          # Fix linting issues
npm run test:coverage     # Ensure tests pass
npm run test:validate     # Validate coverage
```

## Test Data and Fixtures

### Configuration Fixtures
- `tests/cypress/fixtures/`: Sample configuration files
- Mock sponsor data, branding configurations, system settings

### Test Assets
- Sample logos and images for testing
- Mock API responses
- Error scenario configurations

## Debugging Tests

### Debug Mode
```bash
DEBUG_TESTS=true npm test  # Enable verbose logging
```

### Browser DevTools (Cypress)
```bash
npm run test:cypress:open  # Interactive mode with DevTools
```

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Summary**: `coverage/coverage-summary.json`
- **LCOV**: `coverage/lcov.info`

## Best Practices

### Writing Tests
1. **Descriptive Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **Single Responsibility**: One assertion per test when possible
4. **Mock External Dependencies**: Isolate units under test
5. **Clean Up**: Properly clean up resources in afterEach

### Performance Testing
1. **Realistic Scenarios**: Test with realistic data sizes
2. **Resource Constraints**: Simulate Raspberry Pi limitations
3. **Long-running Tests**: Test memory leaks over time
4. **Network Conditions**: Test various connection speeds

### E2E Testing
1. **User Scenarios**: Test complete user workflows
2. **Error Paths**: Test error handling and recovery
3. **Accessibility**: Include accessibility checks
4. **Cross-browser**: Test on different browsers when possible

## Troubleshooting

### Common Issues

#### Tests Timing Out
- Increase timeout in jest.config.js
- Check for unresolved promises
- Verify mock implementations

#### Coverage Not Meeting Threshold
- Run `npm run test:validate` for detailed report
- Check uncovered lines in HTML report
- Add tests for missing branches

#### Cypress Tests Failing
- Check viewport settings
- Verify test data setup
- Review network mocking

#### Performance Tests Inconsistent
- Run multiple times for averages
- Check system resources during tests
- Verify CPU throttling settings

### Getting Help
- Check test logs for detailed error messages
- Review coverage reports for missing tests
- Use debug mode for verbose output
- Consult individual test files for specific requirements

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure coverage meets thresholds
3. Add performance tests for critical paths
4. Update this documentation as needed
5. Run full test suite before submitting PR

For questions or issues with the test suite, please refer to the project documentation or create an issue in the repository.