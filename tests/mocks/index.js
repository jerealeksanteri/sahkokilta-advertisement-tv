// Centralized mock services for testing isolation

/**
 * Mock MagicMirror Module base class
 */
class MockModule {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...this.defaults, ...config };
    this.data = {};
    this.loaded = false;
    this.hidden = false;
    this.identifier = `module_${Math.random().toString(36).substr(2, 9)}`;
  }

  defaults = {};

  start() {
    this.loaded = true;
  }

  stop() {
    this.loaded = false;
  }

  show() {
    this.hidden = false;
  }

  hide() {
    this.hidden = true;
  }

  getDom() {
    const wrapper = document.createElement('div');
    wrapper.className = this.name;
    return wrapper;
  }

  getStyles() {
    return [];
  }

  getScripts() {
    return [];
  }

  notificationReceived(notification, payload, sender) {
    // Override in tests
  }

  sendNotification(notification, payload) {
    // Override in tests
  }

  sendSocketNotification(notification, payload) {
    // Override in tests
  }

  socketNotificationReceived(notification, payload) {
    // Override in tests
  }
}

/**
 * Mock File System operations
 */
const mockFS = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
};

/**
 * Mock Path operations
 */
const mockPath = {
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  isAbsolute: jest.fn((path) => path.startsWith('/')),
};

/**
 * Mock Chokidar file watcher
 */
const mockChokidar = {
  watch: jest.fn(() => ({
    on: jest.fn(),
    add: jest.fn(),
    unwatch: jest.fn(),
    close: jest.fn(),
  })),
};

/**
 * Mock Winston logger
 */
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
  configure: jest.fn(),
  child: jest.fn(() => mockLogger),
};

/**
 * Mock DOM elements and operations
 */
const mockDOM = {
  createElement: jest.fn((tagName) => ({
    tagName: tagName.toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn(),
    },
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  getElementById: jest.fn(),
  getElementsByClassName: jest.fn(() => []),
};

/**
 * Mock Node.js process
 */
const mockProcess = {
  env: { NODE_ENV: 'test' },
  cwd: jest.fn(() => '/test'),
  exit: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  platform: 'linux',
  arch: 'x64',
};

/**
 * Mock timers
 */
const mockTimers = {
  setTimeout: jest.fn((fn, delay) => {
    const id = Math.random();
    if (delay === 0) {
      setImmediate(fn);
    }
    return id;
  }),
  clearTimeout: jest.fn(),
  setInterval: jest.fn((fn, delay) => {
    const id = Math.random();
    return id;
  }),
  clearInterval: jest.fn(),
  setImmediate: jest.fn((fn) => {
    const id = Math.random();
    process.nextTick(fn);
    return id;
  }),
  clearImmediate: jest.fn(),
};

/**
 * Mock EventEmitter
 */
class MockEventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

/**
 * Test utilities
 */
const testUtils = {
  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock configuration
  createMockConfig: (overrides = {}) => ({
    module: 'TestModule',
    position: 'top_left',
    config: {
      ...overrides
    }
  }),
  
  // Create mock sponsor data
  createMockSponsor: (overrides = {}) => ({
    id: 'sponsor-1',
    name: 'Test Sponsor',
    logoPath: '/test/logo.png',
    active: true,
    priority: 1,
    displayDuration: 10000,
    metadata: {
      addedDate: '2023-01-01',
    },
    ...overrides
  }),
  
  // Create mock branding config
  createMockBrandingConfig: (overrides = {}) => ({
    logo: {
      path: '/test/logo.png',
      fallbackPath: '/test/fallback.png',
      position: 'top-left',
      size: { width: 100, height: 50 },
      alt: 'Test Logo'
    },
    theme: {
      colors: {
        primary: '#ff0000',
        secondary: '#00ff00',
        accent: '#0000ff',
        background: '#ffffff',
        text: '#000000'
      }
    },
    ...overrides
  }),
  
  // Create mock display info
  createMockDisplayInfo: (overrides = {}) => ({
    resolution: { width: 1920, height: 1080 },
    orientation: 'landscape',
    scaleFactor: 1.0,
    pixelRatio: 1.0,
    ...overrides
  }),
  
  // Flush all promises
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
  
  // Mock fetch responses
  mockFetch: (responses = {}) => {
    global.fetch = jest.fn((url) => {
      const response = responses[url] || { ok: true, json: () => Promise.resolve({}) };
      return Promise.resolve(response);
    });
  },
  
  // Reset all mocks
  resetAllMocks: () => {
    jest.clearAllMocks();
    Object.values(mockFS).forEach(mock => mock.mockReset());
    Object.values(mockPath).forEach(mock => mock.mockReset());
    Object.values(mockTimers).forEach(mock => mock.mockReset());
    mockLogger.debug.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
  }
};

module.exports = {
  MockModule,
  MockEventEmitter,
  mockFS,
  mockPath,
  mockChokidar,
  mockLogger,
  mockDOM,
  mockProcess,
  mockTimers,
  testUtils,
};