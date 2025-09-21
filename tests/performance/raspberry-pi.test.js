// Performance tests specifically designed for Raspberry Pi hardware
const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

describe('Raspberry Pi Performance Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Launch browser with Raspberry Pi-like constraints
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--memory-pressure-off',
        '--max_old_space_size=512', // Limit memory to simulate Pi constraints
      ],
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
    
    // Simulate Raspberry Pi CPU throttling
    await page.setCPUThrottlingRate(4); // 4x slower than normal
    
    // Set up performance monitoring
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();
  });

  afterEach(async () => {
    if (page) {
      await page.coverage.stopJSCoverage();
      await page.coverage.stopCSSCoverage();
      await page.close();
    }
  });

  describe('Memory Usage Tests', () => {
    test('should maintain low memory footprint during operation', async () => {
      const testHtml = createPerformanceTestPage();
      const testFile = path.join(__dirname, 'memory-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        // Wait for initialization
        await page.waitForFunction(() => window.SahkokiltaTV && window.SahkokiltaTV.initialized);
        
        // Get initial memory usage
        const initialMetrics = await page.metrics();
        const initialMemory = initialMetrics.JSHeapUsedSize;
        
        // Run carousel for extended period to test memory leaks
        await page.evaluate(() => {
          window.SahkokiltaTV.runExtendedTest(30000); // 30 seconds
        });
        
        // Wait for test completion
        await page.waitForFunction(() => window.SahkokiltaTV.testComplete, { timeout: 35000 });
        
        // Get final memory usage
        const finalMetrics = await page.metrics();
        const finalMemory = finalMetrics.JSHeapUsedSize;
        
        // Memory should not increase significantly (allow 20% growth)
        const memoryGrowth = (finalMemory - initialMemory) / initialMemory;
        expect(memoryGrowth).toBeLessThan(0.2);
        
        // Total memory usage should be reasonable for Pi
        expect(finalMemory).toBeLessThan(50 * 1024 * 1024); // 50MB limit
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('should handle garbage collection efficiently', async () => {
      const testHtml = createMemoryStressTestPage();
      const testFile = path.join(__dirname, 'gc-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        // Force garbage collection and measure
        await page.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
        });
        
        const beforeGC = await page.metrics();
        
        // Create memory pressure
        await page.evaluate(() => {
          window.createMemoryPressure();
        });
        
        await page.waitForTimeout(2000);
        
        // Force GC again
        await page.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
        });
        
        const afterGC = await page.metrics();
        
        // Memory should be cleaned up effectively
        const memoryReduction = (beforeGC.JSHeapUsedSize - afterGC.JSHeapUsedSize) / beforeGC.JSHeapUsedSize;
        expect(Math.abs(memoryReduction)).toBeLessThan(0.5); // Should not fluctuate wildly
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('CPU Performance Tests', () => {
    test('should maintain smooth animations under CPU constraints', async () => {
      const testHtml = createAnimationTestPage();
      const testFile = path.join(__dirname, 'animation-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        // Start animation performance monitoring
        await page.evaluate(() => {
          window.startAnimationTest();
        });
        
        // Let animations run for a while
        await page.waitForTimeout(5000);
        
        // Get performance metrics
        const animationMetrics = await page.evaluate(() => {
          return window.getAnimationMetrics();
        });
        
        // Frame rate should be acceptable (at least 15 FPS on Pi)
        expect(animationMetrics.averageFPS).toBeGreaterThan(15);
        expect(animationMetrics.droppedFrames).toBeLessThan(animationMetrics.totalFrames * 0.3);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    test('should handle concurrent operations efficiently', async () => {
      const testHtml = createConcurrencyTestPage();
      const testFile = path.join(__dirname, 'concurrency-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        const startTime = Date.now();
        
        // Start multiple concurrent operations
        await page.evaluate(() => {
          window.startConcurrentOperations();
        });
        
        // Wait for completion
        await page.waitForFunction(() => window.concurrentTestComplete, { timeout: 10000 });
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        // Should complete within reasonable time even with CPU throttling
        expect(totalTime).toBeLessThan(8000); // 8 seconds max
        
        // Check that all operations completed successfully
        const results = await page.evaluate(() => window.getConcurrentResults());
        expect(results.successCount).toBe(results.totalOperations);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Network Performance Tests', () => {
    test('should handle slow network conditions gracefully', async () => {
      // Simulate slow network (typical Pi WiFi conditions)
      await page.emulateNetworkConditions({
        offline: false,
        downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
        uploadThroughput: 0.75 * 1024 * 1024 / 8,   // 0.75 Mbps
        latency: 100 // 100ms latency
      });

      const testHtml = createNetworkTestPage();
      const testFile = path.join(__dirname, 'network-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        const startTime = Date.now();
        await page.goto(`file://${testFile}`);
        
        // Wait for network operations to complete
        await page.waitForFunction(() => window.networkTestComplete, { timeout: 15000 });
        
        const loadTime = Date.now() - startTime;
        
        // Should load within reasonable time despite slow network
        expect(loadTime).toBeLessThan(10000); // 10 seconds max
        
        const networkMetrics = await page.evaluate(() => window.getNetworkMetrics());
        expect(networkMetrics.failedRequests).toBe(0);
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Storage Performance Tests', () => {
    test('should handle file operations efficiently', async () => {
      const testHtml = createStorageTestPage();
      const testFile = path.join(__dirname, 'storage-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        // Test localStorage operations
        const storageMetrics = await page.evaluate(() => {
          const startTime = performance.now();
          
          // Simulate configuration file operations
          for (let i = 0; i < 100; i++) {
            const data = JSON.stringify({
              sponsors: Array(10).fill().map((_, idx) => ({
                id: `sponsor-${i}-${idx}`,
                name: `Sponsor ${i}-${idx}`,
                logoPath: `/logos/sponsor-${i}-${idx}.png`
              }))
            });
            
            localStorage.setItem(`config-${i}`, data);
            const retrieved = localStorage.getItem(`config-${i}`);
            JSON.parse(retrieved);
          }
          
          const endTime = performance.now();
          return {
            operationTime: endTime - startTime,
            storageSize: JSON.stringify(localStorage).length
          };
        });
        
        // Storage operations should be fast enough
        expect(storageMetrics.operationTime).toBeLessThan(1000); // 1 second max
        expect(storageMetrics.storageSize).toBeLessThan(1024 * 1024); // 1MB max
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('Thermal Performance Tests', () => {
    test('should maintain performance under sustained load', async () => {
      const testHtml = createThermalTestPage();
      const testFile = path.join(__dirname, 'thermal-test.html');
      fs.writeFileSync(testFile, testHtml);

      try {
        await page.goto(`file://${testFile}`);
        
        // Run sustained load test (simulating thermal throttling)
        await page.evaluate(() => {
          window.startSustainedLoadTest();
        });
        
        // Monitor performance over time
        const performanceData = [];
        
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(1000);
          
          const metrics = await page.evaluate(() => {
            return window.getCurrentPerformanceMetrics();
          });
          
          performanceData.push(metrics);
        }
        
        // Performance should not degrade significantly over time
        const initialPerf = performanceData[0].operationsPerSecond;
        const finalPerf = performanceData[performanceData.length - 1].operationsPerSecond;
        const degradation = (initialPerf - finalPerf) / initialPerf;
        
        expect(degradation).toBeLessThan(0.3); // Less than 30% degradation
        
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });
});

// Helper functions to create test pages
function createPerformanceTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Performance Test</title></head>
    <body>
      <div id="app">Performance Test Running...</div>
      <script>
        window.SahkokiltaTV = {
          initialized: false,
          testComplete: false,
          
          init: function() {
            this.initialized = true;
            this.sponsors = Array(50).fill().map((_, i) => ({
              id: 'sponsor-' + i,
              name: 'Sponsor ' + i,
              data: 'x'.repeat(1000) // 1KB per sponsor
            }));
          },
          
          runExtendedTest: function(duration) {
            const startTime = Date.now();
            const interval = setInterval(() => {
              // Simulate carousel operations
              this.sponsors.forEach(sponsor => {
                sponsor.lastAccessed = Date.now();
              });
              
              // Create and cleanup temporary objects
              const temp = Array(100).fill().map(i => ({ data: Math.random() }));
              temp.length = 0;
              
              if (Date.now() - startTime > duration) {
                clearInterval(interval);
                this.testComplete = true;
              }
            }, 100);
          }
        };
        
        window.SahkokiltaTV.init();
      </script>
    </body>
    </html>
  `;
}

function createMemoryStressTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Memory Stress Test</title></head>
    <body>
      <script>
        window.createMemoryPressure = function() {
          const largeArrays = [];
          for (let i = 0; i < 10; i++) {
            largeArrays.push(new Array(10000).fill('memory-test-data'));
          }
          
          // Clean up after a short time
          setTimeout(() => {
            largeArrays.length = 0;
          }, 1000);
        };
      </script>
    </body>
    </html>
  `;
}

function createAnimationTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Animation Test</title>
      <style>
        .animated-element {
          width: 100px;
          height: 100px;
          background: red;
          position: absolute;
          transition: transform 0.1s ease;
        }
      </style>
    </head>
    <body>
      <div class="animated-element" id="element"></div>
      <script>
        window.animationMetrics = {
          frameCount: 0,
          droppedFrames: 0,
          startTime: 0,
          lastFrameTime: 0
        };
        
        window.startAnimationTest = function() {
          this.animationMetrics.startTime = performance.now();
          this.animationMetrics.lastFrameTime = this.animationMetrics.startTime;
          
          const element = document.getElementById('element');
          let position = 0;
          
          const animate = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - this.animationMetrics.lastFrameTime;
            
            if (deltaTime > 16.67) { // More than 60fps interval
              this.animationMetrics.droppedFrames++;
            }
            
            this.animationMetrics.frameCount++;
            this.animationMetrics.lastFrameTime = currentTime;
            
            position = (position + 2) % window.innerWidth;
            element.style.transform = 'translateX(' + position + 'px)';
            
            requestAnimationFrame(animate);
          };
          
          animate();
        };
        
        window.getAnimationMetrics = function() {
          const totalTime = (performance.now() - this.animationMetrics.startTime) / 1000;
          return {
            averageFPS: this.animationMetrics.frameCount / totalTime,
            droppedFrames: this.animationMetrics.droppedFrames,
            totalFrames: this.animationMetrics.frameCount
          };
        };
      </script>
    </body>
    </html>
  `;
}

function createConcurrencyTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Concurrency Test</title></head>
    <body>
      <script>
        window.concurrentTestComplete = false;
        window.concurrentResults = { successCount: 0, totalOperations: 0 };
        
        window.startConcurrentOperations = function() {
          const operations = [
            () => this.simulateFileLoad(),
            () => this.simulateImageProcessing(),
            () => this.simulateDataProcessing(),
            () => this.simulateNetworkRequest(),
            () => this.simulateCarouselUpdate()
          ];
          
          this.concurrentResults.totalOperations = operations.length;
          
          const promises = operations.map(op => {
            return new Promise((resolve) => {
              setTimeout(() => {
                try {
                  op();
                  this.concurrentResults.successCount++;
                } catch (error) {
                  console.error('Operation failed:', error);
                }
                resolve();
              }, Math.random() * 1000);
            });
          });
          
          Promise.all(promises).then(() => {
            this.concurrentTestComplete = true;
          });
        };
        
        window.simulateFileLoad = function() {
          const data = JSON.stringify({ test: 'data' });
          JSON.parse(data);
        };
        
        window.simulateImageProcessing = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.fillRect(0, 0, 100, 100);
        };
        
        window.simulateDataProcessing = function() {
          const data = Array(1000).fill().map((_, i) => i * 2);
          data.reduce((sum, val) => sum + val, 0);
        };
        
        window.simulateNetworkRequest = function() {
          // Simulate async operation
          return new Promise(resolve => setTimeout(resolve, 100));
        };
        
        window.simulateCarouselUpdate = function() {
          const sponsors = Array(10).fill().map((_, i) => ({ id: i, name: 'Sponsor ' + i }));
          sponsors.sort((a, b) => a.name.localeCompare(b.name));
        };
        
        window.getConcurrentResults = function() {
          return this.concurrentResults;
        };
      </script>
    </body>
    </html>
  `;
}

function createNetworkTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Network Test</title></head>
    <body>
      <script>
        window.networkTestComplete = false;
        window.networkMetrics = { failedRequests: 0, totalRequests: 0 };
        
        // Simulate network operations
        setTimeout(() => {
          const requests = Array(5).fill().map((_, i) => {
            return new Promise((resolve) => {
              this.networkMetrics.totalRequests++;
              
              // Simulate network request with potential failure
              setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate
                  resolve('success');
                } else {
                  this.networkMetrics.failedRequests++;
                  resolve('failed');
                }
              }, 500 + Math.random() * 1000);
            });
          });
          
          Promise.all(requests).then(() => {
            this.networkTestComplete = true;
          });
        }, 100);
        
        window.getNetworkMetrics = function() {
          return this.networkMetrics;
        };
      </script>
    </body>
    </html>
  `;
}

function createStorageTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Storage Test</title></head>
    <body>
      <script>
        // Test page is ready immediately
      </script>
    </body>
    </html>
  `;
}

function createThermalTestPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Thermal Test</title></head>
    <body>
      <script>
        window.performanceMetrics = { operationsPerSecond: 0 };
        
        window.startSustainedLoadTest = function() {
          let operationCount = 0;
          const startTime = Date.now();
          
          const performWork = () => {
            // CPU intensive work
            for (let i = 0; i < 10000; i++) {
              Math.sqrt(i * Math.random());
            }
            operationCount++;
            
            const elapsed = (Date.now() - startTime) / 1000;
            this.performanceMetrics.operationsPerSecond = operationCount / elapsed;
            
            setTimeout(performWork, 1);
          };
          
          performWork();
        };
        
        window.getCurrentPerformanceMetrics = function() {
          return this.performanceMetrics;
        };
      </script>
    </body>
    </html>
  `;
}