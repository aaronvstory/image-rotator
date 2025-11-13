
# What this adds

* Watches PR review comments and top-level comments for AI prompts and approved suggestions.
* Filters by allowlisted authors and opt-in keywords.
* Builds a single prompt with the selected actions.
* Runs an “apply changes” round with Codex in a write sandbox.
* Commits to a short-lived branch, opens a follow-up PR or pushes to the source branch, and posts a summary comment.

Your repo already has:

* OPENAI_API_KEY secret checks and guidance for adding it
* Codex review and autofix workflows wired up and using the OpenAI key

# Conventions the agent will use

* Allowlisted commenters: `coderabbitai[bot]`, `sourcery-ai[bot]`, `codoki-pr-intelligence[bot]`, `github-actions[bot]` posting Codex, and repo owner.
* Opt-in keywords in a comment: `AI: apply`, `AI: implement`, or a block headed with `Prompt for AI Agents` seen in your threads .
* Safety rules mirror your Codex prompts: minimal targeted edits, preserve behavior, add brief code comments for non-obvious fixes .

# 1) Add the workflow

Create `.github/workflows/pr-agent.yml`:

```yaml
name: PR Agent

on:
  issue_comment:
    types: [created, edited]
  pull_request_review_comment:
    types: [created, edited]
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: read

concurrency:
  group: pr-agent-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}
  cancel-in-progress: true

jobs:
  collect-and-apply:
    if: |
      github.event_name == 'workflow_dispatch' ||
      (github.event.issue.pull_request != '' && contains(github.event.comment.body, 'AI: '))
    runs-on: ubuntu-latest
    env:
      # Debounce window to batch reviewer comments; new comment events will cancel this run via concurrency
      BATCH_DEBOUNCE_SECONDS: ${{ vars.PR_AGENT_DEBOUNCE_SECONDS || '120' }}
      # Max repair rounds when tests fail (1 = initial attempt only, 2 = one retry, etc.)
      MAX_FIX_ROUNDS: ${{ vars.PR_AGENT_MAX_FIX_ROUNDS || '2' }}
    steps:
      - name: Check for required label
        uses: actions/github-script@v7
        id: labelcheck
        with:
          script: |
            const { context, getOctokit } = require('@actions/github');
            const octokit = getOctokit(process.env.GITHUB_TOKEN);
            const { owner, repo } = context.repo;
            const prNumber = context.payload.issue?.number || context.payload.pull_request?.number;
            const { data: labels } = await octokit.rest.issues.listLabelsOnIssue({ owner, repo, issue_number: prNumber });
            const has = labels.some(l => l.name === 'agent:apply');
            core.setOutput('ok', has ? 'true' : 'false');

      - name: Skip if label not present
        if: steps.labelcheck.outputs.ok != 'true'
        run: echo "Missing label 'agent:apply'. Skipping."

      - name: Checkout PR branch
        if: steps.labelcheck.outputs.ok == 'true'
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && github.ref || '' }}
          fetch-depth: 0

      - name: Setup Node.js for agent
        if: steps.labelcheck.outputs.ok == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Install deps for agent script
        if: steps.labelcheck.outputs.ok == 'true'
        run: |
          mkdir -p .github/pr-agent
          npm init -y >/dev/null 2>&1
          npm install @actions/core @actions/github

      - name: Write agent script
        if: steps.labelcheck.outputs.ok == 'true'
        run: |
          cat > .github/pr-agent/index.js <<'JS'
          const core = require('@actions/core');
          const github = require('@actions/github');

          const ALLOWLIST = new Set([
            'coderabbitai', 'coderabbitai[bot]',
            'sourcery-ai', 'sourcery-ai[bot]',
            'codoki-pr-intelligence', 'codoki-pr-intelligence[bot]',
            'github-actions', 'github-actions[bot]',
          ]);

          function isOptIn(body) {
            if (!body) return false;
            const b = body.toLowerCase();
            return b.includes('ai: apply') || b.includes('ai: implement') || b.includes('prompt for ai agents');
          }

          function normalizeComment(c) {
            const loc = [];
            if (c.path && typeof c.line === 'number') {
              loc.push(`File: ${c.path} Line: ${c.line}`);
            }
            return `Author: ${c.user.login}\nLocation: ${loc.join(', ') || 'General'}\nBody:\n${c.body}`;
          }

          async function main() {
            const token = process.env.GITHUB_TOKEN;
            const octokit = github.getOctokit(token);
            const ctx = github.context;

            const repoOwner = ctx.payload.repository.owner.login;
            ALLOWLIST.add(repoOwner);

            let prNumber = ctx.payload.issue?.number || ctx.payload.pull_request?.number || ctx.payload.workflow?.pull_request?.number;
            if (!prNumber && ctx.payload.comment?.pull_request_url) {
              const m = ctx.payload.comment.pull_request_url.match(/pulls\/(\d+)/);
              if (m) prNumber = parseInt(m[1], 10);
            }
            if (!prNumber) throw new Error('Could not resolve PR number');

            const {owner, repo} = ctx.repo;

            const issueComments = await octokit.paginate(
              octokit.rest.issues.listComments,
              {owner, repo, issue_number: prNumber, per_page: 100}
            );

            const reviewComments = await octokit.paginate(
              octokit.rest.pulls.listReviewComments,
              {owner, repo, pull_number: prNumber, per_page: 100}
            );

            const selected = [];
            for (const c of issueComments) {
              if (ALLOWLIST.has(c.user.login) && isOptIn(c.body)) selected.push(normalizeComment(c));
            }
            for (const c of reviewComments) {
              if (ALLOWLIST.has(c.user.login) && isOptIn(c.body)) selected.push(normalizeComment(c));
            }

            if (selected.length === 0) {
              core.setOutput('has_actions', 'false');
              core.setOutput('prompt', 'No actionable comments found');
              return;
            }

            const pr = await octokit.rest.pulls.get({owner, repo, pull_number: prNumber});
            const base = pr.data.base.ref;
            const head = pr.data.head.sha;

            const diff = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
              owner, repo, pull_number: prNumber, headers: {accept: 'application/vnd.github.v3.diff'}
            });

            const prompt = `
