/* Main Application Entry Point for Sähkökilta ry Advertisement TV
 * Initializes and manages the complete application lifecycle
 */

const path = require('path');
const ApplicationLifecycle = require('./ApplicationLifecycle');

class SahkokiltaAdvertisementTV {
  constructor() {
    this.lifecycle = null;
    this.config = null;
    this.started = false;
    
    this.log('Sähkökilta Advertisement TV application created');
  }
  
  /**
   * Initialize the application
   * @param {string} configPath - Path to configuration file
   * @returns {Promise<boolean>} Success status
   */
  async initialize(configPath = null) {
    try {
      // Load configuration
      this.config = await this.loadConfiguration(configPath);
      
      // Create lifecycle manager with configuration
      this.lifecycle = new ApplicationLifecycle(this.config.lifecycle || {});
      
      // Set up lifecycle event handlers
      this.setupLifecycleEventHandlers();
      
      this.log('Application initialized successfully');
      return true;
      
    } catch (error) {
      this.log(`Application initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Load application configuration
   * @param {string} configPath - Path to configuration file
   * @returns {Object} Configuration object
   */
  async loadConfiguration(configPath = null) {
    const defaultConfigPath = path.resolve(__dirname, '../config.js');
    const actualConfigPath = configPath || defaultConfigPath;
    
    try {
      // Clear require cache to ensure fresh config load
      delete require.cache[require.resolve(actualConfigPath)];
      
      const config = require(actualConfigPath);
      
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration: must be an object');
      }
      
      if (!config.modules || !Array.isArray(config.modules)) {
        throw new Error('Invalid configuration: modules array is required');
      }
      
      this.log(`Configuration loaded from: ${actualConfigPath}`);
      return config;
      
    } catch (error) {
      this.log(`Failed to load configuration from ${actualConfigPath}: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Set up lifecycle event handlers
   */
  setupLifecycleEventHandlers() {
    if (!this.lifecycle) {
      return;
    }
    
    // Startup events
    this.lifecycle.on('startup:begin', () => {
      this.log('Application startup beginning');
    });
    
    this.lifecycle.on('startup:complete', () => {
      this.log('Application startup completed');
      this.started = true;
    });
    
    this.lifecycle.on('startup:error', (error) => {
      this.log(`Application startup error: ${error.message}`, 'error');
    });
    
    // Module events
    this.lifecycle.on('modules:configured', (moduleNames) => {
      this.log(`Modules configured: ${moduleNames.join(', ')}`);
    });
    
    this.lifecycle.on('modules:initialized', () => {
      this.log('All modules initialized');
    });
    
    this.lifecycle.on('modules:ready', () => {
      this.log('All modules ready');
    });
    
    this.lifecycle.on('module:initializing', (moduleName) => {
      this.log(`Module initializing: ${moduleName}`);
    });
    
    this.lifecycle.on('module:initialized', (moduleName) => {
      this.log(`Module initialized: ${moduleName}`);
    });
    
    this.lifecycle.on('module:health_check_failed', (moduleName, error) => {
      this.log(`Module health check failed: ${moduleName} - ${error.message}`, 'warn');
    });
    
    // Shutdown events
    this.lifecycle.on('shutdown:begin', () => {
      this.log('Application shutdown beginning');
    });
    
    this.lifecycle.on('shutdown:complete', () => {
      this.log('Application shutdown completed');
      this.started = false;
    });
    
    this.lifecycle.on('shutdown:error', (error) => {
      this.log(`Application shutdown error: ${error.message}`, 'error');
    });
    
    // Error events
    this.lifecycle.on('error:uncaught_exception', (error) => {
      this.log(`Uncaught exception in application: ${error.message}`, 'error');
    });
    
    this.lifecycle.on('error:unhandled_rejection', (reason) => {
      this.log(`Unhandled rejection in application: ${reason}`, 'error');
    });
    
    // Signal events
    this.lifecycle.on('signal:sigterm', () => {
      this.log('Received SIGTERM signal');
    });
    
    this.lifecycle.on('signal:sigint', () => {
      this.log('Received SIGINT signal');
    });
    
    // Restart events
    this.lifecycle.on('restart:scheduled', (attempt) => {
      this.log(`Application restart scheduled (attempt ${attempt})`);
    });
    
    this.lifecycle.on('restart:failed', (error) => {
      this.log(`Application restart failed: ${error.message}`, 'error');
    });
    
    this.log('Lifecycle event handlers set up');
  }
  
  /**
   * Start the application
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    if (!this.lifecycle) {
      throw new Error('Application not initialized. Call initialize() first.');
    }
    
    if (this.started) {
      this.log('Application already started', 'warn');
      return true;
    }
    
    try {
      this.log('Starting Sähkökilta Advertisement TV application');
      
      const success = await this.lifecycle.start(this.config);
      
      if (success) {
        this.log('Application started successfully');
      } else {
        this.log('Application start failed', 'error');
      }
      
      return success;
      
    } catch (error) {
      this.log(`Application start failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Stop the application
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (!this.lifecycle) {
      this.log('Application not initialized', 'warn');
      return true;
    }
    
    if (!this.started) {
      this.log('Application not started', 'warn');
      return true;
    }
    
    try {
      this.log('Stopping Sähkökilta Advertisement TV application');
      
      const success = await this.lifecycle.stop();
      
      if (success) {
        this.log('Application stopped successfully');
      } else {
        this.log('Application stop failed', 'error');
      }
      
      return success;
      
    } catch (error) {
      this.log(`Application stop failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Restart the application
   * @returns {Promise<boolean>} Success status
   */
  async restart() {
    this.log('Restarting application');
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      return await this.start();
    } catch (error) {
      this.log(`Application restart failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Get application status
   * @returns {Object} Status information
   */
  getStatus() {
    if (!this.lifecycle) {
      return {
        initialized: false,
        started: false,
        state: 'not_initialized'
      };
    }
    
    return {
      initialized: true,
      started: this.started,
      ...this.lifecycle.getStatus()
    };
  }
  
  /**
   * Get module information
   * @returns {Array} Module information
   */
  getModuleInfo() {
    if (!this.lifecycle) {
      return [];
    }
    
    return this.lifecycle.getModuleInfo();
  }
  
  /**
   * Reload configuration and restart
   * @param {string} configPath - Optional new config path
   * @returns {Promise<boolean>} Success status
   */
  async reloadConfiguration(configPath = null) {
    this.log('Reloading configuration');
    
    try {
      // Stop current application
      if (this.started) {
        await this.stop();
      }
      
      // Reinitialize with new configuration
      await this.initialize(configPath);
      
      // Start with new configuration
      return await this.start();
      
    } catch (error) {
      this.log(`Configuration reload failed: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * Log a message
   * @param {string} message - Log message
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [SahkokiltaAdvertisementTV] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }
}

// Create and export singleton instance
const app = new SahkokiltaAdvertisementTV();

// If this file is run directly, start the application
if (require.main === module) {
  (async () => {
    try {
      await app.initialize();
      await app.start();
      
      // Keep the process running
      process.on('SIGTERM', async () => {
        await app.stop();
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        await app.stop();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  })();
}

module.exports = app;