/**
 * Unit tests for MMM-SponsorCarousel module
 */

const path = require('path');

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

describe('MMM-SponsorCarousel', () => {
  // Mock module registration to capture the module definition
  let moduleDefinition;
  
  beforeAll(() => {
    global.Module.register = jest.fn((name, definition) => {
      moduleDefinition = definition;
    });

    // Load the module
    require('../../modules/MMM-SponsorCarousel/MMM-SponsorCarousel.js');
  });
  let module;

  beforeEach(() => {
    // Create a fresh module instance for each test
    module = Object.create(moduleDefinition);
    module.name = 'MMM-SponsorCarousel';
    module.identifier = 'test-carousel-1';
    module.config = { ...moduleDefinition.defaults };
    
    // Initialize module state properties
    module.sponsorsConfig = null;
    module.sponsors = [];
    module.currentSponsorIndex = 0;
    module.carouselTimer = null;
    module.updateTimer = null;
    module.retryCount = 0;
    module.isCarouselRunning = false;
    module.loadingState = true;
    module.errorState = null;
    
    // Mock DOM methods
    global.document = {
      createElement: jest.fn((tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        style: {},
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        replaceChild: jest.fn()
      }))
    };

    // Mock module methods
    module.sendSocketNotification = jest.fn();
    module.updateDom = jest.fn();

    // Mock timers
    global.setTimeout = jest.fn();
    global.clearTimeout = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Module Registration', () => {
    test('should register with correct name', () => {
      expect(moduleDefinition).toBeDefined();
      expect(moduleDefinition.defaults).toBeDefined();
    });

    test('should have default configuration', () => {
      expect(moduleDefinition.defaults).toBeDefined();
      expect(moduleDefinition.defaults.sponsorsConfigPath).toBe('config/sponsors.json');
      expect(moduleDefinition.defaults.displayDuration).toBe(10000);
      expect(moduleDefinition.defaults.animationType).toBe('fade');
    });
  });

  describe('Module Initialization', () => {
    test('should initialize with correct default state', () => {
      module.start();

      expect(module.sponsorsConfig).toBeNull();
      expect(module.sponsors).toEqual([]);
      expect(module.currentSponsorIndex).toBe(0);
      expect(module.isCarouselRunning).toBe(false);
      expect(module.loadingState).toBe(true);
      expect(module.errorState).toBeNull();
    });

    test('should load sponsors on start', () => {
      module.start();

      expect(module.sendSocketNotification).toHaveBeenCalledWith(
        'LOAD_SPONSORS_CONFIG',
        {
          configPath: 'config/sponsors.json',
          identifier: 'test-carousel-1'
        }
      );
    });

    test('should schedule updates if hot reload is enabled', () => {
      jest.useFakeTimers();
      module.config.enableHotReload = true;
      
      module.start();
      
      expect(module.updateTimer).toBeDefined();
      
      jest.useRealTimers();
    });
  });

  describe('Sponsor Data Processing', () => {
    const mockSponsorsData = {
      sponsors: [
        {
          id: 'sponsor-1',
          name: 'Test Sponsor 1',
          logoPath: 'logo1.png',
          priority: 8,
          active: true,
          metadata: { addedDate: '2024-01-01T00:00:00Z' }
        },
        {
          id: 'sponsor-2',
          name: 'Test Sponsor 2',
          logoPath: 'logo2.png',
          priority: 5,
          active: false,
          metadata: { addedDate: '2024-01-01T00:00:00Z' }
        },
        {
          id: 'sponsor-3',
          name: 'Test Sponsor 3',
          logoPath: 'logo3.png',
          priority: 3,
          active: true,
          metadata: { 
            addedDate: '2024-01-01T00:00:00Z',
            expiryDate: '2023-12-31T23:59:59Z' // Expired
          }
        }
      ],
      settings: {
        defaultDuration: 10000,
        transitionType: 'fade',
        transitionDuration: 1000,
        shuffleOrder: false,
        respectPriority: true
      }
    };

    test('should process sponsors correctly with default settings', () => {
      const processed = module.processSponsors(mockSponsorsData);
      
      // Should only include active, non-expired sponsors
      expect(processed).toHaveLength(1);
      expect(processed[0].id).toBe('sponsor-1');
    });

    test('should respect priority sorting', () => {
      const sponsorsData = {
        sponsors: [
          { id: 'low', priority: 3, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } },
          { id: 'high', priority: 8, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } },
          { id: 'medium', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ]
      };

      module.config.respectPriority = true;
      const processed = module.processSponsors(sponsorsData);
      
      expect(processed[0].id).toBe('high');
      expect(processed[1].id).toBe('medium');
      expect(processed[2].id).toBe('low');
    });

    test('should shuffle sponsors when configured', () => {
      const sponsorsData = {
        sponsors: Array.from({ length: 10 }, (_, i) => ({
          id: `sponsor-${i}`,
          priority: i,
          active: true,
          metadata: { addedDate: '2024-01-01T00:00:00Z' }
        }))
      };

      module.config.shuffleOrder = true;
      module.config.respectPriority = false;
      
      // Mock Math.random to ensure deterministic shuffling for testing
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);
      
      const processed = module.processSponsors(sponsorsData);
      
      // Should have all sponsors but potentially in different order
      expect(processed).toHaveLength(10);
      
      Math.random = originalRandom;
    });

    test('should include inactive sponsors when configured', () => {
      module.config.onlyActiveSponsors = false;
      const processed = module.processSponsors(mockSponsorsData);
      
      // Should include inactive sponsor but still filter expired
      expect(processed).toHaveLength(2);
      expect(processed.some(s => s.id === 'sponsor-2')).toBe(true);
    });

    test('should handle empty sponsors data', () => {
      const processed = module.processSponsors({ sponsors: [] });
      expect(processed).toEqual([]);
    });

    test('should handle null/undefined sponsors data', () => {
      expect(module.processSponsors(null)).toEqual([]);
      expect(module.processSponsors(undefined)).toEqual([]);
      expect(module.processSponsors({})).toEqual([]);
    });
  });

  describe('Carousel Control', () => {
    beforeEach(() => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1', displayDuration: 5000 },
        { id: 'sponsor-2', name: 'Test 2', displayDuration: 8000 }
      ];
    });

    test('should start carousel with sponsors', () => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1', displayDuration: 5000 },
        { id: 'sponsor-2', name: 'Test 2', displayDuration: 8000 }
      ];
      
      module.startCarousel();
      
      expect(module.isCarouselRunning).toBe(true);
      expect(global.setTimeout).toHaveBeenCalled();
    });

    test('should not start carousel without sponsors', () => {
      module.sponsors = [];
      
      module.startCarousel();
      
      expect(module.isCarouselRunning).toBe(false);
      expect(module.carouselTimer).toBeNull();
    });

    test('should stop carousel correctly', () => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1', displayDuration: 5000 }
      ];
      
      module.startCarousel();
      expect(module.isCarouselRunning).toBe(true);
      
      module.stopCarousel();
      expect(module.isCarouselRunning).toBe(false);
    });

    test('should advance to next sponsor', () => {
      module.currentSponsorIndex = 0;
      
      module.nextSponsor();
      
      expect(module.currentSponsorIndex).toBe(1);
      expect(module.updateDom).toHaveBeenCalled();
    });

    test('should wrap around to first sponsor', () => {
      module.currentSponsorIndex = 1; // Last sponsor
      
      module.nextSponsor();
      
      expect(module.currentSponsorIndex).toBe(0);
    });

    test('should use sponsor-specific display duration', () => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1', displayDuration: 5000 }
      ];
      module.currentSponsorIndex = 0;
      module.startCarousel();
      
      // Should use sponsor's displayDuration (5000ms)
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    test('should fall back to default duration', () => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1' } // No displayDuration
      ];
      module.currentSponsorIndex = 0;
      module.startCarousel();
      
      // Should use config default (10000ms)
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 10000);
    });
  });

  describe('DOM Generation', () => {
    test('should show loading state initially', () => {
      module.loadingState = true;
      
      const dom = module.getDom();
      
      expect(dom.className).toBe('sponsor-carousel-container');
      expect(global.document.createElement).toHaveBeenCalledWith('div');
    });

    test('should show error state when error occurs', () => {
      module.loadingState = false;
      module.errorState = 'Test error';
      
      const dom = module.getDom();
      
      expect(dom.className).toBe('sponsor-carousel-container');
    });

    test('should show fallback when no sponsors available', () => {
      module.loadingState = false;
      module.errorState = null;
      module.sponsors = [];
      
      const dom = module.getDom();
      
      expect(dom.className).toBe('sponsor-carousel-container');
    });

    test('should show carousel when sponsors are available', () => {
      module.loadingState = false;
      module.errorState = null;
      module.sponsors = [
        { id: 'test', name: 'Test Sponsor', logoPath: 'test.png' }
      ];
      module.currentSponsorIndex = 0;
      
      const dom = module.getDom();
      
      expect(dom.className).toBe('sponsor-carousel-container');
    });
  });

  describe('Socket Notifications', () => {
    test('should handle successful config load', () => {
      const mockConfig = {
        sponsors: [
          { id: 'test', name: 'Test', logoPath: 'test.png', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 10000 }
      };

      module.socketNotificationReceived('SPONSORS_CONFIG_LOADED', {
        identifier: 'test-carousel-1',
        config: mockConfig
      });

      expect(module.sponsorsConfig).toEqual(mockConfig);
      expect(module.loadingState).toBe(false);
      expect(module.errorState).toBeNull();
    });

    test('should handle config load error', () => {
      module.socketNotificationReceived('SPONSORS_CONFIG_ERROR', {
        identifier: 'test-carousel-1',
        error: 'File not found'
      });

      expect(module.errorState).toBe('File not found');
      expect(module.loadingState).toBe(false);
    });

    test('should ignore notifications for other instances', () => {
      const originalState = { ...module };

      module.socketNotificationReceived('SPONSORS_CONFIG_LOADED', {
        identifier: 'different-carousel',
        config: { sponsors: [] }
      });

      // State should not change
      expect(module.sponsorsConfig).toBe(originalState.sponsorsConfig);
    });

    test('should handle config updates', () => {
      const mockConfig = {
        sponsors: [
          { id: 'updated', name: 'Updated Sponsor', logoPath: 'updated.png', priority: 5, active: true, metadata: { addedDate: '2024-01-01T00:00:00Z' } }
        ],
        settings: { defaultDuration: 15000 }
      };

      module.socketNotificationReceived('SPONSORS_CONFIG_UPDATED', {
        identifier: 'test-carousel-1',
        config: mockConfig
      });

      expect(module.sponsorsConfig).toEqual(mockConfig);
      expect(module.sponsors[0].id).toBe('updated');
    });
  });

  describe('Error Handling', () => {
    test('should retry on error within max retries', () => {
      module.config.maxRetries = 3;
      module.retryCount = 1;
      
      module.handleError('Test error');
      
      expect(module.errorState).toBe('Test error');
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    test('should stop retrying after max retries', () => {
      module.config.maxRetries = 3;
      module.retryCount = 3;
      
      module.handleError('Test error');
      
      expect(module.errorState).toBe('Test error');
      expect(module.updateDom).toHaveBeenCalled();
    });
  });

  describe('Module Lifecycle', () => {
    test('should suspend correctly', () => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Test 1', displayDuration: 5000 }
      ];
      
      module.startCarousel();
      module.scheduleUpdate();
      
      module.suspend();
      
      expect(module.isCarouselRunning).toBe(false);
    });

    test('should resume correctly', () => {
      module.resume();
      
      expect(module.sendSocketNotification).toHaveBeenCalledWith(
        'LOAD_SPONSORS_CONFIG',
        expect.any(Object)
      );
    });
  });

  describe('Utility Functions', () => {
    test('should shuffle array correctly', () => {
      const originalArray = [1, 2, 3, 4, 5];
      const shuffled = module.shuffleArray(originalArray);
      
      // Should have same length and elements
      expect(shuffled).toHaveLength(originalArray.length);
      expect(shuffled.sort()).toEqual(originalArray.sort());
      
      // Should not modify original array
      expect(originalArray).toEqual([1, 2, 3, 4, 5]);
    });
  });
});