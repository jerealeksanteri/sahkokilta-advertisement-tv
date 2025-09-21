const EventEmitter = require('events');

/**
 * Comprehensive error handling service with recovery strategies,
 * graceful degradation, and fallback content management
 */
class ErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      enableGracefulDegradation: true,
      enableFallbackContent: true,
      memoryThreshold: 0.8, // 80% memory usage threshold
      cpuThreshold: 0.9, // 90% CPU usage threshold
      ...options
    };
    
    this.logger = null;
    this.retryCounters = new Map();
    this.errorStats = new Map();
    this.fallbackContent = new Map();
    this.degradationLevel = 0; // 0 = normal, 1 = reduced, 2 = minimal
    this.initialized = false;
    this.processHandlersSetup = false;
  }

  /**
   * Initialize the error handler with logger
   * @param {Object} logger - Logger instance
   */
  initialize(logger) {
    this.logger = logger;
    this.initialized = true;
    
    // Set up process-level error handlers
    this.setupProcessErrorHandlers();
    
    this.logger.info('ErrorHandler initialized', {
      maxRetries: this.options.maxRetries,
      gracefulDegradation: this.options.enableGracefulDegradation,
      fallbackContent: this.options.enableFallbackContent
    });
  }

  /**
   * Handle configuration errors with appropriate recovery strategies
   * @param {Error} error - Configuration error
   * @param {string} configPath - Path to the configuration file
   * @param {string} schemaKey - Schema key for the configuration
   * @returns {Object} Recovery action and fallback data
   */
  handleConfigError(error, configPath, schemaKey) {
    const errorKey = `config:${configPath}:${schemaKey}`;
    this.recordError(errorKey, error);
    
    this.logger.error('Configuration error occurred', {
      error: error.message,
      configPath,
      schemaKey,
      stack: error.stack
    });

    // Determine recovery action based on error type
    if (error.code === 'ENOENT') {
      // File not found - use default configuration
      return {
        action: RecoveryAction.USE_FALLBACK,
        fallback: this.getDefaultConfig(schemaKey),
        message: `Configuration file not found: ${configPath}. Using default configuration.`
      };
    }
    
    if (error.code === 'VALIDATION_ERROR') {
      // Invalid configuration - try to fix or use defaults
      const fixedConfig = this.attemptConfigFix(error, schemaKey);
      if (fixedConfig) {
        return {
          action: RecoveryAction.USE_FALLBACK,
          fallback: fixedConfig,
          message: `Configuration validation failed. Using corrected configuration.`
        };
      }
      
      return {
        action: RecoveryAction.USE_FALLBACK,
        fallback: this.getDefaultConfig(schemaKey),
        message: `Configuration validation failed. Using default configuration.`
      };
    }
    
    if (this.shouldRetry(errorKey)) {
      return {
        action: RecoveryAction.RETRY_OPERATION,
        retryDelay: this.getRetryDelay(errorKey),
        message: `Retrying configuration load for ${configPath}`
      };
    }
    
    return {
      action: RecoveryAction.USE_FALLBACK,
      fallback: this.getDefaultConfig(schemaKey),
      message: `Using default configuration after multiple failures`
    };
  }

  /**
   * Handle content loading errors (images, assets, etc.)
   * @param {Error} error - Content loading error
   * @param {string} contentPath - Path to the content
   * @param {string} contentType - Type of content (image, video, etc.)
   * @returns {Object} Recovery action and fallback content
   */
  handleContentError(error, contentPath, contentType) {
    const errorKey = `content:${contentPath}`;
    this.recordError(errorKey, error);
    
    this.logger.error('Content loading error occurred', {
      error: error.message,
      contentPath,
      contentType,
      stack: error.stack
    });

    // Check if we have fallback content for this type
    const fallbackContent = this.getFallbackContent(contentType, contentPath);
    
    if (fallbackContent) {
      return {
        action: RecoveryAction.USE_FALLBACK,
        fallback: fallbackContent,
        message: `Using fallback content for ${contentPath}`
      };
    }
    
    if (this.shouldRetry(errorKey)) {
      return {
        action: RecoveryAction.RETRY_OPERATION,
        retryDelay: this.getRetryDelay(errorKey),
        message: `Retrying content load for ${contentPath}`
      };
    }
    
    // Skip this content and continue
    return {
      action: RecoveryAction.SKIP_CONTENT,
      message: `Skipping failed content: ${contentPath}`
    };
  }

  /**
   * Handle system resource errors (memory, CPU, storage)
   * @param {Error} error - System error
   * @param {Object} resourceInfo - Resource usage information
   * @returns {Object} Recovery action and degradation strategy
   */
  handleSystemError(error, resourceInfo = {}) {
    const errorKey = `system:${error.name}`;
    this.recordError(errorKey, error);
    
    this.logger.error('System resource error occurred', {
      error: error.message,
      resourceInfo,
      currentDegradation: this.degradationLevel,
      stack: error.stack
    });

    // Check resource constraints and apply degradation
    if (resourceInfo.memoryUsage > this.options.memoryThreshold) {
      return this.handleMemoryConstraint(resourceInfo);
    }
    
    if (resourceInfo.cpuUsage > this.options.cpuThreshold) {
      return this.handleCpuConstraint(resourceInfo);
    }
    
    if (error.code === 'ENOSPC') {
      return this.handleStorageConstraint(resourceInfo);
    }
    
    return {
      action: RecoveryAction.NOTIFY_ADMIN,
      message: `System error requires attention: ${error.message}`,
      severity: 'high'
    };
  }

  /**
   * Handle display-related errors
   * @param {Error} error - Display error
   * @param {Object} displayInfo - Display information
   * @returns {Object} Recovery action
   */
  handleDisplayError(error, displayInfo = {}) {
    const errorKey = `display:${error.name}`;
    this.recordError(errorKey, error);
    
    this.logger.error('Display error occurred', {
      error: error.message,
      displayInfo,
      stack: error.stack
    });

    if (error.message.includes('resolution') || error.message.includes('display')) {
      // Use safe default resolution
      return {
        action: RecoveryAction.USE_FALLBACK,
        fallback: {
          resolution: { width: 1920, height: 1080 },
          orientation: 'landscape',
          scaleFactor: 1.0
        },
        message: 'Using safe default display settings'
      };
    }
    
    if (this.shouldRetry(errorKey)) {
      return {
        action: RecoveryAction.RETRY_OPERATION,
        retryDelay: this.getRetryDelay(errorKey),
        message: 'Retrying display operation'
      };
    }
    
    return {
      action: RecoveryAction.RESTART_MODULE,
      module: 'LayoutManager',
      message: 'Restarting layout manager due to display error'
    };
  }

  /**
   * Handle memory constraint by applying degradation
   * @param {Object} resourceInfo - Resource usage information
   * @returns {Object} Recovery action
   */
  handleMemoryConstraint(resourceInfo) {
    const newDegradationLevel = Math.min(this.degradationLevel + 1, 2);
    this.setDegradationLevel(newDegradationLevel);
    
    const strategies = [
      'Reducing image quality and disabling animations',
      'Using minimal UI and clearing caches',
      'Emergency mode: basic functionality only'
    ];
    
    return {
      action: RecoveryAction.USE_FALLBACK,
      fallback: {
        degradationLevel: newDegradationLevel,
        imageQuality: newDegradationLevel === 0 ? 'high' : newDegradationLevel === 1 ? 'medium' : 'low',
        animationsEnabled: newDegradationLevel === 0,
        cacheEnabled: newDegradationLevel < 2
      },
      message: `Memory constraint detected. ${strategies[newDegradationLevel]}`
    };
  }

  /**
   * Handle CPU constraint by reducing processing
   * @param {Object} resourceInfo - Resource usage information
   * @returns {Object} Recovery action
   */
  handleCpuConstraint(resourceInfo) {
    const newDegradationLevel = Math.min(this.degradationLevel + 1, 2);
    this.setDegradationLevel(newDegradationLevel);
    
    return {
      action: RecoveryAction.USE_FALLBACK,
      fallback: {
        degradationLevel: newDegradationLevel,
        refreshRate: newDegradationLevel === 0 ? 60 : newDegradationLevel === 1 ? 30 : 15,
        effectsEnabled: newDegradationLevel === 0,
        backgroundProcessing: newDegradationLevel < 2
      },
      message: `CPU constraint detected. Reducing processing load to level ${newDegradationLevel}`
    };
  }

  /**
   * Handle storage constraint
   * @param {Object} resourceInfo - Resource usage information
   * @returns {Object} Recovery action
   */
  handleStorageConstraint(resourceInfo) {
    return {
      action: RecoveryAction.USE_FALLBACK,
      fallback: {
        cleanupRequired: true,
        disableLogging: true,
        clearCache: true
      },
      message: 'Storage space low. Initiating cleanup procedures'
    };
  }

  /**
   * Set fallback content for specific content types
   * @param {string} contentType - Type of content
   * @param {string} contentPath - Original content path
   * @param {*} fallbackData - Fallback content data
   */
  setFallbackContent(contentType, contentPath, fallbackData) {
    const key = `${contentType}:${contentPath}`;
    this.fallbackContent.set(key, fallbackData);
    
    this.logger.debug('Fallback content registered', {
      contentType,
      contentPath,
      fallbackAvailable: true
    });
  }

  /**
   * Get fallback content for a specific type and path
   * @param {string} contentType - Type of content
   * @param {string} contentPath - Original content path
   * @returns {*} Fallback content or null
   */
  getFallbackContent(contentType, contentPath) {
    const specificKey = `${contentType}:${contentPath}`;
    const genericKey = `${contentType}:default`;
    
    return this.fallbackContent.get(specificKey) || 
           this.fallbackContent.get(genericKey) ||
           this.getDefaultFallbackContent(contentType);
  }

  /**
   * Get default fallback content for content types
   * @param {string} contentType - Type of content
   * @returns {*} Default fallback content
   */
  getDefaultFallbackContent(contentType) {
    const defaults = {
      'image': {
        type: 'placeholder',
        src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=',
        alt: 'Image not available'
      },
      'logo': {
        type: 'text',
        content: 'Sähkökilta ry',
        style: { fontSize: '24px', fontWeight: 'bold', color: '#FF6B35' }
      },
      'sponsor': {
        type: 'text',
        content: 'Sponsor content unavailable',
        style: { fontSize: '18px', color: '#666' }
      }
    };
    
    return defaults[contentType] || null;
  }

  /**
   * Get default configuration for schema types
   * @param {string} schemaKey - Schema key
   * @returns {Object} Default configuration
   */
  getDefaultConfig(schemaKey) {
    const defaults = {
      'branding-config': {
        logo: {
          path: 'assets/images/sahkokilta-logo-fallback.png',
          position: 'top-left',
          size: { width: 200, height: 100 }
        },
        theme: {
          colors: {
            primary: '#FF6B35',
            secondary: '#004E89',
            background: '#FFFFFF'
          }
        }
      },
      'sponsors-config': {
        sponsors: [],
        settings: {
          defaultDuration: 10000,
          transitionType: 'fade',
          fallbackMessage: 'No sponsors available'
        }
      },
      'system-config': {
        display: {
          resolution: { width: 1920, height: 1080 },
          orientation: 'landscape',
          scaleFactor: 1.0
        },
        performance: {
          refreshRate: 60,
          memoryLimit: '512MB'
        }
      }
    };
    
    return defaults[schemaKey] || {};
  }

  /**
   * Attempt to fix common configuration issues
   * @param {Error} error - Validation error
   * @param {string} schemaKey - Schema key
   * @returns {Object|null} Fixed configuration or null
   */
  attemptConfigFix(error, schemaKey) {
    if (!error.validationErrors) {
      return null;
    }
    
    // Simple fixes for common validation errors
    const fixes = {
      'missing required property': (path) => {
        const defaultConfig = this.getDefaultConfig(schemaKey);
        return this.setNestedProperty(defaultConfig, path, null);
      },
      'should be string': (path, value) => {
        return String(value);
      },
      'should be number': (path, value) => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      }
    };
    
    // This is a simplified fix attempt - in practice, you'd implement
    // more sophisticated configuration repair logic
    return null;
  }

  /**
   * Check if operation should be retried
   * @param {string} errorKey - Error key for tracking
   * @returns {boolean} Whether to retry
   */
  shouldRetry(errorKey) {
    const retryCount = this.retryCounters.get(errorKey) || 0;
    return retryCount <= this.options.maxRetries;
  }

  /**
   * Get retry delay with exponential backoff
   * @param {string} errorKey - Error key for tracking
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(errorKey) {
    const retryCount = this.retryCounters.get(errorKey) || 0;
    return this.options.retryDelay * Math.pow(2, retryCount - 1);
  }

  /**
   * Record error occurrence for statistics and retry tracking
   * @param {string} errorKey - Error key
   * @param {Error} error - Error object
   */
  recordError(errorKey, error) {
    // Update retry counter
    const retryCount = this.retryCounters.get(errorKey) || 0;
    this.retryCounters.set(errorKey, retryCount + 1);
    
    // Update error statistics
    const stats = this.errorStats.get(errorKey) || {
      count: 0,
      firstOccurrence: new Date(),
      lastOccurrence: null,
      errorTypes: new Set()
    };
    
    stats.count++;
    stats.lastOccurrence = new Date();
    stats.errorTypes.add(error.name);
    
    this.errorStats.set(errorKey, stats);
    
    // Emit error event for monitoring
    this.emit('error-recorded', {
      errorKey,
      error: error.message,
      retryCount: retryCount + 1,
      stats
    });
  }

  /**
   * Set degradation level and emit event
   * @param {number} level - Degradation level (0-2)
   */
  setDegradationLevel(level) {
    const oldLevel = this.degradationLevel;
    this.degradationLevel = Math.max(0, Math.min(2, level));
    
    if (oldLevel !== this.degradationLevel) {
      this.logger.warn('Degradation level changed', {
        oldLevel,
        newLevel: this.degradationLevel,
        reason: 'Resource constraints'
      });
      
      this.emit('degradation-changed', {
        oldLevel,
        newLevel: this.degradationLevel
      });
    }
  }

  /**
   * Reset degradation level to normal
   */
  resetDegradation() {
    this.setDegradationLevel(0);
  }

  /**
   * Get current error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {};
    
    for (const [key, data] of this.errorStats) {
      stats[key] = {
        ...data,
        errorTypes: Array.from(data.errorTypes)
      };
    }
    
    return {
      totalErrors: this.errorStats.size,
      degradationLevel: this.degradationLevel,
      errors: stats
    };
  }

  /**
   * Clear error statistics and retry counters
   */
  clearStats() {
    this.errorStats.clear();
    this.retryCounters.clear();
    
    if (this.logger) {
      this.logger.info('Error statistics cleared');
    }
  }

  /**
   * Setup process-level error handlers
   */
  setupProcessErrorHandlers() {
    // Only set up handlers if not already set up
    if (!this.processHandlersSetup) {
      this.uncaughtExceptionHandler = (error) => {
        if (this.logger) {
          this.logger.error('Uncaught exception', {
            error: error.message,
            stack: error.stack
          });
        }
        
        this.emit('critical-error', {
          type: 'uncaughtException',
          error
        });
      };
      
      this.unhandledRejectionHandler = (reason, promise) => {
        if (this.logger) {
          this.logger.error('Unhandled promise rejection', {
            reason: reason?.message || reason,
            stack: reason?.stack
          });
        }
        
        this.emit('critical-error', {
          type: 'unhandledRejection',
          reason,
          promise
        });
      };
      
      process.on('uncaughtException', this.uncaughtExceptionHandler);
      process.on('unhandledRejection', this.unhandledRejectionHandler);
      
      this.processHandlersSetup = true;
    }
  }

  /**
   * Cleanup error handler resources
   */
  cleanup() {
    this.clearStats();
    this.fallbackContent.clear();
    this.removeAllListeners();
    
    // Remove process handlers if they were set up
    if (this.processHandlersSetup) {
      process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
      process.removeListener('unhandledRejection', this.unhandledRejectionHandler);
      this.processHandlersSetup = false;
    }
    
    if (this.logger) {
      this.logger.info('ErrorHandler cleanup completed');
    }
  }
}

/**
 * Recovery action enumeration
 */
const RecoveryAction = {
  USE_FALLBACK: 'use_fallback',
  RETRY_OPERATION: 'retry_operation',
  SKIP_CONTENT: 'skip_content',
  RESTART_MODULE: 'restart_module',
  NOTIFY_ADMIN: 'notify_admin'
};

module.exports = { ErrorHandler, RecoveryAction };