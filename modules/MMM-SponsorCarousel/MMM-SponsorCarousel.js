/* MagicMirror²
 * Module: MMM-SponsorCarousel
 *
 * Copyright by Sähkökilta ry
 * MIT Licensed.
 */

Module.register("MMM-SponsorCarousel", {
  // Default module config
  defaults: {
    sponsorsConfigPath: "config/sponsors.json",
    displayDuration: 10000, // 10 seconds
    transitionDuration: 1000, // 1 second
    animationType: "fade", // fade, slide, zoom
    fallbackMessage: "No sponsors available",
    autoReload: true,
    updateInterval: 30000, // 30 seconds
    retryDelay: 5000, // 5 seconds
    maxRetries: 3,
    enableHotReload: true,
    showSponsorName: true,
    respectPriority: true,
    shuffleOrder: false,
    onlyActiveSponsors: true
  },

  // Define required scripts
  getScripts: function () {
    return [];
  },

  // Define required styles
  getStyles: function () {
    return ["MMM-SponsorCarousel.css"];
  },

  // Module start function
  start: function () {
    Log.info("Starting module: " + this.name);
    
    // Initialize module state
    this.sponsorsConfig = null;
    this.sponsors = [];
    this.currentSponsorIndex = 0;
    this.carouselTimer = null;
    this.updateTimer = null;
    this.retryCount = 0;
    this.isCarouselRunning = false;
    this.loadingState = true;
    this.errorState = null;

    // Load initial sponsor configuration
    this.loadSponsors();
    
    // Set up periodic updates if hot reload is enabled
    if (this.config.enableHotReload) {
      this.scheduleUpdate();
    }
  },

  // Override the module header
  getHeader: function () {
    return false; // No header for carousel module
  },

  // Generate DOM content
  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "sponsor-carousel-container";

    if (this.loadingState) {
      wrapper.appendChild(this.createLoadingElement());
    } else if (this.errorState) {
      wrapper.appendChild(this.createErrorElement());
    } else if (this.sponsors.length === 0) {
      wrapper.appendChild(this.createFallbackElement());
    } else {
      wrapper.appendChild(this.createCarouselElement());
    }

    return wrapper;
  },

  // Create loading state element
  createLoadingElement: function () {
    const loadingElement = document.createElement("div");
    loadingElement.className = "carousel-loading";
    loadingElement.innerHTML = "Loading sponsors...";
    return loadingElement;
  },

  // Create error state element
  createErrorElement: function () {
    const errorElement = document.createElement("div");
    errorElement.className = "carousel-error";
    errorElement.innerHTML = `Error loading sponsors: ${this.errorState}`;
    return errorElement;
  },

  // Create fallback element when no sponsors available
  createFallbackElement: function () {
    const fallbackElement = document.createElement("div");
    fallbackElement.className = "carousel-fallback";
    fallbackElement.innerHTML = this.config.fallbackMessage;
    return fallbackElement;
  },

  // Create main carousel element
  createCarouselElement: function () {
    const carouselContainer = document.createElement("div");
    carouselContainer.className = `carousel-main carousel-${this.config.animationType}`;

    if (this.sponsors.length > 0) {
      const currentSponsor = this.sponsors[this.currentSponsorIndex];
      const sponsorElement = this.createSponsorElement(currentSponsor);
      if (sponsorElement) {
        carouselContainer.appendChild(sponsorElement);
      }
    }

    return carouselContainer;
  },

  // Create individual sponsor element
  createSponsorElement: function (sponsor) {
    if (!sponsor || !sponsor.id || !sponsor.name) {
      Log.warn("Invalid sponsor data provided to createSponsorElement");
      return null;
    }

    const sponsorContainer = document.createElement("div");
    sponsorContainer.className = "sponsor-item";
    sponsorContainer.setAttribute("data-sponsor-id", sponsor.id);

    // Create sponsor image/ad
    const sponsorMedia = document.createElement("img");
    sponsorMedia.className = "sponsor-media";
    
    // Use ad path if available, otherwise use logo
    const mediaPath = sponsor.adPath || sponsor.logoPath;
    sponsorMedia.src = mediaPath;
    sponsorMedia.alt = sponsor.name;

    // Handle media loading errors
    sponsorMedia.onerror = () => {
      Log.warn(`Failed to load sponsor media: ${mediaPath} for ${sponsor.name}`);
      
      // Try fallback to logo if ad failed
      if (sponsor.adPath && sponsorMedia.src === sponsor.adPath && sponsor.logoPath) {
        sponsorMedia.src = sponsor.logoPath;
      } else {
        // Create text fallback
        const textFallback = document.createElement("div");
        textFallback.className = "sponsor-fallback";
        textFallback.innerHTML = sponsor.name;
        sponsorContainer.replaceChild(textFallback, sponsorMedia);
      }
    };

    sponsorMedia.onload = () => {
      Log.debug(`Sponsor media loaded successfully: ${sponsor.name}`);
    };

    sponsorContainer.appendChild(sponsorMedia);

    // Add sponsor name if enabled
    if (this.config.showSponsorName) {
      const sponsorName = document.createElement("div");
      sponsorName.className = "sponsor-name";
      sponsorName.innerHTML = sponsor.name;
      sponsorContainer.appendChild(sponsorName);
    }

    return sponsorContainer;
  },

  // Load sponsors configuration from file
  loadSponsors: function () {
    Log.info("Loading sponsors configuration from: " + this.config.sponsorsConfigPath);
    
    this.loadingState = true;
    this.errorState = null;
    this.updateDom(500);
    
    this.sendSocketNotification("LOAD_SPONSORS_CONFIG", {
      configPath: this.config.sponsorsConfigPath,
      identifier: this.identifier
    });
  },

  // Process and filter sponsors based on configuration
  processSponsors: function (sponsorsData) {
    if (!sponsorsData || !sponsorsData.sponsors) {
      Log.warn("No sponsors data provided");
      return [];
    }

    let sponsors = [...sponsorsData.sponsors];

    // Filter only active sponsors if configured
    if (this.config.onlyActiveSponsors) {
      sponsors = sponsors.filter(sponsor => sponsor.active !== false);
    }

    // Filter out expired sponsors
    const now = new Date();
    sponsors = sponsors.filter(sponsor => {
      if (sponsor.metadata && sponsor.metadata.expiryDate) {
        const expiryDate = new Date(sponsor.metadata.expiryDate);
        return expiryDate > now;
      }
      return true;
    });

    // Sort by priority if configured
    if (this.config.respectPriority) {
      sponsors.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    // Shuffle if configured
    if (this.config.shuffleOrder) {
      sponsors = this.shuffleArray(sponsors);
    }

    Log.info(`Processed ${sponsors.length} sponsors from ${sponsorsData.sponsors.length} total`);
    return sponsors;
  },

  // Shuffle array utility
  shuffleArray: function (array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Start the carousel rotation
  startCarousel: function () {
    if (this.isCarouselRunning || this.sponsors.length === 0) {
      return;
    }

    Log.info("Starting sponsor carousel");
    this.isCarouselRunning = true;
    this.scheduleNextSponsor();
  },

  // Stop the carousel rotation
  stopCarousel: function () {
    if (!this.isCarouselRunning) {
      return;
    }

    Log.info("Stopping sponsor carousel");
    this.isCarouselRunning = false;
    
    if (this.carouselTimer) {
      clearTimeout(this.carouselTimer);
      this.carouselTimer = null;
    }
  },

  // Schedule next sponsor transition
  scheduleNextSponsor: function () {
    if (!this.isCarouselRunning || this.sponsors.length === 0) {
      return;
    }

    const currentSponsor = this.sponsors[this.currentSponsorIndex];
    const displayDuration = currentSponsor.displayDuration || 
                           (this.sponsorsConfig && this.sponsorsConfig.settings && this.sponsorsConfig.settings.defaultDuration) ||
                           this.config.displayDuration;

    this.carouselTimer = setTimeout(() => {
      this.nextSponsor();
    }, displayDuration);
  },

  // Move to next sponsor
  nextSponsor: function () {
    if (this.sponsors.length === 0) {
      return;
    }

    this.currentSponsorIndex = (this.currentSponsorIndex + 1) % this.sponsors.length;
    
    Log.debug(`Switching to sponsor ${this.currentSponsorIndex + 1}/${this.sponsors.length}: ${this.sponsors[this.currentSponsorIndex].name}`);
    
    // Update DOM with transition
    this.updateDom(this.config.transitionDuration);
    
    // Schedule next transition if carousel is still running
    if (this.isCarouselRunning) {
      this.scheduleNextSponsor();
    }
  },

  // Reload sponsor content
  reloadContent: function () {
    Log.info("Reloading sponsor content");
    this.stopCarousel();
    this.loadSponsors();
  },

  // Update sponsors configuration
  updateSponsors: function (sponsorsData) {
    if (!sponsorsData) {
      Log.warn("No sponsors data provided for update");
      return false;
    }

    try {
      this.sponsorsConfig = sponsorsData;
      this.sponsors = this.processSponsors(sponsorsData);
      this.currentSponsorIndex = 0;
      this.loadingState = false;
      this.errorState = null;
      this.retryCount = 0;

      // Update DOM
      this.updateDom(this.config.transitionDuration);

      // Start carousel if we have sponsors
      if (this.sponsors.length > 0) {
        this.startCarousel();
      }

      Log.info(`Sponsors configuration updated successfully. ${this.sponsors.length} active sponsors loaded.`);
      return true;
    } catch (error) {
      Log.error("Failed to update sponsors: " + error.message);
      this.handleError("Failed to process sponsors configuration");
      return false;
    }
  },

  // Handle errors
  handleError: function (errorMessage) {
    this.retryCount++;
    this.loadingState = false;
    this.errorState = errorMessage;
    
    if (this.retryCount <= this.config.maxRetries) {
      Log.info(`Retrying sponsors load (${this.retryCount}/${this.config.maxRetries}) in ${this.config.retryDelay}ms`);
      setTimeout(() => {
        this.loadSponsors();
      }, this.config.retryDelay);
    } else {
      Log.error("Max retries reached for sponsors loading");
      this.updateDom(500);
    }
  },

  // Schedule periodic updates
  scheduleUpdate: function () {
    if (!this.config.enableHotReload) {
      return;
    }
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      if (this.config.enableHotReload) {
        this.loadSponsors();
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
      case "SPONSORS_CONFIG_LOADED":
        Log.info("Sponsors configuration loaded successfully");
        this.updateSponsors(payload.config);
        break;

      case "SPONSORS_CONFIG_ERROR":
        Log.error("Failed to load sponsors configuration: " + payload.error);
        this.handleError(payload.error);
        break;

      case "SPONSORS_CONFIG_UPDATED":
        Log.info("Sponsors configuration file updated, reloading...");
        this.updateSponsors(payload.config);
        break;

      default:
        Log.warn("Unknown notification received: " + notification);
    }
  },

  // Suspend module
  suspend: function () {
    Log.info("Suspending module: " + this.name);
    this.stopCarousel();
    this.stopScheduledUpdates();
  },

  // Resume module
  resume: function () {
    Log.info("Resuming module: " + this.name);
    this.loadSponsors();
    
    if (this.config.enableHotReload) {
      this.scheduleUpdate();
    }
  },

  // Module notification received
  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        // Start carousel when DOM is ready
        if (this.sponsors.length > 0 && !this.isCarouselRunning) {
          this.startCarousel();
        }
        break;
    }
  }
});