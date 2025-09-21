/* global Module */

/**
 * MMM-LayoutManager
 * 
 * MagicMirror² module for managing responsive layout and display optimization
 * Handles display detection, resolution adaptation, and TV-specific optimizations
 */
Module.register("MMM-LayoutManager", {
    // Default module config
    defaults: {
        displayMode: "auto", // 'tv' | 'monitor' | 'auto'
        resolution: { width: 1920, height: 1080 },
        scaleFactor: 1.0,
        regions: {
            branding: "top_left",
            carousel: "middle_center",
            content: "lower_third"
        },
        tvOptimization: {
            enabled: true,
            minFontSize: 16,
            scaleMultiplier: 1.2,
            overscanCompensation: 0.95
        },
        breakpoints: {
            small: 768,
            medium: 1024,
            large: 1920,
            xlarge: 2560
        },
        orientationHandling: true,
        debugMode: false
    },

    // Current display information
    displayInfo: {
        width: 0,
        height: 0,
        orientation: "landscape",
        pixelRatio: 1,
        type: "unknown",
        aspectRatio: 16/9
    },

    // Layout state
    layoutState: {
        currentBreakpoint: "large",
        isTV: false,
        scaleFactor: 1.0,
        regions: {}
    },

    /**
     * Module startup
     */
    start: function() {
        Log.info("Starting module: " + this.name);
        
        // Initialize display detection
        this.detectDisplay();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Apply initial layout
        this.optimizeLayout();
        
        // Send display info to other modules
        this.sendNotification("LAYOUT_MANAGER_READY", {
            displayInfo: this.displayInfo,
            layoutState: this.layoutState
        });
    },

    /**
     * Detect display characteristics
     */
    detectDisplay: function() {
        const screen = window.screen;
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // Get display dimensions
        this.displayInfo.width = screen.width || viewport.width;
        this.displayInfo.height = screen.height || viewport.height;
        this.displayInfo.pixelRatio = window.devicePixelRatio || 1;
        
        // Calculate aspect ratio
        this.displayInfo.aspectRatio = this.displayInfo.width / this.displayInfo.height;
        
        // Determine orientation
        this.displayInfo.orientation = this.displayInfo.width > this.displayInfo.height ? "landscape" : "portrait";
        
        // Detect display type
        this.displayInfo.type = this.detectDisplayType();
        
        // Update layout state
        this.layoutState.isTV = this.displayInfo.type === "tv";
        this.layoutState.currentBreakpoint = this.calculateBreakpoint();
        this.layoutState.scaleFactor = this.calculateScaleFactor();

        if (this.config.debugMode) {
            Log.info("Display detected:", this.displayInfo);
            Log.info("Layout state:", this.layoutState);
        }

        return this.displayInfo;
    },

    /**
     * Detect display type based on characteristics
     */
    detectDisplayType: function() {
        const { width, height, aspectRatio } = this.displayInfo;
        
        // Force TV mode if configured
        if (this.config.displayMode === "tv") {
            return "tv";
        }
        
        // Force monitor mode if configured
        if (this.config.displayMode === "monitor") {
            return "monitor";
        }
        
        // Auto-detection logic
        // Common TV resolutions and characteristics
        const tvResolutions = [
            { w: 1920, h: 1080 }, // 1080p
            { w: 3840, h: 2160 }, // 4K
            { w: 1366, h: 768 },  // 720p variant
            { w: 1280, h: 720 }   // 720p
        ];
        
        // Check for exact TV resolution matches
        const isCommonTVResolution = tvResolutions.some(res => 
            Math.abs(width - res.w) <= 10 && Math.abs(height - res.h) <= 10
        );
        
        // TV characteristics:
        // - Common TV aspect ratios (16:9, 16:10)
        // - Large screen sizes (typically > 32 inches, approximated by resolution)
        // - Specific resolution patterns
        const isWideAspectRatio = aspectRatio >= 1.6 && aspectRatio <= 1.8;
        const isLargeScreen = width >= 1280 && height >= 720;
        
        // More specific detection - 1440x900 is a common monitor resolution
        const isCommonMonitorResolution = (width === 1440 && height === 900) ||
                                         (width === 1680 && height === 1050) ||
                                         (width === 2560 && height === 1600);
        
        if (isCommonMonitorResolution) {
            return "monitor";
        }
        
        if (isCommonTVResolution || (isWideAspectRatio && isLargeScreen)) {
            return "tv";
        }
        
        return "monitor";
    },

    /**
     * Calculate current breakpoint based on screen width
     */
    calculateBreakpoint: function() {
        const width = this.displayInfo.width;
        const bp = this.config.breakpoints;
        
        if (width >= bp.xlarge) return "xlarge";
        if (width >= bp.large) return "large";
        if (width >= bp.medium) return "medium";
        if (width >= bp.small) return "small";
        return "xsmall";
    },

    /**
     * Calculate appropriate scale factor
     */
    calculateScaleFactor: function() {
        let scaleFactor = this.config.scaleFactor;
        
        // Apply TV-specific scaling
        if (this.layoutState.isTV && this.config.tvOptimization.enabled) {
            scaleFactor *= this.config.tvOptimization.scaleMultiplier;
            
            // Apply overscan compensation
            scaleFactor *= this.config.tvOptimization.overscanCompensation;
        }
        
        // Adjust for pixel density
        if (this.displayInfo.pixelRatio > 1) {
            scaleFactor *= Math.min(this.displayInfo.pixelRatio, 2);
        }
        
        // Ensure reasonable bounds
        return Math.max(0.5, Math.min(3.0, scaleFactor));
    },

    /**
     * Set up event listeners for display changes
     */
    setupEventListeners: function() {
        // Listen for window resize
        window.addEventListener("resize", this.debounce(() => {
            this.handleDisplayChange();
        }, 250));
        
        // Listen for orientation change
        if (this.config.orientationHandling) {
            window.addEventListener("orientationchange", () => {
                // Delay to allow orientation change to complete
                setTimeout(() => {
                    this.handleOrientationChange();
                }, 100);
            });
        }
        
        // Listen for fullscreen changes
        document.addEventListener("fullscreenchange", () => {
            this.handleDisplayChange();
        });
    },

    /**
     * Handle display changes (resize, fullscreen, etc.)
     */
    handleDisplayChange: function() {
        const previousInfo = { ...this.displayInfo };
        const previousState = { ...this.layoutState };
        
        // Re-detect display
        this.detectDisplay();
        
        // Check if significant changes occurred
        const significantChange = 
            Math.abs(previousInfo.width - this.displayInfo.width) > 50 ||
            Math.abs(previousInfo.height - this.displayInfo.height) > 50 ||
            previousInfo.orientation !== this.displayInfo.orientation ||
            previousState.currentBreakpoint !== this.layoutState.currentBreakpoint;
        
        if (significantChange) {
            if (this.config.debugMode) {
                Log.info("Significant display change detected");
            }
            
            // Re-optimize layout
            this.optimizeLayout();
            
            // Notify other modules
            this.sendNotification("DISPLAY_CHANGED", {
                displayInfo: this.displayInfo,
                layoutState: this.layoutState,
                previousInfo: previousInfo
            });
        }
    },

    /**
     * Handle orientation changes
     */
    handleOrientationChange: function() {
        if (this.config.debugMode) {
            Log.info("Orientation change detected");
        }
        
        const previousOrientation = this.displayInfo.orientation;
        
        // Re-detect display to get new orientation
        this.handleDisplayChange();
        
        // Apply orientation-specific optimizations
        this.applyOrientationOptimizations();
        
        // Send specific orientation change notification
        this.sendNotification("ORIENTATION_CHANGED", {
            orientation: this.displayInfo.orientation,
            previousOrientation: previousOrientation,
            displayInfo: this.displayInfo,
            layoutState: this.layoutState
        });
    },

    /**
     * Apply orientation-specific optimizations
     */
    applyOrientationOptimizations: function() {
        const root = document.documentElement;
        const { orientation } = this.displayInfo;
        
        // Remove previous orientation classes
        document.body.classList.remove("orientation-landscape", "orientation-portrait");
        
        // Add current orientation class
        document.body.classList.add(`orientation-${orientation}`);
        
        // Apply orientation-specific CSS variables
        root.style.setProperty("--current-orientation", orientation);
        
        if (orientation === "portrait") {
            // Portrait-specific optimizations
            this.applyPortraitOptimizations();
        } else {
            // Landscape-specific optimizations
            this.applyLandscapeOptimizations();
        }
        
        // Re-setup layout regions for new orientation
        if (this.layoutState.isTV) {
            this.setupTVLayoutRegions();
        }
        
        if (this.config.debugMode) {
            Log.info("Orientation optimizations applied for:", orientation);
        }
    },

    /**
     * Apply portrait-specific optimizations
     */
    applyPortraitOptimizations: function() {
        const root = document.documentElement;
        
        // Adjust scaling for portrait mode
        const portraitScaleFactor = this.layoutState.scaleFactor * 0.9;
        root.style.setProperty("--portrait-scale-factor", portraitScaleFactor);
        
        // Portrait-specific layout adjustments
        root.style.setProperty("--portrait-content-width", "90%");
        root.style.setProperty("--portrait-font-scale", "0.95");
        
        // Adjust regions for portrait layout
        if (this.layoutState.isTV) {
            const { width, height } = this.displayInfo;
            const overscan = this.config.tvOptimization.overscanCompensation;
            const safeWidth = width * overscan;
            const safeHeight = height * overscan;
            
            // Portrait TV regions (stacked vertically)
            const portraitRegions = {
                branding: { height: safeHeight * 0.2 },
                carousel: { height: safeHeight * 0.6 },
                content: { height: safeHeight * 0.2 }
            };
            
            Object.keys(portraitRegions).forEach(regionName => {
                Object.keys(portraitRegions[regionName]).forEach(property => {
                    root.style.setProperty(
                        `--portrait-region-${regionName}-${property}`, 
                        portraitRegions[regionName][property]
                    );
                });
            });
        }
    },

    /**
     * Apply landscape-specific optimizations
     */
    applyLandscapeOptimizations: function() {
        const root = document.documentElement;
        
        // Standard scaling for landscape mode
        root.style.setProperty("--landscape-scale-factor", this.layoutState.scaleFactor);
        
        // Landscape-specific layout adjustments
        root.style.setProperty("--landscape-content-width", "100%");
        root.style.setProperty("--landscape-font-scale", "1.0");
        
        // Landscape is the default, so regions are already optimized
        if (this.config.debugMode) {
            Log.info("Landscape optimizations applied");
        }
    },

    /**
     * Optimize layout based on current display
     */
    optimizeLayout: function() {
        // Apply CSS custom properties for responsive design
        this.applyCSSVariables();
        
        // Apply TV-specific optimizations
        if (this.layoutState.isTV) {
            this.applyTVOptimizations();
        }
        
        // Update region positioning
        this.updateRegions();
        
        if (this.config.debugMode) {
            Log.info("Layout optimized for:", this.layoutState);
        }
    },

    /**
     * Apply CSS custom properties for responsive design
     */
    applyCSSVariables: function() {
        const root = document.documentElement;
        
        // Display information
        root.style.setProperty("--display-width", this.displayInfo.width + "px");
        root.style.setProperty("--display-height", this.displayInfo.height + "px");
        root.style.setProperty("--display-aspect-ratio", this.displayInfo.aspectRatio);
        root.style.setProperty("--pixel-ratio", this.displayInfo.pixelRatio);
        
        // Layout state
        root.style.setProperty("--scale-factor", this.layoutState.scaleFactor);
        root.style.setProperty("--current-breakpoint", this.layoutState.currentBreakpoint);
        root.style.setProperty("--is-tv", this.layoutState.isTV ? "1" : "0");
        
        // Responsive font sizes
        const baseFontSize = this.layoutState.isTV ? 
            Math.max(this.config.tvOptimization.minFontSize, 16 * this.layoutState.scaleFactor) :
            16 * this.layoutState.scaleFactor;
        
        root.style.setProperty("--base-font-size", baseFontSize + "px");
        root.style.setProperty("--small-font-size", (baseFontSize * 0.875) + "px");
        root.style.setProperty("--large-font-size", (baseFontSize * 1.25) + "px");
        root.style.setProperty("--xlarge-font-size", (baseFontSize * 1.5) + "px");
    },

    /**
     * Apply TV-specific optimizations
     */
    applyTVOptimizations: function() {
        if (!this.config.tvOptimization.enabled) return;
        
        const root = document.documentElement;
        
        // TV-specific CSS class
        document.body.classList.add("tv-display");
        document.body.classList.remove("monitor-display");
        
        // Enhanced contrast and sizing for TV viewing
        root.style.setProperty("--tv-line-height", "1.6");
        root.style.setProperty("--tv-letter-spacing", "0.02em");
        root.style.setProperty("--tv-border-radius", "8px");
        
        // Overscan compensation
        const overscan = this.config.tvOptimization.overscanCompensation;
        root.style.setProperty("--overscan-compensation", overscan);
        
        // Apply TV-specific font scaling
        this.applyTVFontScaling();
        
        // Set up layout regions for TV
        this.setupTVLayoutRegions();
        
        // Apply TV-specific spacing and margins
        this.applyTVSpacing();
        
        if (this.config.debugMode) {
            Log.info("TV optimizations applied");
        }
    },

    /**
     * Apply TV-specific font scaling
     */
    applyTVFontScaling: function() {
        const root = document.documentElement;
        const scaleFactor = this.layoutState.scaleFactor;
        const minFontSize = this.config.tvOptimization.minFontSize;
        
        // Calculate TV-optimized font sizes
        const baseFontSize = Math.max(minFontSize, 16 * scaleFactor);
        const smallFontSize = Math.max(minFontSize * 0.875, baseFontSize * 0.875);
        const largeFontSize = baseFontSize * 1.25;
        const xlargeFontSize = baseFontSize * 1.5;
        const xxlargeFontSize = baseFontSize * 2.0;
        
        // Set TV-specific font size variables
        root.style.setProperty("--tv-base-font-size", baseFontSize + "px");
        root.style.setProperty("--tv-small-font-size", smallFontSize + "px");
        root.style.setProperty("--tv-large-font-size", largeFontSize + "px");
        root.style.setProperty("--tv-xlarge-font-size", xlargeFontSize + "px");
        root.style.setProperty("--tv-xxlarge-font-size", xxlargeFontSize + "px");
        
        // Apply enhanced readability settings
        root.style.setProperty("--tv-font-weight", "500"); // Slightly bolder for TV
        root.style.setProperty("--tv-text-shadow", "0 1px 2px rgba(0, 0, 0, 0.3)");
        
        if (this.config.debugMode) {
            Log.info("TV font scaling applied:", {
                baseFontSize: baseFontSize,
                scaleFactor: scaleFactor,
                minFontSize: minFontSize
            });
        }
    },

    /**
     * Set up layout regions optimized for TV viewing
     */
    setupTVLayoutRegions: function() {
        const root = document.documentElement;
        const { width, height } = this.displayInfo;
        
        // Calculate safe areas for TV (accounting for overscan)
        const overscan = this.config.tvOptimization.overscanCompensation;
        const safeWidth = width * overscan;
        const safeHeight = height * overscan;
        const marginX = (width - safeWidth) / 2;
        const marginY = (height - safeHeight) / 2;
        
        // Set safe area variables
        root.style.setProperty("--tv-safe-area-width", safeWidth + "px");
        root.style.setProperty("--tv-safe-area-height", safeHeight + "px");
        root.style.setProperty("--tv-safe-margin-x", marginX + "px");
        root.style.setProperty("--tv-safe-margin-y", marginY + "px");
        
        // Define TV-optimized layout regions
        const regions = {
            branding: {
                top: marginY + "px",
                left: marginX + "px",
                width: safeWidth * 0.3 + "px",
                height: safeHeight * 0.15 + "px"
            },
            carousel: {
                top: safeHeight * 0.25 + marginY + "px",
                left: marginX + "px",
                width: safeWidth + "px",
                height: safeHeight * 0.5 + "px"
            },
            content: {
                top: safeHeight * 0.8 + marginY + "px",
                left: marginX + "px",
                width: safeWidth + "px",
                height: safeHeight * 0.15 + "px"
            }
        };
        
        // Apply region positioning
        Object.keys(regions).forEach(regionName => {
            const region = regions[regionName];
            Object.keys(region).forEach(property => {
                root.style.setProperty(`--tv-region-${regionName}-${property}`, region[property]);
            });
        });
        
        // Store regions in layout state
        this.layoutState.tvRegions = regions;
        
        if (this.config.debugMode) {
            Log.info("TV layout regions configured:", regions);
        }
    },

    /**
     * Apply TV-specific spacing and margins
     */
    applyTVSpacing: function() {
        const root = document.documentElement;
        const scaleFactor = this.layoutState.scaleFactor;
        
        // TV-optimized spacing (larger for better visibility)
        const baseSpacing = 16 * scaleFactor;
        const smallSpacing = 8 * scaleFactor;
        const largeSpacing = 32 * scaleFactor;
        const xlargeSpacing = 48 * scaleFactor;
        
        root.style.setProperty("--tv-spacing-xs", smallSpacing / 2 + "px");
        root.style.setProperty("--tv-spacing-sm", smallSpacing + "px");
        root.style.setProperty("--tv-spacing-md", baseSpacing + "px");
        root.style.setProperty("--tv-spacing-lg", largeSpacing + "px");
        root.style.setProperty("--tv-spacing-xl", xlargeSpacing + "px");
        
        // TV-specific padding and margins for better readability
        root.style.setProperty("--tv-content-padding", largeSpacing + "px");
        root.style.setProperty("--tv-module-margin", baseSpacing + "px");
        root.style.setProperty("--tv-border-width", Math.max(2, scaleFactor * 2) + "px");
    },

    /**
     * Update region positioning based on layout
     */
    updateRegions: function() {
        // Store region information for other modules
        this.layoutState.regions = {
            branding: this.config.regions.branding,
            carousel: this.config.regions.carousel,
            content: this.config.regions.content
        };
        
        // Apply region-specific styling
        const regions = document.querySelectorAll(".region");
        regions.forEach(region => {
            region.style.transform = `scale(${this.layoutState.scaleFactor})`;
        });
    },

    /**
     * Get current display information
     */
    getDisplayInfo: function() {
        return {
            displayInfo: this.displayInfo,
            layoutState: this.layoutState
        };
    },

    /**
     * Utility: Debounce function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Handle notifications from other modules
     */
    notificationReceived: function(notification, payload, sender) {
        switch (notification) {
            case "GET_DISPLAY_INFO":
                if (sender) {
                    this.sendNotification("DISPLAY_INFO_RESPONSE", this.getDisplayInfo(), sender.name);
                }
                break;
                
            case "UPDATE_SCALE_FACTOR":
                if (payload && typeof payload.scaleFactor === "number") {
                    this.adjustScaling(payload.scaleFactor);
                }
                break;
        }
    },

    /**
     * Adjust scaling factor
     */
    adjustScaling: function(factor) {
        this.layoutState.scaleFactor = Math.max(0.5, Math.min(3.0, factor));
        this.applyCSSVariables();
        
        // Re-apply TV optimizations if needed
        if (this.layoutState.isTV) {
            this.applyTVOptimizations();
        }
        
        if (this.config.debugMode) {
            Log.info("Scale factor adjusted to:", this.layoutState.scaleFactor);
        }
    },

    /**
     * Get region positioning for a specific region
     */
    getRegionPosition: function(regionName) {
        if (!regionName || !this.config.regions[regionName]) {
            Log.warn("Invalid region name:", regionName);
            return null;
        }
        
        const baseRegion = this.config.regions[regionName];
        
        // Return TV-specific positioning if available
        if (this.layoutState.isTV && this.layoutState.tvRegions && this.layoutState.tvRegions[regionName]) {
            return {
                ...this.layoutState.tvRegions[regionName],
                magicMirrorRegion: baseRegion,
                optimizedForTV: true
            };
        }
        
        // Return standard MagicMirror region
        return {
            magicMirrorRegion: baseRegion,
            optimizedForTV: false
        };
    },

    /**
     * Update region positioning dynamically
     */
    updateRegionPosition: function(regionName, position) {
        if (!regionName || !position) {
            Log.warn("Invalid region update parameters");
            return false;
        }
        
        const root = document.documentElement;
        
        // Update CSS variables for the region
        Object.keys(position).forEach(property => {
            if (typeof position[property] === 'string' || typeof position[property] === 'number') {
                const value = typeof position[property] === 'number' ? 
                    position[property] + 'px' : position[property];
                root.style.setProperty(`--region-${regionName}-${property}`, value);
            }
        });
        
        // Update stored region data
        if (this.layoutState.tvRegions) {
            this.layoutState.tvRegions[regionName] = { 
                ...this.layoutState.tvRegions[regionName], 
                ...position 
            };
        }
        
        // Notify other modules of region update
        this.sendNotification("REGION_UPDATED", {
            regionName: regionName,
            position: position,
            layoutState: this.layoutState
        });
        
        if (this.config.debugMode) {
            Log.info("Region position updated:", regionName, position);
        }
        
        return true;
    },

    /**
     * Get TV-specific display metrics
     */
    getTVMetrics: function() {
        if (!this.layoutState.isTV) {
            return null;
        }
        
        const { width, height, aspectRatio } = this.displayInfo;
        const overscan = this.config.tvOptimization.overscanCompensation;
        
        return {
            displaySize: { width, height },
            aspectRatio: aspectRatio,
            safeArea: {
                width: width * overscan,
                height: height * overscan
            },
            overscanMargin: {
                x: (width - (width * overscan)) / 2,
                y: (height - (height * overscan)) / 2
            },
            scaleFactor: this.layoutState.scaleFactor,
            fontSizes: {
                base: Math.max(this.config.tvOptimization.minFontSize, 16 * this.layoutState.scaleFactor),
                small: Math.max(this.config.tvOptimization.minFontSize * 0.875, 14 * this.layoutState.scaleFactor),
                large: 20 * this.layoutState.scaleFactor,
                xlarge: 24 * this.layoutState.scaleFactor
            },
            regions: this.layoutState.tvRegions || {}
        };
    },

    /**
     * Apply emergency TV mode (for problematic displays)
     */
    applyEmergencyTVMode: function() {
        Log.warn("Applying emergency TV mode");
        
        const root = document.documentElement;
        
        // Force safe, conservative settings
        root.style.setProperty("--emergency-scale-factor", "0.8");
        root.style.setProperty("--emergency-font-size", "18px");
        root.style.setProperty("--emergency-line-height", "1.8");
        root.style.setProperty("--emergency-overscan", "0.9");
        
        // Add emergency mode class
        document.body.classList.add("emergency-tv-mode");
        
        // Notify other modules
        this.sendNotification("EMERGENCY_TV_MODE_ACTIVATED", {
            reason: "Display compatibility issues",
            displayInfo: this.displayInfo
        });
    }
});