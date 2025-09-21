// Cypress E2E support file

// Import commands
import './commands';

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // Return false to prevent the error from failing the test
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false;
  }
  
  // Let other errors fail the test
  return true;
});

// Custom commands for the application
Cypress.Commands.add('waitForModuleLoad', (moduleName, timeout = 10000) => {
  cy.window({ timeout }).should('have.property', 'SahkokiltaTV');
  cy.window().its('SahkokiltaTV.modules').should('have.property', moduleName);
  cy.window().its(`SahkokiltaTV.modules.${moduleName}.loaded`).should('eq', true);
});

Cypress.Commands.add('mockSponsorData', (sponsors) => {
  cy.window().then((win) => {
    win.SahkokiltaTV = win.SahkokiltaTV || {};
    win.SahkokiltaTV.mockSponsors = sponsors;
  });
});

Cypress.Commands.add('triggerFileChange', (filename, content) => {
  cy.task('writeFile', { filename, content });
  cy.window().then((win) => {
    if (win.SahkokiltaTV && win.SahkokiltaTV.fileWatcher) {
      win.SahkokiltaTV.fileWatcher.emit('change', filename);
    }
  });
});

Cypress.Commands.add('checkAccessibility', () => {
  // Basic accessibility checks
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });
  
  cy.get('button, a, input, select, textarea').each(($el) => {
    cy.wrap($el).should('be.visible');
  });
});

Cypress.Commands.add('measurePerformance', () => {
  cy.window().then((win) => {
    const navigation = win.performance.getEntriesByType('navigation')[0];
    const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
    
    expect(loadTime).to.be.lessThan(3000); // 3 seconds max load time
    
    return {
      loadTime,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstPaint: win.performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0
    };
  });
});

// Global hooks
beforeEach(() => {
  // Clear any previous state
  cy.clearLocalStorage();
  cy.clearCookies();
  
  // Set up viewport for TV display
  cy.viewport(1920, 1080);
});

afterEach(() => {
  // Clean up any test files
  cy.task('log', 'Test completed, cleaning up...');
});