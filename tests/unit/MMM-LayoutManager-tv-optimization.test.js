/**
 * Unit tests for MMM-LayoutManager TV Optimization Features
 * Tests TV-specific scaling, font adjustments, layout regions, and orientation handling
 */

// Mock MagicMirror environment
global.Module = {
    register: jest.fn((name, moduleDefinition) => {
        global.TestModule = moduleDefinition;
        return moduleDefinition;
    })
};

global.Log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Mock DOM environment
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

const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    screen: {
        width: 1920,
        height: 1080
    },
    addEventListener: jest.fn()
};

global.document = mockDocument;
global.window = mockWindow;

// Load the module
require('../../modules/MMM-LayoutManager/MMM-LayoutManager.js');

describe('MMM-LayoutManager TV Optimization', () => {
    let module;

    beforeEach(() => {
        jest.clearAllMocks();
        
        module = Object.create(global.TestModule);
        module.name = "MMM-LayoutManager";
        module.config = { ...global.TestModule.defaults };
        module.sendNotification = jest.fn();
        
        // Set up TV display state
        module.displayInfo = {
            width: 1920,
            height: 1080,
            orientation: "landscape",
            pixelRatio: 1,
            type: "tv",
            aspectRatio: 16/9
        };
        
        module.layoutState = {
            currentBreakpoint: "large",
            isTV: true,
            scaleFactor: 1.2,
            regions: {},
            tvRegions: {}
        };
    });

    describe('TV Font Scaling', () => {
        test('should apply TV-specific font scaling', () => {
            module.config.tvOptimization.minFontSize = 16;
            module.layoutState.scaleFactor = 1.2;

            module.applyTVFontScaling();

            const setProperty = document.documentElement.style.setProperty;
            
            // Check base font size (16 * 1.2 = 19.2)
            expect(setProperty).toHaveBeenCalledWith("--tv-base-font-size", "19.2px");
            
            // Check other font sizes
            expect(setProperty).toHaveBeenCalledWith("--tv-small-font-size", "16.8px"); // 19.2 * 0.875
            expect(setProperty).toHaveBeenCalledWith("--tv-large-font-size", "24px"); // 19.2 * 1.25
            expect(setProperty).toHaveBeenCalledWith("--tv-xlarge-font-size", "28.799999999999997px"); // 19.2 * 1.5
            expect(setProperty).toHaveBeenCalledWith("--tv-xxlarge-font-size", "38.4px"); // 19.2 * 2.0
        });

        test('should enforce minimum font size', () => {
            module.config.tvOptimization.minFontSize = 20;
            module.layoutState.scaleFactor = 0.8; // Would result in 12.8px base

            module.applyTVFontScaling();

            const setProperty = document.documentElement.style.setProperty;
            
            // Should use minimum font size instead of calculated
            expect(setProperty).toHaveBeenCalledWith("--tv-base-font-size", "20px");
            expect(setProperty).toHaveBeenCalledWith("--tv-small-font-size", "17.5px"); // min * 0.875
        });

        test('should apply TV-specific text styling', () => {
            module.applyTVFontScaling();

            const setProperty = document.documentElement.style.setProperty;
            
            expect(setProperty).toHaveBeenCalledWith("--tv-font-weight", "500");
            expect(setProperty).toHaveBeenCalledWith("--tv-text-shadow", "0 1px 2px rgba(0, 0, 0, 0.3)");
        });
    });

    describe('TV Layout Regions', () => {
        test('should setup TV-optimized layout regions', () => {
            module.displayInfo = { width: 1920, height: 1080 };
            module.config.tvOptimization.overscanCompensation = 0.95;

            module.setupTVLayoutRegions();

            const setProperty = document.documentElement.style.setProperty;
            
            // Check safe area calculations
            const expectedSafeWidth = 1920 * 0.95; // 1824
            const expectedSafeHeight = 1080 * 0.95; // 1026
            const expectedMarginX = (1920 - 1824) / 2; // 48
            const expectedMarginY = (1080 - 1026) / 2; // 27

            expect(setProperty).toHaveBeenCalledWith("--tv-safe-area-width", expectedSafeWidth + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-safe-area-height", expectedSafeHeight + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-safe-margin-x", expectedMarginX + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-safe-margin-y", expectedMarginY + "px");
        });

        test('should define region positioning', () => {
            module.displayInfo = { width: 1920, height: 1080 };
            module.config.tvOptimization.overscanCompensation = 0.95;

            module.setupTVLayoutRegions();

            const setProperty = document.documentElement.style.setProperty;
            
            // Check that region properties are being set (exact values may vary due to calculations)
            const calls = setProperty.mock.calls.map(call => call[0]);
            
            expect(calls).toContain("--tv-region-branding-top");
            expect(calls).toContain("--tv-region-branding-left");
            expect(calls).toContain("--tv-region-branding-width");
            expect(calls).toContain("--tv-region-branding-height");
            
            expect(calls).toContain("--tv-region-carousel-top");
            expect(calls).toContain("--tv-region-carousel-left");
            expect(calls).toContain("--tv-region-carousel-width");
            expect(calls).toContain("--tv-region-carousel-height");
            
            expect(calls).toContain("--tv-region-content-top");
            expect(calls).toContain("--tv-region-content-left");
            expect(calls).toContain("--tv-region-content-width");
            expect(calls).toContain("--tv-region-content-height");
        });

        test('should store regions in layout state', () => {
            module.setupTVLayoutRegions();

            expect(module.layoutState.tvRegions).toBeDefined();
            expect(module.layoutState.tvRegions.branding).toBeDefined();
            expect(module.layoutState.tvRegions.carousel).toBeDefined();
            expect(module.layoutState.tvRegions.content).toBeDefined();
        });
    });

    describe('TV Spacing', () => {
        test('should apply TV-specific spacing', () => {
            module.layoutState.scaleFactor = 1.2;

            module.applyTVSpacing();

            const setProperty = document.documentElement.style.setProperty;
            
            const baseSpacing = 16 * 1.2; // 19.2
            const smallSpacing = 8 * 1.2; // 9.6
            const largeSpacing = 32 * 1.2; // 38.4
            const xlargeSpacing = 48 * 1.2; // 57.6

            expect(setProperty).toHaveBeenCalledWith("--tv-spacing-xs", (smallSpacing / 2) + "px"); // 4.8px
            expect(setProperty).toHaveBeenCalledWith("--tv-spacing-sm", smallSpacing + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-spacing-md", baseSpacing + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-spacing-lg", largeSpacing + "px");
            expect(setProperty).toHaveBeenCalledWith("--tv-spacing-xl", xlargeSpacing + "px");
        });

        test('should set content padding and margins', () => {
            module.layoutState.scaleFactor = 1.0;

            module.applyTVSpacing();

            const setProperty = document.documentElement.style.setProperty;
            
            expect(setProperty).toHaveBeenCalledWith("--tv-content-padding", "32px");
            expect(setProperty).toHaveBeenCalledWith("--tv-module-margin", "16px");
            expect(setProperty).toHaveBeenCalledWith("--tv-border-width", "2px");
        });
    });

    describe('Orientation Handling', () => {
        test('should apply orientation-specific optimizations', () => {
            module.displayInfo.orientation = "portrait";

            module.applyOrientationOptimizations();

            expect(document.body.classList.remove).toHaveBeenCalledWith("orientation-landscape", "orientation-portrait");
            expect(document.body.classList.add).toHaveBeenCalledWith("orientation-portrait");
            
            const setProperty = document.documentElement.style.setProperty;
            expect(setProperty).toHaveBeenCalledWith("--current-orientation", "portrait");
        });

        test('should handle orientation change', () => {
            const previousOrientation = "landscape";
            module.displayInfo.orientation = previousOrientation;

            // Mock orientation change to portrait
            global.window.innerWidth = 1080;
            global.window.innerHeight = 1920;

            module.handleOrientationChange();

            expect(module.sendNotification).toHaveBeenCalledWith("ORIENTATION_CHANGED", expect.objectContaining({
                orientation: expect.any(String),
                previousOrientation: previousOrientation,
                displayInfo: expect.any(Object),
                layoutState: expect.any(Object)
            }));
        });

        test('should apply portrait-specific optimizations', () => {
            module.displayInfo = { width: 1080, height: 1920 };
            module.layoutState.scaleFactor = 1.2;
            module.config.tvOptimization.overscanCompensation = 0.95;

            module.applyPortraitOptimizations();

            const setProperty = document.documentElement.style.setProperty;
            
            expect(setProperty).toHaveBeenCalledWith("--portrait-scale-factor", 1.08); // 1.2 * 0.9
            expect(setProperty).toHaveBeenCalledWith("--portrait-content-width", "90%");
            expect(setProperty).toHaveBeenCalledWith("--portrait-font-scale", "0.95");
        });

        test('should apply landscape-specific optimizations', () => {
            module.layoutState.scaleFactor = 1.2;

            module.applyLandscapeOptimizations();

            const setProperty = document.documentElement.style.setProperty;
            
            expect(setProperty).toHaveBeenCalledWith("--landscape-scale-factor", 1.2);
            expect(setProperty).toHaveBeenCalledWith("--landscape-content-width", "100%");
            expect(setProperty).toHaveBeenCalledWith("--landscape-font-scale", "1.0");
        });
    });

    describe('Region Management', () => {
        test('should get region position for TV', () => {
            module.layoutState.tvRegions = {
                branding: {
                    top: "27px",
                    left: "48px",
                    width: "547.2px",
                    height: "153.9px"
                }
            };
            module.config.regions.branding = "top_left";

            const position = module.getRegionPosition("branding");

            expect(position).toEqual({
                top: "27px",
                left: "48px",
                width: "547.2px",
                height: "153.9px",
                magicMirrorRegion: "top_left",
                optimizedForTV: true
            });
        });

        test('should get standard region position for non-TV', () => {
            module.layoutState.isTV = false;
            module.config.regions.branding = "top_left";

            const position = module.getRegionPosition("branding");

            expect(position).toEqual({
                magicMirrorRegion: "top_left",
                optimizedForTV: false
            });
        });

        test('should update region position dynamically', () => {
            const newPosition = {
                top: "100px",
                left: "200px",
                width: "300px"
            };

            const result = module.updateRegionPosition("branding", newPosition);

            expect(result).toBe(true);
            
            const setProperty = document.documentElement.style.setProperty;
            expect(setProperty).toHaveBeenCalledWith("--region-branding-top", "100px");
            expect(setProperty).toHaveBeenCalledWith("--region-branding-left", "200px");
            expect(setProperty).toHaveBeenCalledWith("--region-branding-width", "300px");

            expect(module.sendNotification).toHaveBeenCalledWith("REGION_UPDATED", expect.objectContaining({
                regionName: "branding",
                position: newPosition
            }));
        });
    });

    describe('TV Metrics', () => {
        test('should get comprehensive TV metrics', () => {
            module.displayInfo = { width: 1920, height: 1080, aspectRatio: 16/9 };
            module.layoutState.scaleFactor = 1.2;
            module.config.tvOptimization.overscanCompensation = 0.95;
            module.config.tvOptimization.minFontSize = 16;
            module.layoutState.tvRegions = { branding: {}, carousel: {} };

            const metrics = module.getTVMetrics();

            expect(metrics.displaySize).toEqual({ width: 1920, height: 1080 });
            expect(metrics.aspectRatio).toBeCloseTo(16/9, 5);
            expect(metrics.safeArea).toEqual({
                width: 1824, // 1920 * 0.95
                height: 1026  // 1080 * 0.95
            });
            expect(metrics.overscanMargin).toEqual({
                x: 48, // (1920 - 1824) / 2
                y: 27  // (1080 - 1026) / 2
            });
            expect(metrics.scaleFactor).toBe(1.2);
            expect(metrics.fontSizes.base).toBeCloseTo(19.2, 1);
            expect(metrics.fontSizes.small).toBeCloseTo(16.8, 1);
            expect(metrics.fontSizes.large).toBeCloseTo(24, 1);
            expect(metrics.fontSizes.xlarge).toBeCloseTo(28.8, 1);
            expect(metrics.regions).toEqual({ branding: {}, carousel: {} });
        });

        test('should return null for non-TV displays', () => {
            module.layoutState.isTV = false;

            const metrics = module.getTVMetrics();

            expect(metrics).toBeNull();
        });
    });

    describe('Emergency TV Mode', () => {
        test('should apply emergency TV mode', () => {
            module.applyEmergencyTVMode();

            const setProperty = document.documentElement.style.setProperty;
            
            expect(setProperty).toHaveBeenCalledWith("--emergency-scale-factor", "0.8");
            expect(setProperty).toHaveBeenCalledWith("--emergency-font-size", "18px");
            expect(setProperty).toHaveBeenCalledWith("--emergency-line-height", "1.8");
            expect(setProperty).toHaveBeenCalledWith("--emergency-overscan", "0.9");

            expect(document.body.classList.add).toHaveBeenCalledWith("emergency-tv-mode");
            
            expect(module.sendNotification).toHaveBeenCalledWith("EMERGENCY_TV_MODE_ACTIVATED", expect.objectContaining({
                reason: "Display compatibility issues",
                displayInfo: expect.any(Object)
            }));

            expect(Log.warn).toHaveBeenCalledWith("Applying emergency TV mode");
        });
    });

    describe('Integration with Scale Adjustment', () => {
        test('should re-apply TV optimizations when scaling is adjusted', () => {
            const applyTVOptimizationsSpy = jest.spyOn(module, 'applyTVOptimizations');

            module.adjustScaling(1.5);

            expect(module.layoutState.scaleFactor).toBe(1.5);
            expect(applyTVOptimizationsSpy).toHaveBeenCalled();
        });

        test('should not re-apply TV optimizations for non-TV displays', () => {
            module.layoutState.isTV = false;
            const applyTVOptimizationsSpy = jest.spyOn(module, 'applyTVOptimizations');

            module.adjustScaling(1.5);

            expect(applyTVOptimizationsSpy).not.toHaveBeenCalled();
        });
    });
});