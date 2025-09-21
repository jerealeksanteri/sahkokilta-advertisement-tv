// Additional unit tests to improve coverage for edge cases and error scenarios
const {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} = require('@jest/globals');
const { mockFS, mockLogger, testUtils } = require('../mocks');

describe('Coverage Improvement Tests', () => {
  beforeEach(() => {
    testUtils.resetAllMocks();
  });

  describe('ConfigurationService Edge Cases', () => {
    let ConfigurationService;

    beforeEach(() => {
      ConfigurationService = require('../../services/ConfigurationService.js');
    });

    test('should handle missing configuration files gracefully', async () => {
      mockFS.readFile.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const service = new ConfigurationService();
      const result = await service.loadConfiguration(
        '/nonexistent/config.json'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    test('should handle invalid JSON gracefully', async () => {
      mockFS.readFile.mockResolvedValue('{ invalid json }');

      const service = new ConfigurationService();
      const result = await service.loadConfiguration('/invalid/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    test('should validate configuration against schema', async () => {
      const service = new ConfigurationService();

      const invalidConfig = {
        sponsors: [
          { name: 'Test', logoPath: '/test.png' }, // missing required 'id' field
        ],
      };

      const schema = {
        type: 'object',
        properties: {
          sponsors: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'logoPath'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                logoPath: { type: 'string' },
              },
            },
          },
        },
      };

      const result = service.validateConfiguration(invalidConfig, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("required property 'id'");
    });

    test('should handle schema validation errors', () => {
      const service = new ConfigurationService();

      const result = service.validateConfiguration(null, { type: 'object' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    test('should merge configurations correctly', () => {
      const service = new ConfigurationService();

      const base = {
        theme: { colors: { primary: '#red' } },
        features: { carousel: true },
      };

      const override = {
        theme: { colors: { secondary: '#blue' } },
        features: { branding: true },
      };

      const merged = service.mergeConfigurations(base, override);

      expect(merged.theme.colors.primary).toBe('#red');
      expect(merged.theme.colors.secondary).toBe('#blue');
      expect(merged.features.carousel).toBe(true);
      expect(merged.features.branding).toBe(true);
    });
  });

  describe('ContentService Edge Cases', () => {
    let ContentService;

    beforeEach(() => {
      ContentService = require('../../services/ContentService.js');
    });

    test('should handle file watcher errors', () => {
      const service = new ContentService();
      const errorHandler = jest.fn();

      service.on('error', errorHandler);

      // Simulate watcher error
      service.handleWatcherError(new Error('Watcher failed'));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WATCHER_ERROR',
          error: expect.any(Error),
        })
      );
    });

    test('should handle content validation failures', async () => {
      const service = new ContentService();

      const invalidContent = { sponsors: 'not an array' };
      const schema = {
        type: 'object',
        properties: {
          sponsors: { type: 'array' },
        },
      };

      const result = await service.validateContent(invalidContent, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    test('should handle file system permission errors', async () => {
      mockFS.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const service = new ContentService();
      const result = await service.checkFileAccess('/restricted/file.json');

      expect(result.accessible).toBe(false);
      expect(result.error).toContain('EACCES');
    });

    test('should debounce rapid file changes', async () => {
      const service = new ContentService();
      const changeHandler = jest.fn();

      service.on('content-updated', changeHandler);

      // Simulate rapid file changes
      service.handleFileChange('/test/file.json');
      service.handleFileChange('/test/file.json');
      service.handleFileChange('/test/file.json');

      // Wait for debounce
      await testUtils.waitFor(600);

      expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle concurrent file operations', async () => {
      const service = new ContentService();

      mockFS.readFile
        .mockResolvedValueOnce('{"data": "first"}')
        .mockResolvedValueOnce('{"data": "second"}');

      const [result1, result2] = await Promise.all([
        service.loadContent('/test/file1.json'),
        service.loadContent('/test/file2.json'),
      ]);

      expect(result1.data).toBe('first');
      expect(result2.data).toBe('second');
    });
  });

  describe('ErrorHandler Edge Cases', () => {
    let ErrorHandler;

    beforeEach(() => {
      ErrorHandler = require('../../services/ErrorHandler.js');
    });

    test('should handle circular reference errors', () => {
      const handler = new ErrorHandler();

      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      const error = new Error('Circular reference test');
      error.context = circularObj;

      const result = handler.handleError(error, 'TEST_CONTEXT');

      expect(result.handled).toBe(true);
      expect(result.action).toBeDefined();
    });

    test('should handle memory pressure scenarios', () => {
      const handler = new ErrorHandler();

      const memoryError = new Error('JavaScript heap out of memory');
      memoryError.code = 'ENOMEM';

      const result = handler.handleError(memoryError, 'MEMORY_CONTEXT');

      expect(result.action).toBe('RESTART_MODULE');
      expect(result.severity).toBe('CRITICAL');
    });

    test('should handle network timeout errors', () => {
      const handler = new ErrorHandler();

      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      const result = handler.handleError(timeoutError, 'NETWORK_CONTEXT');

      expect(result.action).toBe('RETRY_OPERATION');
      expect(result.retryDelay).toBeGreaterThan(0);
    });

    test('should escalate repeated errors', () => {
      const handler = new ErrorHandler();

      const error = new Error('Repeated error');

      // First occurrence
      const result1 = handler.handleError(error, 'TEST_CONTEXT');
      expect(result1.action).toBe('RETRY_OPERATION');

      // Simulate multiple occurrences
      for (let i = 0; i < 5; i++) {
        handler.handleError(error, 'TEST_CONTEXT');
      }

      const finalResult = handler.handleError(error, 'TEST_CONTEXT');
      expect(finalResult.action).toBe('RESTART_MODULE');
    });

    test('should handle error recovery strategies', async () => {
      const handler = new ErrorHandler();

      const recoveryStrategy = {
        maxRetries: 3,
        retryDelay: 100,
        fallbackAction: 'USE_FALLBACK',
      };

      const result = await handler.executeRecoveryStrategy(
        () => Promise.reject(new Error('Test error')),
        recoveryStrategy
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('USE_FALLBACK');
      expect(result.attempts).toBe(3);
    });
  });

  describe('LoggingService Edge Cases', () => {
    let LoggingService;

    beforeEach(() => {
      LoggingService = require('../../services/LoggingService.js');
    });

    test('should handle log rotation failures', () => {
      const service = new LoggingService();

      // Mock rotation failure
      const rotationError = new Error('Failed to rotate log file');
      service.handleRotationError(rotationError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Log rotation failed'),
        expect.objectContaining({ error: rotationError })
      );
    });

    test('should handle disk space issues', () => {
      const service = new LoggingService();

      const diskError = new Error('ENOSPC: no space left on device');
      diskError.code = 'ENOSPC';

      service.handleLogError(diskError);

      expect(service.emergencyMode).toBe(true);
    });

    test('should sanitize sensitive data in logs', () => {
      const service = new LoggingService();

      const sensitiveData = {
        password: 'secret123',
        apiKey: 'key-12345',
        token: 'bearer-token',
        normalData: 'safe-value',
      };

      const sanitized = service.sanitizeLogData(sensitiveData);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.normalData).toBe('safe-value');
    });

    test('should handle log buffer overflow', () => {
      const service = new LoggingService({ bufferSize: 2 });

      service.log('info', 'Message 1');
      service.log('info', 'Message 2');
      service.log('info', 'Message 3'); // Should trigger overflow

      expect(service.bufferOverflowCount).toBe(1);
    });

    test('should format structured logs correctly', () => {
      const service = new LoggingService();

      const logEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        module: 'TestModule',
        context: { userId: 123, action: 'test' },
      };

      const formatted = service.formatLogEntry(logEntry);

      expect(formatted).toContain('Test message');
      expect(formatted).toContain('TestModule');
      expect(formatted).toContain('userId');
    });
  });

  describe('Module Integration Edge Cases', () => {
    test('should handle module communication failures', () => {
      const ModuleCommunication = require('../../js/ModuleCommunication.js');
      const comm = new ModuleCommunication();

      // Register module with faulty handler
      const faultyHandler = jest.fn(() => {
        throw new Error('Communication failure');
      });

      comm.registerModule('FaultyModule', {
        channels: [{ name: 'test', event: 'TEST', handler: faultyHandler }],
      });

      comm.sendNotification('test', { data: 'test' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error delivering notification'),
        expect.any(Object)
      );
    });

    test('should handle module dependency cycles', () => {
      const ApplicationLifecycle = require('../../js/ApplicationLifecycle.js');
      const lifecycle = new ApplicationLifecycle();

      // Mock modules with circular dependencies
      lifecycle.modules.set('ModuleA', {
        name: 'ModuleA',
        dependencies: ['ModuleB'],
        priority: 1,
      });

      lifecycle.modules.set('ModuleB', {
        name: 'ModuleB',
        dependencies: ['ModuleA'],
        priority: 2,
      });

      const result = lifecycle.validateModuleDependencies();

      // Should detect and handle circular dependency
      expect(result).toBe(true); // Graceful handling
    });

    test('should handle module timeout scenarios', async () => {
      const ApplicationLifecycle = require('../../js/ApplicationLifecycle.js');
      const lifecycle = new ApplicationLifecycle({ moduleTimeout: 100 });

      // Mock slow module initialization
      jest.spyOn(lifecycle, 'initializeModule').mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 200); // Exceeds timeout
        });
      });

      const result = await lifecycle.initializeModulesInOrder();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Module initialization timeout'),
        expect.any(Object)
      );
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle memory cleanup', () => {
      const ContentService = require('../../services/ContentService.js');
      const service = new ContentService();

      // Simulate memory usage
      service.cache = new Map();
      for (let i = 0; i < 1000; i++) {
        service.cache.set(`key-${i}`, { data: 'large-data'.repeat(100) });
      }

      service.performMemoryCleanup();

      expect(service.cache.size).toBeLessThan(1000);
    });

    test('should handle resource constraints', () => {
      const ErrorHandler = require('../../services/ErrorHandler.js');
      const handler = new ErrorHandler();

      const resourceError = new Error('Resource limit exceeded');
      resourceError.code = 'RESOURCE_EXHAUSTED';

      const result = handler.handleError(resourceError, 'RESOURCE_CONTEXT');

      expect(result.action).toBe('REDUCE_QUALITY');
      expect(result.recommendations).toContain('memory');
    });

    test('should throttle high-frequency operations', async () => {
      const ContentService = require('../../services/ContentService.js');
      const service = new ContentService();

      const operation = jest.fn().mockResolvedValue('success');
      const throttledOperation = service.throttle(operation, 100);

      // Call multiple times rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(throttledOperation());
      }

      await Promise.all(promises);

      // Should be throttled to fewer calls
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