You are an automated PR agent working in this repository.
Follow these rules strictly:
- Make minimal, targeted changes to satisfy the requests.
- Do not refactor unrelated code.
- Add short comments for non-obvious changes.
- Keep behavior the same unless a fix is required.

PR:
- Base branch: ${base}
- Head commit: ${head}

Selected actionable comments (treat as source of truth):
${selected.map((s, i) => `### Action ${i+1}\n${s}`).join('\n\n')}

Git diff for context:
${diff.data}
`.trim();

            core.setOutput('has_actions', 'true');
            core.setOutput('prompt', prompt);
          }

          main().catch(err => {
            core.setFailed(err.message);
          });
          JS

      - name: Collect actionable comments
        if: steps.labelcheck.outputs.ok == 'true'
        id: collect
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node .github/pr-agent/index.js

      - name: Batching delay (debounce window)
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        run: |
          echo "Waiting $BATCH_DEBOUNCE_SECONDS seconds to batch additional reviewer comments..."
          sleep "$BATCH_DEBOUNCE_SECONDS"

      - name: Stop if there is nothing to do
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions != 'true'
        run: echo "No actionable AI comments found. Skipping."

      - name: Run Codex to apply changes
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        id: codex_apply
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: workspace-write
          safety-strategy: drop-sudo
          output-file: pr-agent-output.md
          codex-args: '["--max-iterations","8"]'
          prompt: ${{ steps.collect.outputs.prompt }}

      - name: Set up Node.js (w/ cache) for project
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'

      - name: Install dependencies
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        run: npm ci

      - name: Run tests
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        id: tests
        run: |
          set -e
          npm test 2>&1 | tee test-output.txt
        shell: bash

      - name: Upload test logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: pr-agent-tests-${{ github.run_id }}
          path: |
            test-output.txt
          retention-days: 14

      # Optional repair pass: If tests failed, feed failing output back into the model for one more attempt
      - name: Prepare repair prompt from test failures
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && steps.tests.outcome != 'success' && env.MAX_FIX_ROUNDS != '1'
        run: |
          echo "Preparing repair prompt from failing test output..."
          printf "\n\n---\nTest failures (excerpt):\n\n" >> pr-agent-prompt.txt
          tail -n 500 test-output.txt >> pr-agent-prompt.txt

      - name: Repair attempt via Codex
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && steps.tests.outcome != 'success' && env.MAX_FIX_ROUNDS != '1'
        id: codex_repair
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: workspace-write
          safety-strategy: drop-sudo
          output-file: pr-agent-repair-output.md
          codex-args: '["--max-iterations","8"]'
          prompt-path: pr-agent-prompt.txt

      - name: Re-run tests after repair
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && steps.tests.outcome != 'success' && env.MAX_FIX_ROUNDS != '1'
        id: tests_repair
        run: |
          set -e
          npm test 2>&1 | tee test-output-repair.txt
        shell: bash

      - name: Upload repair logs
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && steps.tests.outcome != 'success' && env.MAX_FIX_ROUNDS != '1'
        uses: actions/upload-artifact@v4
        with:
          name: pr-agent-tests-repair-${{ github.run_id }}
          path: |
            pr-agent-repair-output.md
            test-output-repair.txt
          retention-days: 14

      - name: Detect lint support
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        id: lintdetect
        run: |
          node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));console.log((p.scripts&&p.scripts.lint)?'hasLintScript=true':'hasLintScript=false');" > lint_flag.txt
          cat lint_flag.txt
        shell: bash

      - name: Run lint (if lint script exists)
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && contains(steps.lintdetect.outputs, 'hasLintScript=true')
        id: lint
        run: npm run lint 2>&1 | tee lint-output.txt
        shell: bash

      - name: Upload lint logs
        if: always() && contains(steps.lintdetect.outputs, 'hasLintScript=true')
        uses: actions/upload-artifact@v4
        with:
          name: pr-agent-lint-${{ github.run_id }}
          path: lint-output.txt
          retention-days: 14

      - name: Create branch, commit, and push (only if tests passed)
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true' && (steps.tests.outcome == 'success' || steps.tests_repair.outcome == 'success')
        uses: actions/github-script@v7
        with:
          script: |
            const { exec } = require('child_process');
            async function sh(cmd) { await new Promise((res, rej) => exec(cmd, (e, out, err) => e ? rej(e) : res(out || err))); }
            const branchName = `pr-agent/${{ github.run_id }}`;
            await sh('git config user.name "pr-agent-bot"');
            await sh('git config user.email "pr-agent-bot@users.noreply.github.com"');
            await sh(`git checkout -b ${branchName}`);
            await sh('git add -A');
            const status = await new Promise((res) => exec('git status --porcelain || true', (_, out) => res(out || '')));
            if (!status.trim()) { console.log('No file changes to commit'); return; }
            await sh('git commit -m "chore(pr-agent): apply requested changes"');
            await sh(`git push origin ${branchName}`);

      - name: Open PR or comment summary
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const { context, getOctokit } = require('@actions/github');
            const octokit = getOctokit(process.env.GITHUB_TOKEN);
            const { owner, repo } = context.repo;
            const prNumber = context.payload.issue?.number || context.payload.pull_request?.number;

            let body = 'Automated attempt to apply selected actions from AI prompts.\n\n';
            try {
              body += fs.readFileSync('pr-agent-output.md', 'utf8');
            } catch (e) {}

            const headRef = `pr-agent/${context.runId}`;
            try {
              const pr = await octokit.rest.pulls.create({
                owner, repo,
                title: `PR Agent changes for #${prNumber}`,
                head: headRef,
                base: context.payload.pull_request?.base?.ref || 'main',
                body
              });
              console.log(`Opened PR #${pr.data.number}`);
            } catch (e) {
              await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
            }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Save prompt and diff as artifacts
        if: steps.labelcheck.outputs.ok == 'true' && steps.collect.outputs.has_actions == 'true'
        run: |
          echo "${{ steps.collect.outputs.prompt }}" > pr-agent-prompt.txt
          git diff --name-only > pr-agent-files.txt || true
          git diff > pr-agent.patch || true

      - name: Upload artifacts (prompt/diff/files)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: pr-agent-context-${{ github.run_id }}
          path: |
            pr-agent-output.md
            pr-agent-prompt.txt
            pr-agent-files.txt
            pr-agent.patch
            pr-agent-repair-output.md
            test-output-repair.txt
          retention-days: 30
