/* MagicMirror² Configuration for Sähkökilta ry Advertisement TV
 *
 * This configuration sets up a professional advertisement display system
 * with guild branding, sponsor carousel, and optimized layout management.
 * 
 * For more information on MagicMirror² configuration:
 * https://docs.magicmirror.builders/configuration/introduction.html
 */

const path = require('path');

let config = {
  // Network Configuration
  address: '0.0.0.0', // Listen on all interfaces for Raspberry Pi deployment
  port: 8080,
  basePath: '/',
  ipWhitelist: [], // Allow all IP addresses for kiosk mode
  
  // Security Configuration
  useHttps: false,
  httpsPrivateKey: '',
  httpsCertificate: '',
  
  // Localization
  language: 'en',
  locale: 'en-US',
  timeFormat: 24,
  units: 'metric',
  
  // Logging Configuration
  logLevel: ['INFO', 'LOG', 'WARN', 'ERROR'], // Production logging
  
  // Performance Configuration for Raspberry Pi
  electronOptions: {
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  },
  
  // Custom CSS for global styling
  customCss: path.resolve(__dirname, 'css/custom.css'),
  
  // Module Configuration with Communication Setup
  modules: [
    // Layout Manager - Must load first to set up display optimization
    {
      module: 'MMM-LayoutManager',
      position: 'fullscreen_below',
      header: '',
      config: {
        configPath: 'config/system.json',
        displayMode: 'tv',
        enableAutoDetection: true,
        communicationChannels: {
          displayInfo: 'DISPLAY_INFO_UPDATED',
          layoutChange: 'LAYOUT_CHANGED',
          performanceAlert: 'PERFORMANCE_ALERT'
        },
        dependencies: [], // No dependencies, loads first
        priority: 1 // Highest priority
      }
    },
    
    // Branding Module - Loads after layout manager
    {
      module: 'MMM-SahkokiltaBranding',
      position: 'top_left',
      header: '',
      config: {
        configPath: 'config/branding.json',
        updateInterval: 60000,
        enableHotReload: true,
        communicationChannels: {
          themeUpdate: 'THEME_UPDATED',
          brandingReady: 'BRANDING_READY',
          logoStatus: 'LOGO_STATUS_CHANGED'
        },
        dependencies: ['MMM-LayoutManager'],
        priority: 2,
        // Module communication settings
        shareThemeGlobally: true,
        notifyOtherModules: true
      }
    },
    
    // Sponsor Carousel - Loads after branding and layout
    {
      module: 'MMM-SponsorCarousel',
      position: 'middle_center',
      header: '',
      config: {
        configPath: 'config/sponsors.json',
        updateInterval: 30000,
        enableHotReload: true,
        communicationChannels: {
          carouselUpdate: 'CAROUSEL_UPDATED',
          sponsorChange: 'SPONSOR_CHANGED',
          carouselReady: 'CAROUSEL_READY'
        },
        dependencies: ['MMM-LayoutManager', 'MMM-SahkokiltaBranding'],
        priority: 3,
        // Performance optimization
        preloadImages: true,
        maxCacheSize: '50MB',
        // Responsive behavior
        adaptToLayout: true,
        respectTheme: true
      }
    }
  ],
  
  // Global Module Communication Configuration
  moduleDefaults: {
    // Default communication settings for all modules
    enableCommunication: true,
    communicationTimeout: 5000,
    retryAttempts: 3,
    
    // Default error handling
    errorHandling: {
      enableGracefulDegradation: true,
      fallbackBehavior: 'continue',
      logErrors: true
    },
    
    // Default performance settings
    performance: {
      enableLazyLoading: true,
      enableCaching: true,
      maxMemoryUsage: '100MB'
    }
  },
  
  // Application Lifecycle Configuration
  lifecycle: {
    // Startup sequence configuration
    startup: {
      enableSplashScreen: false,
      moduleLoadTimeout: 10000,
      dependencyCheckTimeout: 5000,
      initializationDelay: 1000
    },
    
    // Shutdown configuration
    shutdown: {
      enableGracefulShutdown: true,
      shutdownTimeout: 5000,
      cleanupModules: true,
      saveState: false
    },
    
    // Error recovery configuration
    errorRecovery: {
      enableAutoRestart: true,
      maxRestartAttempts: 3,
      restartDelay: 5000,
      enableModuleIsolation: true
    }
  },
  
  // Development and Debug Configuration
  debug: {
    enableModuleDebug: false,
    enablePerformanceMonitoring: true,
    enableCommunicationLogging: false,
    enableMemoryTracking: true
  }
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config;
}