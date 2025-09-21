const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const DailyRotateFile = require('winston-daily-rotate-file');

/**
 * Centralized logging service with configurable levels, structured logging,
 * and log rotation capabilities for the Sähkökilta Advertisement TV system
 */
class LoggingService {
  constructor(options = {}) {
    this.options = {
      level: 'info',
      logPath: './logs',
      maxFileSize: '10MB',
      maxFiles: 5,
      datePattern: 'YYYY-MM-DD',
      enableConsole: true,
      enableFile: true,
      enableRotation: true,
      ...options
    };
    
    this.logger = null;
    this.initialized = false;
    this.loggers = new Map(); // For module-specific loggers
  }

  /**
   * Initialize the logging service
   * @param {Object} config - Optional configuration override
   */
  async initialize(config = {}) {
    try {
      // Merge configuration
      this.options = { ...this.options, ...config };
      
      // Ensure log directory exists
      if (this.options.enableFile) {
        await this.ensureLogDirectory();
      }
      
      // Create main logger
      this.logger = this.createLogger('main');
      
      this.initialized = true;
      this.logger.info('LoggingService initialized successfully', {
        level: this.options.level,
        logPath: this.options.logPath,
        enableFile: this.options.enableFile,
        enableRotation: this.options.enableRotation
      });
      
    } catch (error) {
      throw new Error(`Failed to initialize LoggingService: ${error.message}`);
    }
  }

