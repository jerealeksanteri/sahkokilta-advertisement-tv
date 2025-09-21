// Jest environment setup file
// This file is loaded before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DEBUG_TESTS = process.env.DEBUG_TESTS || 'false';

// Mock Electron APIs if they don't exist
if (typeof window === 'undefined') {
  global.window = {};
}

if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// Mock localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
}

// Mock sessionStorage
if (typeof sessionStorage === 'undefined') {
  global.sessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
}

// Mock fetch if not available
if (typeof fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      status: 200,
      statusText: 'OK',
    })
  );
}

// Mock performance API
if (typeof performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  };
}

// Mock requestAnimationFrame
if (typeof requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = jest.fn((callback) => {
    return setTimeout(callback, 16); // ~60fps
  });
}

if (typeof cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = jest.fn((id) => {
    clearTimeout(id);
  });
}

// Mock URL constructor
if (typeof URL === 'undefined') {
  global.URL = class URL {
    constructor(url, base) {
      this.href = url;
      this.origin = 'http://localhost';
      this.protocol = 'http:';
      this.host = 'localhost';
      this.hostname = 'localhost';
      this.port = '';
      this.pathname = '/';
      this.search = '';
      this.hash = '';
    }
  };
}

// Mock WebSocket
if (typeof WebSocket === 'undefined') {
  global.WebSocket = class WebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1; // OPEN
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
    }
    
    send() {}
    close() {}
  };
}

// Mock MutationObserver
if (typeof MutationObserver === 'undefined') {
  global.MutationObserver = class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// Mock Blob
if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts || [];
      this.options = options || {};
      this.size = 0;
      this.type = this.options.type || '';
    }
  };
}

// Mock File
if (typeof File === 'undefined') {
  global.File = class File extends global.Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
      this.lastModified = Date.now();
    }
  };
}

// Mock FileReader
if (typeof FileReader === 'undefined') {
  global.FileReader = class FileReader {
    constructor() {
      this.readyState = 0;
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.onabort = null;
      this.onloadstart = null;
      this.onloadend = null;
      this.onprogress = null;
    }
    
    readAsText() {}
    readAsDataURL() {}
    readAsArrayBuffer() {}
    readAsBinaryString() {}
    abort() {}
  };
}

// Mock crypto
if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    randomUUID: jest.fn(() => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }),
  };
}

// Set up console methods for testing
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  // Override specific methods if needed for testing
  log: process.env.DEBUG_TESTS === 'true' ? originalConsole.log : jest.fn(),
  debug: process.env.DEBUG_TESTS === 'true' ? originalConsole.debug : jest.fn(),
  info: process.env.DEBUG_TESTS === 'true' ? originalConsole.info : jest.fn(),
  warn: originalConsole.warn,
  error: originalConsole.error,
};

// Note: afterEach is not available in setup files
// Individual test files should handle their own cleanup