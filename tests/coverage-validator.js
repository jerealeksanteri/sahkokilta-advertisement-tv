#!/usr/bin/env node

/**
 * Coverage validation script to ensure 80% minimum coverage
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = 80;

function validateCoverage() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.error('❌ Coverage summary not found. Run tests with coverage first.');
    process.exit(1);
  }
  
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;
  
  console.log('\n📊 Coverage Report Summary:');
  console.log('================================');
  
  const metrics = ['statements', 'branches', 'functions', 'lines'];
  let allPassed = true;
  
  metrics.forEach(metric => {
    const pct = total[metric].pct;
    const status = pct >= COVERAGE_THRESHOLD ? '✅' : '❌';
    const color = pct >= COVERAGE_THRESHOLD ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${status} ${metric.padEnd(12)}: ${color}${pct.toFixed(2)}%\x1b[0m (${total[metric].covered}/${total[metric].total})`);
    
    if (pct < COVERAGE_THRESHOLD) {
      allPassed = false;
    }
  });
  
  console.log('================================');
  
  if (allPassed) {
    console.log('✅ All coverage thresholds met!');
    return true;
  } else {
    console.log(`❌ Coverage below ${COVERAGE_THRESHOLD}% threshold`);
    
    // Show files with low coverage
    console.log('\n📋 Files needing attention:');
    Object.entries(coverage).forEach(([file, data]) => {
      if (file === 'total') return;
      
      const lowCoverage = metrics.some(metric => data[metric].pct < COVERAGE_THRESHOLD);
      if (lowCoverage) {
        console.log(`   ${file}:`);
        metrics.forEach(metric => {
          if (data[metric].pct < COVERAGE_THRESHOLD) {
            console.log(`     - ${metric}: ${data[metric].pct.toFixed(2)}%`);
          }
        });
      }
    });
    
    return false;
  }
}

function generateCoverageReport() {
  console.log('\n📈 Generating detailed coverage report...');
  
  const { execSync } = require('child_process');
  
  try {
    execSync('npm run test:coverage -- --silent', { stdio: 'inherit' });
    return validateCoverage();
  } catch (error) {
    console.error('❌ Failed to generate coverage report:', error.message);
    return false;
  }
}

// Run validation
if (require.main === module) {
  const success = fs.existsSync(path.join(__dirname, '../coverage/coverage-summary.json')) 
    ? validateCoverage() 
    : generateCoverageReport();
  
  process.exit(success ? 0 : 1);
}

module.exports = { validateCoverage, generateCoverageReport };