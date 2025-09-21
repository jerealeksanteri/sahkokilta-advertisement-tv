const fs = require('fs').promises;
const path = require('path');
const ContentService = require('../../services/ContentService');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

describe('ContentService', () => {
  let contentService;
  let mockWatcher;
  
  const mockSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      value: { type: 'number' }
    },
    required: ['name', 'value']
  };
  
  const validConfig = {
    name: 'test',
    value: 42
  };
  
  const invalidConfig = {
    name: 'test'
    // missing required 'value' field
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock watcher
    mockWatcher = {
      on: jest.fn(),
      close: jest.fn().mockResolvedValue()
    };
    
    const chokidar = require('chokidar');
    chokidar.watch.mockReturnValue(mockWatcher);
    
    contentService = new ContentService({
      watchDelay: 100,
      maxRetries: 2,
      retryDelay: 50
    });
  });

  afterEach(async () => {
    if (contentService) {
      await contentService.cleanup();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with valid schemas', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      
      await contentService.initialize('/mock/schemas');
      
      expect(contentService.getAvailableSchemas()).toContain('test');
    });

    it('should throw error if schema loading fails', async () => {
      fs.readdir.mockRejectedValue(new Error('Directory not found'));
      
      await expect(contentService.initialize('/invalid/path'))
        .rejects.toThrow('ContentService initialization failed');
    });

    it('should handle invalid JSON schemas gracefully', async () => {
      fs.readdir.mockResolvedValue(['invalid.schema.json']);
      fs.readFile.mockResolvedValue('invalid json');
      
      await expect(contentService.initialize('/mock/schemas'))
        .rejects.toThrow('Failed to load schemas');
    });
  });

  describe('loadConfiguration', () => {
    beforeEach(async () => {
      // Initialize with mock schema
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
    });

    it('should load and validate configuration successfully', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      const result = await contentService.loadConfiguration('/mock/config.json', 'test');
      
      expect(result).toEqual(validConfig);
      expect(fs.access).toHaveBeenCalledWith(path.resolve('/mock/config.json'));
    });

    it('should throw error for non-existent file', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.access.mockRejectedValue(error);
      
      await expect(contentService.loadConfiguration('/nonexistent.json', 'test'))
        .rejects.toThrow('Configuration file not found');
    });

    it('should throw validation error for invalid configuration', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      
      await expect(contentService.loadConfiguration('/mock/invalid.json', 'test'))
        .rejects.toThrow('Configuration validation failed');
    });

    it('should return cached configuration when useCache is true', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      // Clear previous calls from initialization
      fs.readFile.mockClear();
      
      // First load
      const result1 = await contentService.loadConfiguration('/mock/config.json', 'test');
      
      // Second load should use cache
      const result2 = await contentService.loadConfiguration('/mock/config.json', 'test');
      
      expect(result1).toEqual(result2);
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should retry on transient errors', async () => {
      fs.access.mockResolvedValue();
      
      // Clear previous calls from initialization
      fs.readFile.mockClear();
      
      fs.readFile
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(JSON.stringify(validConfig));
      
      const result = await contentService.loadConfiguration('/mock/config.json', 'test');
      
      expect(result).toEqual(validConfig);
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries exceeded', async () => {
      fs.access.mockResolvedValue();
      
      // Clear previous calls from initialization
      fs.readFile.mockClear();
      
      fs.readFile.mockRejectedValue(new Error('Persistent error'));
      
      await expect(contentService.loadConfiguration('/mock/config.json', 'test'))
        .rejects.toThrow('Persistent error');
      
      expect(fs.readFile).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle unsupported file formats', async () => {
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('some content');
      
      await expect(contentService.loadConfiguration('/mock/config.xml', 'test'))
        .rejects.toThrow('Unsupported file format: .xml');
    });
  });

  describe('validateContent', () => {
    beforeEach(async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
    });

    it('should validate valid content successfully', () => {
      const result = contentService.validateContent(validConfig, 'test');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid content', () => {
      const result = contentService.validateContent(invalidConfig, 'test');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("root: must have required property 'value'");
    });

    it('should handle non-existent schema', () => {
      const result = contentService.validateContent(validConfig, 'nonexistent');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema not found: nonexistent');
    });
  });

  describe('file watching', () => {
    beforeEach(async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
    });

    it('should start watching files successfully', () => {
      const filePath = '/mock/config.json';
      
      contentService.watchFiles(filePath, { schemaKey: 'test' });
      
      expect(require('chokidar').watch).toHaveBeenCalledWith(
        path.resolve(filePath),
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true
        })
      );
      
      expect(contentService.getWatchedFiles()).toContain(path.resolve(filePath));
    });

    it('should handle multiple file paths', () => {
      const filePaths = ['/mock/config1.json', '/mock/config2.json'];
      
      contentService.watchFiles(filePaths);
      
      expect(require('chokidar').watch).toHaveBeenCalledTimes(2);
      expect(contentService.getWatchedFiles()).toHaveLength(2);
    });

    it('should not watch already watched files', () => {
      const filePath = '/mock/config.json';
      
      contentService.watchFiles(filePath);
      contentService.watchFiles(filePath); // Second call
      
      expect(require('chokidar').watch).toHaveBeenCalledTimes(1);
    });

    it('should emit content-updated event on file change', async () => {
      const filePath = '/mock/config.json';
      const eventSpy = jest.fn();
      
      contentService.on('content-updated', eventSpy);
      contentService.watchFiles(filePath, { schemaKey: 'test' });
      
      // Simulate file change
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      // Get the change handler and call it
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // Trigger the change handler
      changeHandler();
      
      // Wait for debounce and async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: path.resolve(filePath),
        schemaKey: 'test',
        content: validConfig
      });
    });

    it('should emit file-deleted event on file deletion', () => {
      const filePath = '/mock/config.json';
      const eventSpy = jest.fn();
      
      contentService.on('file-deleted', eventSpy);
      contentService.watchFiles(filePath);
      
      // Get the unlink handler and call it
      const unlinkHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'unlink')[1];
      unlinkHandler();
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: path.resolve(filePath)
      });
    });

    it('should stop watching specific file', async () => {
      const filePath = '/mock/config.json';
      
      contentService.watchFiles(filePath);
      await contentService.stopWatching(filePath);
      
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(contentService.getWatchedFiles()).not.toContain(path.resolve(filePath));
    });

    it('should stop watching all files', async () => {
      const filePaths = ['/mock/config1.json', '/mock/config2.json'];
      
      contentService.watchFiles(filePaths);
      await contentService.stopWatching();
      
      expect(mockWatcher.close).toHaveBeenCalledTimes(2);
      expect(contentService.getWatchedFiles()).toHaveLength(0);
    });
  });

  describe('event system', () => {
    it('should emit content-loaded event on successful load', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
      
      const eventSpy = jest.fn();
      contentService.on('content-loaded', eventSpy);
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      await contentService.loadConfiguration('/mock/config.json', 'test');
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: '/mock/config.json',
        schemaKey: 'test',
        content: validConfig
      });
    });

    it('should emit validation-error event on validation failure', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
      
      const eventSpy = jest.fn();
      contentService.on('validation-error', eventSpy);
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));
      
      try {
        await contentService.loadConfiguration('/mock/config.json', 'test');
      } catch (error) {
        // Expected to throw
      }
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: '/mock/config.json',
        schemaKey: 'test',
        error: expect.any(Error)
      });
    });

    it('should support manual content change notification', () => {
      const eventSpy = jest.fn();
      contentService.on('content-updated', eventSpy);
      
      contentService.notifyChange('/mock/config.json', validConfig, 'test');
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: '/mock/config.json',
        schemaKey: 'test',
        content: validConfig
      });
    });
  });

  describe('utility methods', () => {
    it('should check file existence correctly', async () => {
      fs.access.mockResolvedValue();
      const exists = await contentService.fileExists('/mock/config.json');
      expect(exists).toBe(true);
      
      fs.access.mockRejectedValue(new Error('Not found'));
      const notExists = await contentService.fileExists('/mock/nonexistent.json');
      expect(notExists).toBe(false);
    });

    it('should return cache statistics', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      await contentService.loadConfiguration('/mock/config.json', 'test');
      
      const stats = contentService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toHaveLength(1);
    });

    it('should clear cache for specific file', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
      
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));
      
      await contentService.loadConfiguration('/mock/config.json', 'test');
      
      contentService.clearCacheForFile('/mock/config.json');
      
      const stats = contentService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources properly', async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
      
      contentService.watchFiles('/mock/config.json');
      
      await contentService.cleanup();
      
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(contentService.getWatchedFiles()).toHaveLength(0);
      expect(contentService.getCacheStats().size).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      fs.readdir.mockResolvedValue(['test.schema.json']);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSchema));
      await contentService.initialize('/mock/schemas');
    });

    it('should handle watcher errors gracefully', () => {
      const eventSpy = jest.fn();
      contentService.on('watch-error', eventSpy);
      
      contentService.watchFiles('/mock/config.json');
      
      // Simulate watcher error
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Watcher error');
      errorHandler(testError);
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: path.resolve('/mock/config.json'),
        error: testError
      });
    });

    it('should handle content errors during file change', async () => {
      const eventSpy = jest.fn();
      contentService.on('content-error', eventSpy);
      
      contentService.watchFiles('/mock/config.json', { schemaKey: 'test' });
      
      // Clear previous mocks and set up error scenario
      fs.access.mockClear();
      fs.readFile.mockClear();
      
      // First access succeeds (for clearCacheForFile), then loadConfiguration fails
      fs.access
        .mockResolvedValueOnce() // For clearCacheForFile
        .mockRejectedValue(new Error('File access error')); // For loadConfiguration
      
      const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // Trigger the change handler
      changeHandler();
      
      // Wait for debounce and async operations
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventSpy).toHaveBeenCalledWith({
        filePath: path.resolve('/mock/config.json'),
        schemaKey: 'test',
        error: expect.any(Error)
      });
    });
  });
});