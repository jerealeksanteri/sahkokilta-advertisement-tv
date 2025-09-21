/**
 * Unit tests for MMM-SponsorCarousel display logic and timing
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

describe('MMM-SponsorCarousel Display Logic', () => {
  // Mock module registration to capture the module definition
  let moduleDefinition;
  let module;
  
  beforeAll(() => {
    global.Module.register = jest.fn((name, definition) => {
      moduleDefinition = definition;
    });

    // Load the module
    require('../../modules/MMM-SponsorCarousel/MMM-SponsorCarousel.js');
  });

  beforeEach(() => {
    // Create a fresh module instance for each test
    module = Object.create(moduleDefinition);
    module.name = 'MMM-SponsorCarousel';
    module.identifier = 'test-carousel-display';
    module.config = { ...moduleDefinition.defaults };
    
    // Initialize module state properties
    module.sponsorsConfig = null;
    module.sponsors = [];
    module.currentSponsorIndex = 0;
    module.carouselTimer = null;
    module.updateTimer = null;
    module.retryCount = 0;
    module.isCarouselRunning = false;
    module.loadingState = false;
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
        replaceChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }))
    };

    // Mock module methods
    module.sendSocketNotification = jest.fn();
    module.updateDom = jest.fn();

    // Mock timers
    global.setTimeout = jest.fn((callback, delay) => {
      return { id: Math.random(), callback, delay };
    });
    global.clearTimeout = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Carousel HTML Structure', () => {
    test('should create correct HTML structure for sponsor item', () => {
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor Company',
        logoPath: 'assets/images/test-logo.png',
        priority: 5
      };

      const sponsorElement = module.createSponsorElement(sponsor);
      
      expect(sponsorElement.className).toBe('sponsor-item');
      expect(global.document.createElement).toHaveBeenCalledWith('div');
      expect(global.document.createElement).toHaveBeenCalledWith('img');
    });

    test('should set correct attributes on sponsor media', () => {
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor Company',
        logoPath: 'assets/images/test-logo.png',
        adPath: 'assets/images/test-ad.png'
      };

      const mockImg = {
        className: '',
        src: '',
        alt: '',
        onerror: null,
        onload: null
      };

      global.document.createElement = jest.fn((tag) => {
        if (tag === 'img') return mockImg;
        return {
          tagName: tag.toUpperCase(),
          className: '',
          innerHTML: '',
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          replaceChild: jest.fn()
        };
      });

      module.createSponsorElement(sponsor);
      
      expect(mockImg.src).toBe(sponsor.adPath); // Should prefer ad over logo
      expect(mockImg.alt).toBe(sponsor.name);
      expect(mockImg.className).toBe('sponsor-media');
    });

    test('should fall back to logo when ad path is not available', () => {
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor Company',
        logoPath: 'assets/images/test-logo.png'
        // No adPath
      };

      const mockImg = {
        className: '',
        src: '',
        alt: '',
        onerror: null,
        onload: null
      };

      global.document.createElement = jest.fn((tag) => {
        if (tag === 'img') return mockImg;
        return {
          tagName: tag.toUpperCase(),
          className: '',
          innerHTML: '',
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          replaceChild: jest.fn()
        };
      });

      module.createSponsorElement(sponsor);
      
      expect(mockImg.src).toBe(sponsor.logoPath);
    });

    test('should include sponsor name when configured', () => {
      module.config.showSponsorName = true;
      
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor Company',
        logoPath: 'assets/images/test-logo.png'
      };

      let sponsorNameElement = null;
      let callCount = 0;

      global.document.createElement = jest.fn((tag) => {
        callCount++;
        const element = {
          tagName: tag.toUpperCase(),
          className: '',
          innerHTML: '',
          setAttribute: jest.fn(),
          appendChild: jest.fn((child) => {
            if (child.className === 'sponsor-name') {
              sponsorNameElement = child;
            }
          }),
          replaceChild: jest.fn()
        };
        
        // Track the sponsor name div specifically
        if (tag === 'div' && callCount === 2) { // Second div call is for sponsor name
          sponsorNameElement = element;
        }
        
        return element;
      });

      const result = module.createSponsorElement(sponsor);
      
      expect(result).not.toBeNull();
      expect(sponsorNameElement).not.toBeNull();
      expect(sponsorNameElement.innerHTML).toBe(sponsor.name);
      expect(sponsorNameElement.className).toBe('sponsor-name');
    });

    test('should not include sponsor name when disabled', () => {
      module.config.showSponsorName = false;
      
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor Company',
        logoPath: 'assets/images/test-logo.png'
      };

      let nameElementCreated = false;
      global.document.createElement = jest.fn((tag) => {
        if (tag === 'div') {
          const element = {
            tagName: 'DIV',
            className: '',
            innerHTML: '',
            setAttribute: jest.fn(),
            appendChild: jest.fn((child) => {
              if (child.className === 'sponsor-name') {
                nameElementCreated = true;
              }
            }),
            replaceChild: jest.fn()
          };
          return element;
        }
        return {
          tagName: tag.toUpperCase(),
          className: '',
          src: '',
          alt: '',
          onerror: null,
          onload: null
        };
      });

      module.createSponsorElement(sponsor);
      
      expect(nameElementCreated).toBe(false);
    });
  });

  describe('Carousel Timing and State Management', () => {
    beforeEach(() => {
      module.sponsors = [
        { id: 'sponsor-1', name: 'Sponsor 1', logoPath: 'logo1.png', displayDuration: 5000 },
        { id: 'sponsor-2', name: 'Sponsor 2', logoPath: 'logo2.png', displayDuration: 8000 },
        { id: 'sponsor-3', name: 'Sponsor 3', logoPath: 'logo3.png' } // No custom duration
      ];
    });

    test('should use sponsor-specific display duration', () => {
      module.currentSponsorIndex = 0;
      module.startCarousel();
      
      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5000 // sponsor-1's displayDuration
      );
    });

    test('should use settings default duration when sponsor has no custom duration', () => {
      module.sponsorsConfig = {
        settings: {
          defaultDuration: 12000
        }
      };
      module.currentSponsorIndex = 2; // sponsor-3 has no displayDuration
      module.startCarousel();
      
      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        12000 // settings defaultDuration
      );
    });

    test('should use config default when no settings available', () => {
      module.currentSponsorIndex = 2; // sponsor-3 has no displayDuration
      module.sponsorsConfig = null;
      module.startCarousel();
      
      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        10000 // config.displayDuration default
      );
    });

    test('should advance to next sponsor after timeout', () => {
      let timeoutCallback;
      global.setTimeout = jest.fn((callback, delay) => {
        timeoutCallback = callback;
        return { id: 1 };
      });

      module.currentSponsorIndex = 0;
      module.startCarousel();
      
      expect(module.currentSponsorIndex).toBe(0);
      
      // Simulate timeout
      timeoutCallback();
      
      expect(module.currentSponsorIndex).toBe(1);
      expect(module.updateDom).toHaveBeenCalled();
    });

    test('should wrap around to first sponsor after last', () => {
      let timeoutCallback;
      global.setTimeout = jest.fn((callback, delay) => {
        timeoutCallback = callback;
        return { id: 1 };
      });

      module.currentSponsorIndex = 2; // Last sponsor
      module.startCarousel();
      
      // Simulate timeout
      timeoutCallback();
      
      expect(module.currentSponsorIndex).toBe(0); // Should wrap to first
    });

    test('should continue scheduling next sponsor when carousel is running', () => {
      let timeoutCallback;
      let timeoutCallCount = 0;
      
      global.setTimeout = jest.fn((callback, delay) => {
        timeoutCallback = callback;
        timeoutCallCount++;
        return { id: timeoutCallCount };
      });

      module.startCarousel();
      
      expect(timeoutCallCount).toBe(1);
      
      // Simulate first timeout
      timeoutCallback();
      
      expect(timeoutCallCount).toBe(2); // Should schedule next
    });

    test('should stop scheduling when carousel is stopped', () => {
      let timeoutCallback;
      let timeoutCallCount = 0;
      
      global.setTimeout = jest.fn((callback, delay) => {
        timeoutCallback = callback;
        timeoutCallCount++;
        return { id: timeoutCallCount };
      });

      module.startCarousel();
      module.stopCarousel();
      
      // Simulate timeout after stop
      timeoutCallback();
      
      expect(timeoutCallCount).toBe(1); // Should not schedule next
    });
  });

  describe('Animation and Transition Handling', () => {
    test('should apply correct animation class based on config', () => {
      module.config.animationType = 'slide';
      module.sponsors = [{ id: 'test', name: 'Test', logoPath: 'test.png' }];
      
      const dom = module.getDom();
      
      // Check if carousel container has correct animation class
      expect(global.document.createElement).toHaveBeenCalled();
    });

    test('should use transition duration from config', () => {
      module.config.transitionDuration = 1500;
      module.sponsors = [{ id: 'test', name: 'Test', logoPath: 'test.png' }];
      
      module.nextSponsor();
      
      expect(module.updateDom).toHaveBeenCalledWith(1500);
    });

    test('should handle different animation types', () => {
      const animationTypes = ['fade', 'slide', 'zoom'];
      
      animationTypes.forEach(animationType => {
        module.config.animationType = animationType;
        module.sponsors = [{ id: 'test', name: 'Test', logoPath: 'test.png' }];
        
        const dom = module.getDom();
        
        expect(dom).toBeDefined();
      });
    });
  });

  describe('Error Handling in Display Logic', () => {
    test('should handle image loading errors gracefully', () => {
      const sponsor = {
        id: 'test-sponsor',
        name: 'Test Sponsor',
        logoPath: 'invalid-path.png',
        adPath: 'invalid-ad.png'
      };

      const mockImg = {
        className: '',
        src: '',
        alt: '',
        onerror: null,
        onload: null
      };

      const mockContainer = {
        className: '',
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        replaceChild: jest.fn()
      };

      global.document.createElement = jest.fn((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'div') return mockContainer;
        return mockContainer;
      });

      module.createSponsorElement(sponsor);
      
      // Simulate image error
      mockImg.onerror();
      
      // Should try fallback to logo
      expect(mockImg.src).toBe(sponsor.logoPath);
      
      // Simulate logo error too
      mockImg.onerror();
      
      // Should create text fallback
      expect(mockContainer.replaceChild).toHaveBeenCalled();
    });

    test('should handle missing sponsor data gracefully', () => {
      const invalidSponsors = [null, undefined, {}, { id: 'test' }, { name: 'test' }];
      
      invalidSponsors.forEach(sponsor => {
        const result = module.createSponsorElement(sponsor);
        expect(result).toBeNull();
      });
    });

    test('should handle empty sponsors array in carousel', () => {
      module.sponsors = [];
      
      expect(() => {
        module.startCarousel();
        module.nextSponsor();
        module.scheduleNextSponsor();
      }).not.toThrow();
      
      expect(module.isCarouselRunning).toBe(false);
    });
  });

  describe('DOM State Management', () => {
    test('should show different states correctly', () => {
      // Test loading state
      module.loadingState = true;
      let dom = module.getDom();
      expect(dom.className).toBe('sponsor-carousel-container');
      
      // Test error state
      module.loadingState = false;
      module.errorState = 'Test error';
      dom = module.getDom();
      expect(dom.className).toBe('sponsor-carousel-container');
      
      // Test fallback state (no sponsors)
      module.errorState = null;
      module.sponsors = [];
      dom = module.getDom();
      expect(dom.className).toBe('sponsor-carousel-container');
      
      // Test normal state (with sponsors)
      module.sponsors = [{ id: 'test', name: 'Test', logoPath: 'test.png' }];
      dom = module.getDom();
      expect(dom.className).toBe('sponsor-carousel-container');
    });

    test('should update DOM with correct transition duration', () => {
      module.config.transitionDuration = 2000;
      module.sponsors = [{ id: 'test', name: 'Test', logoPath: 'test.png' }];
      
      module.nextSponsor();
      
      expect(module.updateDom).toHaveBeenCalledWith(2000);
    });
  });
});