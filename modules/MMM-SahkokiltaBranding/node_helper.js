/* MagicMirror²
 * Node Helper: MMM-SahkokiltaBranding
 *
 * Copyright by Jere Niemi
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

module.exports = NodeHelper.create({
  // Node helper started
  start: function () {
    console.log('Starting node helper for: MMM-SahkokiltaBranding');

    this.watchers = new Map();
    this.configs = new Map();

    // Initialize JSON schema validator
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    // Load branding schema
    this.loadBrandingSchema();
  },

  // Load branding configuration schema
  loadBrandingSchema: function () {
    try {
      const schemaPath = path.resolve(
        __dirname,
        '../../schemas/branding-config.schema.json'
      );
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.brandingSchema = JSON.parse(schemaContent);
      this.validateBranding = this.ajv.compile(this.brandingSchema);
      console.log('Branding schema loaded successfully');
    } catch (error) {
      console.error('Failed to load branding schema:', error.message);
      this.validateBranding = null;
    }
  },

  // Handle socket notifications
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case 'LOAD_BRANDING_CONFIG':
        this.loadBrandingConfig(payload.configPath, payload.identifier);
        break;

      case 'VALIDATE_LOGO':
        this.validateLogoFile(payload.logoPath, payload.identifier);
        break;

      default:
        console.warn('Unknown notification received:', notification);
    }
  },

  // Load branding configuration from file
  loadBrandingConfig: function (configPath, identifier) {
    try {
      const fullPath = path.resolve(__dirname, '../../', configPath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Configuration file not found: ${fullPath}`);
      }

      // Read and parse configuration
      const configContent = fs.readFileSync(fullPath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate configuration
      if (this.validateBranding && !this.validateBranding(config)) {
        const errors = this.validateBranding.errors
          .map(err => `${err.instancePath}: ${err.message}`)
          .join(', ');
        throw new Error(`Configuration validation failed: ${errors}`);
      }

      // Store configuration
      this.configs.set(identifier, config);

      // Set up file watcher for hot reloading
      this.setupFileWatcher(fullPath, identifier);

      // Send success notification
      this.sendSocketNotification('BRANDING_CONFIG_LOADED', {
        identifier: identifier,
        config: config,
      });

      console.log(
        `Branding configuration loaded successfully for ${identifier}`
      );
    } catch (error) {
      console.error(
        `Failed to load branding configuration for ${identifier}:`,
        error.message
      );

      this.sendSocketNotification('BRANDING_CONFIG_ERROR', {
        identifier: identifier,
        error: error.message,
      });
    }
  },

  // Set up file watcher for configuration changes
  setupFileWatcher: function (filePath, identifier) {
    // Close existing watcher if any
    if (this.watchers.has(identifier)) {
      this.watchers.get(identifier).close();
    }

    // Create new watcher
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    });

    watcher.on('change', () => {
      console.log(`Branding configuration file changed: ${filePath}`);
      this.reloadBrandingConfig(filePath, identifier);
    });

    watcher.on('error', error => {
      console.error(`File watcher error for ${filePath}:`, error.message);
    });

    this.watchers.set(identifier, watcher);
    console.log(`File watcher set up for: ${filePath}`);
  },

  // Reload configuration when file changes
  reloadBrandingConfig: function (filePath, identifier) {
    try {
      const configContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(configContent);

      // Validate configuration
      if (this.validateBranding && !this.validateBranding(config)) {
        const errors = this.validateBranding.errors
          .map(err => `${err.instancePath}: ${err.message}`)
          .join(', ');
        throw new Error(`Configuration validation failed: ${errors}`);
      }

      // Update stored configuration
      this.configs.set(identifier, config);

      // Notify module of update
      this.sendSocketNotification('BRANDING_CONFIG_UPDATED', {
        identifier: identifier,
        config: config,
      });

      console.log(
        `Branding configuration reloaded successfully for ${identifier}`
      );
    } catch (error) {
      console.error(
        `Failed to reload branding configuration for ${identifier}:`,
        error.message
      );

      this.sendSocketNotification('BRANDING_CONFIG_ERROR', {
        identifier: identifier,
        error: error.message,
      });
    }
  },

  // Validate logo file exists and is accessible
  validateLogoFile: function (logoPath, identifier) {
    try {
      const fullPath = path.resolve(__dirname, '../../', logoPath);

      // Check if file exists
      const exists = fs.existsSync(fullPath);

      if (exists) {
        // Check if it's a valid image file
        const stats = fs.statSync(fullPath);
        const isFile = stats.isFile();
        const validExtensions = [
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.svg',
          '.webp',
        ];
        const hasValidExtension = validExtensions.some(ext =>
          fullPath.toLowerCase().endsWith(ext)
        );

        if (isFile && hasValidExtension) {
          this.sendSocketNotification('LOGO_VALIDATION_RESULT', {
            identifier: identifier,
            logoPath: logoPath,
            valid: true,
          });
        } else {
          throw new Error('File is not a valid image format');
        }
      } else {
        throw new Error('Logo file does not exist');
      }
    } catch (error) {
      console.error(`Logo validation failed for ${logoPath}:`, error.message);

      this.sendSocketNotification('LOGO_VALIDATION_RESULT', {
        identifier: identifier,
        logoPath: logoPath,
        valid: false,
        error: error.message,
      });
    }
  },

  // Clean up resources
  stop: function () {
    console.log('Stopping node helper for: MMM-SahkokiltaBranding');

    // Close all file watchers
    for (const [identifier, watcher] of this.watchers) {
      try {
        watcher.close();
        console.log(`Closed file watcher for: ${identifier}`);
      } catch (error) {
        console.error(
          `Error closing file watcher for ${identifier}:`,
          error.message
        );
      }
    }

    this.watchers.clear();
    this.configs.clear();
  },
});
