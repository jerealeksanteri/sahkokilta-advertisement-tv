/**
 * Unit tests for MMM-LayoutManager
 * Tests display detection and layout calculation functionality
 */

// Mock MagicMirror environment
global.Module = {
    register: jest.fn((name, moduleDefinition) => {
        // Store the module definition for testing
        global.TestModule = moduleDefinition;
        return moduleDefinition;
    })
};

global.Log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock window and screen objects
const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    screen: {
        width: 1920,
        height: 1080
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
};

const mockDocument = {
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
    },
    addEventListener: jest.fn(),
    querySelectorAll: jest.fn(() => [])
};

global.window = mockWindow;
global.document = mockDocument;

// Load the module
require('../../modules/MMM-LayoutManager/MMM-LayoutManager.js');

describe('MMM-LayoutManager', () => {
    let module;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create fresh module instance
        module = Object.create(global.TestModule);
        module.name = "MMM-LayoutManager";
        module.config = { ...global.TestModule.defaults };
        module.sendNotification = jest.fn();
        
        // Reset display info
        module.displayInfo = {
            width: 0,
            height: 0,
            orientation: "landscape",
            pixelRatio: 1,
            type: "unknown",
            aspectRatio: 16/9
        };
        
        module.layoutState = {
            currentBreakpoint: "large",
            isTV: false,
            scaleFactor: 1.0,
            regions: {}
        };
    });

    describe('Display Detection', () => {
        test('should detect basic display properties', () => {
            // Set up mock window dimensions
            global.window.innerWidth = 1920;
            global.window.innerHeight = 1080;
            global.window.screen.width = 1920;
            global.window.screen.height = 1080;
            global.window.devicePixelRatio = 1;

            const displayInfo = module.detectDisplay();

            expect(displayInfo.width).toBe(1920);
            expect(displayInfo.height).toBe(1080);
            expect(displayInfo.pixelRatio).toBe(1);
            expect(displayInfo.orientation).toBe("landscape");
            expect(displayInfo.aspectRatio).toBeCloseTo(1.777, 2);
        });

        test('should detect portrait orientation', () => {
            global.window.innerWidth = 768;
            global.window.innerHeight = 1024;
            global.window.screen.width = 768;
            global.window.screen.height = 1024;

            const displayInfo = module.detectDisplay();

            expect(displayInfo.orientation).toBe("portrait");
            expect(displayInfo.aspectRatio).toBeCloseTo(0.75, 2);
        });

        test('should handle high DPI displays', () => {
            global.window.devicePixelRatio = 2;

            const displayInfo = module.detectDisplay();

            expect(displayInfo.pixelRatio).toBe(2);
        });

        test('should fallback to viewport dimensions when screen unavailable', () => {
            global.window.screen = {};
            global.window.innerWidth = 1366;
            global.window.innerHeight = 768;

            const displayInfo = module.detectDisplay();

            expect(displayInfo.width).toBe(1366);
            expect(displayInfo.height).toBe(768);
        });
    });

    describe('Display Type Detection', () => {
        test('should detect TV display for 1080p resolution', () => {
            global.window.innerWidth = 1920;
            global.window.innerHeight = 1080;
            global.window.screen.width = 1920;
            global.window.screen.height = 1080;

            module.detectDisplay();

            expect(module.displayInfo.type).toBe("tv");
            expect(module.layoutState.isTV).toBe(true);
        });

        test('should detect TV display for 4K resolution', () => {
            global.window.innerWidth = 3840;
            global.window.innerHeight = 2160;
            global.window.screen.width = 3840;
            global.window.screen.height = 2160;

            module.detectDisplay();

            expect(module.displayInfo.type).toBe("tv");
        });

        test('should detect monitor display for non-standard resolution', () => {
            global.window.innerWidth = 1440;
            global.window.innerHeight = 900;
            global.window.screen.width = 1440;
            global.window.screen.height = 900;

            module.detectDisplay();

            expect(module.displayInfo.type).toBe("monitor");
            expect(module.layoutState.isTV).toBe(false);
        });

        test('should respect forced TV mode configuration', () => {
            module.config.displayMode = "tv";
            global.window.innerWidth = 1024;
            global.window.innerHeight = 768;

            module.detectDisplay();

            expect(module.displayInfo.type).toBe("tv");
        });

        test('should respect forced monitor mode configuration', () => {
            module.config.displayMode = "monitor";
            global.window.innerWidth = 1920;
            global.window.innerHeight = 1080;

            module.detectDisplay();

            expect(module.displayInfo.type).toBe("monitor");
        });
    });

    describe('Breakpoint Calculation', () => {
        test('should calculate xlarge breakpoint', () => {
            module.displayInfo.width = 2560;
            const breakpoint = module.calculateBreakpoint();
            expect(breakpoint).toBe("xlarge");
        });

        test('should calculate large breakpoint', () => {
            module.displayInfo.width = 1920;
            module.config.breakpoints = {
                small: 768,
                medium: 1024,
                large: 1920,
                xlarge: 2560
            };
            const breakpoint = module.calculateBreakpoint();
            expect(breakpoint).toBe("large");
        });

        test('should calculate medium breakpoint', () => {
            module.displayInfo.width = 1024;
            const breakpoint = module.calculateBreakpoint();
            expect(breakpoint).toBe("medium");
        });

        test('should calculate small breakpoint', () => {
            module.displayInfo.width = 768;
            const breakpoint = module.calculateBreakpoint();
            expect(breakpoint).toBe("small");
        });

        test('should calculate xsmall breakpoint', () => {
            module.displayInfo.width = 480;
            const breakpoint = module.calculateBreakpoint();
            expect(breakpoint).toBe("xsmall");
        });
    });

    describe('Scale Factor Calculation', () => {
        test('should calculate base scale factor', () => {
            module.config.scaleFactor = 1.0;
            module.layoutState.isTV = false;
            module.displayInfo.pixelRatio = 1;

            const scaleFactor = module.calculateScaleFactor();

            expect(scaleFactor).toBe(1.0);
        });

        test('should apply TV scaling multiplier', () => {
            module.config.scaleFactor = 1.0;
            module.config.tvOptimization.enabled = true;
            module.config.tvOptimization.scaleMultiplier = 1.2;
            module.config.tvOptimization.overscanCompensation = 0.95;
            module.layoutState.isTV = true;
            module.displayInfo.pixelRatio = 1;

            const scaleFactor = module.calculateScaleFactor();

            expect(scaleFactor).toBeCloseTo(1.14, 2); // 1.0 * 1.2 * 0.95
        });

        test('should apply high DPI scaling', () => {
            module.config.scaleFactor = 1.0;
            module.layoutState.isTV = false;
            module.displayInfo.pixelRatio = 2;

            const scaleFactor = module.calculateScaleFactor();

            expect(scaleFactor).toBe(2.0);
        });

        test('should limit scale factor to reasonable bounds', () => {
            module.config.scaleFactor = 5.0; // Unreasonably high
            module.layoutState.isTV = false;
            module.displayInfo.pixelRatio = 1;

            const scaleFactor = module.calculateScaleFactor();

            expect(scaleFactor).toBe(3.0); // Capped at maximum
        });

        test('should enforce minimum scale factor', () => {
            module.config.scaleFactor = 0.1; // Unreasonably low
            module.layoutState.isTV = false;
            module.displayInfo.pixelRatio = 1;

            const scaleFactor = module.calculateScaleFactor();

            expect(scaleFactor).toBe(0.5); // Raised to minimum
        });
    });

    describe('CSS Variables Application', () => {
        test('should apply display information CSS variables', () => {
            module.displayInfo = {
                width: 1920,
                height: 1080,
                aspectRatio: 1.777,
                pixelRatio: 1
            };
            module.layoutState = {
                scaleFactor: 1.2,
                currentBreakpoint: "large",
                isTV: true
            };

            module.applyCSSVariables();

            const setProperty = document.documentElement.style.setProperty;
            expect(setProperty).toHaveBeenCalledWith("--display-width", "1920px");
            expect(setProperty).toHaveBeenCalledWith("--display-height", "1080px");
            expect(setProperty).toHaveBeenCalledWith("--display-aspect-ratio", 1.777);
            expect(setProperty).toHaveBeenCalledWith("--scale-factor", 1.2);
            expect(setProperty).toHaveBeenCalledWith("--current-breakpoint", "large");
            expect(setProperty).toHaveBeenCalledWith("--is-tv", "1");
        });

        test('should calculate appropriate font sizes for TV', () => {
            module.layoutState = {
                isTV: true,
                scaleFactor: 1.2
            };
            module.config.tvOptimization.minFontSize = 16;

            module.applyCSSVariables();

            const setProperty = document.documentElement.style.setProperty;
            const baseFontCall = setProperty.mock.calls.find(call => call[0] === "--base-font-size");
            expect(baseFontCall[1]).toBe("19.2px"); // 16 * 1.2
        });

        test('should calculate appropriate font sizes for monitor', () => {
            module.layoutState = {
                isTV: false,
                scaleFactor: 1.0
            };

            module.applyCSSVariables();

            const setProperty = document.documentElement.style.setProperty;
            const baseFontCall = setProperty.mock.calls.find(call => call[0] === "--base-font-size");
            expect(baseFontCall[1]).toBe("16px"); // 16 * 1.0
        });
    });

    describe('TV Optimizations', () => {
        test('should apply TV-specific CSS classes and properties', () => {
            module.config.tvOptimization.enabled = true;
            module.config.tvOptimization.overscanCompensation = 0.95;

            module.applyTVOptimizations();

            expect(document.body.classList.add).toHaveBeenCalledWith("tv-display");
            expect(document.body.classList.remove).toHaveBeenCalledWith("monitor-display");

            const setProperty = document.documentElement.style.setProperty;
            expect(setProperty).toHaveBeenCalledWith("--tv-line-height", "1.6");
            expect(setProperty).toHaveBeenCalledWith("--tv-letter-spacing", "0.02em");
            expect(setProperty).toHaveBeenCalledWith("--overscan-compensation", 0.95);
        });

        test('should skip TV optimizations when disabled', () => {
            module.config.tvOptimization.enabled = false;

            module.applyTVOptimizations();

            expect(document.body.classList.add).not.toHaveBeenCalled();
        });
    });

    describe('Event Handling', () => {
        test('should set up event listeners on start', () => {
            module.setupEventListeners();

            expect(window.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
            expect(window.addEventListener).toHaveBeenCalledWith("orientationchange", expect.any(Function));
            expect(document.addEventListener).toHaveBeenCalledWith("fullscreenchange", expect.any(Function));
        });

        test('should handle display changes', () => {
            const previousInfo = { ...module.displayInfo };
            
            // Simulate significant change
            global.window.innerWidth = 1366;
            global.window.innerHeight = 768;
            
            module.handleDisplayChange();

            expect(module.sendNotification).toHaveBeenCalledWith("DISPLAY_CHANGED", expect.objectContaining({
                displayInfo: expect.any(Object),
                layoutState: expect.any(Object),
                previousInfo: previousInfo
            }));
        });

        test('should handle orientation changes', () => {
            module.handleOrientationChange();

            expect(module.sendNotification).toHaveBeenCalledWith("ORIENTATION_CHANGED", expect.objectContaining({
                orientation: expect.any(String),
                displayInfo: expect.any(Object)
            }));
        });
    });

    describe('Notification Handling', () => {
        test('should respond to GET_DISPLAY_INFO notification', () => {
            const mockSender = { name: "TestModule" };
            
            module.notificationReceived("GET_DISPLAY_INFO", null, mockSender);

            expect(module.sendNotification).toHaveBeenCalledWith(
                "DISPLAY_INFO_RESPONSE", 
                expect.objectContaining({
                    displayInfo: expect.any(Object),
                    layoutState: expect.any(Object)
                }),
                "TestModule"
            );
        });

        test('should handle UPDATE_SCALE_FACTOR notification', () => {
            const payload = { scaleFactor: 1.5 };
            
            module.notificationReceived("UPDATE_SCALE_FACTOR", payload);

            expect(module.layoutState.scaleFactor).toBe(1.5);
        });
    });

    describe('Utility Functions', () => {
        test('should debounce function calls', (done) => {
            const mockFn = jest.fn();
            const debouncedFn = module.debounce(mockFn, 100);

            // Call multiple times rapidly
            debouncedFn();
            debouncedFn();
            debouncedFn();

            // Should not be called immediately
            expect(mockFn).not.toHaveBeenCalled();

            // Should be called once after delay
            setTimeout(() => {
                expect(mockFn).toHaveBeenCalledTimes(1);
                done();
            }, 150);
        });

        test('should get current display info', () => {
            const info = module.getDisplayInfo();

            expect(info).toHaveProperty('displayInfo');
            expect(info).toHaveProperty('layoutState');
            expect(info.displayInfo).toBe(module.displayInfo);
            expect(info.layoutState).toBe(module.layoutState);
        });

        test('should adjust scaling within bounds', () => {
            module.adjustScaling(2.5);
            expect(module.layoutState.scaleFactor).toBe(2.5);

            module.adjustScaling(5.0); // Above maximum
            expect(module.layoutState.scaleFactor).toBe(3.0);

            module.adjustScaling(0.1); // Below minimum
            expect(module.layoutState.scaleFactor).toBe(0.5);
        });
    });

    describe('Module Lifecycle', () => {
        test('should initialize properly on start', () => {
            module.start();

            expect(Log.info).toHaveBeenCalledWith("Starting module: MMM-LayoutManager");
            expect(module.sendNotification).toHaveBeenCalledWith("LAYOUT_MANAGER_READY", expect.objectContaining({
                displayInfo: expect.any(Object),
                layoutState: expect.any(Object)
            }));
        });
    });
});