/* MagicMirror²
 * Module: MMM-SahkokiltaBranding
 *
 * Copyright by Jere Niemi
 * MIT Licensed.
 */

Module.register("MMM-SahkokiltaBranding", {
  // Default module config
  defaults: {
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
    updateInterval: 30000, // 30 seconds
    retryDelay: 5000, // 5 seconds
    enableHotReload: true
  },

  // Define required scripts
  getScripts: function () {
    return [];
  },

  // Define required styles
  getStyles: function () {
    return ["MMM-SahkokiltaBranding.css"];
  },

  // Module start function
  start: function () {
    Log.info("Starting module: " + this.name);
    
    this.brandingConfig = null;
    this.logoLoaded = false;
    this.themeApplied = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.updateTimer = null;

    // Load initial branding configuration
    this.loadBrandingConfig();
    
    // Set up periodic updates if hot reload is enabled
    if (this.config.enableHotReload) {
      this.scheduleUpdate();
    }
  },

  // Override the module header
  getHeader: function () {
    return false; // No header for branding module
  },

  // Generate DOM content
  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "branding-container";

    if (this.brandingConfig) {
      // Create logo element
      const logoElement = this.createLogoElement();
      if (logoElement) {
        wrapper.appendChild(logoElement);
      }
    } else {
      // Show loading state
      const loadingElement = document.createElement("div");
      loadingElement.className = "branding-loading";
      loadingElement.innerHTML = "Loading branding...";
      wrapper.appendChild(loadingElement);
    }

    return wrapper;
  },

  // Create logo element
  createLogoElement: function () {
    if (!this.brandingConfig || !this.brandingConfig.logo) {
      return null;
    }

    const logoContainer = document.createElement("div");
    logoContainer.className = `logo-container logo-${this.brandingConfig.logo.position}`;

    const logoImg = document.createElement("img");
    logoImg.className = "guild-logo";
    logoImg.src = this.brandingConfig.logo.path;
    logoImg.alt = this.brandingConfig.logo.alt || this.config.logoAlt;
    logoImg.style.width = this.brandingConfig.logo.size.width + "px";
    logoImg.style.height = this.brandingConfig.logo.size.height + "px";

    // Handle logo loading errors
    logoImg.onerror = () => {
      Log.warn("Failed to load logo, trying fallback: " + this.brandingConfig.logo.fallbackPath);
      if (this.brandingConfig.logo.fallbackPath && logoImg.src !== this.brandingConfig.logo.fallbackPath) {
        logoImg.src = this.brandingConfig.logo.fallbackPath;
      } else {
        // Create text fallback
        const textFallback = document.createElement("div");
        textFallback.className = "logo-fallback";
        textFallback.innerHTML = "Sähkökilta ry";
        logoContainer.replaceChild(textFallback, logoImg);
        Log.error("All logo sources failed, using text fallback");
      }
    };

    logoImg.onload = () => {
      this.logoLoaded = true;
      Log.info("Logo loaded successfully");
    };

    logoContainer.appendChild(logoImg);
    return logoContainer;
  },

  // Load branding configuration
  loadBrandingConfig: function () {
    Log.info("Loading branding configuration from: " + this.config.configPath);
    
    this.sendSocketNotification("LOAD_BRANDING_CONFIG", {
      configPath: this.config.configPath,
      identifier: this.identifier
    });
  },

  // Validate logo file exists and is accessible
  validateLogo: function (logoPath) {
    if (!logoPath) {
      return false;
    }

    this.sendSocketNotification("VALIDATE_LOGO", {
      logoPath: logoPath,
      identifier: this.identifier
    });

    return true; // Async validation, result comes via notification
  },

  // Apply theme to document
  applyTheme: function () {
    if (!this.brandingConfig || !this.brandingConfig.theme) {
      Log.warn("No theme configuration available");
      return false;
    }

    try {
      const root = document.documentElement;
      const colors = this.brandingConfig.theme.colors;
      const fonts = this.brandingConfig.theme.fonts;

      // Apply color custom properties
      if (colors) {
        root.style.setProperty('--brand-primary', colors.primary);
        root.style.setProperty('--brand-secondary', colors.secondary);
        root.style.setProperty('--brand-accent', colors.accent || colors.primary);
        root.style.setProperty('--brand-background', colors.background);
        root.style.setProperty('--brand-text', colors.text);
      }

      // Apply font custom properties
      if (fonts) {
        root.style.setProperty('--brand-font-primary', fonts.primary);
        root.style.setProperty('--brand-font-secondary', fonts.secondary || fonts.primary);
      }

      // Apply background style
      if (this.brandingConfig.layout && this.brandingConfig.layout.backgroundStyle) {
        document.body.classList.add(`bg-style-${this.brandingConfig.layout.backgroundStyle}`);
      }

      this.themeApplied = true;
      Log.info("Theme applied successfully");
      return true;
    } catch (error) {
      Log.error("Failed to apply theme: " + error.message);
      return false;
    }
  },

  // Update branding configuration
  updateBranding: function (config) {
    if (!config) {
      Log.warn("No branding configuration provided for update");
      return false;
    }

    try {
      this.brandingConfig = config;
      this.applyTheme();
      this.updateDom(1000); // Update DOM with 1 second animation
      this.retryCount = 0; // Reset retry count on successful update
      
      Log.info("Branding configuration updated successfully");
      return true;
    } catch (error) {
      Log.error("Failed to update branding: " + error.message);
      return false;
    }
  },

  // Schedule next update
  scheduleUpdate: function () {
    // Clear existing timer if any
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      if (this.config.enableHotReload) {
        this.loadBrandingConfig();
        this.scheduleUpdate();
      }
    }, this.config.updateInterval);
  },

  // Stop scheduled updates
  stopScheduledUpdates: function () {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  },

  // Handle notifications from node helper
  socketNotificationReceived: function (notification, payload) {
    if (payload.identifier !== this.identifier) {
      return; // Not for this instance
    }

    switch (notification) {
      case "BRANDING_CONFIG_LOADED":
        Log.info("Branding configuration loaded");
        this.updateBranding(payload.config);
        break;

      case "BRANDING_CONFIG_ERROR":
        Log.error("Failed to load branding configuration: " + payload.error);
        this.handleConfigError(payload.error);
        break;

      case "LOGO_VALIDATION_RESULT":
        if (payload.valid) {
          Log.info("Logo validation successful: " + payload.logoPath);
        } else {
          Log.warn("Logo validation failed: " + payload.logoPath + " - " + payload.error);
        }
        break;

      case "BRANDING_CONFIG_UPDATED":
        Log.info("Branding configuration file updated, reloading...");
        this.updateBranding(payload.config);
        break;

      default:
        Log.warn("Unknown notification received: " + notification);
    }
  },

  // Handle configuration errors
  handleConfigError: function (error) {
    this.retryCount++;
    
    if (this.retryCount <= this.maxRetries) {
      Log.info(`Retrying branding config load (${this.retryCount}/${this.maxRetries}) in ${this.config.retryDelay}ms`);
      setTimeout(() => {
        this.loadBrandingConfig();
      }, this.config.retryDelay);
    } else {
      Log.error("Max retries reached, using fallback configuration");
      this.useFallbackConfig();
    }
  },

  // Use fallback configuration when loading fails
  useFallbackConfig: function () {
    const fallbackConfig = {
      logo: {
        path: this.config.logoPath,
        fallbackPath: this.config.fallbackLogoPath,
        position: this.config.logoPosition,
        size: this.config.logoSize,
        alt: this.config.logoAlt
      },
      theme: {
        colors: this.config.brandColors,
        fonts: this.config.fonts
      },
      layout: this.config.layout
    };

    Log.info("Using fallback branding configuration");
    this.updateBranding(fallbackConfig);
  },

  // Suspend module
  suspend: function () {
    Log.info("Suspending module: " + this.name);
    this.stopScheduledUpdates();
  },

  // Resume module
  resume: function () {
    Log.info("Resuming module: " + this.name);
    this.loadBrandingConfig();
  },

  // Module notification received
  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        // Apply theme when DOM is ready
        if (this.brandingConfig) {
          this.applyTheme();
        }
        break;
    }
  }
});