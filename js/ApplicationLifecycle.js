/* Application Lifecycle Manager for Sähkökilta ry Advertisement TV
 * Handles application startup, module loading, dependency management, and graceful shutdown
 */

const EventEmitter = require('events');
const path = require('path');

class ApplicationLifecycle extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      moduleLoadTimeout: 10000,
      dependencyCheckTimeout: 5000,
      initializationDelay: 1000,
      shutdownTimeout: 5000,
      maxRestartAttempts: 3,
      restartDelay: 5000,
      enableModuleIsolation: true,
      enableAutoRestart: true,
      enableGracefulShutdown: true,
      cleanupModules: true,
      saveState: false,
      ...config
    };
    
    this.state = 'stopped';
    this.modules = new Map();
    this.loadedModules = new Set();
    this.failedModules = new Set();
    this.restartAttempts = 0;
    this.shutdownInProgress = false;
    this.startupPromise = null;
    this.shutdownPromise = null;
    
    // Bind event handlers
    this.handleUncaughtException = this.handleUncaughtException.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
    this.handleSIGTERM = this.handleSIGTERM.bind(this);
    this.handleSIGINT = this.handleSIGINT.bind(this);
    
    this.log('ApplicationLifecycle initialized');
  }
  
  /**
   * Start the application
   * @param {Object} moduleConfig - Module configuration from config.js
   * @returns {Promise<boolean>} Success status
   */
  async start(moduleConfig = {}) {
    if (this.state === 'starting' || this.state === 'running') {
      this.log('Application already starting or running', 'warn');
      return this.startupPromise;
    }
    
    this.state = 'starting';
    this.log('Starting application lifecycle');
    
    this.startupPromise = this._performStartup(moduleConfig);
    return this.startupPromise;
  }
  
  /**
   * Perform the actual startup sequence
   * @param {Object} moduleConfig - Module configuration
   * @returns {Promise<boolean>} Success status
   */
  async _performStartup(moduleConfig) {
    try {
      // Set up error handlers
      this._setupErrorHandlers();
      
      // Emit startup event
      this.emit('startup:begin');
      
      // Initialize module communication system
      await this._initializeModuleCommunication();
      
      // Load and validate module configurations
      await this._loadModuleConfigurations(moduleConfig);
      
      // Check module dependencies
      await this._validateDependencies();
      
      // Initialize modules in dependency order
      await this._initializeModules();
      
      // Wait for all modules to be ready
      await this._waitForModulesReady();
      
      // Perform post-initialization tasks
      await this._postInitialization();
      
      this.state = 'running';
      this.restartAttempts = 0;
      
      this.emit('startup:complete');
      this.log('Application startup completed successfully');
      
      return true;
      
    } catch (error) {
      this.state = 'error';
      this.emit('startup:error', error);
      this.log(`Application startup failed: ${error.message}`, 'error');
      
      // Attempt restart if enabled
      if (this.config.enableAutoRestart && this.restartAttempts < this.config.maxRestartAttempts) {
        this.log(`Attempting restart (${this.restartAttempts + 1}/${this.config.maxRestartAttempts})`, 'warn');
        await this._scheduleRestart();
        return false;
      }
      
      throw error;
    }
  }
  
  /**
   * Initialize the module communication system
   */
  async _initializeModuleCommunication() {
    this.log('Initializing module communication system');
    
    // Import and initialize ModuleCommunication if not already available
    if (typeof global.ModuleCommunication === 'undefined') {
      const ModuleCommunication = require('./ModuleCommunication');
      global.ModuleCommunication = new ModuleCommunication();
    }
    
    this.moduleCommunication = global.ModuleCommunication;
    
    // Set up communication event handlers
    this.moduleCommunication.on = this.moduleCommunication.on || (() => {});
    
    this.emit('communication:initialized');
  }
  
  /**
   * Load and validate module configurations
   * @param {Object} moduleConfig - Module configuration from config.js
   */
  async _loadModuleConfigurations(moduleConfig) {
    this.log('Loading module configurations');
    
    if (!moduleConfig.modules || !Array.isArray(moduleConfig.modules)) {
      throw new Error('Invalid module configuration: modules array not found');
    }
    
    for (const module of moduleConfig.modules) {
      if (!module.module || !module.config) {
        this.log(`Invalid module configuration: ${JSON.stringify(module)}`, 'warn');
        continue;
      }
      
      this.modules.set(module.module, {
        name: module.module,
        position: module.position,
        config: module.config,
        dependencies: module.config.dependencies || [],
        priority: module.config.priority || 999,
        state: 'configured',
        instance: null,
        loadTime: null,
        errors: []
      });
      
      this.log(`Configured module: ${module.module}`);
    }
    
    this.emit('modules:configured', Array.from(this.modules.keys()));
  }
  
  /**
   * Validate module dependencies
   */
  async _validateDependencies() {
    this.log('Validating module dependencies');
    
    const dependencyErrors = [];
    
    for (const [moduleName, moduleInfo] of this.modules) {
      for (const dependency of moduleInfo.dependencies) {
        if (!this.modules.has(dependency)) {
          const error = `Module ${moduleName} depends on ${dependency} which is not configured`;
          dependencyErrors.push(error);
          this.log(error, 'error');
        }
      }
    }
    
    if (dependencyErrors.length > 0) {
      throw new Error(`Dependency validation failed: ${dependencyErrors.join(', ')}`);
    }
    
    this.emit('dependencies:validated');
  }
  
  /**
   * Initialize modules in dependency order
   */
  async _initializeModules() {
    this.log('Initializing modules in dependency order');
    
    // Register modules with communication system
    for (const [moduleName, moduleInfo] of this.modules) {
      try {
        // Create mock module instance for communication system
        const moduleInstance = {
          name: moduleName,
          config: moduleInfo.config,
          initialize: async () => {
            moduleInfo.state = 'initializing';
            this.emit('module:initializing', moduleName);
            
            // Simulate module initialization
            await new Promise(resolve => setTimeout(resolve, this.config.initializationDelay));
            
            moduleInfo.state = 'initialized';
            moduleInfo.loadTime = Date.now();
            this.loadedModules.add(moduleName);
            
            this.emit('module:initialized', moduleName);
            this.log(`Module ${moduleName} initialized successfully`);
          },
          shutdown: async () => {
            moduleInfo.state = 'shutting_down';
            this.emit('module:shutting_down', moduleName);
            
            // Simulate module shutdown
            await new Promise(resolve => setTimeout(resolve, 100));
            
            moduleInfo.state = 'shutdown';
            this.loadedModules.delete(moduleName);
            
            this.emit('module:shutdown', moduleName);
            this.log(`Module ${moduleName} shutdown complete`);
          }
        };
        
        moduleInfo.instance = moduleInstance;
        
        // Register with communication system
        this.moduleCommunication.registerModule(moduleName, moduleInstance, {
          dependencies: moduleInfo.dependencies,
          communicationChannels: moduleInfo.config.communicationChannels || {},
          priority: moduleInfo.priority
        });
        
      } catch (error) {
        this.log(`Failed to register module ${moduleName}: ${error.message}`, 'error');
        moduleInfo.errors.push(error);
        this.failedModules.add(moduleName);
      }
    }
    
    // Initialize modules through communication system
    try {
      await Promise.race([
        this.moduleCommunication.initializeModules(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Module initialization timeout')), this.config.moduleLoadTimeout)
        )
      ]);
    } catch (error) {
      this.log(`Module initialization failed: ${error.message}`, 'error');
      throw error;
    }
    
    this.emit('modules:initialized');
  }
  
  /**
   * Wait for all modules to be ready
   */
  async _waitForModulesReady() {
    this.log('Waiting for modules to be ready');
    
    const startTime = Date.now();
    const timeout = this.config.dependencyCheckTimeout;
    
    while (Date.now() - startTime < timeout) {
      let allReady = true;
      
      for (const [moduleName, moduleInfo] of this.modules) {
        if (this.failedModules.has(moduleName)) {
          continue; // Skip failed modules
        }
        
        if (moduleInfo.state !== 'initialized') {
          allReady = false;
          break;
        }
      }
      
      if (allReady) {
        this.emit('modules:ready');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for modules to be ready');
  }
  
  /**
   * Perform post-initialization tasks
   */
  async _postInitialization() {
    this.log('Performing post-initialization tasks');
    
    // Set up module health monitoring
    this._setupHealthMonitoring();
    
    // Set up periodic cleanup
    this._setupPeriodicCleanup();
    
    this.emit('post_initialization:complete');
  }
  
  /**
   * Set up health monitoring for modules
   */
  _setupHealthMonitoring() {
    if (!this.config.enableModuleIsolation) {
      return;
    }
    
    this.healthCheckInterval = setInterval(() => {
      this._performHealthCheck();
    }, 30000); // Check every 30 seconds
    
    this.log('Health monitoring enabled');
  }
  
  /**
   * Perform health check on modules
   */
  _performHealthCheck() {
    for (const [moduleName, moduleInfo] of this.modules) {
      if (this.loadedModules.has(moduleName)) {
        // Check if module is still responsive
        if (moduleInfo.instance && typeof moduleInfo.instance.healthCheck === 'function') {
          try {
            moduleInfo.instance.healthCheck();
          } catch (error) {
            this.log(`Health check failed for module ${moduleName}: ${error.message}`, 'warn');
            this.emit('module:health_check_failed', moduleName, error);
          }
        }
      }
    }
  }
  
  /**
   * Set up periodic cleanup tasks
   */
  _setupPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._performCleanup();
    }, 300000); // Cleanup every 5 minutes
    
    this.log('Periodic cleanup enabled');
  }
  
  /**
   * Perform cleanup tasks
   */
  _performCleanup() {
    // Clear failed module errors older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [moduleName, moduleInfo] of this.modules) {
      moduleInfo.errors = moduleInfo.errors.filter(error => 
        error.timestamp && error.timestamp > oneHourAgo
      );
    }
    
    this.emit('cleanup:performed');
  }
  
  /**
   * Schedule an application restart
   */
  async _scheduleRestart() {
    this.restartAttempts++;
    
    this.log(`Scheduling restart in ${this.config.restartDelay}ms`);
    this.emit('restart:scheduled', this.restartAttempts);
    
    await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
    
    try {
      await this.stop();
      await this.start();
    } catch (error) {
      this.log(`Restart failed: ${error.message}`, 'error');
      this.emit('restart:failed', error);
    }
  }
  
  /**
   * Stop the application gracefully
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (this.shutdownInProgress) {
      this.log('Shutdown already in progress');
      return this.shutdownPromise;
    }
    
    this.shutdownInProgress = true;
    this.log('Starting graceful shutdown');
    
    this.shutdownPromise = this._performShutdown();
    return this.shutdownPromise;
  }
  
  /**
   * Perform the actual shutdown sequence
   * @returns {Promise<boolean>} Success status
   */
  async _performShutdown() {
    try {
      this.state = 'stopping';
      this.emit('shutdown:begin');
      
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Shutdown modules through communication system
      if (this.moduleCommunication) {
        await Promise.race([
          this.moduleCommunication.shutdown(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), this.config.shutdownTimeout)
          )
        ]);
      }
      
      // Perform final cleanup
      if (this.config.cleanupModules) {
        await this._performFinalCleanup();
      }
      
      // Remove error handlers
      this._removeErrorHandlers();
      
      this.state = 'stopped';
      this.shutdownInProgress = false;
      
      this.emit('shutdown:complete');
      this.log('Graceful shutdown completed');
      
      return true;
      
    } catch (error) {
      this.state = 'error';
      this.shutdownInProgress = false;
      
      this.emit('shutdown:error', error);
      this.log(`Shutdown failed: ${error.message}`, 'error');
      
      throw error;
    }
  }
  
  /**
   * Perform final cleanup tasks
   */
  async _performFinalCleanup() {
    this.log('Performing final cleanup');
    
    // Clear module references
    this.modules.clear();
    this.loadedModules.clear();
    this.failedModules.clear();
    
    // Save state if enabled
    if (this.config.saveState) {
      // Implementation would save application state to disk
      this.log('State saving not implemented');
    }
    
    this.emit('cleanup:final');
  }
  
  /**
   * Set up error handlers
   */
  _setupErrorHandlers() {
    process.on('uncaughtException', this.handleUncaughtException);
    process.on('unhandledRejection', this.handleUnhandledRejection);
    process.on('SIGTERM', this.handleSIGTERM);
    process.on('SIGINT', this.handleSIGINT);
    
    this.log('Error handlers set up');
  }
  
  /**
   * Remove error handlers
   */
  _removeErrorHandlers() {
    process.removeListener('uncaughtException', this.handleUncaughtException);
    process.removeListener('unhandledRejection', this.handleUnhandledRejection);
    process.removeListener('SIGTERM', this.handleSIGTERM);
    process.removeListener('SIGINT', this.handleSIGINT);
    
    this.log('Error handlers removed');
  }
  
  /**
   * Handle uncaught exceptions
   * @param {Error} error - The uncaught exception
   */
  handleUncaughtException(error) {
    this.log(`Uncaught exception: ${error.message}`, 'error');
    this.emit('error:uncaught_exception', error);
    
    if (this.config.enableGracefulShutdown) {
      this.stop().finally(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }
  
  /**
   * Handle unhandled promise rejections
   * @param {*} reason - The rejection reason
   * @param {Promise} promise - The rejected promise
   */
  handleUnhandledRejection(reason, promise) {
    this.log(`Unhandled rejection: ${reason}`, 'error');
    this.emit('error:unhandled_rejection', reason, promise);
    
    if (this.config.enableGracefulShutdown) {
      this.stop().finally(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }
  
  /**
   * Handle SIGTERM signal
   */
  handleSIGTERM() {
    this.log('Received SIGTERM, shutting down gracefully');
    this.emit('signal:sigterm');
    
    this.stop().finally(() => {
      process.exit(0);
    });
  }
  
  /**
   * Handle SIGINT signal (Ctrl+C)
   */
  handleSIGINT() {
    this.log('Received SIGINT, shutting down gracefully');
    this.emit('signal:sigint');
    
    this.stop().finally(() => {
      process.exit(0);
    });
  }
  
  /**
   * Get application status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      modules: {
        total: this.modules.size,
        loaded: this.loadedModules.size,
        failed: this.failedModules.size
      },
      restartAttempts: this.restartAttempts,
      shutdownInProgress: this.shutdownInProgress,
      uptime: this.state === 'running' ? Date.now() - this.startTime : 0
    };
  }
  
  /**
   * Get module information
   * @returns {Array} Module information
   */
  getModuleInfo() {
    return Array.from(this.modules.entries()).map(([name, info]) => ({
      name,
      state: info.state,
      dependencies: info.dependencies,
      priority: info.priority,
      loadTime: info.loadTime,
      errors: info.errors.length,
      loaded: this.loadedModules.has(name),
      failed: this.failedModules.has(name)
    }));
  }
  
  /**
   * Log a message
   * @param {string} message - Log message
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ApplicationLifecycle] [${level.toUpperCase()}] ${message}`;
    
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

module.exports = ApplicationLifecycle;