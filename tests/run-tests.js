// Simple test runner to execute all *.test.js files sequentially
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname);
let failures = 0;

/**
 * Write a message to the console.
 * @param {*} msg - The value to write to stdout (will be formatted by console.log).
 */
function log(msg) { console.log(msg); }

(async () => {
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));
  for (const file of files) {
    log(`\nRunning ${file} ...`);
    try {
      const result = require(path.join(testsDir, file));
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (e) {
      failures++;
      console.error(`Test ${file} FAILED:`, e);
    }
  }
  process.on('beforeExit', () => {
    if (failures) {
      console.error(`\n${failures} test file(s) failed.`);
      process.exitCode = 1;
    } else {
      console.log('\nAll tests passed.');
      process.exitCode = 0;
    }
  });
})();