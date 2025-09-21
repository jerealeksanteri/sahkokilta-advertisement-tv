const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'tests/cypress/support/e2e.js',
    specPattern: 'tests/cypress/e2e/**/*.cy.js',
    fixturesFolder: 'tests/cypress/fixtures',
    screenshotsFolder: 'tests/cypress/screenshots',
    videosFolder: 'tests/cypress/videos',
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        // Custom task for file operations
        readFile(filename) {
          const fs = require('fs');
          const path = require('path');
          
          try {
            return fs.readFileSync(path.resolve(filename), 'utf8');
          } catch (error) {
            return null;
          }
        },
        
        writeFile({ filename, content }) {
          const fs = require('fs');
          const path = require('path');
          
          try {
            fs.writeFileSync(path.resolve(filename), content);
            return true;
          } catch (error) {
            return false;
          }
        }
      });
    },
    
    // Test configuration
    viewportWidth: 1920,
    viewportHeight: 1080,
    video: false,
    screenshotOnRunFailure: true,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    }
  },
  
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
  },
});