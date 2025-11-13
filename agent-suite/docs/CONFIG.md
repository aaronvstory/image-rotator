# Configuration

These workflows work out-of-the-box with sensible defaults. You can customize them via environment variables or by editing the YAML.

PR Agent (templates/.github/workflows/pr-agent-apply.yml):

- Trigger: comment keywords ("ai: apply", "agent: apply", "/agent apply", "/ai apply") or labels ("AI: Apply", "agent:apply"). Also supports manual runs (workflow_dispatch).
- Env toggles:
  - PR_AGENT_REQUIRE_LABEL: if set (e.g., "agent:apply"), the PR must have that label to run when triggered by a comment.
  - PR_AGENT_DEBOUNCE_SECONDS: seconds to wait after a comment to batch multiple triggers (default 120).
  - OPENAI_API_KEY: GitHub Actions secret required by Codex steps.

Reviewer Bots Pinger (templates/.github/workflows/reviewer-bots-pinger.yml):

- Trigger: PR opened/synchronize/reopened.
- Behavior: waits (default 5 minutes), then pings missing bots (Sourcery/CodeRabbit/Codex/Claude) with minimal triggers.
- Automatic bots are skipped (Copilot, Codoki).
- Env toggles:
  - PING_WAIT_MINUTES: override the wait window (default 5).

Codex Autofix CI (templates/.github/workflows/codex-autofix-ci.yml):

- Trigger: when named CI workflows (CI/Tests/Build) fail on main/master/develop.
- Behavior: minimal fix committed directly to the same branch; comments on associated PR (if any), uploads artifacts.
- Secrets:
  - OPENAI_API_KEY: required for Codex steps.

Security & Secrets:

- Do not hardcode API keys in workflow files. Use GitHub Actions secrets.
- Avoid committing local desktop configs with tokens. If a token leaked, rotate it immediately.
