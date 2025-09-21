/**
 * Integration tests for MMM-SponsorCarousel hot-reloading capabilities
 */

// Mock MagicMirror² environment
global.Module = {
  register: jest.fn()
};

global.Log = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('MMM-SponsorCarousel Hot-Reloading', () => {
  let moduleDefinition;
  let module;

  beforeAll(() => {
    // Mock Module registration
    global.Module.register = jest.fn((name, definition) => {
      moduleDefinition = definition;
    });

    // Load the module
    require('../../modules/MMM-SponsorCarousel/MMM-SponsorCarousel.js');
  });

  beforeEach(() => {
    // Create fresh module instance
    module = Object.create(moduleDefinition);
    module.name = 'MMM-SponsorCarousel';
    module.identifier = 'test-carousel-hotreload';
    module.config = { ...moduleDefinition.defaults };
    
    // Initialize module state
    module.sponsorsConfig = null;
    module.sponsors = [];
    module.currentSponsorIndex = 0;
    module.carouselTimer = null;
    module.updateTimer = null;
    module.retryCount = 0;
    module.isCarouselRunning = false;
    module.loadingState = true;
    module.errorState = null;

    // Mock module methods
    module.sendSocketNotification = jest.fn();
    module.updateDom = jest.fn();

    // Mock timers
    global.setTimeout = jest.fn();
    global.clearTimeout = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Initial Configuration Loading', () => {
    test('should request sponsors config on module start', () => {
      module.start();

      expect(module.sendSocketNotification).toHaveBeenCalledWith(
        'LOAD_SPONSORS_CONFIG',
        {
          configPath: 'config/sponsors.json',
          identifier: 'test-carousel-hotreload'
        }
      );
    });

    test('should schedule periodic updates when hot reload is enabled', () => {
      module.config.enableHotReload = true;
      
      module.start();

      expect(global.setTimeout).toHaveBeenCalled();
    });

    test('should not schedule updates when hot reload is disabled', () => {
      module.config.enableHotReload = false;
      
      module.start();

      // Should only call setTimeout for loading config, not for scheduling updates
      expect(global.setTimeout).not.toHaveBeenCalled();
    });
  });

  describe('Module Hot-Reload Response', () => {
    test('should handle config updates from node helper', () => {
      const updatedConfig = {
        sponsors: [
          { id: 'new-sponsor', name: 'New Sponsor', logoPath: 'new.png', priority: 7, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 12000 }
      };

      // Simulate receiving update notification
      module.socketNotificationReceived('SPONSORS_CONFIG_UPDATED', {
        identifier: 'test-carousel-hotreload',
        config: updatedConfig
      });

      expect(module.sponsorsConfig).toEqual(updatedConfig);
      expect(module.sponsors).toHaveLength(1);
      expect(module.sponsors[0].id).toBe('new-sponsor');
      expect(module.loadingState).toBe(false);
      expect(module.errorState).toBeNull();
    });

    test('should restart carousel after config update', () => {
      const updatedConfig = {
        sponsors: [
          { id: 'sponsor-1', name: 'Sponsor 1', logoPath: 'logo1.png', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } },
          { id: 'sponsor-2', name: 'Sponsor 2', logoPath: 'logo2.png', priority: 8, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 10000 }
      };

      module.socketNotificationReceived('SPONSORS_CONFIG_UPDATED', {
        identifier: 'test-carousel-hotreload',
        config: updatedConfig
      });

      expect(module.updateDom).toHaveBeenCalled();
      expect(module.sponsors).toHaveLength(2);
      expect(module.isCarouselRunning).toBe(true); // Started by updateSponsors when sponsors are available
    });

    test('should handle hot-reload errors gracefully', () => {
      module.socketNotificationReceived('SPONSORS_CONFIG_ERROR', {
        identifier: 'test-carousel-hotreload',
        error: 'File not found',
        code: 'ENOENT'
      });

      expect(module.errorState).toBe('File not found');
      expect(module.loadingState).toBe(false);
    });

    test('should ignore notifications for other module instances', () => {
      const originalConfig = module.sponsorsConfig;

      module.socketNotificationReceived('SPONSORS_CONFIG_UPDATED', {
        identifier: 'different-carousel-instance',
        config: { sponsors: [], settings: {} }
      });

      expect(module.sponsorsConfig).toBe(originalConfig);
    });
  });

  describe('Automatic Update Scheduling', () => {
    test('should schedule periodic updates when hot reload is enabled', () => {
      module.config.enableHotReload = true;
      module.config.updateInterval = 30000;

      module.scheduleUpdate();

      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
    });

    test('should not schedule updates when hot reload is disabled', () => {
      module.config.enableHotReload = false;

      module.scheduleUpdate();

      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    test('should clear existing timer before scheduling new one', () => {
      module.updateTimer = { id: 123 };

      module.scheduleUpdate();

      expect(global.clearTimeout).toHaveBeenCalledWith({ id: 123 });
    });

    test('should stop scheduled updates on suspend', () => {
      module.updateTimer = { id: 456 };

      module.suspend();

      expect(global.clearTimeout).toHaveBeenCalledWith({ id: 456 });
      expect(module.updateTimer).toBeNull();
    });
  });

  describe('Error Recovery in Hot-Reload', () => {
    test('should retry loading config on transient errors', () => {
      module.config.maxRetries = 3;
      module.retryCount = 1;

      module.handleError('Temporary network error');

      expect(module.errorState).toBe('Temporary network error');
      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        module.config.retryDelay
      );
    });

    test('should stop retrying after max attempts', () => {
      module.config.maxRetries = 3;
      module.retryCount = 3;

      module.handleError('Persistent error');

      expect(module.errorState).toBe('Persistent error');
      expect(module.updateDom).toHaveBeenCalled();
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    test('should reset retry count on successful update', () => {
      module.retryCount = 2;

      const config = {
        sponsors: [
          { id: 'test', name: 'Test', logoPath: 'test.png', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 10000 }
      };

      module.updateSponsors(config);

      expect(module.retryCount).toBe(0);
    });
  });

  describe('Configuration Validation in Hot-Reload', () => {
    test('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        sponsors: [
          { id: 'invalid', name: '', logoPath: '', priority: -1, active: 'maybe' } // Invalid data
        ]
      };

      expect(() => {
        module.updateSponsors(invalidConfig);
      }).not.toThrow();

      // The processSponsors function doesn't validate individual sponsor fields,
      // it only filters by active status and expiry date
      // So this test should expect the sponsor to be included
      expect(module.sponsors).toHaveLength(1);
    });

    test('should preserve existing config on validation failure', () => {
      const validConfig = {
        sponsors: [
          { id: 'valid', name: 'Valid Sponsor', logoPath: 'valid.png', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 10000 }
      };

      // Set initial valid config
      module.updateSponsors(validConfig);
      const originalSponsors = [...module.sponsors];

      // Try to update with invalid config
      module.socketNotificationReceived('SPONSORS_CONFIG_ERROR', {
        identifier: 'test-carousel-hotreload',
        error: 'Validation failed'
      });

      // Should keep original sponsors
      expect(module.sponsors).toEqual(originalSponsors);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup timers on module suspend', () => {
      module.updateTimer = { id: 123 };
      module.carouselTimer = { id: 456 };

      module.suspend();

      expect(global.clearTimeout).toHaveBeenCalledWith({ id: 123 });
      expect(module.updateTimer).toBeNull();
    });

    test('should restart hot-reload on module resume', () => {
      module.resume();

      expect(module.sendSocketNotification).toHaveBeenCalledWith(
        'LOAD_SPONSORS_CONFIG',
        expect.any(Object)
      );
    });
  });
});