```

Notes.

* Uses the same OPENAI_API_KEY pattern already present in your repo’s automation   .
* Permissions match the need to comment, push branches, and open PRs.
* Triggers on comments that include `AI:` for strong opt-in control. You can adjust the `if:` and `isOptIn` logic as you like.

## 2) How to ask the agent to act

Add one of these comments on the PR:

* `AI: apply`
* `AI: implement`
* Paste a block that starts with `Prompt for AI Agents` like in your existing threads .

You can scope it further in the comment, for example:

```text
AI: apply
- Update /api/batch/progress SSE to restrict CORS to the app origin
- Ignore caller-supplied jobId and generate server-side UUIDs
- Clamp chunkSize to a sane minimum
```

These items align with the earlier Codex review findings for the OCR batch flow and SSE hardening   .

## 3) Guardrails baked in

* Allowlist reviewers and the repo owner to prevent random triggers.
* Opt-in keywords required.
* Minimal edit rule and short code comments in the Codex prompt, same as your autofix workflow rules .
* Artifacts uploaded for traceability.

## 4) Optional refinements

* Add label gating before applying changes, for example only proceed when label `agent:apply` is present.
* Add a dry-run mode that posts a proposed patch as a comment instead of pushing.
* Limit file types or paths to avoid risky edits outside the PR’s diff.

## 5) Secrets and prerequisites

* Make sure `OPENAI_API_KEY` is present at Settings → Secrets → Actions, which your repo already guides contributors to set up .
* Keep using your Codex actions so the agent has parity with your current automated reviews and autofix flows   .

## 6) Quick test

* On an existing PR, add a comment: `AI: apply` and list one safe, small change.
* Open the Actions tab and watch the PR Agent run.
* Review the new branch or the comment summary it posts.

If you want, I can also tune the allowlist, the keyword triggers, or change it to push directly to the PR branch instead of opening a side PR.
