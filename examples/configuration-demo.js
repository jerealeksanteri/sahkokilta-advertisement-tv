#!/usr/bin/env node

/**
 * Configuration Service Demo
 * 
 * This script demonstrates how to use the ConfigurationService
 * to load, validate, and manage configuration files.
 */

const path = require('path');
const ConfigurationService = require('../services/ConfigurationService');

async function demonstrateConfigurationService() {
  console.log('🚀 Configuration Service Demo\n');

  try {
    // Initialize the configuration service
    console.log('1. Initializing ConfigurationService...');
    const configService = new ConfigurationService();
    await configService.initialize();
    console.log('✅ ConfigurationService initialized successfully\n');

    // Show available schemas
    console.log('2. Available configuration schemas:');
    const schemas = configService.getAvailableSchemas();
    schemas.forEach(schema => console.log(`   - ${schema}`));
    console.log('');

    // Load and validate branding configuration
    console.log('3. Loading branding configuration...');
    const brandingConfigPath = path.join(__dirname, '../config/branding.json');
    
    if (await configService.configExists(brandingConfigPath)) {
      const brandingConfig = await configService.loadConfiguration(
        brandingConfigPath, 
        'branding-config'
      );
      console.log('✅ Branding configuration loaded and validated successfully');
      console.log(`   Logo path: ${brandingConfig.logo.path}`);
      console.log(`   Primary color: ${brandingConfig.theme.colors.primary}`);
      console.log(`   Logo position: ${brandingConfig.logo.position}\n`);
    } else {
      console.log('⚠️  Branding configuration file not found\n');
    }

    // Load and validate sponsors configuration
    console.log('4. Loading sponsors configuration...');
    const sponsorsConfigPath = path.join(__dirname, '../config/sponsors.json');
    
    if (await configService.configExists(sponsorsConfigPath)) {
      const sponsorsConfig = await configService.loadConfiguration(
        sponsorsConfigPath, 
        'sponsors-config'
      );
      console.log('✅ Sponsors configuration loaded and validated successfully');
      console.log(`   Number of sponsors: ${sponsorsConfig.sponsors.length}`);
      console.log(`   Active sponsors: ${sponsorsConfig.sponsors.filter(s => s.active).length}`);
      console.log(`   Default duration: ${sponsorsConfig.settings.defaultDuration}ms\n`);
    } else {
      console.log('⚠️  Sponsors configuration file not found\n');
    }

    // Load and validate system configuration
    console.log('5. Loading system configuration...');
    const systemConfigPath = path.join(__dirname, '../config/system.json');
    
    if (await configService.configExists(systemConfigPath)) {
      const systemConfig = await configService.loadConfiguration(
        systemConfigPath, 
        'system-config'
      );
      console.log('✅ System configuration loaded and validated successfully');
      console.log(`   Resolution: ${systemConfig.display.resolution.width}x${systemConfig.display.resolution.height}`);
      console.log(`   Orientation: ${systemConfig.display.orientation}`);
      console.log(`   Log level: ${systemConfig.logging.level}\n`);
    } else {
      console.log('⚠️  System configuration file not found\n');
    }

    // Demonstrate validation with invalid configuration
    console.log('6. Testing validation with invalid configuration...');
    const invalidConfig = {
      logo: {
        path: 'test-logo.png'
        // Missing required 'position' field
      }
    };
    
    const validationResult = configService.validateConfiguration(invalidConfig, 'branding-config');
    if (!validationResult.valid) {
      console.log('✅ Validation correctly caught invalid configuration:');
      validationResult.errors.forEach(error => console.log(`   - ${error}`));
      console.log('');
    }

    // Show default configurations
    console.log('7. Default configurations available:');
    schemas.forEach(schema => {
      const defaults = configService.getDefaultConfiguration(schema);
      console.log(`   - ${schema}: ${Object.keys(defaults).length} properties`);
    });
    console.log('');

    console.log('🎉 Configuration Service demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  demonstrateConfigurationService();
}

module.exports = { demonstrateConfigurationService };