const fs = require('fs').promises;
const path = require('path');
const ConfigurationService = require('../../services/ConfigurationService');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('ConfigurationService', () => {
  let configService;
  const mockSchemaDir = path.join(__dirname, '../../schemas');

  beforeEach(async () => {
    configService = new ConfigurationService();
    
    // Mock schema files
    const mockBrandingSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        logo: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            position: { type: 'string', enum: ['top-left', 'top-center', 'top-right'] }
          },
          required: ['path', 'position']
        }
      },
      required: ['logo']
    };

    const mockSponsorsSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        sponsors: { type: 'array' },
        settings: { type: 'object' }
      },
      required: ['sponsors', 'settings']
    };

    const mockSystemSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        display: { type: 'object' },
        performance: { type: 'object' }
      },
      required: ['display', 'performance']
    };

    // Mock fs.readFile for schema loading
    fs.readFile.mockImplementation((filePath) => {
      if (filePath.includes('branding-config.schema.json')) {
        return Promise.resolve(JSON.stringify(mockBrandingSchema));
      }
      if (filePath.includes('sponsors-config.schema.json')) {
        return Promise.resolve(JSON.stringify(mockSponsorsSchema));
      }
      if (filePath.includes('system-config.schema.json')) {
        return Promise.resolve(JSON.stringify(mockSystemSchema));
      }
      return Promise.reject(new Error('File not found'));
    });

    await configService.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize successfully and load schemas', async () => {
      const newService = new ConfigurationService();
      await expect(newService.initialize()).resolves.not.toThrow();
      expect(newService.getAvailableSchemas()).toContain('branding-config');
      expect(newService.getAvailableSchemas()).toContain('sponsors-config');
      expect(newService.getAvailableSchemas()).toContain('system-config');
    });

    test('should throw error if schema loading fails', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('Schema file not found'));
      const newService = new ConfigurationService();
      await expect(newService.initialize()).rejects.toThrow('Failed to initialize ConfigurationService');
    });
  });

  describe('loadConfiguration', () => {
    test('should load and validate valid configuration', async () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      fs.access.mockResolvedValueOnce();
      fs.readFile.mockResolvedValueOnce(JSON.stringify(validConfig));

      const result = await configService.loadConfiguration('test-config.json', 'branding-config');
      expect(result).toEqual(validConfig);
    });

    test('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        logo: {
          path: 'test-logo.png'
          // missing required 'position' field
        }
      };

      fs.access.mockResolvedValueOnce();
      fs.readFile.mockResolvedValueOnce(JSON.stringify(invalidConfig));

      await expect(
        configService.loadConfiguration('test-config.json', 'branding-config')
      ).rejects.toThrow('Configuration validation failed');
    });

    test('should throw error for non-existent file', async () => {
      fs.access.mockRejectedValueOnce({ code: 'ENOENT' });

      await expect(
        configService.loadConfiguration('non-existent.json', 'branding-config')
      ).rejects.toThrow('Configuration file not found');
    });

    test('should throw error for invalid JSON', async () => {
      fs.access.mockResolvedValueOnce();
      fs.readFile.mockResolvedValueOnce('invalid json content');

      await expect(
        configService.loadConfiguration('invalid.json', 'branding-config')
      ).rejects.toThrow();
    });

    test('should return cached configuration when useCache is true', async () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      fs.access.mockResolvedValue();
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('test-config.json')) {
          return Promise.resolve(JSON.stringify(validConfig));
        }
        // Return schema content for other files
        if (filePath.includes('branding-config.schema.json')) {
          return Promise.resolve(JSON.stringify({
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
              logo: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  position: { type: 'string', enum: ['top-left', 'top-center', 'top-right'] }
                },
                required: ['path', 'position']
              }
            },
            required: ['logo']
          }));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Clear call count from initialization
      const initialCallCount = fs.readFile.mock.calls.length;
      
      // First call should read from file
      await configService.loadConfiguration('test-config.json', 'branding-config');
      
      // Second call should use cache
      const result = await configService.loadConfiguration('test-config.json', 'branding-config', true);
      
      // Should only have one additional call for the config file (not counting schema loads)
      const configFileCalls = fs.readFile.mock.calls.filter(call => call[0].includes('test-config.json'));
      expect(configFileCalls).toHaveLength(1);
      expect(result).toEqual(validConfig);
    });
  });

  describe('validateConfiguration', () => {
    test('should validate correct configuration', () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      const result = configService.validateConfiguration(validConfig, 'branding-config');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return validation errors for invalid configuration', () => {
      const invalidConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'invalid-position'
        }
      };

      const result = configService.validateConfiguration(invalidConfig, 'branding-config');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return error for unknown schema', () => {
      const config = {};
      const result = configService.validateConfiguration(config, 'unknown-schema');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema not found: unknown-schema');
    });
  });

  describe('saveConfiguration', () => {
    test('should save valid configuration', async () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();

      await expect(
        configService.saveConfiguration('test-config.json', validConfig, 'branding-config')
      ).resolves.not.toThrow();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(validConfig, null, 2),
        'utf8'
      );
    });

    test('should throw error when saving invalid configuration', async () => {
      const invalidConfig = {
        logo: {
          path: 'test-logo.png'
          // missing required 'position' field
        }
      };

      await expect(
        configService.saveConfiguration('test-config.json', invalidConfig, 'branding-config')
      ).rejects.toThrow('Cannot save invalid configuration');
    });
  });

  describe('getDefaultConfiguration', () => {
    test('should return default configuration for branding-config', () => {
      const defaults = configService.getDefaultConfiguration('branding-config');
      expect(defaults).toHaveProperty('logo');
      expect(defaults).toHaveProperty('theme');
      expect(defaults).toHaveProperty('layout');
    });

    test('should return default configuration for sponsors-config', () => {
      const defaults = configService.getDefaultConfiguration('sponsors-config');
      expect(defaults).toHaveProperty('sponsors');
      expect(defaults).toHaveProperty('settings');
    });

    test('should return default configuration for system-config', () => {
      const defaults = configService.getDefaultConfiguration('system-config');
      expect(defaults).toHaveProperty('display');
      expect(defaults).toHaveProperty('performance');
      expect(defaults).toHaveProperty('logging');
    });

    test('should return empty object for unknown schema', () => {
      const defaults = configService.getDefaultConfiguration('unknown-schema');
      expect(defaults).toEqual({});
    });
  });

  describe('clearCache', () => {
    test('should clear specific configuration from cache', async () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      fs.access.mockResolvedValue();
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('test-config.json')) {
          return Promise.resolve(JSON.stringify(validConfig));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Load configuration to populate cache
      await configService.loadConfiguration('test-config.json', 'branding-config');
      
      // Count calls to config file before clearing cache
      const callsBeforeClear = fs.readFile.mock.calls.filter(call => call[0].includes('test-config.json')).length;
      
      // Clear specific cache
      configService.clearCache('test-config.json');
      
      // Next load should read from file again
      await configService.loadConfiguration('test-config.json', 'branding-config');
      
      // Should have made two calls to the config file
      const totalConfigCalls = fs.readFile.mock.calls.filter(call => call[0].includes('test-config.json')).length;
      expect(totalConfigCalls).toBe(2);
    });

    test('should clear all cache when no path specified', async () => {
      const validConfig = {
        logo: {
          path: 'test-logo.png',
          position: 'top-left'
        }
      };

      fs.access.mockResolvedValue();
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('test-config.json')) {
          return Promise.resolve(JSON.stringify(validConfig));
        }
        return Promise.reject(new Error('File not found'));
      });

      // Load configuration to populate cache
      await configService.loadConfiguration('test-config.json', 'branding-config');
      
      // Clear all cache
      configService.clearCache();
      
      // Next load should read from file again
      await configService.loadConfiguration('test-config.json', 'branding-config');
      
      // Should have made two calls to the config file
      const totalConfigCalls = fs.readFile.mock.calls.filter(call => call[0].includes('test-config.json')).length;
      expect(totalConfigCalls).toBe(2);
    });
  });

  describe('configExists', () => {
    test('should return true for existing file', async () => {
      fs.access.mockResolvedValueOnce();
      const exists = await configService.configExists('existing-config.json');
      expect(exists).toBe(true);
    });

    test('should return false for non-existing file', async () => {
      fs.access.mockRejectedValueOnce(new Error('File not found'));
      const exists = await configService.configExists('non-existing-config.json');
      expect(exists).toBe(false);
    });
  });
});