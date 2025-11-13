# Troubleshooting

Agent didn’t start after labeling the PR:

- By default, the agent starts on a comment ("AI: apply"). Label-only is supported but requires the label to be exactly "AI: Apply" or "agent:apply". Make sure the label event occurred after merging the setup workflows.

Nothing runs after merging the setup PR:

- Correct: merging the setup PR only installs the workflows. They activate on future PR events (open/synchronize/reopen) and comments/labels. Nothing runs on merge itself.

Status check didn’t appear:

- Ensure tests ran successfully in the agent job. The status check is created at the end with success/failure and a link to artifacts.

Reviewer bots weren’t pinged:

- The pinger waits ~5 minutes then posts minimal triggers for Sourcery/CodeRabbit/Codex/Claude. Automatic bots (Copilot, Codoki) are intentionally skipped.

CI Autofix didn’t create a PR:

- By design. It commits minimal fixes directly to the same branch and comments on the associated PR if one exists.

Security note:

- If any local config file (e.g., a desktop app JSON) contains API tokens, rotate them and do not commit those files. Use GitHub Actions secrets instead.