  /**
   * Create a logger instance with specified configuration
   * @param {string} service - Service name for the logger
   * @param {Object} options - Logger-specific options
   * @returns {Object} Winston logger instance
   */
  createLogger(service = 'default', options = {}) {
    const loggerOptions = { ...this.options, ...options };
    
    const transports = [];
    
    // Console transport
    if (loggerOptions.enableConsole && process.env.NODE_ENV !== 'test') {
      transports.push(new winston.transports.Console({
        level: loggerOptions.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, service: svc, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${svc || service}] ${level}: ${message}${metaStr}`;
          })
        )
      }));
    }
    
    // File transport with rotation
    if (loggerOptions.enableFile) {
      if (loggerOptions.enableRotation) {
        // Daily rotate file transport
        transports.push(new DailyRotateFile({
          filename: path.join(loggerOptions.logPath, `${service}-%DATE%.log`),
          datePattern: loggerOptions.datePattern,
          maxSize: loggerOptions.maxFileSize,
          maxFiles: loggerOptions.maxFiles,
          level: loggerOptions.level,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        }));
        
        // Error log file
        transports.push(new DailyRotateFile({
          filename: path.join(loggerOptions.logPath, `${service}-error-%DATE%.log`),
          datePattern: loggerOptions.datePattern,
          maxSize: loggerOptions.maxFileSize,
          maxFiles: loggerOptions.maxFiles,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        }));
      } else {
        // Simple file transport
        transports.push(new winston.transports.File({
          filename: path.join(loggerOptions.logPath, `${service}.log`),
          level: loggerOptions.level,
          maxsize: this.parseSize(loggerOptions.maxFileSize),
          maxFiles: loggerOptions.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        }));
      }
    }
    
    return winston.createLogger({
      level: loggerOptions.level,
      defaultMeta: { service },
      transports,
      exitOnError: false
    });
  }

  /**
   * Get or create a logger for a specific module/service
   * @param {string} moduleName - Name of the module
   * @param {Object} options - Optional logger configuration
   * @returns {Object} Logger instance for the module
   */
  getLogger(moduleName, options = {}) {
    if (!this.initialized) {
      throw new Error('LoggingService must be initialized before getting loggers');
    }
    
    if (!this.loggers.has(moduleName)) {
      const logger = this.createLogger(moduleName, options);
      this.loggers.set(moduleName, logger);
    }
    
    return this.loggers.get(moduleName);
  }

  /**
   * Get the main logger instance
   * @returns {Object} Main logger instance
   */
  getMainLogger() {
    if (!this.initialized) {
      throw new Error('LoggingService must be initialized before getting main logger');
    }
    
    return this.logger;
  }

  /**
   * Log structured data with context
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @param {string} moduleName - Optional module name
   */
  log(level, message, meta = {}, moduleName = 'main') {
    const logger = moduleName === 'main' ? this.getMainLogger() : this.getLogger(moduleName);
    
    // Add timestamp and context to metadata
    const enrichedMeta = {
      ...meta,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    logger.log(level, message, enrichedMeta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   * @param {string} moduleName - Optional module name
   */
  debug(message, meta = {}, moduleName = 'main') {
    this.log('debug', message, meta, moduleName);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   * @param {string} moduleName - Optional module name
   */
  info(message, meta = {}, moduleName = 'main') {
    this.log('info', message, meta, moduleName);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   * @param {string} moduleName - Optional module name
   */
  warn(message, meta = {}, moduleName = 'main') {
    this.log('warn', message, meta, moduleName);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata (can include error object)
   * @param {string} moduleName - Optional module name
   */
  error(message, meta = {}, moduleName = 'main') {
    // If meta contains an error object, extract stack trace
    if (meta.error && meta.error instanceof Error) {
      meta.stack = meta.error.stack;
      meta.errorMessage = meta.error.message;
      meta.errorName = meta.error.name;
    }
    
    this.log('error', message, meta, moduleName);
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} meta - Additional metadata
   * @param {string} moduleName - Optional module name
   */
  performance(operation, duration, meta = {}, moduleName = 'main') {
    this.info(`Performance: ${operation}`, {
      ...meta,
      operation,
      duration,
      performanceMetric: true
    }, moduleName);
  }

  /**
   * Log system resource usage
   * @param {Object} resources - Resource usage data
   * @param {string} moduleName - Optional module name
   */
  systemMetrics(resources = {}, moduleName = 'main') {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.info('System metrics', {
      ...resources,
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      systemMetric: true
    }, moduleName);
  }

  /**
   * Set log level for all loggers or specific logger
   * @param {string} level - New log level
   * @param {string} moduleName - Optional specific module name
   */
  setLevel(level, moduleName = null) {
    if (!this.initialized) {
      throw new Error('LoggingService must be initialized before setting level');
    }
    
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${validLevels.join(', ')}`);
    }
    
    if (moduleName) {
      const logger = this.getLogger(moduleName);
      logger.level = level;
    } else {
      // Set level for all loggers
      this.options.level = level;
      this.logger.level = level;
      
      for (const logger of this.loggers.values()) {
        logger.level = level;
      }
    }
    
    this.info(`Log level changed to: ${level}`, { moduleName: moduleName || 'all' });
  }

  /**
   * Get current log level
   * @param {string} moduleName - Optional module name
   * @returns {string} Current log level
   */
  getLevel(moduleName = null) {
    if (!this.initialized) {
      return this.options.level;
    }
    
    if (moduleName) {
      const logger = this.getLogger(moduleName);
      return logger.level;
    }
    
    return this.logger.level;
  }

  /**
   * Clean up old log files
   * @param {number} maxAge - Maximum age in days (default: 30)
   */
  async cleanupLogs(maxAge = 30) {
    if (!this.options.enableFile) {
      return;
    }
    
    try {
      const logDir = this.options.logPath;
      const files = await fs.readdir(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && file.endsWith('.log') && stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      this.info(`Log cleanup completed`, { 
        deletedFiles: deletedCount, 
        maxAge,
        logDirectory: logDir 
      });
      
    } catch (error) {
      this.error('Failed to cleanup logs', { error });
    }
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  async getLogStats() {
    const stats = {
      initialized: this.initialized,
      level: this.options.level,
      logPath: this.options.logPath,
      activeLoggers: Array.from(this.loggers.keys()),
      loggerCount: this.loggers.size
    };
    
    if (this.options.enableFile) {
      try {
        const files = await fs.readdir(this.options.logPath);
        const logFiles = files.filter(file => file.endsWith('.log'));
        
        stats.logFiles = logFiles.length;
        stats.logFileNames = logFiles;
        
        // Calculate total log directory size
        let totalSize = 0;
        for (const file of logFiles) {
          const filePath = path.join(this.options.logPath, file);
          const fileStats = await fs.stat(filePath);
          totalSize += fileStats.size;
        }
        
        stats.totalLogSize = totalSize;
        stats.totalLogSizeFormatted = this.formatBytes(totalSize);
        
      } catch (error) {
        stats.logFilesError = error.message;
      }
    }
    
    return stats;
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.options.logPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create log directory: ${error.message}`);
    }
  }

  /**
   * Parse size string to bytes
   * @param {string} sizeStr - Size string (e.g., '10MB', '1GB')
   * @returns {number} Size in bytes
   */
  parseSize(sizeStr) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]{1,2})$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }
    
    const [, size, unit] = match;
    const multiplier = units[unit.toUpperCase()];
    
    if (!multiplier) {
      throw new Error(`Unknown size unit: ${unit}`);
    }
    
    return Math.floor(parseFloat(size) * multiplier);
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Shutdown the logging service gracefully
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    this.info('LoggingService shutting down');
    
    // Close all loggers
    if (this.logger) {
      this.logger.end();
    }
    
    for (const logger of this.loggers.values()) {
      logger.end();
    }
    
    // Clear logger references
    this.loggers.clear();
    this.logger = null;
    this.initialized = false;
  }
}

module.exports = LoggingService;