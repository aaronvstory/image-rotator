import { spawn } from 'node:child_process';
const WALL = Number(process.env.TEST_WALL_TIMEOUT_MS || 120000);
// Run the project's dedicated test runner to avoid node --test auto-discovery
// which can pick up this watchdog file and cause recursive runs.
const child = spawn('node', ['tests/run-tests.js'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_ENV: 'test' } });

let innerKillTimer = null;
const timer = setTimeout(() => {
  try { child.kill('SIGTERM'); } catch { }
  innerKillTimer = setTimeout(() => {
    try { child.kill('SIGKILL'); } catch { }
  }, 4000);
  innerKillTimer.unref();
}, WALL);
timer.unref();

child.on('exit', (code) => {
  clearTimeout(timer);
  if (innerKillTimer) clearTimeout(innerKillTimer);
  process.exit(code ?? 1);
});
