# Configuration System Documentation

## Overview

The Configuration System provides a robust, schema-validated approach to managing configuration files for the Sähkökilta Advertisement TV project. It supports JSON configuration files with comprehensive validation, caching, and error handling.

## Features

- **Schema Validation**: All configurations are validated against JSON schemas
- **Multiple Configuration Types**: Support for branding, sponsors, and system configurations
- **Caching**: Intelligent caching system for improved performance
- **Error Handling**: Comprehensive error handling with detailed validation messages
- **Default Values**: Built-in default configurations for all types
- **File Watching**: Ready for integration with file watching systems

## Configuration Types

### 1. Branding Configuration (`branding-config`)

Controls the visual identity and theming of the application.

**Schema**: `schemas/branding-config.schema.json`
**Example**: `config/branding.json`

```json
{
  "logo": {
    "path": "assets/images/sahkokilta-logo.png",
    "fallbackPath": "assets/images/sahkokilta-logo-fallback.png",
    "position": "top-left",
    "size": { "width": 200, "height": 100 },
    "alt": "Sähkökilta ry Logo"
  },
  "theme": {
    "colors": {
      "primary": "#FF6B35",
      "secondary": "#004E89",
      "accent": "#FFD23F",
      "background": "#FFFFFF",
      "text": "#333333"
    },
    "fonts": {
      "primary": "Arial, sans-serif",
      "secondary": "Georgia, serif"
    }
  },
  "layout": {
    "logoRegion": ".logo-region",
    "backgroundStyle": "solid"
  }
}
```

### 2. Sponsors Configuration (`sponsors-config`)

Manages sponsor information and carousel settings.

**Schema**: `schemas/sponsors-config.schema.json`
**Example**: `config/sponsors.json`

```json
{
  "sponsors": [
    {
      "id": "example-sponsor-1",
      "name": "Example Technology Corp",
      "logoPath": "assets/images/sponsors/example-tech-logo.png",
      "displayDuration": 12000,
      "priority": 8,
      "active": true,
      "metadata": {
        "addedDate": "2024-01-15T10:00:00Z",
        "expiryDate": "2024-12-31T23:59:59Z",
        "contactInfo": "contact@exampletech.com"
      }
    }
  ],
  "settings": {
    "defaultDuration": 10000,
    "transitionType": "fade",
    "transitionDuration": 1000,
    "shuffleOrder": false,
    "respectPriority": true
  }
}
```

### 3. System Configuration (`system-config`)

Controls system-level settings and performance parameters.

**Schema**: `schemas/system-config.schema.json`
**Example**: `config/system.json`

```json
{
  "display": {
    "resolution": { "width": 1920, "height": 1080 },
    "orientation": "landscape",
    "scaleFactor": 1.0,
    "fullscreen": true
  },
  "performance": {
    "refreshRate": 60,
    "memoryLimit": "512MB",
    "cpuThreshold": 80
  },
  "logging": {
    "level": "info",
    "logPath": "./logs",
    "maxFileSize": "10MB",
    "maxFiles": 5
  }
}
```

## Usage

### Basic Usage

```javascript
const ConfigurationService = require('./services/ConfigurationService');

async function loadConfiguration() {
  // Initialize the service
  const configService = new ConfigurationService();
  await configService.initialize();

  // Load and validate a configuration file
  const brandingConfig = await configService.loadConfiguration(
    'config/branding.json',
    'branding-config'
  );

  console.log('Logo path:', brandingConfig.logo.path);
}
```

### Validation

```javascript
// Validate configuration without loading from file
const validationResult = configService.validateConfiguration(
  configObject,
  'branding-config'
);

if (!validationResult.valid) {
  console.error('Validation errors:', validationResult.errors);
}
```

### Caching

```javascript
// Load with caching (default)
const config1 = await configService.loadConfiguration(
  'config/branding.json',
  'branding-config',
  true
);

// Force reload from file
const config2 = await configService.loadConfiguration(
  'config/branding.json',
  'branding-config',
  false
);

// Clear cache
configService.clearCache('config/branding.json');
```

### Saving Configuration

```javascript
// Save validated configuration
await configService.saveConfiguration(
  'config/new-branding.json',
  brandingConfig,
  'branding-config'
);
```

### Default Configurations

```javascript
// Get default configuration for any schema
const defaults = configService.getDefaultConfiguration('branding-config');
```

## API Reference

### ConfigurationService

#### Methods

- `initialize()`: Initialize the service and load schemas
- `loadConfiguration(configPath, schemaKey, useCache)`: Load and validate configuration
- `validateConfiguration(config, schemaKey)`: Validate configuration object
- `saveConfiguration(configPath, config, schemaKey)`: Save validated configuration
- `getDefaultConfiguration(schemaKey)`: Get default configuration
- `clearCache(configPath)`: Clear configuration cache
- `configExists(configPath)`: Check if configuration file exists
- `getAvailableSchemas()`: Get list of available schema keys

#### Events

The ConfigurationService is designed to work with file watchers and can be extended to emit events for configuration changes.

## Error Handling

The configuration system provides detailed error messages for common scenarios:

### Validation Errors
```
Configuration validation failed: /logo: must have required property 'position', /theme/colors/primary: must match pattern "^#[0-9A-Fa-f]{6}$"
```

### File Errors
```
Configuration file not found: /path/to/config.json
```

### Schema Errors
```
Schema not found: unknown-schema-key
```

## Testing

Run the configuration system tests:

```bash
npm test -- tests/unit/ConfigurationService.test.js
```

Run the demo script:

```bash
node examples/configuration-demo.js
```

## Schema Development

When adding new configuration types:

1. Create a JSON schema in `schemas/` directory
2. Add the schema to the `loadSchemas()` method
3. Add default configuration in `getDefaultConfiguration()`
4. Create sample configuration file in `config/` directory
5. Add unit tests for the new configuration type

## Dependencies

- `ajv`: JSON schema validation
- `ajv-formats`: Additional format validators for AJV
- `fs/promises`: File system operations

## Performance Considerations

- Configurations are cached after first load
- Schema validation is performed on every load (cached or not)
- File existence is checked before attempting to read
- Large configuration files should be split into smaller, focused files

## Security Considerations

- All configuration files are validated against strict schemas
- File paths are resolved to prevent directory traversal
- Invalid configurations are rejected before processing
- Error messages don't expose sensitive file system information