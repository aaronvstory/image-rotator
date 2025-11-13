# PR Agent + Reviewer Bots Suite

This suite adds a safe “PR Agent” that applies minimal, test-verified fixes to an open PR on demand, a reviewer-bot pinger that nudges third‑party bots (without creating extra PRs), and an autofix job for failing CI that commits directly to the same branch.

Highlights:

- No follow-up PRs: all fixes are committed to the original PR branch
- Comment or label to run the agent (supports both “AI: Apply” and “agent:apply”)
- Uploads artifacts (prompts, repair logs, test output) and posts a summary + status check
- Pings Sourcery/CodeRabbit/Codex/Claude only if they haven’t posted; skips automatic bots (Copilot, Codoki)
- Portable defaults: no repo variables required

Contents:

- templates/.github/workflows/pr-agent-apply.yml — on-demand agent that commits minimal changes to the PR branch, runs tests, and creates a status check
- templates/.github/workflows/reviewer-bots-pinger.yml — waits briefly, then pings missing reviewer bots with their trigger commands
- templates/.github/workflows/codex-autofix-ci.yml — applies minimal fixes when CI fails, commits to the same branch, and comments on the PR if one exists
- docs/EXECUTIVE-SUMMARY.md — what this is and why
- docs/QUICKSTART.md — copy/paste setup and how to run
- docs/CONFIG.md — environment, toggles, customization
- docs/TROUBLESHOOTING.md — common issues
- scripts/install.ps1 and scripts/install.sh — quick installer to copy templates into a repo

License: MIT (see LICENSE)
