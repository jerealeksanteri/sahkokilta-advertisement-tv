/**
 * End-to-end tests for complete application lifecycle
 * Tests startup, module loading, dependency management, and graceful shutdown
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const path = require('path');
const fs = require('fs-extra');

// Import the application classes
const ApplicationLifecycle = require('../../js/ApplicationLifecycle');
const SahkokiltaAdvertisementTV = require('../../js/main');

// Mock MagicMirror² environment
global.Log = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('Application Lifecycle Integration Tests', () => {
  let lifecycle;
  let mockConfig;

  beforeEach(() => {
    // Create mock configuration
    mockConfig = {
      modules: [
        {
          module: 'MMM-LayoutManager',
          position: 'fullscreen_below',
          config: {
            dependencies: [],
            priority: 1,
            communicationChannels: {
              displayInfo: 'DISPLAY_INFO_UPDATED'
            }
          }
        },
        {
          module: 'MMM-SahkokiltaBranding',
          position: 'top_left',
          config: {
            dependencies: ['MMM-LayoutManager'],
            priority: 2,
            communicationChannels: {
              themeUpdate: 'THEME_UPDATED'
            }
          }
        },
        {
          module: 'MMM-SponsorCarousel',
          position: 'middle_center',
          config: {
            dependencies: ['MMM-LayoutManager', 'MMM-SahkokiltaBranding'],
            priority: 3,
            communicationChannels: {
              carouselUpdate: 'CAROUSEL_UPDATED'
            }
          }
        }
      ],
      lifecycle: {
        moduleLoadTimeout: 5000,
        dependencyCheckTimeout: 3000,
        initializationDelay: 100,
        shutdownTimeout: 3000,
        enableAutoRestart: false,
        enableGracefulShutdown: true
      }
    };

    lifecycle = new ApplicationLifecycle(mockConfig.lifecycle);
  });

  afterEach(async () => {
    if (lifecycle && lifecycle.state !== 'stopped') {
      try {
        await lifecycle.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    jest.clearAllMocks();
  });

  describe('Application Startup', () => {
    test('should start application successfully with valid configuration', async () => {
      const startupEvents = [];
      
      lifecycle.on('startup:begin', () => startupEvents.push('begin'));
      lifecycle.on('modules:configured', () => startupEvents.push('configured'));
      lifecycle.on('dependencies:validated', () => startupEvents.push('validated'));
      lifecycle.on('modules:initialized', () => startupEvents.push('initialized'));
      lifecycle.on('modules:ready', () => startupEvents.push('ready'));
      lifecycle.on('startup:complete', () => startupEvents.push('complete'));

      const result = await lifecycle.start(mockConfig);

      expect(result).toBe(true);
      expect(lifecycle.state).toBe('running');
      expect(startupEvents).toEqual([
        'begin',
        'configured',
        'validated',
        'initialized',
        'ready',
        'complete'
      ]);
    });

    test('should handle startup with missing dependencies', async () => {
      // Add a module with non-existent dependency
      mockConfig.modules.push({
        module: 'MMM-NonExistent',
        position: 'bottom_center',
        config: {
          dependencies: ['MMM-DoesNotExist'],
          priority: 4
        }
      });

      await expect(lifecycle.start(mockConfig)).rejects.toThrow('Dependency validation failed');
      expect(lifecycle.state).toBe('error');
    });

    test('should handle startup timeout', async () => {
      // Set very short timeout
      lifecycle.config.moduleLoadTimeout = 50;
      lifecycle.config.initializationDelay = 100; // Longer than timeout

      await expect(lifecycle.start(mockConfig)).rejects.toThrow('Module initialization timeout');
      expect(lifecycle.state).toBe('error');
    });

    test('should load modules in correct dependency order', async () => {
      const initializationOrder = [];
      
      lifecycle.on('module:initializing', (moduleName) => {
        initializationOrder.push(moduleName);
      });

      await lifecycle.start(mockConfig);

      expect(initializationOrder).toEqual([
        'MMM-LayoutManager',
        'MMM-SahkokiltaBranding',
        'MMM-SponsorCarousel'
      ]);
    });
  });

  describe('Module Dependency Management', () => {
    test('should validate dependencies correctly', async () => {
      const validationEvents = [];
      
      lifecycle.on('dependencies:validated', () => validationEvents.push('validated'));

      await lifecycle.start(mockConfig);

      expect(validationEvents).toContain('validated');
      expect(lifecycle.modules.size).toBe(3);
    });

    test('should handle circular dependencies', async () => {
      // Create circular dependency
      mockConfig.modules[0].config.dependencies = ['MMM-SponsorCarousel'];

      await expect(lifecycle.start(mockConfig)).rejects.toThrow();
    });

    test('should track module states correctly', async () => {
      await lifecycle.start(mockConfig);

      const moduleInfo = lifecycle.getModuleInfo();
      
      expect(moduleInfo).toHaveLength(3);
      moduleInfo.forEach(module => {
        expect(module.state).toBe('initialized');
        expect(module.loaded).toBe(true);
        expect(module.failed).toBe(false);
      });
    });
  });

  describe('Application Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await lifecycle.start(mockConfig);
      
      const shutdownEvents = [];
      lifecycle.on('shutdown:begin', () => shutdownEvents.push('begin'));
      lifecycle.on('shutdown:complete', () => shutdownEvents.push('complete'));

      const result = await lifecycle.stop();

      expect(result).toBe(true);
      expect(lifecycle.state).toBe('stopped');
      expect(shutdownEvents).toEqual(['begin', 'complete']);
    });

    test('should shutdown modules in reverse order', async () => {
      await lifecycle.start(mockConfig);
      
      const shutdownOrder = [];
      lifecycle.on('module:shutting_down', (moduleName) => {
        shutdownOrder.push(moduleName);
      });

      await lifecycle.stop();

      expect(shutdownOrder).toEqual([
        'MMM-SponsorCarousel',
        'MMM-SahkokiltaBranding',
        'MMM-LayoutManager'
      ]);
    });

    test('should handle shutdown timeout', async () => {
      await lifecycle.start(mockConfig);
      
      // Set very short shutdown timeout
      lifecycle.config.shutdownTimeout = 50;
      
      // Mock a module that takes too long to shutdown
      const layoutModule = lifecycle.modules.get('MMM-LayoutManager');
      if (layoutModule && layoutModule.instance) {
        layoutModule.instance.shutdown = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        };
      }

      await expect(lifecycle.stop()).rejects.toThrow('Shutdown timeout');
    });
  });

  describe('Error Handling', () => {
    test('should handle module initialization errors', async () => {
      const errorEvents = [];
      lifecycle.on('startup:error', (error) => errorEvents.push(error));

      // Mock module initialization failure
      const originalRegister = lifecycle.moduleCommunication?.registerModule;
      if (lifecycle.moduleCommunication) {
        lifecycle.moduleCommunication.registerModule = jest.fn().mockImplementation(() => {
          throw new Error('Module registration failed');
        });
      }

      await expect(lifecycle.start(mockConfig)).rejects.toThrow();
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    test('should handle uncaught exceptions', (done) => {
      const originalExit = process.exit;
      process.exit = jest.fn();

      lifecycle.on('error:uncaught_exception', (error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test uncaught exception');
        
        // Restore original exit
        process.exit = originalExit;
        done();
      });

      // Simulate uncaught exception
      lifecycle.handleUncaughtException(new Error('Test uncaught exception'));
    });

    test('should handle unhandled rejections', (done) => {
      const originalExit = process.exit;
      process.exit = jest.fn();

      lifecycle.on('error:unhandled_rejection', (reason) => {
        expect(reason).toBe('Test unhandled rejection');
        
        // Restore original exit
        process.exit = originalExit;
        done();
      });

      // Simulate unhandled rejection
      lifecycle.handleUnhandledRejection('Test unhandled rejection', Promise.resolve());
    });
  });

  describe('Health Monitoring', () => {
    test('should set up health monitoring when enabled', async () => {
      lifecycle.config.enableModuleIsolation = true;
      
      await lifecycle.start(mockConfig);
      
      expect(lifecycle.healthCheckInterval).toBeDefined();
      
      await lifecycle.stop();
      expect(lifecycle.healthCheckInterval).toBeUndefined();
    });

    test('should perform periodic cleanup', async () => {
      const cleanupEvents = [];
      lifecycle.on('cleanup:performed', () => cleanupEvents.push('cleanup'));

      await lifecycle.start(mockConfig);
      
      // Trigger cleanup manually
      lifecycle._performCleanup();
      
      expect(cleanupEvents).toContain('cleanup');
    });
  });

  describe('Application Status', () => {
    test('should provide accurate status information', async () => {
      let status = lifecycle.getStatus();
      expect(status.state).toBe('stopped');
      expect(status.modules.total).toBe(0);

      await lifecycle.start(mockConfig);

      status = lifecycle.getStatus();
      expect(status.state).toBe('running');
      expect(status.modules.total).toBe(3);
      expect(status.modules.loaded).toBe(3);
      expect(status.modules.failed).toBe(0);
    });

    test('should provide module information', async () => {
      await lifecycle.start(mockConfig);

      const moduleInfo = lifecycle.getModuleInfo();
      
      expect(moduleInfo).toHaveLength(3);
      expect(moduleInfo[0].name).toBe('MMM-LayoutManager');
      expect(moduleInfo[0].priority).toBe(1);
      expect(moduleInfo[0].dependencies).toEqual([]);
      
      expect(moduleInfo[1].name).toBe('MMM-SahkokiltaBranding');
      expect(moduleInfo[1].dependencies).toEqual(['MMM-LayoutManager']);
    });
  });
});

describe('Main Application Integration Tests', () => {
  let app;
  let tempConfigPath;

  beforeEach(async () => {
    // Create temporary config file
    tempConfigPath = path.join(__dirname, 'temp-config.js');
    const configContent = `
      module.exports = {
        modules: [
          {
            module: 'MMM-LayoutManager',
            position: 'fullscreen_below',
            config: {
              dependencies: [],
              priority: 1
            }
          },
          {
            module: 'MMM-SahkokiltaBranding',
            position: 'top_left',
            config: {
              dependencies: ['MMM-LayoutManager'],
              priority: 2
            }
          }
        ],
        lifecycle: {
          moduleLoadTimeout: 3000,
          enableAutoRestart: false
        }
      };
    `;
    
    await fs.writeFile(tempConfigPath, configContent);
    
    // Create new app instance
    app = new (require('../../js/main').constructor)();
  });

  afterEach(async () => {
    if (app && app.started) {
      try {
        await app.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up temp config file
    if (await fs.pathExists(tempConfigPath)) {
      await fs.remove(tempConfigPath);
    }
    
    jest.clearAllMocks();
  });

  describe('Application Initialization', () => {
    test('should initialize with valid configuration', async () => {
      const result = await app.initialize(tempConfigPath);
      
      expect(result).toBe(true);
      expect(app.config).toBeDefined();
      expect(app.lifecycle).toBeDefined();
    });

    test('should fail initialization with invalid config path', async () => {
      await expect(app.initialize('/nonexistent/config.js')).rejects.toThrow();
    });

    test('should load default configuration when no path provided', async () => {
      // This will try to load the actual config.js file
      const result = await app.initialize();
      
      expect(result).toBe(true);
      expect(app.config).toBeDefined();
    });
  });

  describe('Application Lifecycle', () => {
    test('should start and stop application successfully', async () => {
      await app.initialize(tempConfigPath);
      
      const startResult = await app.start();
      expect(startResult).toBe(true);
      expect(app.started).toBe(true);
      
      const stopResult = await app.stop();
      expect(stopResult).toBe(true);
      expect(app.started).toBe(false);
    });

    test('should restart application successfully', async () => {
      await app.initialize(tempConfigPath);
      await app.start();
      
      const restartResult = await app.restart();
      
      expect(restartResult).toBe(true);
      expect(app.started).toBe(true);
    });

    test('should reload configuration successfully', async () => {
      await app.initialize(tempConfigPath);
      await app.start();
      
      // Modify config file
      const newConfigContent = `
        module.exports = {
          modules: [
            {
              module: 'MMM-LayoutManager',
              position: 'fullscreen_below',
              config: {
                dependencies: [],
                priority: 1
              }
            }
          ],
          lifecycle: {
            moduleLoadTimeout: 2000
          }
        };
      `;
      
      await fs.writeFile(tempConfigPath, newConfigContent);
      
      const reloadResult = await app.reloadConfiguration(tempConfigPath);
      
      expect(reloadResult).toBe(true);
      expect(app.config.modules).toHaveLength(1);
    });
  });

  describe('Application Status and Monitoring', () => {
    test('should provide accurate status information', async () => {
      let status = app.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);

      await app.initialize(tempConfigPath);
      
      status = app.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.started).toBe(false);

      await app.start();
      
      status = app.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.started).toBe(true);
      expect(status.state).toBe('running');
    });

    test('should provide module information', async () => {
      await app.initialize(tempConfigPath);
      await app.start();

      const moduleInfo = app.getModuleInfo();
      
      expect(moduleInfo).toHaveLength(2);
      expect(moduleInfo.find(m => m.name === 'MMM-LayoutManager')).toBeDefined();
      expect(moduleInfo.find(m => m.name === 'MMM-SahkokiltaBranding')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle start without initialization', async () => {
      await expect(app.start()).rejects.toThrow('Application not initialized');
    });

    test('should handle multiple start calls', async () => {
      await app.initialize(tempConfigPath);
      
      await app.start();
      const secondStart = await app.start();
      
      expect(secondStart).toBe(true);
    });

    test('should handle stop without start', async () => {
      await app.initialize(tempConfigPath);
      
      const stopResult = await app.stop();
      expect(stopResult).toBe(true);
    });
  });
});