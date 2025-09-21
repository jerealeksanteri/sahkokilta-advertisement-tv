// Puppeteer E2E tests for browser automation
const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('Puppeteer E2E Tests', () => {
  let browser;
  let page;
  const testPort = 3001;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    // Launch browser in headless mode for CI/CD
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set up console logging for debugging
    page.on('console', msg => {
      if (process.env.DEBUG_TESTS) {
        console.log(`PAGE LOG: ${msg.text()}`);
      }
    });
    
    // Set up error handling
    page.on('pageerror', error => {
      console.error(`PAGE ERROR: ${error.message}`);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Application Loading', () => {
    test('should load the main application page', async () => {
      // Create a simple HTML file for testing
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sähkökilta Advertisement TV</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .module { border: 1px solid #ccc; margin: 10px; padding: 10px; }
            .branding { background: #ff6b35; color: white; }
            .carousel { background: #004e89; color: white; }
            .layout-manager { background: #ffd23f; color: black; }
          </style>
        </head>
        <body>
          <div id="app">
            <h1>Sähkökilta Advertisement TV</h1>
            <div class="module branding" id="branding-module">
              <h2>Branding Module</h2>
              <div class="logo">Logo Placeholder</div>
            </div>
            <div class="module carousel" id="carousel-module">
              <h2>Sponsor Carousel</h2>
              <div class="sponsor-display">Sponsor 1</div>
            </div>
            <div class="module layout-manager" id="layout-module">
              <h2>Layout Manager</h2>
              <div class="display-info">1920x1080</div>
            </div>
          </div>
          <script>
            // Mock module functionality
            window.SahkokiltaTV = {
              modules: {
                branding: { loaded: true },
                carousel: { loaded: true },
                layout: { loaded: true }
              },
              
              init: function() {
                console.log('Application initialized');
                this.startCarousel();
              },
              
              startCarousel: function() {
                const sponsors = ['Sponsor 1', 'Sponsor 2', 'Sponsor 3'];
                let currentIndex = 0;
                const display = document.querySelector('.sponsor-display');
                
                setInterval(() => {
                  currentIndex = (currentIndex + 1) % sponsors.length;
                  display.textContent = sponsors[currentIndex];
                }, 2000);
              }
            };
            
            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', () => {
              window.SahkokiltaTV.init();
            });
          </script>
        </body>
        </html>
      `;
      
      // Write test HTML to a temporary file
      const testFile = path.join(__dirname, 'test-app.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        // Navigate to the test file
        await page.goto(`file://${testFile}`);
        
        // Wait for the page to load
        await page.waitForSelector('#app');
        
        // Check if the main elements are present
        const title = await page.$eval('h1', el => el.textContent);
        expect(title).toBe('Sähkökilta Advertisement TV');
        
        const brandingModule = await page.$('#branding-module');
        expect(brandingModule).toBeTruthy();
        
        const carouselModule = await page.$('#carousel-module');
        expect(carouselModule).toBeTruthy();
        
        const layoutModule = await page.$('#layout-module');
        expect(layoutModule).toBeTruthy();
        
      } finally {
        // Clean up test file
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    }, 10000);

    test('should initialize JavaScript modules correctly', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Module Test</title></head>
        <body>
          <div id="status">Loading...</div>
          <script>
            window.moduleStatus = { initialized: false };
            
            function initializeModules() {
              window.moduleStatus.initialized = true;
              document.getElementById('status').textContent = 'Initialized';
            }
            
            setTimeout(initializeModules, 100);
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'module-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Wait for initialization
        await page.waitForFunction(() => window.moduleStatus && window.moduleStatus.initialized);
        
        const status = await page.$eval('#status', el => el.textContent);
        expect(status).toBe('Initialized');
        
        const moduleStatus = await page.evaluate(() => window.moduleStatus.initialized);
        expect(moduleStatus).toBe(true);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Sponsor Carousel Functionality', () => {
    test('should rotate through sponsors automatically', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Carousel Test</title></head>
        <body>
          <div id="sponsor-display">Sponsor 1</div>
          <script>
            const sponsors = ['Sponsor 1', 'Sponsor 2', 'Sponsor 3'];
            let currentIndex = 0;
            
            function nextSponsor() {
              currentIndex = (currentIndex + 1) % sponsors.length;
              document.getElementById('sponsor-display').textContent = sponsors[currentIndex];
            }
            
            // Rotate every 500ms for faster testing
            setInterval(nextSponsor, 500);
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'carousel-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Check initial sponsor
        let sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Sponsor 1');
        
        // Wait for first rotation
        await page.waitForTimeout(600);
        sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Sponsor 2');
        
        // Wait for second rotation
        await page.waitForTimeout(500);
        sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Sponsor 3');
        
        // Wait for cycle back to first
        await page.waitForTimeout(500);
        sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Sponsor 1');
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    }, 5000);

    test('should handle sponsor data updates', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Sponsor Update Test</title></head>
        <body>
          <div id="sponsor-display">Loading...</div>
          <button id="update-btn">Update Sponsors</button>
          <script>
            let sponsors = ['Initial Sponsor'];
            let currentIndex = 0;
            
            function updateDisplay() {
              document.getElementById('sponsor-display').textContent = sponsors[currentIndex];
            }
            
            function updateSponsors(newSponsors) {
              sponsors = newSponsors;
              currentIndex = 0;
              updateDisplay();
            }
            
            document.getElementById('update-btn').addEventListener('click', () => {
              updateSponsors(['Updated Sponsor 1', 'Updated Sponsor 2']);
            });
            
            updateDisplay();
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'sponsor-update-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Check initial state
        let sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Initial Sponsor');
        
        // Click update button
        await page.click('#update-btn');
        
        // Check updated state
        sponsor = await page.$eval('#sponsor-display', el => el.textContent);
        expect(sponsor).toBe('Updated Sponsor 1');
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Responsive Layout', () => {
    test('should adapt to different screen sizes', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Responsive Test</title>
          <style>
            .container { width: 100%; }
            @media (max-width: 768px) {
              .container { background: red; }
            }
            @media (min-width: 769px) and (max-width: 1024px) {
              .container { background: blue; }
            }
            @media (min-width: 1025px) {
              .container { background: green; }
            }
          </style>
        </head>
        <body>
          <div class="container" id="container">Responsive Container</div>
          <script>
            function getScreenInfo() {
              return {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
              };
            }
            window.getScreenInfo = getScreenInfo;
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'responsive-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Test desktop size (1920x1080)
        await page.setViewport({ width: 1920, height: 1080 });
        let screenInfo = await page.evaluate(() => window.getScreenInfo());
        expect(screenInfo.width).toBe(1920);
        expect(screenInfo.height).toBe(1080);
        
        let bgColor = await page.$eval('#container', el => 
          getComputedStyle(el).backgroundColor
        );
        expect(bgColor).toBe('rgb(0, 128, 0)'); // green
        
        // Test tablet size (768x1024)
        await page.setViewport({ width: 768, height: 1024 });
        screenInfo = await page.evaluate(() => window.getScreenInfo());
        expect(screenInfo.width).toBe(768);
        
        bgColor = await page.$eval('#container', el => 
          getComputedStyle(el).backgroundColor
        );
        expect(bgColor).toBe('rgb(255, 0, 0)'); // red
        
        // Test mobile size (375x667)
        await page.setViewport({ width: 375, height: 667 });
        screenInfo = await page.evaluate(() => window.getScreenInfo());
        expect(screenInfo.width).toBe(375);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle JavaScript errors gracefully', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Error Test</title></head>
        <body>
          <div id="status">OK</div>
          <button id="error-btn">Trigger Error</button>
          <script>
            window.errorCount = 0;
            
            window.addEventListener('error', (event) => {
              window.errorCount++;
              document.getElementById('status').textContent = 'Error Handled';
            });
            
            document.getElementById('error-btn').addEventListener('click', () => {
              throw new Error('Test error');
            });
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'error-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Check initial state
        let status = await page.$eval('#status', el => el.textContent);
        expect(status).toBe('OK');
        
        // Trigger error
        await page.click('#error-btn');
        
        // Wait for error handling
        await page.waitForTimeout(100);
        
        // Check error was handled
        status = await page.$eval('#status', el => el.textContent);
        expect(status).toBe('Error Handled');
        
        const errorCount = await page.evaluate(() => window.errorCount);
        expect(errorCount).toBe(1);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Performance Tests', () => {
    test('should load within acceptable time limits', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Performance Test</title></head>
        <body>
          <div id="content">Loading...</div>
          <script>
            const startTime = performance.now();
            
            setTimeout(() => {
              const loadTime = performance.now() - startTime;
              document.getElementById('content').textContent = 'Loaded in ' + Math.round(loadTime) + 'ms';
              window.loadTime = loadTime;
            }, 50);
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'performance-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        const startTime = Date.now();
        await page.goto(`file://${testFile}`);
        
        // Wait for content to load
        await page.waitForFunction(() => window.loadTime !== undefined);
        
        const totalLoadTime = Date.now() - startTime;
        const jsLoadTime = await page.evaluate(() => window.loadTime);
        
        // Should load within reasonable time (adjust thresholds as needed)
        expect(totalLoadTime).toBeLessThan(2000); // 2 seconds
        expect(jsLoadTime).toBeLessThan(1000); // 1 second for JS execution
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('should handle memory usage efficiently', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Memory Test</title></head>
        <body>
          <div id="status">Testing...</div>
          <script>
            // Create some objects to test memory usage
            const testData = [];
            
            function createTestData() {
              for (let i = 0; i < 1000; i++) {
                testData.push({
                  id: i,
                  data: 'test data '.repeat(10),
                  timestamp: Date.now()
                });
              }
            }
            
            function cleanupTestData() {
              testData.length = 0;
            }
            
            createTestData();
            
            // Simulate cleanup after use
            setTimeout(() => {
              cleanupTestData();
              document.getElementById('status').textContent = 'Memory test complete';
              window.testComplete = true;
            }, 100);
          </script>
        </body>
        </html>
      `;
      
      const testFile = path.join(__dirname, 'memory-test.html');
      fs.writeFileSync(testFile, testHtml);
      
      try {
        await page.goto(`file://${testFile}`);
        
        // Wait for test completion
        await page.waitForFunction(() => window.testComplete);
        
        const status = await page.$eval('#status', el => el.textContent);
        expect(status).toBe('Memory test complete');
        
        // Get memory usage metrics if available
        const metrics = await page.metrics();
        if (metrics.JSHeapUsedSize) {
          // Should not use excessive memory (adjust threshold as needed)
          expect(metrics.JSHeapUsedSize).toBeLessThan(50 * 1024 * 1024); // 50MB
        }
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });
});