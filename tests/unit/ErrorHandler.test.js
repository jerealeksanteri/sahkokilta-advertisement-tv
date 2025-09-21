const { ErrorHandler, RecoveryAction } = require('../../services/ErrorHandler');

describe('ErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    errorHandler = new ErrorHandler({
      maxRetries: 2,
      retryDelay: 100,
      memoryThreshold: 0.8,
      cpuThreshold: 0.9
    });
  });

  afterEach(() => {
    if (errorHandler.initialized) {
      errorHandler.cleanup();
    }
  });

  describe('Constructor', () => {
    it('should create ErrorHandler with default options', () => {
      const handler = new ErrorHandler();
      
      expect(handler.options.maxRetries).toBe(3);
      expect(handler.options.retryDelay).toBe(1000);
      expect(handler.options.enableGracefulDegradation).toBe(true);
      expect(handler.options.enableFallbackContent).toBe(true);
      expect(handler.initialized).toBe(false);
    });

    it('should merge custom options with defaults', () => {
      const customOptions = {
        maxRetries: 5,
        retryDelay: 2000,
        enableGracefulDegradation: false
      };
      
      const handler = new ErrorHandler(customOptions);
      
      expect(handler.options.maxRetries).toBe(5);
      expect(handler.options.retryDelay).toBe(2000);
      expect(handler.options.enableGracefulDegradation).toBe(false);
      expect(handler.options.enableFallbackContent).toBe(true); // Default preserved
    });
  });

  describe('Initialization', () => {
    it('should initialize with logger', () => {
      errorHandler.initialize(mockLogger);
      
      expect(errorHandler.initialized).toBe(true);
      expect(errorHandler.logger).toBe(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ErrorHandler initialized',
        expect.objectContaining({
          maxRetries: 2,
          gracefulDegradation: true,
          fallbackContent: true
        })
      );
    });
  });

  describe('Configuration Error Handling', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should handle file not found error with fallback', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      
      const result = errorHandler.handleConfigError(error, '/path/to/config.json', 'branding-config');
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback).toEqual(expect.objectContaining({
        logo: expect.any(Object),
        theme: expect.any(Object)
      }));
      expect(result.message).toContain('Using default configuration');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle validation error with fallback', () => {
      const error = new Error('Validation failed');
      error.code = 'VALIDATION_ERROR';
      error.validationErrors = ['missing required property'];
      
      const result = errorHandler.handleConfigError(error, '/path/to/config.json', 'sponsors-config');
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback).toEqual(expect.objectContaining({
        sponsors: [],
        settings: expect.any(Object)
      }));
    });

    it('should retry operation when retry limit not reached', () => {
      const error = new Error('Network error');
      
      const result1 = errorHandler.handleConfigError(error, '/path/to/config.json', 'system-config');
      expect(result1.action).toBe(RecoveryAction.RETRY_OPERATION);
      
      const result2 = errorHandler.handleConfigError(error, '/path/to/config.json', 'system-config');
      expect(result2.action).toBe(RecoveryAction.RETRY_OPERATION);
      
      const result3 = errorHandler.handleConfigError(error, '/path/to/config.json', 'system-config');
      expect(result3.action).toBe(RecoveryAction.USE_FALLBACK);
    });

    it('should calculate exponential backoff for retry delay', () => {
      const error = new Error('Network error');
      
      const result1 = errorHandler.handleConfigError(error, '/path/to/config.json', 'system-config');
      expect(result1.retryDelay).toBe(100); // Base delay
      
      const result2 = errorHandler.handleConfigError(error, '/path/to/config.json', 'system-config');
      expect(result2.retryDelay).toBe(200); // 2x base delay
    });
  });

  describe('Content Error Handling', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should handle content loading error with fallback', () => {
      // Set up fallback content
      errorHandler.setFallbackContent('image', '/path/to/image.jpg', {
        type: 'placeholder',
        src: 'fallback-image.jpg'
      });
      
      const error = new Error('Image not found');
      const result = errorHandler.handleContentError(error, '/path/to/image.jpg', 'image');
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback).toEqual({
        type: 'placeholder',
        src: 'fallback-image.jpg'
      });
    });

    it('should use default fallback when no specific fallback exists', () => {
      const error = new Error('Logo not found');
      const result = errorHandler.handleContentError(error, '/path/to/logo.png', 'logo');
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback).toEqual(expect.objectContaining({
        type: 'text',
        content: 'Sähkökilta ry'
      }));
    });

    it('should skip content when no fallback available and retries exhausted', () => {
      const error = new Error('Content error');
      
      // Exhaust retries
      errorHandler.handleContentError(error, '/path/to/unknown.file', 'unknown');
      errorHandler.handleContentError(error, '/path/to/unknown.file', 'unknown');
      
      const result = errorHandler.handleContentError(error, '/path/to/unknown.file', 'unknown');
      
      expect(result.action).toBe(RecoveryAction.SKIP_CONTENT);
      expect(result.message).toContain('Skipping failed content');
    });
  });

  describe('System Error Handling', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should handle memory constraint with degradation', () => {
      const error = new Error('Out of memory');
      const resourceInfo = { memoryUsage: 0.9, cpuUsage: 0.5 };
      
      const result = errorHandler.handleSystemError(error, resourceInfo);
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback.degradationLevel).toBe(1);
      expect(result.fallback.imageQuality).toBe('medium');
      expect(result.fallback.animationsEnabled).toBe(false);
      expect(errorHandler.degradationLevel).toBe(1);
    });

    it('should handle CPU constraint with performance reduction', () => {
      const error = new Error('High CPU usage');
      const resourceInfo = { memoryUsage: 0.5, cpuUsage: 0.95 };
      
      const result = errorHandler.handleSystemError(error, resourceInfo);
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback.refreshRate).toBe(30);
      expect(result.fallback.effectsEnabled).toBe(false);
    });

    it('should handle storage constraint with cleanup', () => {
      const error = new Error('No space left');
      error.code = 'ENOSPC';
      
      const result = errorHandler.handleSystemError(error, {});
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback.cleanupRequired).toBe(true);
      expect(result.fallback.clearCache).toBe(true);
    });

    it('should escalate unknown system errors', () => {
      const error = new Error('Unknown system error');
      
      const result = errorHandler.handleSystemError(error, {});
      
      expect(result.action).toBe(RecoveryAction.NOTIFY_ADMIN);
      expect(result.severity).toBe('high');
    });
  });

  describe('Display Error Handling', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should handle resolution error with safe defaults', () => {
      const error = new Error('Invalid resolution detected');
      
      const result = errorHandler.handleDisplayError(error, {});
      
      expect(result.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(result.fallback.resolution).toEqual({ width: 1920, height: 1080 });
      expect(result.fallback.orientation).toBe('landscape');
    });

    it('should retry display operations when appropriate', () => {
      const error = new Error('Display connection failed');
      
      const result = errorHandler.handleDisplayError(error, {});
      
      expect(result.action).toBe(RecoveryAction.RETRY_OPERATION);
    });

    it('should restart module after retry exhaustion', () => {
      const error = new Error('Display connection failed');
      
      // Exhaust retries
      errorHandler.handleDisplayError(error, {});
      errorHandler.handleDisplayError(error, {});
      
      const result = errorHandler.handleDisplayError(error, {});
      
      expect(result.action).toBe(RecoveryAction.RESTART_MODULE);
      expect(result.module).toBe('LayoutManager');
    });
  });

  describe('Degradation Management', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should set degradation level and emit event', (done) => {
      errorHandler.on('degradation-changed', (event) => {
        expect(event.oldLevel).toBe(0);
        expect(event.newLevel).toBe(1);
        done();
      });
      
      errorHandler.setDegradationLevel(1);
      
      expect(errorHandler.degradationLevel).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Degradation level changed',
        expect.objectContaining({
          oldLevel: 0,
          newLevel: 1
        })
      );
    });

    it('should clamp degradation level to valid range', () => {
      errorHandler.setDegradationLevel(-1);
      expect(errorHandler.degradationLevel).toBe(0);
      
      errorHandler.setDegradationLevel(5);
      expect(errorHandler.degradationLevel).toBe(2);
    });

    it('should reset degradation to normal', () => {
      errorHandler.setDegradationLevel(2);
      errorHandler.resetDegradation();
      
      expect(errorHandler.degradationLevel).toBe(0);
    });
  });

  describe('Fallback Content Management', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should set and retrieve fallback content', () => {
      const fallbackData = { type: 'placeholder', content: 'Fallback' };
      
      errorHandler.setFallbackContent('image', '/path/to/image.jpg', fallbackData);
      
      const retrieved = errorHandler.getFallbackContent('image', '/path/to/image.jpg');
      expect(retrieved).toEqual(fallbackData);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fallback content registered',
        expect.objectContaining({
          contentType: 'image',
          contentPath: '/path/to/image.jpg'
        })
      );
    });

    it('should fall back to generic content type fallback', () => {
      errorHandler.setFallbackContent('image', 'default', { type: 'generic' });
      
      const retrieved = errorHandler.getFallbackContent('image', '/specific/path.jpg');
      expect(retrieved).toEqual({ type: 'generic' });
    });

    it('should use built-in defaults when no fallback is set', () => {
      const retrieved = errorHandler.getFallbackContent('sponsor', '/path/to/sponsor.png');
      
      expect(retrieved).toEqual(expect.objectContaining({
        type: 'text',
        content: 'Sponsor content unavailable'
      }));
    });
  });

  describe('Error Statistics', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should record error statistics', (done) => {
      errorHandler.on('error-recorded', (event) => {
        expect(event.errorKey).toBe('test-error');
        expect(event.retryCount).toBe(1);
        expect(event.stats.count).toBe(1);
        done();
      });
      
      const error = new Error('Test error');
      errorHandler.recordError('test-error', error);
    });

    it('should track multiple occurrences of same error', () => {
      const error = new Error('Repeated error');
      
      errorHandler.recordError('repeated', error);
      errorHandler.recordError('repeated', error);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errors.repeated.count).toBe(2);
    });

    it('should get comprehensive error statistics', () => {
      const error1 = new Error('Error 1');
      const error2 = new TypeError('Error 2');
      
      errorHandler.recordError('key1', error1);
      errorHandler.recordError('key2', error2);
      errorHandler.setDegradationLevel(1);
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.degradationLevel).toBe(1);
      expect(stats.errors.key1).toBeDefined();
      expect(stats.errors.key2).toBeDefined();
    });

    it('should clear statistics', () => {
      const error = new Error('Test error');
      errorHandler.recordError('test', error);
      
      errorHandler.clearStats();
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Error statistics cleared');
    });
  });

  describe('Default Configurations', () => {
    it('should provide default branding configuration', () => {
      const config = errorHandler.getDefaultConfig('branding-config');
      
      expect(config).toEqual(expect.objectContaining({
        logo: expect.objectContaining({
          path: expect.stringContaining('fallback'),
          position: 'top-left'
        }),
        theme: expect.objectContaining({
          colors: expect.objectContaining({
            primary: '#FF6B35'
          })
        })
      }));
    });

    it('should provide default sponsors configuration', () => {
      const config = errorHandler.getDefaultConfig('sponsors-config');
      
      expect(config).toEqual(expect.objectContaining({
        sponsors: [],
        settings: expect.objectContaining({
          defaultDuration: 10000,
          transitionType: 'fade'
        })
      }));
    });

    it('should provide default system configuration', () => {
      const config = errorHandler.getDefaultConfig('system-config');
      
      expect(config).toEqual(expect.objectContaining({
        display: expect.objectContaining({
          resolution: { width: 1920, height: 1080 }
        }),
        performance: expect.any(Object)
      }));
    });

    it('should return empty object for unknown schema', () => {
      const config = errorHandler.getDefaultConfig('unknown-schema');
      expect(config).toEqual({});
    });
  });

  describe('Process Error Handlers', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should handle uncaught exceptions', (done) => {
      errorHandler.on('critical-error', (event) => {
        expect(event.type).toBe('uncaughtException');
        expect(event.error).toBeInstanceOf(Error);
        done();
      });
      
      // Simulate uncaught exception
      process.emit('uncaughtException', new Error('Uncaught error'));
    });

    it('should handle unhandled promise rejections', (done) => {
      errorHandler.on('critical-error', (event) => {
        expect(event.type).toBe('unhandledRejection');
        expect(event.reason).toBe('Promise rejected');
        done();
      });
      
      // Simulate unhandled rejection
      process.emit('unhandledRejection', 'Promise rejected', Promise.resolve());
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      errorHandler.initialize(mockLogger);
    });

    it('should cleanup resources', () => {
      const error = new Error('Test error');
      errorHandler.recordError('test', error);
      errorHandler.setFallbackContent('image', 'test.jpg', { fallback: true });
      
      errorHandler.cleanup();
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(0);
      expect(errorHandler.fallbackContent.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith('ErrorHandler cleanup completed');
    });
  });
});