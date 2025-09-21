/**
 * Unit tests for MMM-SahkokiltaBranding module
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock MagicMirror Module system
global.Module = {
  register: jest.fn(),
  definitions: {}
};

global.Log = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock DOM methods
global.document = {
  createElement: jest.fn(() => ({
    className: '',
    innerHTML: '',
    style: {},
    appendChild: jest.fn(),
    replaceChild: jest.fn(),
    addEventListener: jest.fn()
  })),
  documentElement: {
    style: {
      setProperty: jest.fn()
    }
  },
  body: {
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    }
  }
};

describe('MMM-SahkokiltaBranding Module', () => {
  let moduleInstance;
  let mockConfig;

  beforeEach(() => {
    // Reset mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Mock module configuration
    mockConfig = {
      configPath: "config/branding.json",
      logoPath: "assets/images/sahkokilta-logo.png",
      fallbackLogoPath: "assets/images/sahkokilta-logo-fallback.png",
      brandColors: {
        primary: "#FF6B35",
        secondary: "#004E89",
        accent: "#FFD23F",
        background: "#FFFFFF",
        text: "#333333"
      },
      logoPosition: "top-left",
      logoSize: {
        width: 200,
        height: 100
      },
      logoAlt: "Sähkökilta ry Logo",
      fonts: {
        primary: "Arial, sans-serif",
        secondary: "Georgia, serif"
      },
      layout: {
        logoRegion: ".logo-region",
        backgroundStyle: "solid"
      },
      updateInterval: 30000,
      retryDelay: 5000,
      enableHotReload: true
    };

    // Load the module
    require('../../modules/MMM-SahkokiltaBranding/MMM-SahkokiltaBranding.js');
    
    // Get the registered module definition
    const moduleDefinition = Module.register.mock.calls[0][1];
    
    // Create module instance
    moduleInstance = Object.create(moduleDefinition);
    moduleInstance.name = "MMM-SahkokiltaBranding";
    moduleInstance.identifier = "module_1_MMM-SahkokiltaBranding";
    moduleInstance.config = { ...moduleDefinition.defaults, ...mockConfig };
    moduleInstance.sendSocketNotification = jest.fn();
    moduleInstance.updateDom = jest.fn();
  });

  afterEach(() => {
    // Stop any scheduled updates to prevent hanging timers
    if (moduleInstance && moduleInstance.stopScheduledUpdates) {
      moduleInstance.stopScheduledUpdates();
    }
    
    // Clear all timers to prevent async operations from hanging
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetModules();
  });

  describe('Module Registration', () => {
    test('should register module with correct name', () => {
      expect(Module.register).toHaveBeenCalledWith(
        "MMM-SahkokiltaBranding",
        expect.any(Object)
      );
    });

    test('should have default configuration', () => {
      const moduleDefinition = Module.register.mock.calls[0][1];
      expect(moduleDefinition.defaults).toBeDefined();
      expect(moduleDefinition.defaults.logoPosition).toBe("top-left");
      expect(moduleDefinition.defaults.brandColors.primary).toBe("#FF6B35");
    });
  });

  describe('Module Initialization', () => {
    test('should initialize with correct default values', () => {
      // Disable hot reload for this test to check initial null state
      moduleInstance.config.enableHotReload = false;
      moduleInstance.start();
      
      expect(moduleInstance.brandingConfig).toBeNull();
      expect(moduleInstance.logoLoaded).toBe(false);
      expect(moduleInstance.themeApplied).toBe(false);
      expect(moduleInstance.retryCount).toBe(0);
      expect(moduleInstance.maxRetries).toBe(3);
      expect(moduleInstance.updateTimer).toBeNull();
    });

    test('should load branding configuration on start', () => {
      moduleInstance.start();
      
      expect(moduleInstance.sendSocketNotification).toHaveBeenCalledWith(
        "LOAD_BRANDING_CONFIG",
        {
          configPath: mockConfig.configPath,
          identifier: moduleInstance.identifier
        }
      );
      
      // Clean up
      moduleInstance.stopScheduledUpdates();
    });

    test('should schedule updates when hot reload is enabled', () => {
      jest.useFakeTimers();
      moduleInstance.config.enableHotReload = true;
      
      moduleInstance.start();
      
      // Verify timer was set
      expect(moduleInstance.updateTimer).not.toBeNull();
      
      // Fast-forward time
      jest.advanceTimersByTime(mockConfig.updateInterval);
      
      // Should have called loadBrandingConfig again
      expect(moduleInstance.sendSocketNotification).toHaveBeenCalledTimes(2);
      
      // Clean up timers before test ends
      moduleInstance.stopScheduledUpdates();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('should stop scheduled updates when requested', () => {
      jest.useFakeTimers();
      moduleInstance.config.enableHotReload = true;
      
      moduleInstance.start();
      expect(moduleInstance.updateTimer).not.toBeNull();
      
      moduleInstance.stopScheduledUpdates();
      expect(moduleInstance.updateTimer).toBeNull();
      
      jest.useRealTimers();
    });
  });

  describe('DOM Generation', () => {
    test('should return loading state when no config is loaded', () => {
      const dom = moduleInstance.getDom();
      
      expect(dom.className).toBe("branding-container");
      expect(document.createElement).toHaveBeenCalledWith("div");
    });

    test('should create logo element when config is available', () => {
      const mockBrandingConfig = {
        logo: {
          path: "test-logo.png",
          position: "top-center",
          size: { width: 150, height: 75 },
          alt: "Test Logo"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      const dom = moduleInstance.getDom();
      
      expect(dom.className).toBe("branding-container");
    });

    test('should not show header', () => {
      const header = moduleInstance.getHeader();
      expect(header).toBe(false);
    });
  });

  describe('Logo Element Creation', () => {
    test('should return null when no branding config', () => {
      moduleInstance.brandingConfig = null;
      const logoElement = moduleInstance.createLogoElement();
      
      expect(logoElement).toBeNull();
    });

    test('should create logo element with correct attributes', () => {
      const mockBrandingConfig = {
        logo: {
          path: "test-logo.png",
          position: "top-center",
          size: { width: 150, height: 75 },
          alt: "Test Logo"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      
      // Mock createElement to return objects with properties
      const mockImg = {
        className: '',
        src: '',
        alt: '',
        style: {},
        onerror: null,
        onload: null
      };
      
      const mockContainer = {
        className: '',
        appendChild: jest.fn()
      };
      
      document.createElement.mockImplementation((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'div') return mockContainer;
        return { className: '', appendChild: jest.fn() };
      });
      
      const logoElement = moduleInstance.createLogoElement();
      
      expect(logoElement).toBe(mockContainer);
      expect(mockContainer.className).toBe("logo-container logo-top-center");
      expect(mockImg.src).toBe("test-logo.png");
      expect(mockImg.alt).toBe("Test Logo");
    });
  });

  describe('Logo Validation', () => {
    test('should return false for empty logo path', () => {
      const result = moduleInstance.validateLogo("");
      expect(result).toBe(false);
    });

    test('should return false for null logo path', () => {
      const result = moduleInstance.validateLogo(null);
      expect(result).toBe(false);
    });

    test('should send validation request for valid path', () => {
      const logoPath = "test-logo.png";
      const result = moduleInstance.validateLogo(logoPath);
      
      expect(result).toBe(true);
      expect(moduleInstance.sendSocketNotification).toHaveBeenCalledWith(
        "VALIDATE_LOGO",
        {
          logoPath: logoPath,
          identifier: moduleInstance.identifier
        }
      );
    });
  });

  describe('Theme Application', () => {
    test('should return false when no theme config', () => {
      moduleInstance.brandingConfig = null;
      const result = moduleInstance.applyTheme();
      
      expect(result).toBe(false);
      expect(Log.warn).toHaveBeenCalledWith("No theme configuration available");
    });

    test('should apply theme colors and fonts', () => {
      const mockBrandingConfig = {
        theme: {
          colors: {
            primary: "#FF6B35",
            secondary: "#004E89",
            background: "#FFFFFF",
            text: "#333333"
          },
          fonts: {
            primary: "Arial, sans-serif",
            secondary: "Georgia, serif"
          }
        },
        layout: {
          backgroundStyle: "solid"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      const result = moduleInstance.applyTheme();
      
      expect(result).toBe(true);
      expect(moduleInstance.themeApplied).toBe(true);
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--brand-primary', '#FF6B35'
      );
      expect(document.body.classList.add).toHaveBeenCalledWith('bg-style-solid');
    });

    test('should handle theme application errors', () => {
      moduleInstance.brandingConfig = { 
        theme: {
          colors: {
            primary: "#FF6B35",
            secondary: "#004E89",
            background: "#FFFFFF",
            text: "#333333"
          },
          fonts: {
            primary: "Arial, sans-serif"
          }
        },
        layout: {
          backgroundStyle: "solid"
        }
      };
      
      // Mock setProperty to throw error on first call
      let callCount = 0;
      document.documentElement.style.setProperty.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("CSS error");
        }
      });
      
      const result = moduleInstance.applyTheme();
      
      expect(result).toBe(false);
      expect(Log.error).toHaveBeenCalledWith("Failed to apply theme: CSS error");
    });
  });

  describe('Configuration Updates', () => {
    test('should update branding configuration successfully', () => {
      const newConfig = {
        logo: { path: "new-logo.png" },
        theme: { colors: { primary: "#000000" } }
      };
      
      const result = moduleInstance.updateBranding(newConfig);
      
      expect(result).toBe(true);
      expect(moduleInstance.brandingConfig).toBe(newConfig);
      expect(moduleInstance.retryCount).toBe(0);
      expect(moduleInstance.updateDom).toHaveBeenCalledWith(1000);
    });

    test('should handle null configuration', () => {
      const result = moduleInstance.updateBranding(null);
      
      expect(result).toBe(false);
      expect(Log.warn).toHaveBeenCalledWith("No branding configuration provided for update");
    });
  });

  describe('Error Handling', () => {
    test('should retry on configuration error', () => {
      jest.useFakeTimers();
      moduleInstance.retryCount = 0;
      moduleInstance.maxRetries = 3;
      
      moduleInstance.handleConfigError("Test error");
      
      expect(moduleInstance.retryCount).toBe(1);
      
      // Fast-forward time
      jest.advanceTimersByTime(mockConfig.retryDelay);
      
      expect(moduleInstance.sendSocketNotification).toHaveBeenCalledWith(
        "LOAD_BRANDING_CONFIG",
        expect.any(Object)
      );
      
      // Clear timers before test ends
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    test('should use fallback config after max retries', () => {
      moduleInstance.retryCount = 3;
      moduleInstance.maxRetries = 3;
      
      moduleInstance.handleConfigError("Test error");
      
      expect(Log.error).toHaveBeenCalledWith("Max retries reached, using fallback configuration");
      expect(moduleInstance.brandingConfig).toBeDefined();
    });
  });

  describe('Socket Notifications', () => {
    test('should handle BRANDING_CONFIG_LOADED notification', () => {
      const payload = {
        identifier: moduleInstance.identifier,
        config: { logo: { path: "test.png" } }
      };
      
      moduleInstance.socketNotificationReceived("BRANDING_CONFIG_LOADED", payload);
      
      expect(moduleInstance.brandingConfig).toBe(payload.config);
    });

    test('should handle BRANDING_CONFIG_ERROR notification', () => {
      const payload = {
        identifier: moduleInstance.identifier,
        error: "Test error"
      };
      
      moduleInstance.socketNotificationReceived("BRANDING_CONFIG_ERROR", payload);
      
      expect(Log.error).toHaveBeenCalledWith("Failed to load branding configuration: Test error");
    });

    test('should ignore notifications for other instances', () => {
      const payload = {
        identifier: "different_identifier",
        config: { logo: { path: "test.png" } }
      };
      
      // Set initial state to null (as set in start method)
      moduleInstance.brandingConfig = null;
      
      moduleInstance.socketNotificationReceived("BRANDING_CONFIG_LOADED", payload);
      
      // Should remain null since the notification was ignored
      expect(moduleInstance.brandingConfig).toBeNull();
    });
  });

  describe('Theme System Integration', () => {
    test('should apply complete brand color scheme', () => {
      const mockBrandingConfig = {
        theme: {
          colors: {
            primary: "#FF6B35",
            secondary: "#004E89", 
            accent: "#FFD23F",
            background: "#FFFFFF",
            text: "#333333"
          },
          fonts: {
            primary: "Arial, sans-serif",
            secondary: "Georgia, serif"
          }
        },
        layout: {
          backgroundStyle: "gradient"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      const result = moduleInstance.applyTheme();
      
      expect(result).toBe(true);
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-primary', '#FF6B35');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-secondary', '#004E89');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-accent', '#FFD23F');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-background', '#FFFFFF');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-text', '#333333');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-font-primary', 'Arial, sans-serif');
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-font-secondary', 'Georgia, serif');
      expect(document.body.classList.add).toHaveBeenCalledWith('bg-style-gradient');
    });

    test('should handle missing accent color by using primary', () => {
      const mockBrandingConfig = {
        theme: {
          colors: {
            primary: "#FF6B35",
            secondary: "#004E89",
            background: "#FFFFFF",
            text: "#333333"
          },
          fonts: {
            primary: "Arial, sans-serif"
          }
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      moduleInstance.applyTheme();
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-accent', '#FF6B35');
    });

    test('should handle missing secondary font by using primary', () => {
      const mockBrandingConfig = {
        theme: {
          colors: {
            primary: "#FF6B35",
            secondary: "#004E89",
            background: "#FFFFFF",
            text: "#333333"
          },
          fonts: {
            primary: "Arial, sans-serif"
          }
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      moduleInstance.applyTheme();
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--brand-font-secondary', 'Arial, sans-serif');
    });

    test('should apply different background styles', () => {
      const testCases = ['solid', 'gradient', 'pattern'];
      
      testCases.forEach(style => {
        jest.clearAllMocks();
        
        const mockBrandingConfig = {
          theme: {
            colors: { primary: "#FF6B35", secondary: "#004E89", background: "#FFFFFF", text: "#333333" },
            fonts: { primary: "Arial, sans-serif" }
          },
          layout: { backgroundStyle: style }
        };
        
        moduleInstance.brandingConfig = mockBrandingConfig;
        moduleInstance.applyTheme();
        
        expect(document.body.classList.add).toHaveBeenCalledWith(`bg-style-${style}`);
      });
    });
  });

  describe('Logo Fallback System', () => {
    test('should handle logo loading error with fallback', () => {
      const mockBrandingConfig = {
        logo: {
          path: "primary-logo.png",
          fallbackPath: "fallback-logo.png",
          position: "top-center",
          size: { width: 150, height: 75 },
          alt: "Test Logo"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      
      // Mock createElement to return objects with properties
      const mockImg = {
        className: '',
        src: '',
        alt: '',
        style: {},
        onerror: null,
        onload: null
      };
      
      const mockContainer = {
        className: '',
        appendChild: jest.fn(),
        replaceChild: jest.fn()
      };
      
      document.createElement.mockImplementation((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'div') return mockContainer;
        return { className: '', appendChild: jest.fn() };
      });
      
      const logoElement = moduleInstance.createLogoElement();
      
      // Simulate logo loading error
      mockImg.onerror();
      
      expect(mockImg.src).toBe("fallback-logo.png");
      expect(Log.warn).toHaveBeenCalledWith("Failed to load logo, trying fallback: fallback-logo.png");
    });

    test('should create text fallback when all logo sources fail', () => {
      const mockBrandingConfig = {
        logo: {
          path: "primary-logo.png",
          fallbackPath: "fallback-logo.png",
          position: "top-center",
          size: { width: 150, height: 75 },
          alt: "Test Logo"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      
      const mockImg = {
        className: '',
        src: '',
        alt: '',
        style: {},
        onerror: null,
        onload: null
      };
      
      const mockTextFallback = {
        className: '',
        innerHTML: ''
      };
      
      const mockContainer = {
        className: '',
        appendChild: jest.fn(),
        replaceChild: jest.fn()
      };
      
      let createElementCallCount = 0;
      document.createElement.mockImplementation((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'div') {
          createElementCallCount++;
          if (createElementCallCount === 1) return mockContainer;
          if (createElementCallCount === 2) return mockTextFallback;
        }
        return { className: '', appendChild: jest.fn() };
      });
      
      const logoElement = moduleInstance.createLogoElement();
      
      // First set the src to fallback to simulate it's already tried the fallback
      mockImg.src = "fallback-logo.png";
      
      // Simulate fallback logo also failing
      mockImg.onerror();
      
      expect(mockContainer.replaceChild).toHaveBeenCalledWith(mockTextFallback, mockImg);
      expect(mockTextFallback.className).toBe("logo-fallback");
      expect(mockTextFallback.innerHTML).toBe("Sähkökilta ry");
      expect(Log.error).toHaveBeenCalledWith("All logo sources failed, using text fallback");
    });

    test('should log success when logo loads correctly', () => {
      const mockBrandingConfig = {
        logo: {
          path: "working-logo.png",
          position: "top-left",
          size: { width: 200, height: 100 },
          alt: "Working Logo"
        }
      };
      
      moduleInstance.brandingConfig = mockBrandingConfig;
      
      const mockImg = {
        className: '',
        src: '',
        alt: '',
        style: {},
        onerror: null,
        onload: null
      };
      
      const mockContainer = {
        className: '',
        appendChild: jest.fn()
      };
      
      document.createElement.mockImplementation((tag) => {
        if (tag === 'img') return mockImg;
        if (tag === 'div') return mockContainer;
        return { className: '', appendChild: jest.fn() };
      });
      
      const logoElement = moduleInstance.createLogoElement();
      
      // Simulate successful logo loading
      mockImg.onload();
      
      expect(moduleInstance.logoLoaded).toBe(true);
      expect(Log.info).toHaveBeenCalledWith("Logo loaded successfully");
    });
  });

  describe('Logo Positioning System', () => {
    test('should apply correct CSS classes for different logo positions', () => {
      const positions = ['top-left', 'top-center', 'top-right'];
      
      positions.forEach(position => {
        const mockBrandingConfig = {
          logo: {
            path: "test-logo.png",
            position: position,
            size: { width: 150, height: 75 },
            alt: "Test Logo"
          }
        };
        
        moduleInstance.brandingConfig = mockBrandingConfig;
        
        const mockContainer = {
          className: '',
          appendChild: jest.fn()
        };
        
        document.createElement.mockImplementation((tag) => {
          if (tag === 'img') return { className: '', src: '', alt: '', style: {}, onerror: null, onload: null };
          if (tag === 'div') return mockContainer;
          return { className: '', appendChild: jest.fn() };
        });
        
        const logoElement = moduleInstance.createLogoElement();
        
        expect(mockContainer.className).toBe(`logo-container logo-${position}`);
      });
    });
  });
});