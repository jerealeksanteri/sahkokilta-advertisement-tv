const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const EventEmitter = require('events');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const winston = require('winston');

/**
 * Content service for managing configuration files with file watching and validation
 * Provides centralized content management with event-driven updates
 */
class ContentService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      watchDelay: 1000, // Debounce delay for file changes
      maxRetries: 3,
      retryDelay: 1000,
      enableCaching: true,
      ...options
    };
    
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    
    this.schemas = new Map();
    this.contentCache = new Map();
    this.watchers = new Map();
    this.watchedFiles = new Set();
    this.debounceTimers = new Map();
    
    // Initialize logger with environment-specific configuration
    this.logger = this.createLogger();
  }

  /**
   * Initialize the content service
   * @param {string} schemasPath - Path to schemas directory
   */
  async initialize(schemasPath = path.join(__dirname, '../schemas')) {
    try {
      await this.loadSchemas(schemasPath);
      this.logger.info('ContentService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ContentService', { error: error.message });
      throw new Error(`ContentService initialization failed: ${error.message}`);
    }
  }

  /**
   * Load JSON schemas from directory
   * @param {string} schemasPath - Path to schemas directory
   */
  async loadSchemas(schemasPath) {
    try {
      const schemaFiles = await fs.readdir(schemasPath);
      const jsonSchemas = schemaFiles.filter(file => file.endsWith('.schema.json'));
      
      for (const schemaFile of jsonSchemas) {
        const schemaPath = path.join(schemasPath, schemaFile);
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        
        const schemaKey = schemaFile.replace('.schema.json', '');
        this.schemas.set(schemaKey, schema);
        this.ajv.addSchema(schema, schemaKey);
        
        this.logger.debug(`Loaded schema: ${schemaKey}`);
      }
      
      this.logger.info(`Loaded ${jsonSchemas.length} schemas`);
    } catch (error) {
      throw new Error(`Failed to load schemas: ${error.message}`);
    }
  }

  /**
   * Load configuration file with validation and caching
   * @param {string} filePath - Path to configuration file
   * @param {string} schemaKey - Schema key for validation
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loaded and validated configuration
   */
  async loadConfiguration(filePath, schemaKey, options = {}) {
    const opts = { useCache: this.options.enableCaching, ...options };
    const absolutePath = path.resolve(filePath);
    const cacheKey = `${absolutePath}:${schemaKey}`;
    
    // Return cached version if available and requested
    if (opts.useCache && this.contentCache.has(cacheKey)) {
      this.logger.debug(`Returning cached configuration: ${filePath}`);
      return this.contentCache.get(cacheKey);
    }
    
    let retries = 0;
    while (retries <= this.options.maxRetries) {
      try {
        // Check file existence
        await fs.access(absolutePath);
        
        // Read and parse file
        const content = await this.readConfigurationFile(absolutePath);
        
        // Validate content
        const validationResult = this.validateContent(content, schemaKey);
        if (!validationResult.valid) {
          const error = new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
          error.code = 'VALIDATION_ERROR';
          error.validationErrors = validationResult.errors;
          throw error;
        }
        
        // Cache the validated configuration
        if (opts.useCache) {
          this.contentCache.set(cacheKey, content);
        }
        
        this.logger.info(`Successfully loaded configuration: ${filePath}`);
        this.emit('content-loaded', { filePath, schemaKey, content });
        
        return content;
        
      } catch (error) {
        retries++;
        
        if (error.code === 'ENOENT') {
          const notFoundError = new Error(`Configuration file not found: ${absolutePath}`);
          notFoundError.code = 'FILE_NOT_FOUND';
          throw notFoundError;
        }
        
        if (error.code === 'VALIDATION_ERROR' || retries > this.options.maxRetries) {
          this.logger.error(`Failed to load configuration: ${filePath}`, { 
            error: error.message,
            retries 
          });
          this.emit('validation-error', { filePath, schemaKey, error });
          throw error;
        }
        
        this.logger.warn(`Retrying configuration load: ${filePath}`, { 
          attempt: retries,
          error: error.message 
        });
        
        await this.delay(this.options.retryDelay);
      }
    }
  }

  /**
   * Read and parse configuration file
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<Object>} Parsed configuration object
   */
  async readConfigurationFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return JSON.parse(content);
      case '.yaml':
      case '.yml':
        // Note: YAML support would require js-yaml dependency
        throw new Error('YAML support not implemented yet');
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Validate content against schema
   * @param {Object} content - Content to validate
   * @param {string} schemaKey - Schema key for validation
   * @returns {Object} Validation result
   */
  validateContent(content, schemaKey) {
    if (!this.schemas.has(schemaKey)) {
      return {
        valid: false,
        errors: [`Schema not found: ${schemaKey}`]
      };
    }
    
    const validate = this.ajv.getSchema(schemaKey);
    const valid = validate(content);
    
    if (!valid) {
      const errors = validate.errors.map(error => {
        const instancePath = error.instancePath || 'root';
        const message = error.message;
        const allowedValues = error.params?.allowedValues ? 
          ` (allowed: ${error.params.allowedValues.join(', ')})` : '';
        return `${instancePath}: ${message}${allowedValues}`;
      });
      
      return {
        valid: false,
        errors
      };
    }
    
    return {
      valid: true,
      errors: []
    };
  }

  /**
   * Watch files for changes and emit events
   * @param {string|Array<string>} paths - File paths to watch
   * @param {Object} options - Watch options
   */
  watchFiles(paths, options = {}) {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const opts = {
      schemaKey: null,
      persistent: true,
      ignoreInitial: true,
      ...options
    };
    
    pathArray.forEach(filePath => {
      const absolutePath = path.resolve(filePath);
      
      if (this.watchedFiles.has(absolutePath)) {
        this.logger.debug(`File already being watched: ${absolutePath}`);
        return;
      }
      
      try {
        const watcher = chokidar.watch(absolutePath, {
          persistent: opts.persistent,
          ignoreInitial: opts.ignoreInitial,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 100
          }
        });
        
        watcher.on('change', () => {
          this.handleFileChange(absolutePath, opts.schemaKey);
        });
        
        watcher.on('unlink', () => {
          this.handleFileDelete(absolutePath);
        });
        
        watcher.on('error', (error) => {
          this.logger.error(`File watcher error for ${absolutePath}`, { error: error.message });
          this.emit('watch-error', { filePath: absolutePath, error });
        });
        
        this.watchers.set(absolutePath, watcher);
        this.watchedFiles.add(absolutePath);
        
        this.logger.info(`Started watching file: ${absolutePath}`);
        
      } catch (error) {
        this.logger.error(`Failed to watch file: ${absolutePath}`, { error: error.message });
        this.emit('watch-error', { filePath: absolutePath, error });
      }
    });
  }

  /**
   * Handle file change events with debouncing
   * @param {string} filePath - Changed file path
   * @param {string} schemaKey - Optional schema key for validation
   */
  handleFileChange(filePath, schemaKey = null) {
    // Clear existing debounce timer
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath));
    }
    
    // Set new debounce timer
    const timer = setTimeout(async () => {
      try {
        this.logger.info(`File changed: ${filePath}`);
        
        // Clear cache for this file
        this.clearCacheForFile(filePath);
        
        // If schema key is provided, reload and validate
        if (schemaKey) {
          const content = await this.loadConfiguration(filePath, schemaKey);
          this.emit('content-updated', { filePath, schemaKey, content });
        } else {
          this.emit('file-changed', { filePath });
        }
        
      } catch (error) {
        this.logger.error(`Error handling file change: ${filePath}`, { error: error.message });
        this.emit('content-error', { filePath, schemaKey, error });
      } finally {
        this.debounceTimers.delete(filePath);
      }
    }, this.options.watchDelay);
    
    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Handle file deletion events
   * @param {string} filePath - Deleted file path
   */
  handleFileDelete(filePath) {
    this.logger.warn(`File deleted: ${filePath}`);
    this.clearCacheForFile(filePath);
    this.emit('file-deleted', { filePath });
  }

  /**
   * Stop watching a file or all files
   * @param {string} filePath - Optional specific file path to stop watching
   */
  async stopWatching(filePath = null) {
    if (filePath) {
      const absolutePath = path.resolve(filePath);
      const watcher = this.watchers.get(absolutePath);
      
      if (watcher) {
        await watcher.close();
        this.watchers.delete(absolutePath);
        this.watchedFiles.delete(absolutePath);
        this.logger.info(`Stopped watching file: ${absolutePath}`);
      }
    } else {
      // Stop watching all files
      for (const [path, watcher] of this.watchers) {
        await watcher.close();
        this.logger.info(`Stopped watching file: ${path}`);
      }
      
      this.watchers.clear();
      this.watchedFiles.clear();
    }
  }

  /**
   * Clear cache for specific file or all cache
   * @param {string} filePath - Optional specific file path to clear from cache
   */
  clearCacheForFile(filePath = null) {
    if (filePath) {
      const absolutePath = path.resolve(filePath);
      for (const [cacheKey] of this.contentCache) {
        if (cacheKey.startsWith(absolutePath)) {
          this.contentCache.delete(cacheKey);
        }
      }
    } else {
      this.contentCache.clear();
    }
  }

  /**
   * Get available schema keys
   * @returns {Array<string>} Array of available schema keys
   */
  getAvailableSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(path.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get watched files list
   * @returns {Array<string>} Array of currently watched file paths
   */
  getWatchedFiles() {
    return Array.from(this.watchedFiles);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.contentCache.size,
      keys: Array.from(this.contentCache.keys())
    };
  }

  /**
   * Notify about content changes (for manual triggering)
   * @param {string} filePath - File path that changed
   * @param {Object} content - New content
   * @param {string} schemaKey - Schema key for the content
   */
  notifyChange(filePath, content, schemaKey) {
    this.emit('content-updated', { filePath, schemaKey, content });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Stop all file watchers
    await this.stopWatching();
    
    // Clear caches
    this.contentCache.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    this.logger.info('ContentService cleanup completed');
  }

  /**
   * Create logger instance with environment-specific configuration
   * @returns {Object} Logger instance
   */
  createLogger() {
    // Use console logging in test environment
    if (process.env.NODE_ENV === 'test') {
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      };
    }
    
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'ContentService' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Utility method for delays
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ContentService;