const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Configuration service for loading and validating configuration files
 * Supports JSON and YAML formats with schema validation
 */
class ConfigurationService {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.schemas = new Map();
    this.configCache = new Map();
    this.watchers = new Map();
  }

  /**
   * Initialize the configuration service by loading schemas
   */
  async initialize() {
    try {
      await this.loadSchemas();
    } catch (error) {
      throw new Error(`Failed to initialize ConfigurationService: ${error.message}`);
    }
  }

  /**
   * Load all JSON schemas from the schemas directory
   */
  async loadSchemas() {
    const schemaDir = path.join(__dirname, '../schemas');
    const schemaFiles = [
      'branding-config.schema.json',
      'sponsors-config.schema.json',
      'system-config.schema.json'
    ];

    for (const schemaFile of schemaFiles) {
      try {
        const schemaPath = path.join(schemaDir, schemaFile);
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        
        const schemaKey = schemaFile.replace('.schema.json', '');
        this.schemas.set(schemaKey, schema);
        this.ajv.addSchema(schema, schemaKey);
      } catch (error) {
        throw new Error(`Failed to load schema ${schemaFile}: ${error.message}`);
      }
    }
  }

  /**
   * Load and validate a configuration file
   * @param {string} configPath - Path to the configuration file
   * @param {string} schemaKey - Schema key for validation
   * @param {boolean} useCache - Whether to use cached version if available
   * @returns {Promise<Object>} Validated configuration object
   */
  async loadConfiguration(configPath, schemaKey, useCache = true) {
    const absolutePath = path.resolve(configPath);
    const cacheKey = `${absolutePath}:${schemaKey}`;

    // Return cached version if available and requested
    if (useCache && this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    try {
      // Check if file exists
      await fs.access(absolutePath);
      
      // Read and parse configuration file
      const configContent = await fs.readFile(absolutePath, 'utf8');
      let config;
      
      if (absolutePath.endsWith('.json')) {
        config = JSON.parse(configContent);
      } else if (absolutePath.endsWith('.yaml') || absolutePath.endsWith('.yml')) {
        // Note: YAML support would require js-yaml dependency
        throw new Error('YAML support not implemented yet');
      } else {
        throw new Error(`Unsupported file format: ${path.extname(absolutePath)}`);
      }

      // Validate against schema
      const validationResult = this.validateConfiguration(config, schemaKey);
      if (!validationResult.valid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Cache the validated configuration
      this.configCache.set(cacheKey, config);
      
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${absolutePath}`);
      }
      throw error;
    }
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration object to validate
   * @param {string} schemaKey - Schema key for validation
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateConfiguration(config, schemaKey) {
    if (!this.schemas.has(schemaKey)) {
      return {
        valid: false,
        errors: [`Schema not found: ${schemaKey}`]
      };
    }

    const validate = this.ajv.getSchema(schemaKey);
    const valid = validate(config);
    
    if (!valid) {
      const errors = validate.errors.map(error => {
        const instancePath = error.instancePath || 'root';
        return `${instancePath}: ${error.message}`;
      });
      
      return {
        valid: false,
        errors
      };
    }

    return {
      valid: true,
      errors: []
    };
  }

  /**
   * Get default configuration for a given schema
   * @param {string} schemaKey - Schema key
   * @returns {Object} Default configuration object
   */
  getDefaultConfiguration(schemaKey) {
    const defaults = {
      'branding-config': {
        logo: {
          path: 'assets/images/sahkokilta-logo.png',
          fallbackPath: 'assets/images/sahkokilta-logo-fallback.png',
          position: 'top-left',
          size: { width: 200, height: 100 },
          alt: 'Sähkökilta ry Logo'
        },
        theme: {
          colors: {
            primary: '#FF6B35',
            secondary: '#004E89',
            accent: '#FFD23F',
            background: '#FFFFFF',
            text: '#333333'
          },
          fonts: {
            primary: 'Arial, sans-serif',
            secondary: 'Georgia, serif'
          }
        },
        layout: {
          logoRegion: '.logo-region',
          backgroundStyle: 'solid'
        }
      },
      'sponsors-config': {
        sponsors: [],
        settings: {
          defaultDuration: 10000,
          transitionType: 'fade',
          transitionDuration: 1000,
          shuffleOrder: false,
          respectPriority: true
        }
      },
      'system-config': {
        display: {
          resolution: { width: 1920, height: 1080 },
          orientation: 'landscape',
          scaleFactor: 1.0,
          fullscreen: true
        },
        performance: {
          refreshRate: 60,
          memoryLimit: '512MB',
          cpuThreshold: 80
        },
        logging: {
          level: 'info',
          logPath: './logs',
          maxFileSize: '10MB',
          maxFiles: 5
        }
      }
    };

    return defaults[schemaKey] || {};
  }

  /**
   * Save configuration to file
   * @param {string} configPath - Path to save configuration
   * @param {Object} config - Configuration object to save
   * @param {string} schemaKey - Schema key for validation
   */
  async saveConfiguration(configPath, config, schemaKey) {
    // Validate before saving
    const validationResult = this.validateConfiguration(config, schemaKey);
    if (!validationResult.valid) {
      throw new Error(`Cannot save invalid configuration: ${validationResult.errors.join(', ')}`);
    }

    try {
      const absolutePath = path.resolve(configPath);
      const configContent = JSON.stringify(config, null, 2);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      
      // Write configuration file
      await fs.writeFile(absolutePath, configContent, 'utf8');
      
      // Update cache
      const cacheKey = `${absolutePath}:${schemaKey}`;
      this.configCache.set(cacheKey, config);
      
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Clear configuration cache
   * @param {string} configPath - Optional specific path to clear, or clear all if not provided
   */
  clearCache(configPath = null) {
    if (configPath) {
      const absolutePath = path.resolve(configPath);
      for (const [key] of this.configCache) {
        if (key.startsWith(absolutePath)) {
          this.configCache.delete(key);
        }
      }
    } else {
      this.configCache.clear();
    }
  }

  /**
   * Get available schema keys
   * @returns {Array<string>} Array of available schema keys
   */
  getAvailableSchemas() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Check if a configuration file exists
   * @param {string} configPath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async configExists(configPath) {
    try {
      await fs.access(path.resolve(configPath));
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ConfigurationService;