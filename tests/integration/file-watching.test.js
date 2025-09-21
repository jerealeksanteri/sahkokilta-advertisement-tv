// Integration tests for file watching and hot-reloading functionality
const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');

// Mock dependencies
jest.mock('chokidar');
jest.mock('fs-extra');

describe('File Watching and Hot-Reloading Integration Tests', () => {
  let mockWatcher;
  let mockContentService;
  let testConfigDir;
  let originalConsoleLog;

  beforeEach(() => {
    // Set up test environment
    testConfigDir = path.join(__dirname, 'test-config');
    
    // Mock chokidar watcher
    mockWatcher = new EventEmitter();
    mockWatcher.close = jest.fn();
    mockWatcher.add = jest.fn();
    mockWatcher.unwatch = jest.fn();
    
    chokidar.watch.mockReturnValue(mockWatcher);
    
    // Mock fs-extra
    fs.ensureDir.mockResolvedValue();
    fs.readFile.mockResolvedValue('{"test": "data"}');
    fs.writeFile.mockResolvedValue();
    fs.pathExists.mockResolvedValue(true);
    
    // Mock ContentService
    mockContentService = {
      loadConfiguration: jest.fn().mockResolvedValue({ success: true, data: {} }),
      validateContent: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      emit: jest.fn(),
      on: jest.fn(),
      watchers: new Map(),
      debounceTimers: new Map(),
      
      setupFileWatcher: function(configPath, callback) {
        const watcher = chokidar.watch(configPath, {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true
        });
        
        this.watchers.set(configPath, watcher);
        
        watcher.on('change', (filePath) => {
          this.handleFileChange(filePath, callback);
        });
        
        watcher.on('add', (filePath) => {
          this.handleFileChange(filePath, callback);
        });
        
        watcher.on('error', (error) => {
          this.emit('error', { type: 'WATCHER_ERROR', error, path: configPath });
        });
        
        return watcher;
      },
      
      handleFileChange: function(filePath, callback) {
        // Debounce rapid changes
        const debounceKey = filePath;
        
        if (this.debounceTimers.has(debounceKey)) {
          clearTimeout(this.debounceTimers.get(debounceKey));
        }
        
        const timer = setTimeout(async () => {
          this.debounceTimers.delete(debounceKey);
          
          try {
            const content = await this.loadConfiguration(filePath);
            if (content.success) {
              callback(filePath, content.data);
              this.emit('content-updated', { path: filePath, content: content.data });
            }
          } catch (error) {
            this.emit('error', { type: 'RELOAD_ERROR', error, path: filePath });
          }
        }, 300);
        
        this.debounceTimers.set(debounceKey, timer);
      },
      
      stopWatching: function(configPath) {
        const watcher = this.watchers.get(configPath);
        if (watcher) {
          watcher.close();
          this.watchers.delete(configPath);
        }
        
        // Clear any pending debounce timers
        for (const [key, timer] of this.debounceTimers.entries()) {
          if (key.includes(configPath)) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
          }
        }
      }
    };
    
    // Suppress console.log during tests
    originalConsoleLog = console.log;
    console.log = jest.fn();
  });

  afterEach(() => {
    // Clean up
    mockContentService.watchers.forEach(watcher => watcher.close());
    mockContentService.watchers.clear();
    mockContentService.debounceTimers.forEach(timer => clearTimeout(timer));
    mockContentService.debounceTimers.clear();
    
    jest.clearAllMocks();
    console.log = originalConsoleLog;
  });

  describe('File Watcher Setup', () => {
    test('should initialize file watchers for configuration directories', () => {
      const configPaths = [
        path.join(testConfigDir, 'sponsors.json'),
        path.join(testConfigDir, 'branding.json'),
        path.join(testConfigDir, 'system.json')
      ];
      
      const callback = jest.fn();
      
      configPaths.forEach(configPath => {
        mockContentService.setupFileWatcher(configPath, callback);
      });
      
      expect(chokidar.watch).toHaveBeenCalledTimes(3);
      expect(mockContentService.watchers.size).toBe(3);
      
      configPaths.forEach(configPath => {
        expect(mockContentService.watchers.has(configPath)).toBe(true);
      });
    });

    test('should handle watcher initialization errors gracefully', () => {
      const errorCallback = jest.fn();
      mockContentService.on = jest.fn((event, callback) => {
        if (event === 'error') {
          errorCallback.mockImplementation(callback);
        }
      });
      
      const configPath = path.join(testConfigDir, 'invalid.json');
      mockContentService.setupFileWatcher(configPath, jest.fn());
      
      // Simulate watcher error
      const watcher = mockContentService.watchers.get(configPath);
      const error = new Error('Permission denied');
      mockWatcher.emit('error', error);
      
      expect(mockContentService.emit).toHaveBeenCalledWith('error', {
        type: 'WATCHER_ERROR',
        error,
        path: configPath
      });
    });

    test('should clean up watchers properly', () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      
      mockContentService.setupFileWatcher(configPath, callback);
      expect(mockContentService.watchers.size).toBe(1);
      
      mockContentService.stopWatching(configPath);
      expect(mockContentService.watchers.size).toBe(0);
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('File Change Detection', () => {
    test('should detect file changes and trigger reload', async () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      const contentUpdateCallback = jest.fn();
      
      mockContentService.on = jest.fn((event, cb) => {
        if (event === 'content-updated') {
          contentUpdateCallback.mockImplementation(cb);
        }
      });
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      // Mock successful file load
      const newContent = {
        sponsors: [
          { id: 'new-sponsor', name: 'New Sponsor', logoPath: '/logos/new.png' }
        ]
      };
      
      mockContentService.loadConfiguration.mockResolvedValueOnce({
        success: true,
        data: newContent
      });
      
      // Simulate file change
      mockWatcher.emit('change', configPath);
      
      // Wait for debounced callback
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).toHaveBeenCalledWith(configPath, newContent);
      expect(mockContentService.emit).toHaveBeenCalledWith('content-updated', {
        path: configPath,
        content: newContent
      });
    });

    test('should detect new file additions', async () => {
      const configPath = path.join(testConfigDir, 'new-config.json');
      const callback = jest.fn();
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      const newContent = { newConfig: true };
      mockContentService.loadConfiguration.mockResolvedValueOnce({
        success: true,
        data: newContent
      });
      
      // Simulate file addition
      mockWatcher.emit('add', configPath);
      
      // Wait for debounced callback
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).toHaveBeenCalledWith(configPath, newContent);
    });

    test('should debounce rapid file changes', async () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      mockContentService.loadConfiguration.mockResolvedValue({
        success: true,
        data: { test: 'data' }
      });
      
      // Simulate rapid file changes
      mockWatcher.emit('change', configPath);
      mockWatcher.emit('change', configPath);
      mockWatcher.emit('change', configPath);
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Should only be called once due to debouncing
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should handle file load errors during change detection', async () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      const errorCallback = jest.fn();
      
      mockContentService.on = jest.fn((event, cb) => {
        if (event === 'error') {
          errorCallback.mockImplementation(cb);
        }
      });
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      // Mock file load error
      const loadError = new Error('File not found');
      mockContentService.loadConfiguration.mockRejectedValueOnce(loadError);
      
      // Simulate file change
      mockWatcher.emit('change', configPath);
      
      // Wait for debounced callback
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).not.toHaveBeenCalled();
      expect(mockContentService.emit).toHaveBeenCalledWith('error', {
        type: 'RELOAD_ERROR',
        error: loadError,
        path: configPath
      });
    });
  });

  describe('Hot-Reloading Integration', () => {
    test('should reload sponsor configuration and update carousel', async () => {
      const sponsorConfigPath = path.join(testConfigDir, 'sponsors.json');
      
      // Mock carousel module
      const mockCarousel = {
        sponsors: [],
        currentIndex: 0,
        
        updateSponsors: function(newSponsors) {
          this.sponsors = newSponsors;
          this.currentIndex = 0;
        },
        
        getCurrentSponsor: function() {
          return this.sponsors[this.currentIndex];
        }
      };
      
      const callback = (filePath, content) => {
        if (filePath.includes('sponsors.json') && content.sponsors) {
          mockCarousel.updateSponsors(content.sponsors);
        }
      };
      
      mockContentService.setupFileWatcher(sponsorConfigPath, callback);
      
      // Initial sponsors
      const initialSponsors = [
        { id: 'sponsor1', name: 'Initial Sponsor', logoPath: '/logos/initial.png' }
      ];
      
      mockCarousel.updateSponsors(initialSponsors);
      expect(mockCarousel.getCurrentSponsor().name).toBe('Initial Sponsor');
      
      // Update sponsors via file change
      const updatedSponsors = [
        { id: 'sponsor1', name: 'Updated Sponsor', logoPath: '/logos/updated.png' },
        { id: 'sponsor2', name: 'New Sponsor', logoPath: '/logos/new.png' }
      ];
      
      mockContentService.loadConfiguration.mockResolvedValueOnce({
        success: true,
        data: { sponsors: updatedSponsors }
      });
      
      // Simulate file change
      mockWatcher.emit('change', sponsorConfigPath);
      
      // Wait for hot reload
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(mockCarousel.sponsors).toEqual(updatedSponsors);
      expect(mockCarousel.getCurrentSponsor().name).toBe('Updated Sponsor');
    });

    test('should reload branding configuration and update theme', async () => {
      const brandingConfigPath = path.join(testConfigDir, 'branding.json');
      
      // Mock branding module
      const mockBranding = {
        theme: {},
        
        updateTheme: function(newTheme) {
          this.theme = { ...this.theme, ...newTheme };
        },
        
        getTheme: function() {
          return this.theme;
        }
      };
      
      const callback = (filePath, content) => {
        if (filePath.includes('branding.json') && content.theme) {
          mockBranding.updateTheme(content.theme);
        }
      };
      
      mockContentService.setupFileWatcher(brandingConfigPath, callback);
      
      // Initial theme
      const initialTheme = {
        colors: { primary: '#ff0000', secondary: '#00ff00' }
      };
      
      mockBranding.updateTheme(initialTheme);
      expect(mockBranding.getTheme().colors.primary).toBe('#ff0000');
      
      // Update theme via file change
      const updatedTheme = {
        colors: { primary: '#0000ff', accent: '#ffff00' }
      };
      
      mockContentService.loadConfiguration.mockResolvedValueOnce({
        success: true,
        data: { theme: updatedTheme }
      });
      
      // Simulate file change
      mockWatcher.emit('change', brandingConfigPath);
      
      // Wait for hot reload
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(mockBranding.getTheme().colors.primary).toBe('#0000ff');
      expect(mockBranding.getTheme().colors.accent).toBe('#ffff00');
    });

    test('should handle multiple simultaneous configuration updates', async () => {
      const sponsorPath = path.join(testConfigDir, 'sponsors.json');
      const brandingPath = path.join(testConfigDir, 'branding.json');
      
      const updateLog = [];
      
      const callback = (filePath, content) => {
        updateLog.push({ path: filePath, content });
      };
      
      mockContentService.setupFileWatcher(sponsorPath, callback);
      mockContentService.setupFileWatcher(brandingPath, callback);
      
      // Mock different content for each file
      mockContentService.loadConfiguration
        .mockResolvedValueOnce({
          success: true,
          data: { sponsors: [{ id: 'new-sponsor' }] }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { theme: { colors: { primary: '#new-color' } } }
        });
      
      // Simulate simultaneous file changes
      mockWatcher.emit('change', sponsorPath);
      mockWatcher.emit('change', brandingPath);
      
      // Wait for both debounced callbacks
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(updateLog).toHaveLength(2);
      expect(updateLog.some(log => log.path === sponsorPath)).toBe(true);
      expect(updateLog.some(log => log.path === brandingPath)).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should continue watching after temporary file errors', async () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      // First change fails
      mockContentService.loadConfiguration
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          success: true,
          data: { sponsors: [{ id: 'recovered' }] }
        });
      
      // Simulate first change (fails)
      mockWatcher.emit('change', configPath);
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).not.toHaveBeenCalled();
      
      // Simulate second change (succeeds)
      mockWatcher.emit('change', configPath);
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(callback).toHaveBeenCalledWith(configPath, { sponsors: [{ id: 'recovered' }] });
    });

    test('should handle corrupted configuration files gracefully', async () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      const errorCallback = jest.fn();
      
      mockContentService.on = jest.fn((event, cb) => {
        if (event === 'error') {
          errorCallback.mockImplementation(cb);
        }
      });
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      // Mock corrupted file (invalid JSON)
      mockContentService.loadConfiguration.mockResolvedValueOnce({
        success: false,
        error: 'Invalid JSON syntax'
      });
      
      // Simulate file change with corrupted content
      mockWatcher.emit('change', configPath);
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Should not call callback with invalid content
      expect(callback).not.toHaveBeenCalled();
    });

    test('should recover from watcher disconnection', () => {
      const configPath = path.join(testConfigDir, 'sponsors.json');
      const callback = jest.fn();
      
      mockContentService.setupFileWatcher(configPath, callback);
      
      // Simulate watcher error (disconnection)
      const error = new Error('ENOENT: no such file or directory');
      mockWatcher.emit('error', error);
      
      // Should emit error event
      expect(mockContentService.emit).toHaveBeenCalledWith('error', {
        type: 'WATCHER_ERROR',
        error,
        path: configPath
      });
      
      // Watcher should still be in the map (for potential restart)
      expect(mockContentService.watchers.has(configPath)).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should limit number of concurrent file operations', async () => {
      const configPaths = Array(10).fill().map((_, i) => 
        path.join(testConfigDir, `config-${i}.json`)
      );
      
      const callback = jest.fn();
      
      // Set up watchers for all paths
      configPaths.forEach(path => {
        mockContentService.setupFileWatcher(path, callback);
      });
      
      // Mock slow file operations
      mockContentService.loadConfiguration.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, data: {} }), 100))
      );
      
      // Trigger changes on all files simultaneously
      configPaths.forEach(path => {
        mockWatcher.emit('change', path);
      });
      
      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // All callbacks should eventually be called
      expect(callback).toHaveBeenCalledTimes(10);
    });

    test('should clean up resources when stopping watchers', () => {
      const configPaths = [
        path.join(testConfigDir, 'sponsors.json'),
        path.join(testConfigDir, 'branding.json')
      ];
      
      const callback = jest.fn();
      
      // Set up watchers
      configPaths.forEach(path => {
        mockContentService.setupFileWatcher(path, callback);
      });
      
      expect(mockContentService.watchers.size).toBe(2);
      
      // Trigger some changes to create debounce timers
      configPaths.forEach(path => {
        mockWatcher.emit('change', path);
      });
      
      expect(mockContentService.debounceTimers.size).toBe(2);
      
      // Stop watching all
      configPaths.forEach(path => {
        mockContentService.stopWatching(path);
      });
      
      expect(mockContentService.watchers.size).toBe(0);
      expect(mockContentService.debounceTimers.size).toBe(0);
    });
  });
});