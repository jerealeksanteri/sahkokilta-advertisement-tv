const ContentService = require('../../services/ContentService');
const LoggingService = require('../../services/LoggingService');
const { ErrorHandler, RecoveryAction } = require('../../services/ErrorHandler');
const fs = require('fs').promises;
const path = require('path');

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

describe('Error Handling Integration', () => {
  let contentService;
  let loggingService;
  let errorHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize logging service
    loggingService = new LoggingService({
      enableConsole: false,
      enableFile: false
    });
    await loggingService.initialize();
    
    // Initialize content service
    contentService = new ContentService();
    
    // Initialize error handler
    errorHandler = new ErrorHandler();
    errorHandler.initialize(loggingService.getMainLogger());
  });

  afterEach(async () => {
    if (contentService) {
      await contentService.cleanup();
    }
    if (errorHandler) {
      errorHandler.cleanup();
    }
    if (loggingService) {
      await loggingService.shutdown();
    }
  });

  describe('Configuration Error Recovery', () => {
    beforeEach(async () => {
      // Mock schema loading
      fs.readdir.mockResolvedValue(['branding-config.schema.json']);
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('schema')) {
          return Promise.resolve(JSON.stringify({
            type: 'object',
            properties: {
              logo: { type: 'object' },
              theme: { type: 'object' }
            },
            required: ['logo']
          }));
        }
        throw new Error('File not found');
      });
      
      await contentService.initialize();
    });

    it('should use fallback configuration when file not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      let fallbackUsed = false;
      contentService.on('fallback-used', () => {
        fallbackUsed = true;
      });
      
      const config = await contentService.loadConfiguration(
        '/nonexistent/config.json',
        'branding-config'
      );
      
      expect(fallbackUsed).toBe(true);
      expect(config).toEqual(expect.objectContaining({
        logo: expect.any(Object),
        theme: expect.any(Object)
      }));
    });

    it('should handle validation errors with fallback', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('schema')) {
          return Promise.resolve(JSON.stringify({
            type: 'object',
            properties: {
              logo: { type: 'object' }
            },
            required: ['logo']
          }));
        }
        // Return invalid configuration
        return Promise.resolve(JSON.stringify({ invalid: 'config' }));
      });
      
      let fallbackUsed = false;
      contentService.on('fallback-used', () => {
        fallbackUsed = true;
      });
      
      const config = await contentService.loadConfiguration(
        '/invalid/config.json',
        'branding-config'
      );
      
      expect(fallbackUsed).toBe(true);
      expect(config).toEqual(expect.objectContaining({
        logo: expect.any(Object)
      }));
    });
  });

  describe('Error Statistics and Monitoring', () => {
    it('should track error statistics across services', () => {
      const error1 = new Error('Config error');
      const error2 = new Error('Content error');
      
      errorHandler.handleConfigError(error1, '/config1.json', 'branding-config');
      errorHandler.handleContentError(error2, '/image.jpg', 'image');
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.errors['config:/config1.json:branding-config']).toBeDefined();
      expect(stats.errors['content:/image.jpg']).toBeDefined();
    });

    it('should handle system resource constraints', () => {
      const error = new Error('Memory exhausted');
      const resourceInfo = { memoryUsage: 0.95, cpuUsage: 0.6 };
      
      const recovery = errorHandler.handleSystemError(error, resourceInfo);
      
      expect(recovery.action).toBe(RecoveryAction.USE_FALLBACK);
      expect(recovery.fallback.degradationLevel).toBe(1);
      expect(recovery.fallback.imageQuality).toBe('medium');
      expect(errorHandler.degradationLevel).toBe(1);
    });

    it('should emit degradation events for monitoring', (done) => {
      let eventCount = 0;
      errorHandler.on('degradation-changed', (event) => {
        eventCount++;
        if (eventCount === 1) {
          expect(event.oldLevel).toBe(0);
          expect(event.newLevel).toBe(1);
        } else if (eventCount === 2) {
          expect(event.oldLevel).toBe(1);
          expect(event.newLevel).toBe(2);
          done();
        }
      });
      
      const error = new Error('Critical resource constraint');
      const resourceInfo = { memoryUsage: 0.95, cpuUsage: 0.95 };
      
      // Trigger multiple constraints to reach level 2
      errorHandler.handleSystemError(error, resourceInfo);
      errorHandler.handleSystemError(error, resourceInfo);
    });
  });

  describe('Fallback Content Management', () => {
    it('should provide appropriate fallbacks for different content types', () => {
      // Test image fallback
      const imageFallback = errorHandler.getFallbackContent('image', '/missing/image.jpg');
      expect(imageFallback.type).toBe('placeholder');
      expect(imageFallback.src).toContain('data:image/svg+xml');
      
      // Test logo fallback
      const logoFallback = errorHandler.getFallbackContent('logo', '/missing/logo.png');
      expect(logoFallback.type).toBe('text');
      expect(logoFallback.content).toBe('Sähkökilta ry');
      
      // Test sponsor fallback
      const sponsorFallback = errorHandler.getFallbackContent('sponsor', '/missing/sponsor.png');
      expect(sponsorFallback.type).toBe('text');
      expect(sponsorFallback.content).toContain('unavailable');
    });

    it('should allow custom fallback content registration', () => {
      const customFallback = {
        type: 'custom',
        content: 'Custom fallback content'
      };
      
      errorHandler.setFallbackContent('image', '/specific/image.jpg', customFallback);
      
      const retrieved = errorHandler.getFallbackContent('image', '/specific/image.jpg');
      expect(retrieved).toEqual(customFallback);
    });
  });

  describe('Process Error Handling', () => {
    it('should handle critical errors and emit events', (done) => {
      errorHandler.on('critical-error', (event) => {
        expect(event.type).toBe('uncaughtException');
        expect(event.error).toBeInstanceOf(Error);
        done();
      });
      
      // Simulate uncaught exception
      const testError = new Error('Critical system error');
      process.emit('uncaughtException', testError);
    });

    it('should handle unhandled promise rejections', (done) => {
      errorHandler.on('critical-error', (event) => {
        expect(event.type).toBe('unhandledRejection');
        expect(event.reason).toBe('Promise rejection reason');
        done();
      });
      
      // Simulate unhandled rejection
      process.emit('unhandledRejection', 'Promise rejection reason', Promise.resolve());
    });
  });

  describe('Service Integration', () => {
    it('should integrate error handling across all services', async () => {
      // Mock schema loading for content service
      fs.readdir.mockResolvedValue(['system-config.schema.json']);
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('schema')) {
          return Promise.resolve(JSON.stringify({
            type: 'object',
            properties: {
              display: { type: 'object' }
            }
          }));
        }
        throw new Error('Configuration file not found');
      });
      
      await contentService.initialize();
      
      // Test that content service uses error handler for recovery
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      const config = await contentService.loadConfiguration(
        '/missing/system.json',
        'system-config'
      );
      
      // Should get default system configuration from error handler
      expect(config).toEqual(expect.objectContaining({
        display: expect.objectContaining({
          resolution: { width: 1920, height: 1080 }
        })
      }));
    });
  });
});