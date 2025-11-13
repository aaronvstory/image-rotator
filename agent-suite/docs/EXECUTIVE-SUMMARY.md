# Executive Summary

This suite automates safe, minimal improvements to pull requests you already opened, without creating more PRs. It:

- Runs an on-demand PR Agent that applies surgical fixes and polish, commits to the PR branch, runs tests, and posts a status check with artifacts.
- Pings third-party reviewer bots only if they haven’t commented yet, skipping automatic ones (Copilot, Codoki).
- Applies minimal fixes automatically when CI fails by committing to the same branch and commenting on an associated PR (if any).

Why it matters:

- Keeps your PRs moving with low-risk changes and clear audit artifacts.
- Avoids noisy follow-up branches/PRs.
- Works across repos with sensible defaults; no secret repo variables are required.

Security notes:

- The workflows use your repository’s standard permissions and secrets. Do not hardcode tokens; rely on GitHub Actions’ secrets for the Codex/OpenAI key.
- Never commit local desktop configs containing tokens to a repository.
