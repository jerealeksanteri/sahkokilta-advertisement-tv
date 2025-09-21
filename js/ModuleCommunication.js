/* Module Communication System for Sähkökilta ry Advertisement TV
 * Handles inter-module communication, dependency management, and data sharing
 */

class ModuleCommunication {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Map();
    this.communicationChannels = new Map();
    this.eventListeners = new Map();
    this.moduleStates = new Map();
    this.sharedData = new Map();
    this.loadOrder = [];
    this.initialized = false;
    
    // Configuration
    this.config = {
      timeout: 5000,
      retryAttempts: 3,
      enableLogging: true
    };
    
    this.log('ModuleCommunication system initialized');
  }
  
  /**
   * Register a module with the communication system
   * @param {string} moduleId - Unique module identifier
   * @param {Object} moduleInstance - Module instance
   * @param {Object} config - Module communication configuration
   */
  registerModule(moduleId, moduleInstance, config = {}) {
    if (this.modules.has(moduleId)) {
      this.log(`Module ${moduleId} already registered, updating...`, 'warn');
    }
    
    const moduleConfig = {
      instance: moduleInstance,
      dependencies: config.dependencies || [],
      communicationChannels: config.communicationChannels || {},
      priority: config.priority || 999,
      state: 'registered',
      ...config
    };
    
    this.modules.set(moduleId, moduleConfig);
    this.moduleStates.set(moduleId, 'registered');
    
    // Register communication channels
    if (config.communicationChannels) {
      this.registerCommunicationChannels(moduleId, config.communicationChannels);
    }
    
    // Register dependencies
    if (config.dependencies && config.dependencies.length > 0) {
      this.dependencies.set(moduleId, config.dependencies);
    }
    
    this.log(`Module ${moduleId} registered with priority ${moduleConfig.priority}`);
    
    // Update load order
    this.updateLoadOrder();
    
    return true;
  }
  
  /**
   * Register communication channels for a module
   * @param {string} moduleId - Module identifier
   * @param {Object} channels - Channel definitions
   */
  registerCommunicationChannels(moduleId, channels) {
    Object.entries(channels).forEach(([channelName, eventName]) => {
      if (!this.communicationChannels.has(eventName)) {
        this.communicationChannels.set(eventName, new Set());
      }
      this.communicationChannels.get(eventName).add(moduleId);
      
      this.log(`Registered channel ${channelName} (${eventName}) for module ${moduleId}`);
    });
  }
  
  /**
   * Update module load order based on dependencies and priorities
   */
  updateLoadOrder() {
    const modules = Array.from(this.modules.entries());
    
    // Sort by priority first
    modules.sort((a, b) => a[1].priority - b[1].priority);
    
    // Then resolve dependencies
    const resolved = [];
    const resolving = new Set();
    
    const resolveDependencies = (moduleId) => {
      if (resolved.includes(moduleId)) {
        return;
      }
      
      if (resolving.has(moduleId)) {
        this.log(`Circular dependency detected for module ${moduleId}`, 'error');
        return;
      }
      
      resolving.add(moduleId);
      
      const dependencies = this.dependencies.get(moduleId) || [];
      dependencies.forEach(dep => {
        if (this.modules.has(dep)) {
          resolveDependencies(dep);
        } else {
          this.log(`Dependency ${dep} not found for module ${moduleId}`, 'warn');
        }
      });
      
      resolving.delete(moduleId);
      resolved.push(moduleId);
    };
    
    modules.forEach(([moduleId]) => {
      resolveDependencies(moduleId);
    });
    
    this.loadOrder = resolved;
    this.log(`Load order updated: ${this.loadOrder.join(' -> ')}`);
  }
  
  /**
   * Initialize all modules in dependency order
   */
  async initializeModules() {
    this.log('Starting module initialization sequence');
    
    for (const moduleId of this.loadOrder) {
      try {
        await this.initializeModule(moduleId);
      } catch (error) {
        this.log(`Failed to initialize module ${moduleId}: ${error.message}`, 'error');
        this.moduleStates.set(moduleId, 'error');
      }
    }
    
    this.initialized = true;
    this.broadcastEvent('MODULES_INITIALIZED', { loadOrder: this.loadOrder });
    this.log('All modules initialized');
  }
  
  /**
   * Initialize a specific module
   * @param {string} moduleId - Module to initialize
   */
  async initializeModule(moduleId) {
    const moduleConfig = this.modules.get(moduleId);
    if (!moduleConfig) {
      throw new Error(`Module ${moduleId} not found`);
    }
    
    // Check dependencies
    const dependencies = this.dependencies.get(moduleId) || [];
    for (const dep of dependencies) {
      const depState = this.moduleStates.get(dep);
      if (depState !== 'initialized' && depState !== 'ready') {
        throw new Error(`Dependency ${dep} not ready for module ${moduleId}`);
      }
    }
    
    this.log(`Initializing module ${moduleId}`);
    this.moduleStates.set(moduleId, 'initializing');
    
    // Call module initialization if available
    if (moduleConfig.instance && typeof moduleConfig.instance.initialize === 'function') {
      await moduleConfig.instance.initialize();
    }
    
    this.moduleStates.set(moduleId, 'initialized');
    this.broadcastEvent('MODULE_INITIALIZED', { moduleId, state: 'initialized' });
    
    this.log(`Module ${moduleId} initialized successfully`);
  }
  
  /**
   * Broadcast an event to all listening modules
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {string} sender - Sender module ID
   */
  broadcastEvent(eventName, data = {}, sender = 'system') {
    const listeners = this.communicationChannels.get(eventName);
    if (!listeners || listeners.size === 0) {
      this.log(`No listeners for event ${eventName}`, 'debug');
      return;
    }
    
    this.log(`Broadcasting event ${eventName} from ${sender} to ${listeners.size} listeners`);
    
    listeners.forEach(moduleId => {
      if (moduleId === sender) {
        return; // Don't send to sender
      }
      
      const moduleConfig = this.modules.get(moduleId);
      if (moduleConfig && moduleConfig.instance) {
        try {
          // Use MagicMirror's notification system if available
          if (typeof moduleConfig.instance.sendNotification === 'function') {
            moduleConfig.instance.sendNotification(eventName, { ...data, sender });
          }
          
          // Also call custom event handler if available
          if (typeof moduleConfig.instance.onCommunicationEvent === 'function') {
            moduleConfig.instance.onCommunicationEvent(eventName, data, sender);
          }
        } catch (error) {
          this.log(`Error sending event ${eventName} to module ${moduleId}: ${error.message}`, 'error');
        }
      }
    });
  }
  
  /**
   * Send a direct message to a specific module
   * @param {string} targetModuleId - Target module ID
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {string} sender - Sender module ID
   */
  sendDirectMessage(targetModuleId, eventName, data = {}, sender = 'system') {
    const moduleConfig = this.modules.get(targetModuleId);
    if (!moduleConfig) {
      this.log(`Target module ${targetModuleId} not found`, 'error');
      return false;
    }
    
    this.log(`Sending direct message ${eventName} from ${sender} to ${targetModuleId}`);
    
    try {
      if (moduleConfig.instance && typeof moduleConfig.instance.sendNotification === 'function') {
        moduleConfig.instance.sendNotification(eventName, { ...data, sender, direct: true });
      }
      
      if (typeof moduleConfig.instance.onCommunicationEvent === 'function') {
        moduleConfig.instance.onCommunicationEvent(eventName, data, sender);
      }
      
      return true;
    } catch (error) {
      this.log(`Error sending direct message to ${targetModuleId}: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Set shared data that other modules can access
   * @param {string} key - Data key
   * @param {*} value - Data value
   * @param {string} moduleId - Module setting the data
   */
  setSharedData(key, value, moduleId = 'system') {
    this.sharedData.set(key, { value, moduleId, timestamp: Date.now() });
    this.log(`Shared data '${key}' set by ${moduleId}`);
    
    // Notify modules about data change
    this.broadcastEvent('SHARED_DATA_UPDATED', { key, value, moduleId });
  }
  
  /**
   * Get shared data
   * @param {string} key - Data key
   * @returns {*} Data value or undefined
   */
  getSharedData(key) {
    const data = this.sharedData.get(key);
    return data ? data.value : undefined;
  }
  
  /**
   * Get module state
   * @param {string} moduleId - Module ID
   * @returns {string} Module state
   */
  getModuleState(moduleId) {
    return this.moduleStates.get(moduleId) || 'unknown';
  }
  
  /**
   * Get all module states
   * @returns {Object} All module states
   */
  getAllModuleStates() {
    return Object.fromEntries(this.moduleStates);
  }
  
  /**
   * Check if all dependencies are ready for a module
   * @param {string} moduleId - Module ID
   * @returns {boolean} True if all dependencies are ready
   */
  areDependenciesReady(moduleId) {
    const dependencies = this.dependencies.get(moduleId) || [];
    return dependencies.every(dep => {
      const state = this.moduleStates.get(dep);
      return state === 'initialized' || state === 'ready';
    });
  }
  
  /**
   * Gracefully shutdown all modules
   */
  async shutdown() {
    this.log('Starting graceful shutdown');
    
    // Shutdown in reverse order
    const shutdownOrder = [...this.loadOrder].reverse();
    
    for (const moduleId of shutdownOrder) {
      try {
        await this.shutdownModule(moduleId);
      } catch (error) {
        this.log(`Error shutting down module ${moduleId}: ${error.message}`, 'error');
      }
    }
    
    this.log('Shutdown complete');
  }
  
  /**
   * Shutdown a specific module
   * @param {string} moduleId - Module to shutdown
   */
  async shutdownModule(moduleId) {
    const moduleConfig = this.modules.get(moduleId);
    if (!moduleConfig) {
      return;
    }
    
    this.log(`Shutting down module ${moduleId}`);
    this.moduleStates.set(moduleId, 'shutting_down');
    
    if (moduleConfig.instance && typeof moduleConfig.instance.shutdown === 'function') {
      await moduleConfig.instance.shutdown();
    }
    
    this.moduleStates.set(moduleId, 'shutdown');
    this.log(`Module ${moduleId} shutdown complete`);
  }
  
  /**
   * Log a message
   * @param {string} message - Log message
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    if (!this.config.enableLogging) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ModuleCommunication] [${level.toUpperCase()}] ${message}`;
    
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

// Create global instance
if (typeof window !== 'undefined') {
  window.ModuleCommunication = new ModuleCommunication();
} else if (typeof global !== 'undefined') {
  global.ModuleCommunication = new ModuleCommunication();
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleCommunication;
}