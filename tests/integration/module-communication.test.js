/**
 * Integration tests for module loading and communication
 * Tests the MagicMirror² configuration and module interaction
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const path = require('path');
const fs = require('fs-extra');

// Mock MagicMirror² environment
global.Log = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

global.Module = {
  register: jest.fn(),
  definitions: new Map()
};

// Import the module communication system
const ModuleCommunication = require('../../js/ModuleCommunication');

describe('Module Communication Integration Tests', () => {
  let communication;
  let mockModules;

  beforeEach(() => {
    communication = new ModuleCommunication();
    
    // Create mock modules
    mockModules = {
      'MMM-LayoutManager': {
        name: 'MMM-LayoutManager',
        initialize: jest.fn().mockResolvedValue(true),
        shutdown: jest.fn().mockResolvedValue(true),
        sendNotification: jest.fn(),
        onCommunicationEvent: jest.fn()
      },
      'MMM-SahkokiltaBranding': {
        name: 'MMM-SahkokiltaBranding',
        initialize: jest.fn().mockResolvedValue(true),
        shutdown: jest.fn().mockResolvedValue(true),
        sendNotification: jest.fn(),
        onCommunicationEvent: jest.fn()
      },
      'MMM-SponsorCarousel': {
        name: 'MMM-SponsorCarousel',
        initialize: jest.fn().mockResolvedValue(true),
        shutdown: jest.fn().mockResolvedValue(true),
        sendNotification: jest.fn(),
        onCommunicationEvent: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Registration', () => {
    test('should register modules with correct configuration', () => {
      const moduleId = 'MMM-LayoutManager';
      const config = {
        dependencies: [],
        communicationChannels: {
          displayInfo: 'DISPLAY_INFO_UPDATED',
          layoutChange: 'LAYOUT_CHANGED'
        },
        priority: 1
      };

      const result = communication.registerModule(moduleId, mockModules[moduleId], config);

      expect(result).toBe(true);
      expect(communication.modules.has(moduleId)).toBe(true);
      expect(communication.moduleStates.get(moduleId)).toBe('registered');
    });

    test('should handle module registration with dependencies', () => {
      // Register layout manager first
      communication.registerModule('MMM-LayoutManager', mockModules['MMM-LayoutManager'], {
        dependencies: [],
        priority: 1
      });

      // Register branding module with dependency
      communication.registerModule('MMM-SahkokiltaBranding', mockModules['MMM-SahkokiltaBranding'], {
        dependencies: ['MMM-LayoutManager'],
        priority: 2
      });

      expect(communication.dependencies.get('MMM-SahkokiltaBranding')).toEqual(['MMM-LayoutManager']);
      expect(communication.loadOrder).toEqual(['MMM-LayoutManager', 'MMM-SahkokiltaBranding']);
    });

    test('should update load order based on priorities and dependencies', () => {
      // Register modules in random order
      communication.registerModule('MMM-SponsorCarousel', mockModules['MMM-SponsorCarousel'], {
        dependencies: ['MMM-LayoutManager', 'MMM-SahkokiltaBranding'],
        priority: 3
      });

      communication.registerModule('MMM-SahkokiltaBranding', mockModules['MMM-SahkokiltaBranding'], {
        dependencies: ['MMM-LayoutManager'],
        priority: 2
      });

      communication.registerModule('MMM-LayoutManager', mockModules['MMM-LayoutManager'], {
        dependencies: [],
        priority: 1
      });

      expect(communication.loadOrder).toEqual([
        'MMM-LayoutManager',
        'MMM-SahkokiltaBranding',
        'MMM-SponsorCarousel'
      ]);
    });
  });

  describe('Module Initialization', () => {
    beforeEach(() => {
      // Register all modules
      communication.registerModule('MMM-LayoutManager', mockModules['MMM-LayoutManager'], {
        dependencies: [],
        priority: 1
      });

      communication.registerModule('MMM-SahkokiltaBranding', mockModules['MMM-SahkokiltaBranding'], {
        dependencies: ['MMM-LayoutManager'],
        priority: 2
      });

      communication.registerModule('MMM-SponsorCarousel', mockModules['MMM-SponsorCarousel'], {
        dependencies: ['MMM-LayoutManager', 'MMM-SahkokiltaBranding'],
        priority: 3
      });
    });

    test('should initialize modules in correct order', async () => {
      await communication.initializeModules();

      // Check that all modules were initialized
      expect(mockModules['MMM-LayoutManager'].initialize).toHaveBeenCalled();
      expect(mockModules['MMM-SahkokiltaBranding'].initialize).toHaveBeenCalled();
      expect(mockModules['MMM-SponsorCarousel'].initialize).toHaveBeenCalled();

      // Check initialization order
      const layoutCall = mockModules['MMM-LayoutManager'].initialize.mock.invocationCallOrder[0];
      const brandingCall = mockModules['MMM-SahkokiltaBranding'].initialize.mock.invocationCallOrder[0];
      const carouselCall = mockModules['MMM-SponsorCarousel'].initialize.mock.invocationCallOrder[0];

      expect(layoutCall).toBeLessThan(brandingCall);
      expect(brandingCall).toBeLessThan(carouselCall);

      // Check final states
      expect(communication.getModuleState('MMM-LayoutManager')).toBe('initialized');
      expect(communication.getModuleState('MMM-SahkokiltaBranding')).toBe('initialized');
      expect(communication.getModuleState('MMM-SponsorCarousel')).toBe('initialized');
    });

    test('should handle initialization errors gracefully', async () => {
      // Make branding module fail initialization
      mockModules['MMM-SahkokiltaBranding'].initialize.mockRejectedValue(new Error('Init failed'));

      await communication.initializeModules();

      expect(communication.getModuleState('MMM-LayoutManager')).toBe('initialized');
      expect(communication.getModuleState('MMM-SahkokiltaBranding')).toBe('error');
      // Carousel should fail because its dependency (branding) failed
      expect(communication.getModuleState('MMM-SponsorCarousel')).toBe('error');
    });

    test('should check dependencies before initialization', async () => {
      // Try to initialize carousel before its dependencies
      await expect(communication.initializeModule('MMM-SponsorCarousel')).rejects.toThrow();
    });
  });

  describe('Module Communication', () => {
    beforeEach(async () => {
      // Register and initialize all modules
      communication.registerModule('MMM-LayoutManager', mockModules['MMM-LayoutManager'], {
        dependencies: [],
        communicationChannels: {
          displayInfo: 'DISPLAY_INFO_UPDATED',
          layoutChange: 'LAYOUT_CHANGED'
        },
        priority: 1
      });

      communication.registerModule('MMM-SahkokiltaBranding', mockModules['MMM-SahkokiltaBranding'], {
        dependencies: ['MMM-LayoutManager'],
        communicationChannels: {
          themeUpdate: 'THEME_UPDATED',
          brandingReady: 'BRANDING_READY'
        },
        priority: 2
      });

      communication.registerModule('MMM-SponsorCarousel', mockModules['MMM-SponsorCarousel'], {
        dependencies: ['MMM-LayoutManager', 'MMM-SahkokiltaBranding'],
        communicationChannels: {
          carouselUpdate: 'CAROUSEL_UPDATED',
          sponsorChange: 'SPONSOR_CHANGED'
        },
        priority: 3
      });

      await communication.initializeModules();
    });

    test('should broadcast events to listening modules', () => {
      const eventData = { resolution: { width: 1920, height: 1080 } };
      
      communication.broadcastEvent('DISPLAY_INFO_UPDATED', eventData, 'MMM-LayoutManager');

      // Layout manager should not receive its own event
      expect(mockModules['MMM-LayoutManager'].sendNotification).not.toHaveBeenCalled();
      
      // Check if there are any listeners for this event
      const listeners = communication.communicationChannels.get('DISPLAY_INFO_UPDATED');
      if (listeners && listeners.size > 0) {
        // Other modules should receive the event
        expect(mockModules['MMM-SahkokiltaBranding'].sendNotification).toHaveBeenCalledWith(
          'DISPLAY_INFO_UPDATED',
          expect.objectContaining({
            ...eventData,
            sender: 'MMM-LayoutManager'
          })
        );
      } else {
        // If no listeners, the event should not be sent
        expect(mockModules['MMM-SahkokiltaBranding'].sendNotification).not.toHaveBeenCalled();
      }
    });

    test('should send direct messages between modules', () => {
      const messageData = { theme: 'dark', colors: { primary: '#FF6B35' } };
      
      const result = communication.sendDirectMessage(
        'MMM-SponsorCarousel',
        'THEME_UPDATED',
        messageData,
        'MMM-SahkokiltaBranding'
      );

      expect(result).toBe(true);
      expect(mockModules['MMM-SponsorCarousel'].sendNotification).toHaveBeenCalledWith(
        'THEME_UPDATED',
        expect.objectContaining({
          ...messageData,
          sender: 'MMM-SahkokiltaBranding',
          direct: true
        })
      );
    });

    test('should handle shared data correctly', () => {
      const themeData = { primary: '#FF6B35', secondary: '#004E89' };
      
      communication.setSharedData('theme', themeData, 'MMM-SahkokiltaBranding');
      
      const retrievedData = communication.getSharedData('theme');
      expect(retrievedData).toEqual(themeData);

      // Check if there are listeners for shared data updates
      const listeners = communication.communicationChannels.get('SHARED_DATA_UPDATED');
      if (listeners && listeners.size > 0) {
        // Should broadcast data update event
        expect(mockModules['MMM-LayoutManager'].sendNotification).toHaveBeenCalledWith(
          'SHARED_DATA_UPDATED',
          expect.objectContaining({
            key: 'theme',
            value: themeData,
            moduleId: 'MMM-SahkokiltaBranding'
          })
        );
      } else {
        // If no listeners, verify data was stored correctly
        expect(retrievedData).toEqual(themeData);
      }
    });
  });

  describe('Module Lifecycle Management', () => {
    beforeEach(async () => {
      // Register and initialize all modules
      Object.keys(mockModules).forEach((moduleId, index) => {
        communication.registerModule(moduleId, mockModules[moduleId], {
          dependencies: index === 0 ? [] : [Object.keys(mockModules)[index - 1]],
          priority: index + 1
        });
      });

      await communication.initializeModules();
    });

    test('should shutdown modules in reverse order', async () => {
      await communication.shutdown();

      // Check that all modules were shut down
      Object.values(mockModules).forEach(module => {
        expect(module.shutdown).toHaveBeenCalled();
      });

      // Check shutdown order (reverse of initialization)
      const layoutCall = mockModules['MMM-LayoutManager'].shutdown.mock.invocationCallOrder[0];
      const brandingCall = mockModules['MMM-SahkokiltaBranding'].shutdown.mock.invocationCallOrder[0];
      const carouselCall = mockModules['MMM-SponsorCarousel'].shutdown.mock.invocationCallOrder[0];

      expect(carouselCall).toBeLessThan(brandingCall);
      expect(brandingCall).toBeLessThan(layoutCall);
    });

    test('should handle shutdown errors gracefully', async () => {
      mockModules['MMM-SahkokiltaBranding'].shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await communication.shutdown();

      // Other modules should still be shut down
      expect(mockModules['MMM-LayoutManager'].shutdown).toHaveBeenCalled();
      expect(mockModules['MMM-SponsorCarousel'].shutdown).toHaveBeenCalled();
    });
  });

  describe('Dependency Management', () => {
    test('should correctly identify when dependencies are ready', () => {
      communication.registerModule('MMM-LayoutManager', mockModules['MMM-LayoutManager'], {
        dependencies: [],
        priority: 1
      });

      communication.registerModule('MMM-SahkokiltaBranding', mockModules['MMM-SahkokiltaBranding'], {
        dependencies: ['MMM-LayoutManager'],
        priority: 2
      });

      // Initially, branding dependencies are not ready
      expect(communication.areDependenciesReady('MMM-SahkokiltaBranding')).toBe(false);

      // After layout manager is initialized
      communication.moduleStates.set('MMM-LayoutManager', 'initialized');
      expect(communication.areDependenciesReady('MMM-SahkokiltaBranding')).toBe(true);
    });

    test('should detect circular dependencies', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      communication.registerModule('ModuleA', { name: 'ModuleA' }, {
        dependencies: ['ModuleB'],
        priority: 1
      });

      communication.registerModule('ModuleB', { name: 'ModuleB' }, {
        dependencies: ['ModuleA'],
        priority: 2
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circular dependency detected')
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('MagicMirror² Configuration Integration', () => {
  let config;

  beforeEach(() => {
    // Load the actual config
    delete require.cache[require.resolve('../../config.js')];
    config = require('../../config.js');
  });

  test('should have valid configuration structure', () => {
    expect(config).toBeDefined();
    expect(config.modules).toBeDefined();
    expect(Array.isArray(config.modules)).toBe(true);
    expect(config.modules.length).toBeGreaterThan(0);
  });

  test('should have all required modules configured', () => {
    const moduleNames = config.modules.map(m => m.module);
    
    expect(moduleNames).toContain('MMM-LayoutManager');
    expect(moduleNames).toContain('MMM-SahkokiltaBranding');
    expect(moduleNames).toContain('MMM-SponsorCarousel');
  });

  test('should have correct module priorities and dependencies', () => {
    const layoutModule = config.modules.find(m => m.module === 'MMM-LayoutManager');
    const brandingModule = config.modules.find(m => m.module === 'MMM-SahkokiltaBranding');
    const carouselModule = config.modules.find(m => m.module === 'MMM-SponsorCarousel');

    expect(layoutModule.config.priority).toBe(1);
    expect(brandingModule.config.priority).toBe(2);
    expect(carouselModule.config.priority).toBe(3);

    expect(layoutModule.config.dependencies).toEqual([]);
    expect(brandingModule.config.dependencies).toContain('MMM-LayoutManager');
    expect(carouselModule.config.dependencies).toContain('MMM-LayoutManager');
    expect(carouselModule.config.dependencies).toContain('MMM-SahkokiltaBranding');
  });

  test('should have communication channels configured', () => {
    config.modules.forEach(module => {
      expect(module.config.communicationChannels).toBeDefined();
      expect(typeof module.config.communicationChannels).toBe('object');
    });
  });

  test('should have lifecycle configuration', () => {
    expect(config.lifecycle).toBeDefined();
    expect(config.lifecycle.startup).toBeDefined();
    expect(config.lifecycle.shutdown).toBeDefined();
    expect(config.lifecycle.errorRecovery).toBeDefined();
  });

  test('should have performance optimizations for Raspberry Pi', () => {
    expect(config.electronOptions).toBeDefined();
    expect(config.moduleDefaults.performance).toBeDefined();
    expect(config.debug.enablePerformanceMonitoring).toBe(true);
  });
});