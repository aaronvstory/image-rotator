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

- VS Code User Settings are user-specific and located outside the workspace folder. To apply the recommended terminal configuration, paste the settings block into User Settings (JSON) via Command Palette → Preferences: Open User Settings (JSON).

- To diagnose terminal hangs, perform the following steps:
  1. Command Palette → Developer: Reload With Extensions Disabled
  2. Command Palette → Terminal: Kill All Terminals
  3. Command Palette → Developer: Reload Window
  4. Run `npm test` in the integrated terminal to observe test execution behavior
  5. Optionally, open VS Code Developer Tools (Help → Toggle Developer Tools) to monitor console output and terminal integration diagnostics during test runs
