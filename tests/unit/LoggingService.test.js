const LoggingService = require('../../services/LoggingService');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// Mock winston to avoid actual file operations in tests
jest.mock('winston', () => {
  const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    end: jest.fn(),
    level: 'info'
  });

  return {
    createLogger: jest.fn(() => createMockLogger()),
    format: {
      combine: jest.fn(() => 'combined-format'),
      colorize: jest.fn(() => 'colorize-format'),
      timestamp: jest.fn(() => 'timestamp-format'),
      printf: jest.fn(() => 'printf-format'),
      errors: jest.fn(() => 'errors-format'),
      json: jest.fn(() => 'json-format')
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  };
});

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    filename: 'mocked-rotate-file'
  }));
});

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('LoggingService', () => {
  let loggingService;
  const testLogPath = './test-logs';

  beforeEach(() => {
    jest.clearAllMocks();
    loggingService = new LoggingService({
      logPath: testLogPath,
      level: 'debug',
      enableConsole: false, // Disable console for tests
      enableFile: true
    });
  });

  afterEach(async () => {
    if (loggingService.initialized) {
      await loggingService.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should create LoggingService with default options', () => {
      const service = new LoggingService();
      
      expect(service.options.level).toBe('info');
      expect(service.options.logPath).toBe('./logs');
      expect(service.options.maxFileSize).toBe('10MB');
      expect(service.options.maxFiles).toBe(5);
      expect(service.initialized).toBe(false);
    });

    it('should merge custom options with defaults', () => {
      const customOptions = {
        level: 'debug',
        logPath: './custom-logs',
        maxFiles: 10
      };
      
      const service = new LoggingService(customOptions);
      
      expect(service.options.level).toBe('debug');
      expect(service.options.logPath).toBe('./custom-logs');
      expect(service.options.maxFiles).toBe(10);
      expect(service.options.maxFileSize).toBe('10MB'); // Default preserved
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      fs.mkdir.mockResolvedValue();
      
      await loggingService.initialize();
      
      expect(loggingService.initialized).toBe(true);
      expect(loggingService.logger).toBeDefined();
      expect(fs.mkdir).toHaveBeenCalledWith(testLogPath, { recursive: true });
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should merge initialization config with constructor options', async () => {
      fs.mkdir.mockResolvedValue();
      
      const initConfig = {
        level: 'error',
        maxFiles: 3
      };
      
      await loggingService.initialize(initConfig);
      
      expect(loggingService.options.level).toBe('error');
      expect(loggingService.options.maxFiles).toBe(3);
      expect(loggingService.options.logPath).toBe(testLogPath); // Original preserved
    });

    it('should throw error if log directory creation fails', async () => {
      const error = new Error('Permission denied');
      fs.mkdir.mockRejectedValue(error);
      
      await expect(loggingService.initialize()).rejects.toThrow(
        'Failed to initialize LoggingService: Failed to create log directory: Permission denied'
      );
      
      expect(loggingService.initialized).toBe(false);
    });

    it('should skip directory creation when file logging is disabled', async () => {
      loggingService.options.enableFile = false;
      
      await loggingService.initialize();
      
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(loggingService.initialized).toBe(true);
    });
  });

  describe('Logger Creation', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should create logger with correct service name', () => {
      const logger = loggingService.createLogger('test-service');
      
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: { service: 'test-service' }
        })
      );
    });

    it('should create logger with custom options', () => {
      const customOptions = { level: 'warn' };
      loggingService.createLogger('test-service', customOptions);
      
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn'
        })
      );
    });

    it('should cache module loggers', () => {
      const logger1 = loggingService.getLogger('module1');
      const logger2 = loggingService.getLogger('module1');
      
      expect(logger1).toBe(logger2);
      expect(winston.createLogger).toHaveBeenCalledTimes(2); // Main + module1
    });

    it('should create separate loggers for different modules', () => {
      const logger1 = loggingService.getLogger('module1');
      const logger2 = loggingService.getLogger('module2');
      
      // Since winston.createLogger creates new instances, they should be different
      expect(winston.createLogger).toHaveBeenCalledTimes(3); // Main + module1 + module2
      expect(loggingService.loggers.has('module1')).toBe(true);
      expect(loggingService.loggers.has('module2')).toBe(true);
    });
  });

  describe('Logging Methods', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should log debug messages with metadata', () => {
      const meta = { userId: 123 };
      loggingService.debug('Debug message', meta);
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'debug',
        'Debug message',
        expect.objectContaining({
          userId: 123,
          timestamp: expect.any(String),
          pid: expect.any(Number),
          memory: expect.any(Object),
          uptime: expect.any(Number)
        })
      );
    });

    it('should log info messages', () => {
      loggingService.info('Info message');
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'info',
        'Info message',
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });

    it('should log warning messages', () => {
      loggingService.warn('Warning message');
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'warn',
        'Warning message',
        expect.any(Object)
      );
    });

    it('should log error messages with error object processing', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      loggingService.error('Error occurred', { error });
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'error',
        'Error occurred',
        expect.objectContaining({
          error,
          stack: 'Error stack trace',
          errorMessage: 'Test error',
          errorName: 'Error'
        })
      );
    });

    it('should log to specific module logger', () => {
      const moduleLogger = loggingService.getLogger('test-module');
      loggingService.info('Module message', {}, 'test-module');
      
      expect(moduleLogger.log).toHaveBeenCalledWith(
        'info',
        'Module message',
        expect.any(Object)
      );
    });
  });

  describe('Performance Logging', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should log performance metrics', () => {
      loggingService.performance('database-query', 150, { query: 'SELECT * FROM users' });
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'info',
        'Performance: database-query',
        expect.objectContaining({
          operation: 'database-query',
          duration: 150,
          query: 'SELECT * FROM users',
          performanceMetric: true
        })
      );
    });

    it('should log system metrics', () => {
      loggingService.systemMetrics({ customMetric: 'value' });
      
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'info',
        'System metrics',
        expect.objectContaining({
          customMetric: 'value',
          memory: expect.any(Object),
          cpu: expect.any(Object),
          uptime: expect.any(Number),
          systemMetric: true
        })
      );
    });
  });

  describe('Log Level Management', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should set log level for all loggers', () => {
      const moduleLogger = loggingService.getLogger('test-module');
      
      loggingService.setLevel('error');
      
      expect(loggingService.options.level).toBe('error');
      expect(loggingService.logger.level).toBe('error');
      expect(moduleLogger.level).toBe('error');
    });

    it('should set log level for specific module', () => {
      const moduleLogger = loggingService.getLogger('test-module');
      const originalMainLevel = loggingService.logger.level;
      
      loggingService.setLevel('warn', 'test-module');
      
      expect(moduleLogger.level).toBe('warn');
      expect(loggingService.logger.level).toBe(originalMainLevel); // Should remain unchanged
    });

    it('should throw error for invalid log level', () => {
      expect(() => {
        loggingService.setLevel('invalid');
      }).toThrow('Invalid log level: invalid');
    });

    it('should get current log level', () => {
      const currentLevel = loggingService.getLevel();
      expect(['debug', 'info', 'warn', 'error']).toContain(currentLevel);
      
      const moduleLogger = loggingService.getLogger('test-module');
      moduleLogger.level = 'warn';
      
      expect(loggingService.getLevel('test-module')).toBe('warn');
    });

    it('should return default level when not initialized', () => {
      const uninitializedService = new LoggingService({ level: 'error' });
      expect(uninitializedService.getLevel()).toBe('error');
    });
  });

  describe('Log Cleanup', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should clean up old log files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days old
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days old
      
      fs.readdir.mockResolvedValue(['old-file.log', 'recent-file.log', 'not-a-log.txt']);
      fs.stat.mockImplementation((filePath) => {
        if (filePath.includes('old-file.log')) {
          return Promise.resolve({ isFile: () => true, mtime: oldDate });
        }
        if (filePath.includes('recent-file.log')) {
          return Promise.resolve({ isFile: () => true, mtime: recentDate });
        }
        return Promise.resolve({ isFile: () => false });
      });
      fs.unlink.mockResolvedValue();
      
      await loggingService.cleanupLogs(30);
      
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(testLogPath, 'old-file.log'));
    });

    it('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      await loggingService.cleanupLogs();
      
      // Should not throw, but log the error
      expect(loggingService.logger.log).toHaveBeenCalledWith(
        'error',
        'Failed to cleanup logs',
        expect.objectContaining({
          error: expect.any(Error)
        })
      );
    });

    it('should skip cleanup when file logging is disabled', async () => {
      loggingService.options.enableFile = false;
      
      await loggingService.cleanupLogs();
      
      expect(fs.readdir).not.toHaveBeenCalled();
    });
  });

  describe('Log Statistics', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
    });

    it('should return basic statistics', async () => {
      loggingService.getLogger('module1');
      loggingService.getLogger('module2');
      
      fs.readdir.mockResolvedValue(['app.log', 'error.log', 'other.txt']);
      fs.stat.mockResolvedValue({ size: 1024 });
      
      const stats = await loggingService.getLogStats();
      
      expect(stats).toEqual(expect.objectContaining({
        initialized: true,
        level: 'debug',
        logPath: testLogPath,
        activeLoggers: ['module1', 'module2'],
        loggerCount: 2,
        logFiles: 2,
        logFileNames: ['app.log', 'error.log'],
        totalLogSize: 2048,
        totalLogSizeFormatted: '2 KB'
      }));
    });

    it('should handle file system errors in statistics', async () => {
      fs.readdir.mockRejectedValue(new Error('Access denied'));
      
      const stats = await loggingService.getLogStats();
      
      expect(stats.logFilesError).toBe('Access denied');
    });
  });

  describe('Utility Methods', () => {
    it('should parse size strings correctly', () => {
      expect(loggingService.parseSize('10MB')).toBe(10 * 1024 * 1024);
      expect(loggingService.parseSize('1GB')).toBe(1024 * 1024 * 1024);
      expect(loggingService.parseSize('500KB')).toBe(500 * 1024);
      expect(loggingService.parseSize('100B')).toBe(100);
    });

    it('should throw error for invalid size format', () => {
      expect(() => loggingService.parseSize('invalid')).toThrow('Invalid size format');
      expect(() => loggingService.parseSize('10XB')).toThrow('Unknown size unit');
    });

    it('should format bytes to human readable strings', () => {
      expect(loggingService.formatBytes(0)).toBe('0 B');
      expect(loggingService.formatBytes(1024)).toBe('1 KB');
      expect(loggingService.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(loggingService.formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getting logger before initialization', () => {
      const uninitializedService = new LoggingService();
      
      expect(() => {
        uninitializedService.getLogger('test');
      }).toThrow('LoggingService must be initialized before getting loggers');
    });

    it('should throw error when getting main logger before initialization', () => {
      const uninitializedService = new LoggingService();
      
      expect(() => {
        uninitializedService.getMainLogger();
      }).toThrow('LoggingService must be initialized before getting main logger');
    });

    it('should throw error when setting level before initialization', () => {
      const uninitializedService = new LoggingService();
      
      expect(() => {
        uninitializedService.setLevel('error');
      }).toThrow('LoggingService must be initialized before setting level');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully when initialized', async () => {
      fs.mkdir.mockResolvedValue();
      await loggingService.initialize();
      
      const moduleLogger = loggingService.getLogger('test-module');
      
      await loggingService.shutdown();
      
      expect(loggingService.logger).toBeNull();
      expect(loggingService.initialized).toBe(false);
      expect(loggingService.loggers.size).toBe(0);
    });

    it('should handle shutdown when not initialized', async () => {
      const uninitializedService = new LoggingService();
      
      await expect(uninitializedService.shutdown()).resolves.not.toThrow();
    });
  });
});