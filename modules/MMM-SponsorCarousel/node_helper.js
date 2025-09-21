/* MagicMirror²
 * Node Helper: MMM-SponsorCarousel
 *
 * Copyright by Sähkökilta ry
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const path = require("path");
const ContentService = require("../../services/ContentService");

module.exports = NodeHelper.create({
  // Node helper start
  start: function () {
    console.log("Starting node helper for: MMM-SponsorCarousel");
    
    this.contentService = null;
    this.watchedConfigs = new Map(); // Track watched config files per identifier
    this.initialized = false;
  },

  // Initialize content service
  async initializeContentService() {
    if (this.initialized) {
      return;
    }

    try {
      this.contentService = new ContentService({
        watchDelay: 1000,
        maxRetries: 3,
        retryDelay: 1000,
        enableCaching: true
      });

      await this.contentService.initialize();
      
      // Set up event listeners
      this.contentService.on('content-updated', (data) => {
        this.handleContentUpdate(data);
      });

      this.contentService.on('validation-error', (data) => {
        this.handleValidationError(data);
      });

      this.contentService.on('content-error', (data) => {
        this.handleContentError(data);
      });

      this.initialized = true;
      console.log("ContentService initialized for MMM-SponsorCarousel");
    } catch (error) {
      console.error("Failed to initialize ContentService:", error.message);
      throw error;
    }
  },

  // Handle socket notifications from module
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "LOAD_SPONSORS_CONFIG":
        this.loadSponsorsConfig(payload);
        break;
      
      default:
        console.warn(`Unknown notification received: ${notification}`);
    }
  },

  // Load sponsors configuration
  async loadSponsorsConfig(payload) {
    const { configPath, identifier } = payload;
    
    try {
      // Initialize content service if needed
      if (!this.initialized) {
        await this.initializeContentService();
      }

      const absolutePath = path.resolve(configPath);
      console.log(`Loading sponsors config: ${absolutePath} for ${identifier}`);

      // Load and validate configuration
      const sponsorsConfig = await this.contentService.loadConfiguration(
        absolutePath,
        'sponsors-config'
      );

      // Set up file watching for hot reload
      if (!this.watchedConfigs.has(identifier)) {
        this.contentService.watchFiles(absolutePath, {
          schemaKey: 'sponsors-config'
        });
        this.watchedConfigs.set(identifier, absolutePath);
        console.log(`Started watching sponsors config: ${absolutePath}`);
      }

      // Send success response
      this.sendSocketNotification("SPONSORS_CONFIG_LOADED", {
        identifier: identifier,
        config: sponsorsConfig
      });

    } catch (error) {
      console.error(`Failed to load sponsors config for ${identifier}:`, error.message);
      
      // Send error response
      this.sendSocketNotification("SPONSORS_CONFIG_ERROR", {
        identifier: identifier,
        error: error.message,
        code: error.code
      });
    }
  },

  // Handle content updates from file watcher
  handleContentUpdate(data) {
    const { filePath, schemaKey, content } = data;
    
    if (schemaKey !== 'sponsors-config') {
      return;
    }

    console.log(`Sponsors config updated: ${filePath}`);
    
    // Find which module instance is watching this file
    for (const [identifier, watchedPath] of this.watchedConfigs) {
      if (path.resolve(watchedPath) === path.resolve(filePath)) {
        this.sendSocketNotification("SPONSORS_CONFIG_UPDATED", {
          identifier: identifier,
          config: content
        });
        break;
      }
    }
  },

  // Handle validation errors
  handleValidationError(data) {
    const { filePath, schemaKey, error } = data;
    
    if (schemaKey !== 'sponsors-config') {
      return;
    }

    console.error(`Sponsors config validation error: ${filePath}`, error.message);
    
    // Find which module instance is watching this file
    for (const [identifier, watchedPath] of this.watchedConfigs) {
      if (path.resolve(watchedPath) === path.resolve(filePath)) {
        this.sendSocketNotification("SPONSORS_CONFIG_ERROR", {
          identifier: identifier,
          error: `Validation failed: ${error.message}`,
          code: 'VALIDATION_ERROR'
        });
        break;
      }
    }
  },

  // Handle content errors
  handleContentError(data) {
    const { filePath, schemaKey, error } = data;
    
    if (schemaKey !== 'sponsors-config') {
      return;
    }

    console.error(`Sponsors config content error: ${filePath}`, error.message);
    
    // Find which module instance is watching this file
    for (const [identifier, watchedPath] of this.watchedConfigs) {
      if (path.resolve(watchedPath) === path.resolve(filePath)) {
        this.sendSocketNotification("SPONSORS_CONFIG_ERROR", {
          identifier: identifier,
          error: error.message,
          code: error.code || 'CONTENT_ERROR'
        });
        break;
      }
    }
  },

  // Cleanup when stopping
  stop: function () {
    console.log("Stopping node helper for: MMM-SponsorCarousel");
    
    if (this.contentService) {
      this.contentService.cleanup();
    }
    
    this.watchedConfigs.clear();
  }
});