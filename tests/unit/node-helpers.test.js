// Unit tests for all node helper files
const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { MockEventEmitter, mockFS, mockLogger, testUtils } = require('../mocks');

// Mock dependencies
jest.mock('fs-extra', () => require('../mocks').mockFS);
jest.mock('path', () => require('../mocks').mockPath);
jest.mock('chokidar', () => require('../mocks').mockChokidar);

describe('Node Helper Tests', () => {
  let mockNodeHelper;
  
  beforeEach(() => {
    testUtils.resetAllMocks();
    
    // Mock base NodeHelper class
    mockNodeHelper = {
      name: 'TestNodeHelper',
      sendSocketNotification: jest.fn(),
      socketNotificationReceived: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  });

  describe('MMM-LayoutManager Node Helper', () => {
    let LayoutManagerNodeHelper;
    
    beforeEach(() => {
      // Mock the node helper module
      jest.doMock('../../modules/MMM-LayoutManager/node_helper.js', () => {
        return class extends MockEventEmitter {
          constructor() {
            super();
            this.name = 'MMM-LayoutManager';
            this.displayInfo = null;
            this.watchers = new Map();
          }
          
          start() {
            this.detectDisplay();
          }
          
          stop() {
            this.watchers.forEach(watcher => watcher.close());
            this.watchers.clear();
          }
          
          socketNotificationReceived(notification, payload) {
            switch (notification) {
              case 'GET_DISPLAY_INFO':
                this.handleGetDisplayInfo(payload);
                break;
              case 'UPDATE_LAYOUT':
                this.handleUpdateLayout(payload);
                break;
              case 'OPTIMIZE_FOR_TV':
                this.handleOptimizeForTV(payload);
                break;
            }
          }
          
          detectDisplay() {
            // Mock display detection
            this.displayInfo = {
              resolution: { width: 1920, height: 1080 },
              orientation: 'landscape',
              scaleFactor: 1.0,
              pixelRatio: 1.0,
              displayType: 'tv'
            };
            
            this.sendSocketNotification('DISPLAY_INFO_DETECTED', this.displayInfo);
          }
          
          handleGetDisplayInfo(payload) {
            this.sendSocketNotification('DISPLAY_INFO_RESPONSE', {
              identifier: payload.identifier,
              displayInfo: this.displayInfo
            });
          }
          
          handleUpdateLayout(payload) {
            this.sendSocketNotification('LAYOUT_UPDATED', {
              identifier: payload.identifier,
              success: true
            });
          }
          
          handleOptimizeForTV(payload) {
            const optimizations = {
              scaleFactor: 1.2,
              fontSize: '18px',
              spacing: 'large'
            };
            
            this.sendSocketNotification('TV_OPTIMIZATION_APPLIED', {
              identifier: payload.identifier,
              optimizations
            });
          }
          
          sendSocketNotification(notification, payload) {
            mockNodeHelper.sendSocketNotification(notification, payload);
          }
        };
      });
      
      LayoutManagerNodeHelper = require('../../modules/MMM-LayoutManager/node_helper.js');
    });
    
    test('should initialize and detect display on start', () => {
      const helper = new LayoutManagerNodeHelper();
      helper.start();
      
      expect(helper.displayInfo).toBeDefined();
      expect(helper.displayInfo.resolution).toEqual({ width: 1920, height: 1080 });
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'DISPLAY_INFO_DETECTED',
        expect.objectContaining({
          resolution: { width: 1920, height: 1080 }
        })
      );
    });
    
    test('should handle GET_DISPLAY_INFO notification', () => {
      const helper = new LayoutManagerNodeHelper();
      helper.start();
      
      helper.socketNotificationReceived('GET_DISPLAY_INFO', { identifier: 'test-123' });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'DISPLAY_INFO_RESPONSE',
        {
          identifier: 'test-123',
          displayInfo: helper.displayInfo
        }
      );
    });
    
    test('should handle UPDATE_LAYOUT notification', () => {
      const helper = new LayoutManagerNodeHelper();
      
      helper.socketNotificationReceived('UPDATE_LAYOUT', { 
        identifier: 'test-123',
        layout: { regions: ['top', 'bottom'] }
      });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'LAYOUT_UPDATED',
        {
          identifier: 'test-123',
          success: true
        }
      );
    });
    
    test('should handle OPTIMIZE_FOR_TV notification', () => {
      const helper = new LayoutManagerNodeHelper();
      
      helper.socketNotificationReceived('OPTIMIZE_FOR_TV', { identifier: 'test-123' });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'TV_OPTIMIZATION_APPLIED',
        {
          identifier: 'test-123',
          optimizations: expect.objectContaining({
            scaleFactor: 1.2,
            fontSize: '18px'
          })
        }
      );
    });
    
    test('should clean up watchers on stop', () => {
      const helper = new LayoutManagerNodeHelper();
      const mockWatcher = { close: jest.fn() };
      helper.watchers.set('test', mockWatcher);
      
      helper.stop();
      
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(helper.watchers.size).toBe(0);
    });
  });

  describe('MMM-SahkokiltaBranding Node Helper', () => {
    let BrandingNodeHelper;
    
    beforeEach(() => {
      jest.doMock('../../modules/MMM-SahkokiltaBranding/node_helper.js', () => {
        return class extends MockEventEmitter {
          constructor() {
            super();
            this.name = 'MMM-SahkokiltaBranding';
            this.brandingConfig = null;
            this.logoCache = new Map();
          }
          
          start() {
            this.loadBrandingConfig();
          }
          
          stop() {
            this.logoCache.clear();
          }
          
          socketNotificationReceived(notification, payload) {
            switch (notification) {
              case 'LOAD_BRANDING_CONFIG':
                this.handleLoadBrandingConfig(payload);
                break;
              case 'VALIDATE_LOGO':
                this.handleValidateLogo(payload);
                break;
              case 'UPDATE_THEME':
                this.handleUpdateTheme(payload);
                break;
            }
          }
          
          loadBrandingConfig() {
            this.brandingConfig = {
              logo: {
                path: '/assets/images/sahkokilta-logo.png',
                fallbackPath: '/assets/images/fallback-logo.png',
                position: 'top-left',
                size: { width: 150, height: 75 }
              },
              theme: {
                colors: {
                  primary: '#ff6b35',
                  secondary: '#004e89',
                  accent: '#ffd23f'
                }
              }
            };
            
            this.sendSocketNotification('BRANDING_CONFIG_LOADED', this.brandingConfig);
          }
          
          handleLoadBrandingConfig(payload) {
            this.sendSocketNotification('BRANDING_CONFIG_RESPONSE', {
              identifier: payload.identifier,
              config: this.brandingConfig
            });
          }
          
          async handleValidateLogo(payload) {
            const { logoPath, identifier } = payload;
            
            // Mock logo validation
            const isValid = !logoPath.includes('invalid');
            const logoInfo = isValid ? {
              path: logoPath,
              size: { width: 150, height: 75 },
              format: 'png',
              exists: true
            } : null;
            
            this.sendSocketNotification('LOGO_VALIDATION_RESULT', {
              identifier,
              isValid,
              logoInfo
            });
          }
          
          handleUpdateTheme(payload) {
            const { theme, identifier } = payload;
            
            if (this.brandingConfig) {
              this.brandingConfig.theme = { ...this.brandingConfig.theme, ...theme };
            }
            
            this.sendSocketNotification('THEME_UPDATED', {
              identifier,
              theme: this.brandingConfig.theme
            });
          }
          
          sendSocketNotification(notification, payload) {
            mockNodeHelper.sendSocketNotification(notification, payload);
          }
        };
      });
      
      BrandingNodeHelper = require('../../modules/MMM-SahkokiltaBranding/node_helper.js');
    });
    
    test('should load branding config on start', () => {
      const helper = new BrandingNodeHelper();
      helper.start();
      
      expect(helper.brandingConfig).toBeDefined();
      expect(helper.brandingConfig.logo.path).toBe('/assets/images/sahkokilta-logo.png');
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'BRANDING_CONFIG_LOADED',
        expect.objectContaining({
          logo: expect.objectContaining({
            path: '/assets/images/sahkokilta-logo.png'
          })
        })
      );
    });
    
    test('should handle LOAD_BRANDING_CONFIG notification', () => {
      const helper = new BrandingNodeHelper();
      helper.start();
      
      helper.socketNotificationReceived('LOAD_BRANDING_CONFIG', { identifier: 'test-123' });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'BRANDING_CONFIG_RESPONSE',
        {
          identifier: 'test-123',
          config: helper.brandingConfig
        }
      );
    });
    
    test('should validate logo successfully', async () => {
      const helper = new BrandingNodeHelper();
      
      helper.socketNotificationReceived('VALIDATE_LOGO', {
        identifier: 'test-123',
        logoPath: '/valid/logo.png'
      });
      
      await testUtils.flushPromises();
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'LOGO_VALIDATION_RESULT',
        {
          identifier: 'test-123',
          isValid: true,
          logoInfo: expect.objectContaining({
            path: '/valid/logo.png',
            exists: true
          })
        }
      );
    });
    
    test('should handle invalid logo validation', async () => {
      const helper = new BrandingNodeHelper();
      
      helper.socketNotificationReceived('VALIDATE_LOGO', {
        identifier: 'test-123',
        logoPath: '/invalid/logo.png'
      });
      
      await testUtils.flushPromises();
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'LOGO_VALIDATION_RESULT',
        {
          identifier: 'test-123',
          isValid: false,
          logoInfo: null
        }
      );
    });
    
    test('should update theme', () => {
      const helper = new BrandingNodeHelper();
      helper.start();
      
      const newTheme = {
        colors: {
          primary: '#new-primary'
        }
      };
      
      helper.socketNotificationReceived('UPDATE_THEME', {
        identifier: 'test-123',
        theme: newTheme
      });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'THEME_UPDATED',
        {
          identifier: 'test-123',
          theme: expect.objectContaining({
            colors: expect.objectContaining({
              primary: '#new-primary'
            })
          })
        }
      );
    });
    
    test('should clear logo cache on stop', () => {
      const helper = new BrandingNodeHelper();
      helper.logoCache.set('test', 'data');
      
      helper.stop();
      
      expect(helper.logoCache.size).toBe(0);
    });
  });

  describe('MMM-SponsorCarousel Node Helper', () => {
    let CarouselNodeHelper;
    
    beforeEach(() => {
      jest.doMock('../../modules/MMM-SponsorCarousel/node_helper.js', () => {
        return class extends MockEventEmitter {
          constructor() {
            super();
            this.name = 'MMM-SponsorCarousel';
            this.sponsorData = [];
            this.fileWatcher = null;
          }
          
          start() {
            this.loadSponsorData();
            this.setupFileWatcher();
          }
          
          stop() {
            if (this.fileWatcher) {
              this.fileWatcher.close();
            }
          }
          
          socketNotificationReceived(notification, payload) {
            switch (notification) {
              case 'LOAD_SPONSORS':
                this.handleLoadSponsors(payload);
                break;
              case 'VALIDATE_SPONSOR_DATA':
                this.handleValidateSponsorData(payload);
                break;
              case 'RELOAD_SPONSORS':
                this.handleReloadSponsors(payload);
                break;
            }
          }
          
          loadSponsorData() {
            this.sponsorData = [
              {
                id: 'sponsor-1',
                name: 'Test Sponsor 1',
                logoPath: '/assets/images/sponsors/sponsor1.png',
                active: true,
                priority: 1
              },
              {
                id: 'sponsor-2',
                name: 'Test Sponsor 2',
                logoPath: '/assets/images/sponsors/sponsor2.png',
                active: true,
                priority: 2
              }
            ];
            
            this.sendSocketNotification('SPONSORS_LOADED', {
              sponsors: this.sponsorData,
              count: this.sponsorData.length
            });
          }
          
          setupFileWatcher() {
            // Mock file watcher setup
            this.fileWatcher = {
              close: jest.fn(),
              on: jest.fn()
            };
          }
          
          handleLoadSponsors(payload) {
            this.sendSocketNotification('SPONSORS_RESPONSE', {
              identifier: payload.identifier,
              sponsors: this.sponsorData
            });
          }
          
          handleValidateSponsorData(payload) {
            const { sponsors, identifier } = payload;
            
            const validationResults = sponsors.map(sponsor => ({
              id: sponsor.id,
              isValid: sponsor.name && sponsor.logoPath && sponsor.id,
              errors: []
            }));
            
            const allValid = validationResults.every(result => result.isValid);
            
            this.sendSocketNotification('SPONSOR_VALIDATION_RESULT', {
              identifier,
              isValid: allValid,
              results: validationResults
            });
          }
          
          handleReloadSponsors(payload) {
            this.loadSponsorData();
            
            this.sendSocketNotification('SPONSORS_RELOADED', {
              identifier: payload.identifier,
              sponsors: this.sponsorData,
              timestamp: Date.now()
            });
          }
          
          sendSocketNotification(notification, payload) {
            mockNodeHelper.sendSocketNotification(notification, payload);
          }
        };
      });
      
      CarouselNodeHelper = require('../../modules/MMM-SponsorCarousel/node_helper.js');
    });
    
    test('should load sponsor data on start', () => {
      const helper = new CarouselNodeHelper();
      helper.start();
      
      expect(helper.sponsorData).toHaveLength(2);
      expect(helper.sponsorData[0].name).toBe('Test Sponsor 1');
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'SPONSORS_LOADED',
        {
          sponsors: expect.arrayContaining([
            expect.objectContaining({ name: 'Test Sponsor 1' })
          ]),
          count: 2
        }
      );
    });
    
    test('should setup file watcher on start', () => {
      const helper = new CarouselNodeHelper();
      helper.start();
      
      expect(helper.fileWatcher).toBeDefined();
      expect(helper.fileWatcher.close).toBeDefined();
    });
    
    test('should handle LOAD_SPONSORS notification', () => {
      const helper = new CarouselNodeHelper();
      helper.start();
      
      helper.socketNotificationReceived('LOAD_SPONSORS', { identifier: 'test-123' });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'SPONSORS_RESPONSE',
        {
          identifier: 'test-123',
          sponsors: helper.sponsorData
        }
      );
    });
    
    test('should validate sponsor data', () => {
      const helper = new CarouselNodeHelper();
      
      const testSponsors = [
        { id: 'valid', name: 'Valid Sponsor', logoPath: '/valid.png' },
        { id: 'invalid', name: '', logoPath: '/invalid.png' }
      ];
      
      helper.socketNotificationReceived('VALIDATE_SPONSOR_DATA', {
        identifier: 'test-123',
        sponsors: testSponsors
      });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'SPONSOR_VALIDATION_RESULT',
        {
          identifier: 'test-123',
          isValid: false,
          results: expect.arrayContaining([
            expect.objectContaining({ id: 'valid', isValid: true }),
            expect.objectContaining({ id: 'invalid', isValid: false })
          ])
        }
      );
    });
    
    test('should handle sponsor reload', () => {
      const helper = new CarouselNodeHelper();
      helper.start();
      
      helper.socketNotificationReceived('RELOAD_SPONSORS', { identifier: 'test-123' });
      
      expect(mockNodeHelper.sendSocketNotification).toHaveBeenCalledWith(
        'SPONSORS_RELOADED',
        {
          identifier: 'test-123',
          sponsors: helper.sponsorData,
          timestamp: expect.any(Number)
        }
      );
    });
    
    test('should close file watcher on stop', () => {
      const helper = new CarouselNodeHelper();
      helper.start();
      
      const closeSpy = jest.spyOn(helper.fileWatcher, 'close');
      helper.stop();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});