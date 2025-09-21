// Custom Cypress commands for Sähkökilta Advertisement TV

// Command to wait for application initialization
Cypress.Commands.add('initializeApp', () => {
  cy.visit('/');
  cy.get('[data-testid="app-container"]', { timeout: 10000 }).should('be.visible');
  cy.waitForModuleLoad('branding');
  cy.waitForModuleLoad('carousel');
  cy.waitForModuleLoad('layout');
});

// Command to simulate sponsor carousel interactions
Cypress.Commands.add('testCarouselRotation', (expectedSponsors) => {
  expectedSponsors.forEach((sponsor, index) => {
    cy.get('[data-testid="current-sponsor"]')
      .should('contain.text', sponsor.name);
    
    if (index < expectedSponsors.length - 1) {
      // Wait for next rotation
      cy.wait(2000); // Adjust based on carousel timing
    }
  });
});

// Command to test branding elements
Cypress.Commands.add('verifyBranding', () => {
  cy.get('[data-testid="guild-logo"]').should('be.visible');
  cy.get('[data-testid="brand-colors"]').should('exist');
  
  // Check if brand colors are applied
  cy.get('body').should('have.css', 'background-color').and('not.eq', 'rgba(0, 0, 0, 0)');
});

// Command to test responsive layout
Cypress.Commands.add('testResponsiveLayout', () => {
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 1366, height: 768, name: 'Laptop' },
    { width: 768, height: 1024, name: 'Tablet' }
  ];
  
  viewports.forEach(viewport => {
    cy.viewport(viewport.width, viewport.height);
    cy.get('[data-testid="layout-container"]').should('be.visible');
    
    // Verify layout adapts to viewport
    cy.window().then((win) => {
      expect(win.innerWidth).to.equal(viewport.width);
      expect(win.innerHeight).to.equal(viewport.height);
    });
  });
});

// Command to simulate configuration updates
Cypress.Commands.add('updateConfiguration', (configType, newConfig) => {
  const configFiles = {
    sponsors: 'config/sponsors.json',
    branding: 'config/branding.json',
    system: 'config/system.json'
  };
  
  const filename = configFiles[configType];
  if (!filename) {
    throw new Error(`Unknown config type: ${configType}`);
  }
  
  cy.triggerFileChange(filename, JSON.stringify(newConfig, null, 2));
});

// Command to test error scenarios
Cypress.Commands.add('simulateError', (errorType) => {
  cy.window().then((win) => {
    switch (errorType) {
      case 'network':
        // Mock network failure
        cy.intercept('GET', '**/*', { forceNetworkError: true });
        break;
        
      case 'javascript':
        // Trigger JavaScript error
        win.eval('throw new Error("Simulated JS error")');
        break;
        
      case 'missing-file':
        // Simulate missing configuration file
        cy.intercept('GET', '**/config/*.json', { statusCode: 404 });
        break;
        
      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }
  });
});

// Command to verify performance metrics
Cypress.Commands.add('checkPerformanceMetrics', () => {
  cy.window().then((win) => {
    const performance = win.performance;
    
    // Check navigation timing
    const navigation = performance.getEntriesByType('navigation')[0];
    const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
    
    expect(loadTime, 'Page load time').to.be.lessThan(3000);
    
    // Check resource loading
    const resources = performance.getEntriesByType('resource');
    resources.forEach(resource => {
      expect(resource.duration, `Resource ${resource.name} load time`).to.be.lessThan(2000);
    });
    
    // Check memory usage (if available)
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / (1024 * 1024); // MB
      expect(memoryUsage, 'Memory usage').to.be.lessThan(100); // 100MB limit
    }
  });
});

// Command to test hot-reloading functionality
Cypress.Commands.add('testHotReload', (configType) => {
  const originalConfig = {
    sponsors: [
      { id: 'sponsor1', name: 'Original Sponsor', logoPath: '/logos/original.png' }
    ]
  };
  
  const updatedConfig = {
    sponsors: [
      { id: 'sponsor1', name: 'Updated Sponsor', logoPath: '/logos/updated.png' },
      { id: 'sponsor2', name: 'New Sponsor', logoPath: '/logos/new.png' }
    ]
  };
  
  // Set initial config
  cy.updateConfiguration(configType, originalConfig);
  cy.get('[data-testid="current-sponsor"]').should('contain.text', 'Original Sponsor');
  
  // Update config and verify hot reload
  cy.updateConfiguration(configType, updatedConfig);
  cy.get('[data-testid="current-sponsor"]', { timeout: 5000 })
    .should('contain.text', 'Updated Sponsor');
});

// Command to test accessibility features
Cypress.Commands.add('testAccessibility', () => {
  // Check for proper ARIA labels
  cy.get('[role]').should('exist');
  
  // Check keyboard navigation
  cy.get('body').type('{tab}');
  cy.focused().should('be.visible');
  
  // Check color contrast (basic check)
  cy.get('[data-testid="text-content"]').each(($el) => {
    cy.wrap($el).should('have.css', 'color').and('not.eq', 'rgba(0, 0, 0, 0)');
  });
  
  // Check image alt texts
  cy.checkAccessibility();
});

// Command to simulate Raspberry Pi environment
Cypress.Commands.add('simulateRaspberryPi', () => {
  // Set user agent to simulate Raspberry Pi browser
  cy.visit('/', {
    onBeforeLoad: (win) => {
      Object.defineProperty(win.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/84.0.4147.105 Safari/537.36'
      });
      
      // Simulate lower performance
      Object.defineProperty(win.navigator, 'hardwareConcurrency', {
        value: 4 // Raspberry Pi 4 has 4 cores
      });
    }
  });
  
  // Simulate slower network
  cy.intercept('**/*', (req) => {
    req.reply((res) => {
      // Add delay to simulate slower network
      return new Promise(resolve => {
        setTimeout(() => resolve(res), 100);
      });
    });
  });
});