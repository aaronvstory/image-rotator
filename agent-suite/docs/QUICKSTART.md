# Quickstart

Install these workflows into any repository:

1) Copy the files from templates/.github/workflows/* into your repo’s .github/workflows/ directory.
2) Commit and push.
3) Ensure a GitHub Actions secret OPENAI_API_KEY is set if you’ll run the PR Agent or Codex Autofix.

Usage:

- To run the PR Agent, either:
  - Comment on the PR: "AI: apply" (or "agent: apply"), or
  - Add a label: "AI: Apply" or "agent:apply"
- The agent makes minimal edits, runs tests, uploads artifacts, posts a summary, and publishes a status check.
- Reviewer Bots Pinger runs automatically on PR open/sync/reopen, waits ~5 minutes, and pings missing bots (Sourcery/CodeRabbit/Codex/Claude), skipping automatic ones (Copilot/Codoki).
- Codex Autofix runs when your CI workflow (CI/Tests/Build) fails on main/master/develop, commits fixes directly to the same branch, and comments on the PR if one exists.

Optional: Use the included installer scripts from the agent-suite root:

Windows PowerShell:

```powershell
pwsh -NoProfile -File .\\scripts\\install.ps1 -TargetPath "C:\\path\\to\\your\\repo"
```

bash/zsh:

```bash
./scripts/install.sh -t /path/to/your/repo
```

Then commit and push in your target repo.
