Test watchdog and VS Code terminal stability

This repository includes a small watchdog wrapper to run Node's built-in test runner with a hard wall timeout to avoid long-hanging test runs when shell integration or terminals misbehave.

Files added

- `scripts/test-watchdog.mjs` - spawns `node --test` with a hard wall timeout (default 120s). Kills the child with SIGTERM and SIGKILL if it doesn't exit.

Package scripts

- `npm test` and `npm run test:ci` now run `node scripts/test-watchdog.mjs`.

Recommended VS Code user settings (apply in your User Settings JSON)

```json
{
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.profiles.windows": {
    "PowerShell": {
      "path": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "args": ["-NoLogo", "-NoProfile"]
    },
    "Command Prompt": {
      "path": "C:\\Windows\\System32\\cmd.exe"
    }
  },
  "terminal.integrated.automationShell.windows": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  "terminal.integrated.shellIntegration.enabled": true,
  "terminal.integrated.shellIntegration.decorationIcon": "none",
  "terminal.integrated.enablePersistentSessions": false,
  "terminal.integrated.environmentChangesIndicator": "off",
  "terminal.integrated.inheritEnv": true
}
```

Notes

- I can't modify your VS Code User Settings from within the repository because those files are user-specific and outside the workspace folder. Please paste the recommended settings into your User Settings (JSON) if you'd like the stable terminal setup.

- To diagnose terminal hangs, follow the steps in the earlier message: reload with extensions disabled, kill all terminals, and run `npm test` to observe behaviour.

If you'd like, I can now run `npm test` in the integrated terminal and share the output. If you prefer to watch via the VS Code developer tools, let me know and I'll start the run now.
