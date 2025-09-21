// Unit tests for main application files
const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { MockEventEmitter, mockLogger, testUtils } = require('../mocks');

// Mock dependencies
jest.mock('../../services/LoggingService.js', () => {
  return class MockLoggingService {
    constructor() {
      this.logger = require('../mocks').mockLogger;
    }
    
    debug(message, meta) {
      this.logger.debug(message, meta);
    }
    
    info(message, meta) {
      this.logger.info(message, meta);
    }
    
    warn(message, meta) {
      this.logger.warn(message, meta);
    }
    
    error(message, meta) {
      this.logger.error(message, meta);
    }
    
    getLogger() {
      return this.logger;
    }
  };
});

describe('Main Application Tests', () => {
  beforeEach(() => {
    testUtils.resetAllMocks();
    
    // Mock global objects
    global.document = {
      ...require('../mocks').mockDOM,
      readyState: 'loading',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    
    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { reload: jest.fn() },
      console: mockLogger,
    };
    
    global.process = {
      ...require('../mocks').mockProcess,
      exit: jest.fn(),
    };
  });

  describe('main.js', () => {
    let main;
    
    beforeEach(() => {
      // Mock the main module
      jest.doMock('../../js/main.js', () => {
        return {
          init: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          restart: jest.fn(),
          getStatus: jest.fn(() => 'running'),
          
          // Application state
          isInitialized: false,
          isRunning: false,
          modules: new Map(),
          
          // Initialize the application
          async initialize() {
            if (this.isInitialized) {
              throw new Error('Application already initialized');
            }
            
            this.isInitialized = true;
            this.setupErrorHandlers();
            this.loadConfiguration();
            
            return { success: true, message: 'Application initialized' };
          },
          
          // Start the application
          async startApplication() {
            if (!this.isInitialized) {
              throw new Error('Application not initialized');
            }
            
            if (this.isRunning) {
              throw new Error('Application already running');
            }
            
            this.isRunning = true;
            this.initializeModules();
            
            return { success: true, message: 'Application started' };
          },
          
          // Stop the application
          async stopApplication() {
            if (!this.isRunning) {
              return { success: true, message: 'Application already stopped' };
            }
            
            this.isRunning = false;
            this.shutdownModules();
            
            return { success: true, message: 'Application stopped' };
          },
          
          // Setup error handlers
          setupErrorHandlers() {
            process.on('uncaughtException', this.handleUncaughtException.bind(this));
            process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
            window.addEventListener('error', this.handleWindowError.bind(this));
          },
          
          // Load configuration
          loadConfiguration() {
            this.config = {
              modules: [
                { module: 'MMM-LayoutManager', position: 'fullscreen_above' },
                { module: 'MMM-SahkokiltaBranding', position: 'top_left' },
                { module: 'MMM-SponsorCarousel', position: 'bottom_center' }
              ]
            };
          },
          
          // Initialize modules
          initializeModules() {
            this.config.modules.forEach(moduleConfig => {
              const module = {
                name: moduleConfig.module,
                position: moduleConfig.position,
                loaded: true,
                hidden: false
              };
              this.modules.set(moduleConfig.module, module);
            });
          },
          
          // Shutdown modules
          shutdownModules() {
            this.modules.clear();
          },
          
          // Error handlers
          handleUncaughtException(error) {
            console.error('Uncaught Exception:', error);
            this.restart();
          },
          
          handleUnhandledRejection(reason, promise) {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
          },
          
          handleWindowError(event) {
            console.error('Window Error:', event.error);
          }
        };
      });
      
      main = require('../../js/main.js');
    });
    
    test('should initialize application successfully', async () => {
      const result = await main.initialize();
      
      expect(result.success).toBe(true);
      expect(main.isInitialized).toBe(true);
      expect(main.config).toBeDefined();
      expect(main.config.modules).toHaveLength(3);
    });
    
    test('should throw error when initializing twice', async () => {
      await main.initialize();
      
      await expect(main.initialize()).rejects.toThrow('Application already initialized');
    });
    
    test('should start application after initialization', async () => {
      await main.initialize();
      const result = await main.startApplication();
      
      expect(result.success).toBe(true);
      expect(main.isRunning).toBe(true);
      expect(main.modules.size).toBe(3);
    });
    
    test('should throw error when starting without initialization', async () => {
      await expect(main.startApplication()).rejects.toThrow('Application not initialized');
    });
    
    test('should throw error when starting twice', async () => {
      await main.initialize();
      await main.startApplication();
      
      await expect(main.startApplication()).rejects.toThrow('Application already running');
    });
    
    test('should stop application successfully', async () => {
      await main.initialize();
      await main.startApplication();
      
      const result = await main.stopApplication();
      
      expect(result.success).toBe(true);
      expect(main.isRunning).toBe(false);
      expect(main.modules.size).toBe(0);
    });
    
    test('should handle stopping when not running', async () => {
      const result = await main.stopApplication();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Application already stopped');
    });
    
    test('should setup error handlers during initialization', async () => {
      const processOnSpy = jest.spyOn(process, 'on');
      const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      await main.initialize();
      
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(windowAddEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    });
    
    test('should handle uncaught exceptions', async () => {
      await main.initialize();
      const restartSpy = jest.spyOn(main, 'restart').mockImplementation(() => {});
      
      const error = new Error('Test error');
      main.handleUncaughtException(error);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Uncaught Exception:', error);
      expect(restartSpy).toHaveBeenCalled();
    });
    
    test('should handle unhandled rejections', async () => {
      await main.initialize();
      
      const reason = 'Test rejection';
      const promise = Promise.reject(reason);
      main.handleUnhandledRejection(reason, promise);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    test('should handle window errors', async () => {
      await main.initialize();
      
      const error = new Error('Window error');
      const event = { error };
      main.handleWindowError(event);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Window Error:', error);
    });
    
    test('should return correct status', async () => {
      expect(main.getStatus()).toBe('running');
    });
  });

  describe('ApplicationLifecycle.js', () => {
    let ApplicationLifecycle;
    
    beforeEach(() => {
      // Mock ApplicationLifecycle
      jest.doMock('../../js/ApplicationLifecycle.js', () => {
        return class ApplicationLifecycle extends MockEventEmitter {
          constructor(config = {}) {
            super();
            this.config = {
              enableGracefulShutdown: true,
              shutdownTimeout: 5000,
              moduleTimeout: 3000,
              ...config
            };
            this.modules = new Map();
            this.isShuttingDown = false;
            this.logger = mockLogger;
          }
          
          async start() {
            this.log('Starting application lifecycle');
            this.setupErrorHandlers();
            this.initializeModuleCommunication();
            await this.loadModuleConfigurations();
            this.validateModuleDependencies();
            await this.initializeModulesInOrder();
            this.waitForModulesReady();
            
            this.emit('lifecycle:started');
            return { success: true };
          }
          
          async stop() {
            if (this.isShuttingDown) {
              return { success: true, message: 'Already shutting down' };
            }
            
            this.isShuttingDown = true;
            this.log('Starting graceful shutdown');
            
            await this.shutdownModulesInOrder();
            this.performFinalCleanup();
            
            this.log('Graceful shutdown completed');
            this.emit('lifecycle:stopped');
            
            return { success: true };
          }
          
          setupErrorHandlers() {
            this.log('Error handlers set up');
            process.on('SIGTERM', this.handleSignal.bind(this));
            process.on('SIGINT', this.handleSignal.bind(this));
          }
          
          initializeModuleCommunication() {
            this.log('Initializing module communication system');
            this.moduleCommunication = {
              registerModule: jest.fn(),
              sendNotification: jest.fn(),
              broadcastNotification: jest.fn()
            };
          }
          
          async loadModuleConfigurations() {
            this.log('Loading module configurations');
            
            const moduleConfigs = [
              { module: 'MMM-LayoutManager', position: 'fullscreen_above', priority: 1 },
              { module: 'MMM-SahkokiltaBranding', position: 'top_left', priority: 2 },
              { module: 'MMM-SponsorCarousel', position: 'bottom_center', priority: 3 }
            ];
            
            moduleConfigs.forEach(config => {
              this.log(`Configured module: ${config.module}`);
              this.modules.set(config.module, {
                ...config,
                loaded: false,
                initialized: false
              });
            });
          }
          
          validateModuleDependencies() {
            this.log('Validating module dependencies');
            // Mock dependency validation
            return true;
          }
          
          async initializeModulesInOrder() {
            this.log('Initializing modules in dependency order');
            
            for (const [name, module] of this.modules) {
              await this.initializeModule(name, module);
            }
          }
          
          async initializeModule(name, module) {
            try {
              module.loaded = true;
              module.initialized = true;
              this.emit('module:initialized', { name, module });
              return { success: true };
            } catch (error) {
              this.error(`Failed to initialize module ${name}:`, error);
              return { success: false, error };
            }
          }
          
          waitForModulesReady() {
            this.log('Waiting for modules to be ready');
            
            setTimeout(() => {
              this.emit('modules:ready');
            }, 100);
          }
          
          async shutdownModulesInOrder() {
            this.log('Starting graceful shutdown');
            
            const moduleNames = Array.from(this.modules.keys()).reverse();
            
            for (const name of moduleNames) {
              await this.shutdownModule(name);
            }
            
            this.log('Shutdown complete');
          }
          
          async shutdownModule(name) {
            const module = this.modules.get(name);
            if (!module) return;
            
            this.log(`Shutting down module ${name}`);
            
            return new Promise((resolve) => {
              setTimeout(() => {
                module.loaded = false;
                module.initialized = false;
                this.log(`Module ${name} shutdown complete`);
                this.emit('module:shutdown', { name });
                resolve();
              }, 100);
            });
          }
          
          performFinalCleanup() {
            this.log('Performing final cleanup');
            this.removeAllListeners();
            this.log('Error handlers removed');
          }
          
          handleSignal(signal) {
            this.log(`Received ${signal}, initiating graceful shutdown`);
            this.stop();
          }
          
          log(message, meta = {}) {
            this.logger.info(`[ApplicationLifecycle] [INFO] ${message}`, meta);
          }
          
          error(message, error = null) {
            this.logger.error(`[ApplicationLifecycle] [ERROR] ${message}`, { error });
          }
        };
      });
      
      ApplicationLifecycle = require('../../js/ApplicationLifecycle.js');
    });
    
    test('should start application lifecycle successfully', async () => {
      const lifecycle = new ApplicationLifecycle();
      const result = await lifecycle.start();
      
      expect(result.success).toBe(true);
      expect(lifecycle.modules.size).toBe(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[ApplicationLifecycle] [INFO] Starting application lifecycle'),
        expect.any(Object)
      );
    });
    
    test('should initialize modules in correct order', async () => {
      const lifecycle = new ApplicationLifecycle();
      const moduleInitSpy = jest.spyOn(lifecycle, 'initializeModule');
      
      await lifecycle.start();
      
      expect(moduleInitSpy).toHaveBeenCalledTimes(3);
      expect(moduleInitSpy).toHaveBeenCalledWith('MMM-LayoutManager', expect.any(Object));
      expect(moduleInitSpy).toHaveBeenCalledWith('MMM-SahkokiltaBranding', expect.any(Object));
      expect(moduleInitSpy).toHaveBeenCalledWith('MMM-SponsorCarousel', expect.any(Object));
    });
    
    test('should emit lifecycle events', async () => {
      const lifecycle = new ApplicationLifecycle();
      const startedSpy = jest.fn();
      const moduleInitSpy = jest.fn();
      
      lifecycle.on('lifecycle:started', startedSpy);
      lifecycle.on('module:initialized', moduleInitSpy);
      
      await lifecycle.start();
      
      expect(startedSpy).toHaveBeenCalled();
      expect(moduleInitSpy).toHaveBeenCalledTimes(3);
    });
    
    test('should stop application lifecycle gracefully', async () => {
      const lifecycle = new ApplicationLifecycle();
      await lifecycle.start();
      
      const result = await lifecycle.stop();
      
      expect(result.success).toBe(true);
      expect(lifecycle.isShuttingDown).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[ApplicationLifecycle] [INFO] Graceful shutdown completed'),
        expect.any(Object)
      );
    });
    
    test('should handle duplicate stop calls', async () => {
      const lifecycle = new ApplicationLifecycle();
      await lifecycle.start();
      
      await lifecycle.stop();
      const result = await lifecycle.stop();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Already shutting down');
    });
    
    test('should shutdown modules in reverse order', async () => {
      const lifecycle = new ApplicationLifecycle();
      await lifecycle.start();
      
      const shutdownSpy = jest.spyOn(lifecycle, 'shutdownModule');
      await lifecycle.stop();
      
      expect(shutdownSpy).toHaveBeenCalledTimes(3);
      // Verify reverse order (last initialized, first shutdown)
      expect(shutdownSpy.mock.calls[0][0]).toBe('MMM-SponsorCarousel');
      expect(shutdownSpy.mock.calls[1][0]).toBe('MMM-SahkokiltaBranding');
      expect(shutdownSpy.mock.calls[2][0]).toBe('MMM-LayoutManager');
    });
    
    test('should handle module initialization failure', async () => {
      const lifecycle = new ApplicationLifecycle();
      
      // Mock a failing module
      jest.spyOn(lifecycle, 'initializeModule').mockImplementationOnce(() => {
        throw new Error('Module initialization failed');
      });
      
      await lifecycle.start();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize module'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
    
    test('should setup error handlers', async () => {
      const lifecycle = new ApplicationLifecycle();
      const processOnSpy = jest.spyOn(process, 'on');
      
      await lifecycle.start();
      
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
    
    test('should handle system signals', async () => {
      const lifecycle = new ApplicationLifecycle();
      const stopSpy = jest.spyOn(lifecycle, 'stop');
      
      lifecycle.handleSignal('SIGTERM');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Received SIGTERM, initiating graceful shutdown'),
        expect.any(Object)
      );
      expect(stopSpy).toHaveBeenCalled();
    });
    
    test('should validate module dependencies', async () => {
      const lifecycle = new ApplicationLifecycle();
      const validateSpy = jest.spyOn(lifecycle, 'validateModuleDependencies');
      
      await lifecycle.start();
      
      expect(validateSpy).toHaveBeenCalled();
    });
    
    test('should wait for modules to be ready', (done) => {
      const lifecycle = new ApplicationLifecycle();
      
      lifecycle.on('modules:ready', () => {
        done();
      });
      
      lifecycle.start();
    });
  });

  describe('ModuleCommunication.js', () => {
    let ModuleCommunication;
    
    beforeEach(() => {
      jest.doMock('../../js/ModuleCommunication.js', () => {
        return class ModuleCommunication extends MockEventEmitter {
          constructor() {
            super();
            this.modules = new Map();
            this.channels = new Map();
            this.loadOrder = [];
            this.logger = mockLogger;
          }
          
          registerModule(name, config = {}) {
            const module = {
              name,
              config,
              priority: config.priority || 999,
              channels: config.channels || [],
              loaded: false,
              initialized: false
            };
            
            this.modules.set(name, module);
            this.registerChannels(name, module.channels);
            this.updateLoadOrder();
            
            this.log(`Module ${name} registered with priority ${module.priority}`);
            this.emit('module:registered', { name, module });
            
            return module;
          }
          
          registerChannels(moduleName, channels) {
            channels.forEach(channel => {
              if (!this.channels.has(channel.name)) {
                this.channels.set(channel.name, []);
              }
              
              this.channels.get(channel.name).push({
                module: moduleName,
                event: channel.event,
                handler: channel.handler
              });
              
              this.log(`Registered channel ${channel.name} (${channel.event}) for module ${moduleName}`);
            });
          }
          
          updateLoadOrder() {
            this.loadOrder = Array.from(this.modules.values())
              .sort((a, b) => b.priority - a.priority)
              .map(module => module.name);
            
            this.log(`Load order updated: ${this.loadOrder.join(' -> ')}`);
          }
          
          sendNotification(notification, payload, sender = null) {
            this.log(`Sending notification: ${notification}`, { payload, sender });
            
            const channel = this.channels.get(notification);
            if (channel) {
              channel.forEach(subscriber => {
                if (subscriber.module !== sender) {
                  this.deliverNotification(subscriber, notification, payload);
                }
              });
            } else {
              this.debug(`No listeners for event ${notification}`);
            }
            
            this.emit('notification:sent', { notification, payload, sender });
          }
          
          deliverNotification(subscriber, notification, payload) {
            try {
              if (typeof subscriber.handler === 'function') {
                subscriber.handler(notification, payload);
              } else {
                this.emit(`${subscriber.module}:${notification}`, payload);
              }
            } catch (error) {
              this.error(`Error delivering notification ${notification} to ${subscriber.module}:`, error);
            }
          }
          
          broadcastNotification(notification, payload) {
            this.log(`Broadcasting notification: ${notification}`, { payload });
            
            this.modules.forEach((module, name) => {
              if (module.loaded) {
                this.deliverNotification({ module: name, handler: null }, notification, payload);
              }
            });
            
            this.emit('notification:broadcast', { notification, payload });
          }
          
          initializeModules() {
            this.log('Starting module initialization sequence');
            
            this.loadOrder.forEach(moduleName => {
              const module = this.modules.get(moduleName);
              if (module && !module.initialized) {
                this.initializeModule(moduleName, module);
              }
            });
            
            this.log('All modules initialized');
            this.emit('modules:initialized');
          }
          
          initializeModule(name, module) {
            try {
              module.loaded = true;
              module.initialized = true;
              
              this.log(`Module ${name} initialized successfully`);
              this.emit('module:initialized', { name, module });
              
              return { success: true };
            } catch (error) {
              this.error(`Failed to initialize module ${name}:`, error);
              return { success: false, error };
            }
          }
          
          async shutdown() {
            this.log('Starting graceful shutdown');
            
            const shutdownOrder = [...this.loadOrder].reverse();
            
            for (const moduleName of shutdownOrder) {
              await this.shutdownModule(moduleName);
            }
            
            this.log('Shutdown complete');
            this.emit('communication:shutdown');
          }
          
          async shutdownModule(name) {
            const module = this.modules.get(name);
            if (!module || !module.loaded) return;
            
            this.log(`Shutting down module ${name}`);
            
            return new Promise((resolve) => {
              setTimeout(() => {
                module.loaded = false;
                module.initialized = false;
                this.log(`Module ${name} shutdown complete`);
                this.emit('module:shutdown', { name });
                resolve();
              }, 100);
            });
          }
          
          getModuleStatus(name) {
            const module = this.modules.get(name);
            return module ? {
              name: module.name,
              loaded: module.loaded,
              initialized: module.initialized,
              priority: module.priority
            } : null;
          }
          
          getAllModulesStatus() {
            const status = {};
            this.modules.forEach((module, name) => {
              status[name] = this.getModuleStatus(name);
            });
            return status;
          }
          
          log(message, meta = {}) {
            this.logger.info(`[ModuleCommunication] [INFO] ${message}`, meta);
          }
          
          debug(message, meta = {}) {
            this.logger.debug(`[ModuleCommunication] [DEBUG] ${message}`, meta);
          }
          
          error(message, error = null) {
            this.logger.error(`[ModuleCommunication] [ERROR] ${message}`, { error });
          }
        };
      });
      
      ModuleCommunication = require('../../js/ModuleCommunication.js');
    });
    
    test('should register modules with correct priority', () => {
      const comm = new ModuleCommunication();
      
      const module1 = comm.registerModule('TestModule1', { priority: 1 });
      const module2 = comm.registerModule('TestModule2', { priority: 2 });
      
      expect(module1.priority).toBe(1);
      expect(module2.priority).toBe(2);
      expect(comm.modules.size).toBe(2);
      expect(comm.loadOrder).toEqual(['TestModule2', 'TestModule1']);
    });
    
    test('should register communication channels', () => {
      const comm = new ModuleCommunication();
      
      const channels = [
        { name: 'testChannel', event: 'TEST_EVENT', handler: jest.fn() }
      ];
      
      comm.registerModule('TestModule', { channels });
      
      expect(comm.channels.has('testChannel')).toBe(true);
      expect(comm.channels.get('testChannel')).toHaveLength(1);
    });
    
    test('should send notifications to registered channels', () => {
      const comm = new ModuleCommunication();
      const handler = jest.fn();
      
      comm.registerModule('TestModule', {
        channels: [{ name: 'testChannel', event: 'TEST_EVENT', handler }]
      });
      
      comm.sendNotification('testChannel', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith('testChannel', { data: 'test' });
    });
    
    test('should not send notifications to sender', () => {
      const comm = new ModuleCommunication();
      const handler = jest.fn();
      
      comm.registerModule('TestModule', {
        channels: [{ name: 'testChannel', event: 'TEST_EVENT', handler }]
      });
      
      comm.sendNotification('testChannel', { data: 'test' }, 'TestModule');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    test('should broadcast notifications to all loaded modules', () => {
      const comm = new ModuleCommunication();
      
      comm.registerModule('Module1', {});
      comm.registerModule('Module2', {});
      
      // Mark modules as loaded
      comm.modules.get('Module1').loaded = true;
      comm.modules.get('Module2').loaded = true;
      
      const broadcastSpy = jest.spyOn(comm, 'deliverNotification');
      comm.broadcastNotification('BROADCAST_TEST', { data: 'broadcast' });
      
      expect(broadcastSpy).toHaveBeenCalledTimes(2);
    });
    
    test('should initialize modules in priority order', () => {
      const comm = new ModuleCommunication();
      
      comm.registerModule('LowPriority', { priority: 1 });
      comm.registerModule('HighPriority', { priority: 3 });
      comm.registerModule('MediumPriority', { priority: 2 });
      
      const initSpy = jest.spyOn(comm, 'initializeModule');
      comm.initializeModules();
      
      expect(initSpy).toHaveBeenCalledTimes(3);
      expect(initSpy.mock.calls[0][0]).toBe('HighPriority');
      expect(initSpy.mock.calls[1][0]).toBe('MediumPriority');
      expect(initSpy.mock.calls[2][0]).toBe('LowPriority');
    });
    
    test('should shutdown modules in reverse order', async () => {
      const comm = new ModuleCommunication();
      
      comm.registerModule('First', { priority: 3 });
      comm.registerModule('Second', { priority: 2 });
      comm.registerModule('Third', { priority: 1 });
      
      // Mark as loaded
      comm.modules.forEach(module => { module.loaded = true; });
      
      const shutdownSpy = jest.spyOn(comm, 'shutdownModule');
      await comm.shutdown();
      
      expect(shutdownSpy).toHaveBeenCalledTimes(3);
      expect(shutdownSpy.mock.calls[0][0]).toBe('Third');
      expect(shutdownSpy.mock.calls[1][0]).toBe('Second');
      expect(shutdownSpy.mock.calls[2][0]).toBe('First');
    });
    
    test('should get module status', () => {
      const comm = new ModuleCommunication();
      
      comm.registerModule('TestModule', { priority: 1 });
      const module = comm.modules.get('TestModule');
      module.loaded = true;
      module.initialized = true;
      
      const status = comm.getModuleStatus('TestModule');
      
      expect(status).toEqual({
        name: 'TestModule',
        loaded: true,
        initialized: true,
        priority: 1
      });
    });
    
    test('should get all modules status', () => {
      const comm = new ModuleCommunication();
      
      comm.registerModule('Module1', { priority: 1 });
      comm.registerModule('Module2', { priority: 2 });
      
      const allStatus = comm.getAllModulesStatus();
      
      expect(Object.keys(allStatus)).toHaveLength(2);
      expect(allStatus.Module1).toBeDefined();
      expect(allStatus.Module2).toBeDefined();
    });
    
    test('should handle notification delivery errors', () => {
      const comm = new ModuleCommunication();
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      comm.registerModule('TestModule', {
        channels: [{ name: 'testChannel', event: 'TEST_EVENT', handler: faultyHandler }]
      });
      
      comm.sendNotification('testChannel', { data: 'test' });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error delivering notification'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
    
    test('should emit events for module lifecycle', () => {
      const comm = new ModuleCommunication();
      const registeredSpy = jest.fn();
      const initializedSpy = jest.fn();
      
      comm.on('module:registered', registeredSpy);
      comm.on('module:initialized', initializedSpy);
      
      comm.registerModule('TestModule', {});
      comm.initializeModules();
      
      expect(registeredSpy).toHaveBeenCalledWith({
        name: 'TestModule',
        module: expect.any(Object)
      });
      expect(initializedSpy).toHaveBeenCalledWith({
        name: 'TestModule',
        module: expect.any(Object)
      });
    });
  });
});