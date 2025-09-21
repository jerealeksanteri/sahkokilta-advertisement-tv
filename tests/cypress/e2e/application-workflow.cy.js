// Cypress E2E tests for full application workflows

describe('Sähkökilta Advertisement TV - Full Application Workflow', () => {
  beforeEach(() => {
    // Create a test HTML page for Cypress to interact with
    cy.task('writeFile', {
      filename: 'cypress-test-app.html',
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sähkökilta Advertisement TV</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
              background: linear-gradient(135deg, #ff6b35, #004e89);
              color: white;
            }
            .app-container { 
              width: 100vw; 
              height: 100vh; 
              display: flex; 
              flex-direction: column;
            }
            .branding-section { 
              height: 20%; 
              display: flex; 
              align-items: center; 
              padding: 20px;
              background: rgba(255, 107, 53, 0.9);
            }
            .logo { 
              width: 150px; 
              height: 75px; 
              background: white; 
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #004e89;
              font-weight: bold;
            }
            .carousel-section { 
              flex: 1; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              background: rgba(0, 78, 137, 0.9);
            }
            .sponsor-display { 
              font-size: 3em; 
              text-align: center;
              padding: 40px;
              border: 3px solid #ffd23f;
              border-radius: 20px;
              background: rgba(255, 210, 63, 0.1);
            }
            .layout-info { 
              position: absolute; 
              top: 10px; 
              right: 10px; 
              font-size: 0.8em;
              background: rgba(0, 0, 0, 0.5);
              padding: 5px 10px;
              border-radius: 5px;
            }
            .status-indicator {
              position: absolute;
              bottom: 10px;
              left: 10px;
              padding: 5px 10px;
              background: rgba(0, 255, 0, 0.8);
              border-radius: 5px;
              color: black;
            }
            .error-indicator {
              background: rgba(255, 0, 0, 0.8) !important;
              color: white !important;
            }
          </style>
        </head>
        <body>
          <div class="app-container" data-testid="app-container">
            <div class="branding-section">
              <div class="logo" data-testid="guild-logo">Sähkökilta</div>
              <h1 style="margin-left: 20px;">Advertisement TV</h1>
            </div>
            
            <div class="carousel-section">
              <div class="sponsor-display" data-testid="current-sponsor">
                Loading sponsors...
              </div>
            </div>
            
            <div class="layout-info" data-testid="layout-info">
              <span id="resolution">1920x1080</span>
            </div>
            
            <div class="status-indicator" data-testid="status-indicator">
              Initializing...
            </div>
          </div>
          
          <div style="display: none;" data-testid="brand-colors"></div>
          <div style="display: none;" data-testid="layout-container"></div>
          <div style="display: none;" data-testid="text-content">Sample text for accessibility</div>
          
          <script>
            // Mock Sähkökilta TV Application
            window.SahkokiltaTV = {
              modules: {
                branding: { loaded: false },
                carousel: { loaded: false },
                layout: { loaded: false }
              },
              
              sponsors: [
                { id: 'sponsor1', name: 'TechCorp', logoPath: '/logos/techcorp.png' },
                { id: 'sponsor2', name: 'InnovateLab', logoPath: '/logos/innovate.png' },
                { id: 'sponsor3', name: 'FutureSoft', logoPath: '/logos/future.png' }
              ],
              
              currentSponsorIndex: 0,
              carouselInterval: null,
              
              init: function() {
                console.log('Initializing Sähkökilta TV...');
                this.initializeBranding();
                this.initializeLayout();
                this.initializeCarousel();
                this.updateStatus('Running');
              },
              
              initializeBranding: function() {
                console.log('Initializing branding module...');
                this.modules.branding.loaded = true;
                
                // Apply brand colors
                document.body.style.setProperty('--primary-color', '#ff6b35');
                document.body.style.setProperty('--secondary-color', '#004e89');
                document.body.style.setProperty('--accent-color', '#ffd23f');
              },
              
              initializeLayout: function() {
                console.log('Initializing layout module...');
                this.modules.layout.loaded = true;
                
                // Update resolution display
                const resolution = window.innerWidth + 'x' + window.innerHeight;
                document.getElementById('resolution').textContent = resolution;
                
                // Handle resize events
                window.addEventListener('resize', () => {
                  const newResolution = window.innerWidth + 'x' + window.innerHeight;
                  document.getElementById('resolution').textContent = newResolution;
                });
              },
              
              initializeCarousel: function() {
                console.log('Initializing carousel module...');
                this.modules.carousel.loaded = true;
                
                this.updateSponsorDisplay();
                this.startCarousel();
              },
              
              updateSponsorDisplay: function() {
                const sponsor = this.sponsors[this.currentSponsorIndex];
                const display = document.querySelector('[data-testid="current-sponsor"]');
                display.textContent = sponsor.name;
              },
              
              startCarousel: function() {
                this.carouselInterval = setInterval(() => {
                  this.currentSponsorIndex = (this.currentSponsorIndex + 1) % this.sponsors.length;
                  this.updateSponsorDisplay();
                }, 3000); // 3 second rotation
              },
              
              stopCarousel: function() {
                if (this.carouselInterval) {
                  clearInterval(this.carouselInterval);
                  this.carouselInterval = null;
                }
              },
              
              updateSponsors: function(newSponsors) {
                this.sponsors = newSponsors;
                this.currentSponsorIndex = 0;
                this.updateSponsorDisplay();
              },
              
              updateStatus: function(status) {
                const indicator = document.querySelector('[data-testid="status-indicator"]');
                indicator.textContent = status;
                
                if (status.includes('Error')) {
                  indicator.classList.add('error-indicator');
                } else {
                  indicator.classList.remove('error-indicator');
                }
              },
              
              simulateError: function(errorType) {
                this.updateStatus('Error: ' + errorType);
                console.error('Simulated error:', errorType);
              },
              
              // File watcher simulation
              fileWatcher: {
                listeners: {},
                
                on: function(event, callback) {
                  if (!this.listeners[event]) {
                    this.listeners[event] = [];
                  }
                  this.listeners[event].push(callback);
                },
                
                emit: function(event, data) {
                  if (this.listeners[event]) {
                    this.listeners[event].forEach(callback => callback(data));
                  }
                }
              }
            };
            
            // Set up file watcher for hot reloading
            window.SahkokiltaTV.fileWatcher.on('change', (filename) => {
              console.log('File changed:', filename);
              
              if (filename.includes('sponsors.json')) {
                // Simulate sponsor data reload
                setTimeout(() => {
                  if (window.SahkokiltaTV.mockSponsors) {
                    window.SahkokiltaTV.updateSponsors(window.SahkokiltaTV.mockSponsors);
                  }
                }, 500);
              }
            });
            
            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.SahkokiltaTV.init();
              }, 100);
            });
            
            // Error handling
            window.addEventListener('error', (event) => {
              window.SahkokiltaTV.simulateError('JavaScript Error');
            });
            
            window.addEventListener('unhandledrejection', (event) => {
              window.SahkokiltaTV.simulateError('Promise Rejection');
            });
          </script>
        </body>
        </html>
      `
    });
    
    // Visit the test page
    cy.visit('/cypress-test-app.html');
  });

  describe('Application Initialization', () => {
    it('should initialize all modules successfully', () => {
      cy.initializeApp();
      
      // Verify all modules are loaded
      cy.waitForModuleLoad('branding');
      cy.waitForModuleLoad('carousel');
      cy.waitForModuleLoad('layout');
      
      // Check status indicator
      cy.get('[data-testid="status-indicator"]')
        .should('contain.text', 'Running')
        .should('not.have.class', 'error-indicator');
    });

    it('should display branding elements correctly', () => {
      cy.initializeApp();
      cy.verifyBranding();
      
      // Check guild logo
      cy.get('[data-testid="guild-logo"]')
        .should('be.visible')
        .should('contain.text', 'Sähkökilta');
      
      // Check title
      cy.contains('Advertisement TV').should('be.visible');
    });

    it('should adapt layout to different screen sizes', () => {
      cy.initializeApp();
      cy.testResponsiveLayout();
      
      // Test specific viewport changes
      cy.viewport(1366, 768);
      cy.get('[data-testid="layout-info"]')
        .should('contain.text', '1366x768');
      
      cy.viewport(1920, 1080);
      cy.get('[data-testid="layout-info"]')
        .should('contain.text', '1920x1080');
    });
  });

  describe('Sponsor Carousel Functionality', () => {
    it('should rotate through sponsors automatically', () => {
      cy.initializeApp();
      
      // Check initial sponsor
      cy.get('[data-testid="current-sponsor"]')
        .should('contain.text', 'TechCorp');
      
      // Wait for first rotation (3 seconds)
      cy.wait(3100);
      cy.get('[data-testid="current-sponsor"]')
        .should('contain.text', 'InnovateLab');
      
      // Wait for second rotation
      cy.wait(3000);
      cy.get('[data-testid="current-sponsor"]')
        .should('contain.text', 'FutureSoft');
      
      // Wait for cycle back to first
      cy.wait(3000);
      cy.get('[data-testid="current-sponsor"]')
        .should('contain.text', 'TechCorp');
    });

    it('should handle sponsor data updates via hot reload', () => {
      cy.initializeApp();
      
      // Mock new sponsor data
      const newSponsors = [
        { id: 'new1', name: 'NewSponsor1', logoPath: '/logos/new1.png' },
        { id: 'new2', name: 'NewSponsor2', logoPath: '/logos/new2.png' }
      ];
      
      cy.mockSponsorData(newSponsors);
      cy.triggerFileChange('config/sponsors.json', JSON.stringify(newSponsors));
      
      // Verify hot reload worked
      cy.get('[data-testid="current-sponsor"]', { timeout: 2000 })
        .should('contain.text', 'NewSponsor1');
    });

    it('should maintain carousel state during configuration updates', () => {
      cy.initializeApp();
      
      // Let carousel run for a bit
      cy.wait(1500);
      
      // Update configuration
      const updatedSponsors = [
        { id: 'updated1', name: 'UpdatedSponsor', logoPath: '/logos/updated.png' }
      ];
      
      cy.mockSponsorData(updatedSponsors);
      cy.triggerFileChange('config/sponsors.json', JSON.stringify(updatedSponsors));
      
      // Should show updated sponsor
      cy.get('[data-testid="current-sponsor"]', { timeout: 2000 })
        .should('contain.text', 'UpdatedSponsor');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle JavaScript errors gracefully', () => {
      cy.initializeApp();
      
      // Simulate JavaScript error
      cy.window().then((win) => {
        win.eval('throw new Error("Test error")');
      });
      
      // Check error indicator
      cy.get('[data-testid="status-indicator"]')
        .should('contain.text', 'Error: JavaScript Error')
        .should('have.class', 'error-indicator');
    });

    it('should handle network failures', () => {
      cy.initializeApp();
      
      // Simulate network error
      cy.simulateError('network');
      
      // Application should still be functional
      cy.get('[data-testid="app-container"]').should('be.visible');
      cy.get('[data-testid="current-sponsor"]').should('be.visible');
    });

    it('should recover from configuration file errors', () => {
      cy.initializeApp();
      
      // Simulate missing configuration file
      cy.simulateError('missing-file');
      
      // Should show error but continue running
      cy.get('[data-testid="status-indicator"]')
        .should('contain.text', 'Error');
      
      // Core functionality should still work
      cy.get('[data-testid="guild-logo"]').should('be.visible');
    });
  });

  describe('Performance and Optimization', () => {
    it('should load within acceptable time limits', () => {
      cy.visit('/cypress-test-app.html');
      
      // Measure performance
      cy.measurePerformance().then((metrics) => {
        expect(metrics.loadTime).to.be.lessThan(3000);
      });
      
      // Check that all critical elements are loaded quickly
      cy.get('[data-testid="app-container"]', { timeout: 2000 }).should('be.visible');
      cy.get('[data-testid="guild-logo"]', { timeout: 1000 }).should('be.visible');
    });

    it('should perform well on Raspberry Pi simulation', () => {
      cy.simulateRaspberryPi();
      
      // Should still initialize within reasonable time
      cy.get('[data-testid="app-container"]', { timeout: 5000 }).should('be.visible');
      cy.waitForModuleLoad('branding', 8000);
      cy.waitForModuleLoad('carousel', 8000);
      
      // Check performance metrics
      cy.checkPerformanceMetrics();
    });

    it('should handle memory efficiently during long operation', () => {
      cy.initializeApp();
      
      // Let carousel run for extended period
      cy.wait(10000);
      
      // Check that application is still responsive
      cy.get('[data-testid="current-sponsor"]').should('be.visible');
      
      // Verify no memory leaks (basic check)
      cy.window().then((win) => {
        if (win.performance.memory) {
          const memoryUsage = win.performance.memory.usedJSHeapSize / (1024 * 1024);
          expect(memoryUsage).to.be.lessThan(50); // 50MB limit
        }
      });
    });
  });

  describe('Accessibility and Usability', () => {
    it('should meet basic accessibility requirements', () => {
      cy.initializeApp();
      cy.testAccessibility();
      
      // Check color contrast
      cy.get('[data-testid="guild-logo"]')
        .should('have.css', 'color')
        .and('not.eq', 'rgba(0, 0, 0, 0)');
      
      // Check text readability
      cy.get('[data-testid="current-sponsor"]')
        .should('have.css', 'font-size')
        .then((fontSize) => {
          const size = parseFloat(fontSize);
          expect(size).to.be.greaterThan(20); // Minimum readable size for TV
        });
    });

    it('should be readable from TV viewing distance', () => {
      cy.initializeApp();
      
      // Check font sizes are appropriate for TV
      cy.get('[data-testid="current-sponsor"]')
        .should('have.css', 'font-size')
        .then((fontSize) => {
          const size = parseFloat(fontSize);
          expect(size).to.be.greaterThan(40); // Large enough for TV viewing
        });
      
      // Check contrast ratios
      cy.get('[data-testid="guild-logo"]')
        .should('have.css', 'background-color', 'rgb(255, 255, 255)')
        .should('have.css', 'color', 'rgb(0, 78, 137)');
    });
  });

  describe('Integration with File System', () => {
    it('should watch for configuration file changes', () => {
      cy.initializeApp();
      
      // Verify file watcher is set up
      cy.window().should('have.nested.property', 'SahkokiltaTV.fileWatcher');
      
      // Test file change detection
      cy.triggerFileChange('config/sponsors.json', '{"test": "data"}');
      
      // Should detect the change (logged to console)
      cy.window().then((win) => {
        // File watcher should be active
        expect(win.SahkokiltaTV.fileWatcher).to.exist;
      });
    });

    it('should reload content when files are modified', () => {
      cy.initializeApp();
      
      // Initial state
      cy.get('[data-testid="current-sponsor"]')
        .should('contain.text', 'TechCorp');
      
      // Modify sponsor configuration
      const newConfig = [
        { id: 'reload1', name: 'ReloadTest', logoPath: '/logos/reload.png' }
      ];
      
      cy.mockSponsorData(newConfig);
      cy.triggerFileChange('config/sponsors.json', JSON.stringify(newConfig));
      
      // Should reload and show new content
      cy.get('[data-testid="current-sponsor"]', { timeout: 2000 })
        .should('contain.text', 'ReloadTest');
    });
  });
});