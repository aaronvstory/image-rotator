Created 7 todos

Here’s a focused strategy breakdown so you can decide confidently without touching code yet.

## What the Current Main Adds Beyond WSL
- Polished visual design: refined gradients, spacing, responsive behavior, animation states for rotation, loading, hover preview aesthetics.
- Simplified user flow: immediate “OCR All” action without selection overhead.
- Persisted hover delay via `localStorage` (WSL uses dual control but not persistence).
- Existing OCR side panel architecture (`ocr-panel.js`) with streaming progress and a lighter inspector (lower cognitive load for quick batch monitoring).
- Possibly integrated Electron (from earlier merge) giving desktop packaging potential; WSL version did not show explicit Electron hooks.

## What the WSL Version Adds Beyond Current Main
- Rich functionality: selection system (all, unprocessed, next N/custom), filtering (processed/unprocessed), processed badges, per-image result viewing.
- Advanced batch modal: pause/resume/cancel, time remaining estimates, separate status buckets (skipped/failed).
- Multi-tab OCR viewer: formatted semantic grouping + editable JSON + editable raw text + per-field copy + copy all.
- Modular architecture: clear separation of concerns (better long-term extensibility).
- Statistics banner (total, processed, remaining) improves operational awareness.
- Structured save endpoints (JSON/TXT) with path validation.

## Decision Criteria

| Criterion | Favor Current Main | Favor WSL Base |
|-----------|--------------------|----------------|
| Visual polish needed immediately | Yes | No (needs styling work) |
| Functional expansion & scalability | Limited | Strong |
| Quick onboarding simplicity | Higher (less UI complexity) | Lower (more buttons/options) |
| Extensibility / future features | Weaker (monolithic) | Strong (modular classes) |
| Editing OCR data | Minimal | Full editing workflow |
| Selective processing / partial runs | Absent | Native |
| Desktop readiness (Electron) | Present | Needs port/backfill |

If long-term roadmap = richer OCR operations, selective workflows, editable results, then WSL architecture is the better foundation. If immediate deliverable requires aesthetically polished but simple rotation/OCR demo, stick with current main and gradually graft features.

## Recommended Path (Balanced)

1. Create a new feature branch from current `main` (e.g., `feature/advanced-ocr-ui`).
2. Introduce WSL functionality files incrementally (not wholesale overwrite).
3. Merge server enhancements first (non-breaking: `hasOCRResults`, recursive scan, OCR save endpoints).
4. Add selection + badges + “View Results” button (low-impact UI additions).
5. Add OCR Viewer modal (coexist with existing inspector initially).
6. Bring in Batch Modal / Progress replacing or augmenting existing OCR panel.
7. After functional parity achieved, unify styling: apply current main’s stylesheet tokens (colors, spacing) to new components.
8. Electron integration: ensure viewer + batch modal works in desktop window (test preload security).
9. Remove deprecated pieces (old inspector) only after confidence and regression tests.

This avoids a jarring wholesale swap while preserving the styling baseline.

## Alternative Path: Make WSL the New Base
If you prefer to “flip”:
1. Copy WSL code into a new branch `feature/wsl-functional-base`.
2. Port styling from current main (replace WSL style.css with main’s, then layer missing selectors for batch UI + viewer).
3. Integrate Electron bootstrap from current main.
4. Open PR comparing to `main`; review diff for regressions (rotation, preview, batch endpoints).
5. Merge once polished; then retire current main’s OCR panel.

Risk: Larger initial diff, harder code review, more merge conflict potential later.

## Git Branching & PR Flow (If Incremental)

```pwsh
# Ensure up-to-date main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/advanced-ocr-ui

# Stage WSL functional modules (selectively)
# (Add server delta first, then front-end modules in separate commits)
git add server.js public/js/batch-selection.js public/js/batch-progress.js ...
git commit -m "feat: add batch selection and progress modules (no UI wiring yet)"

# Push branch
git push -u origin feature/advanced-ocr-ui

# Open PR on GitHub (title: "Advanced OCR UI & Selection Framework")
```

Commit segmentation makes review easier:
- Commit 1: server endpoints + `hasOCRResults`.
- Commit 2: selection checkboxes + processed badges (hidden until server flag works).
- Commit 3: OCR viewer modal + endpoints integration.
- Commit 4: batch modal + progress client.
- Commit 5: styling harmonization.
- Commit 6: optional removal of legacy inspector / consolidation.

## Risk Mitigation
- Namespace collisions: Keep new modules in `public/js/` with distinct class names.
- Route divergence: For now, adapt WSL front-end to current `/api/ocr/*` routes or create compatibility wrappers.
- Performance: Defer heavy DOM updates (selection recalculation) until after initial render.
- User confusion: Hide advanced controls behind an “Advanced Mode” toggle initially if desired.

## Why Not Just Replace Main Now?
A full swap trades styling for function, but you lose polished UX baseline and complicate immediate testing. Incremental grafting gives you:
- Faster visual continuity.
- Lower regression risk.
- Granular rollback (revert individual commits if needed).

## Suggested Immediate Next Step
Decide: incremental graft vs replacement. Given your comment (“WSL functionality good; current styling good”), incremental graft onto current polished main is the lower-risk synthesis and leverages both strengths.

Let me know which direction you choose (Incremental Graft vs Full Replacement). Once you pick, I’ll produce a precise task breakdown and (if you approve) start implementing in small, reviewable commits.

Want a preview diff plan or a checklist for the first commit? Just say the word.

Good call—let’s make the WSL build the foundation and keep everything reversible in GitHub while we port styling in safe, reviewable steps.
