// Simple test runner to execute all *.test.js files sequentially
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname);
let failures = 0;

function log(msg) { console.log(msg); }

(async () => {
  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));
  for (const file of files) {
    log(`\nRunning ${file} ...`);
    try {
      require(path.join(testsDir, file));
    } catch (e) {
      failures++;
      console.error(`Test ${file} FAILED:`, e);
    }
  }
  setTimeout(() => { // allow any async IIFEs to finish
    if (failures) {
      console.error(`\n${failures} test file(s) failed.`);
      process.exit(1);
    } else {
      console.log('\nAll tests passed.');
    }
  }, 500);
})();
