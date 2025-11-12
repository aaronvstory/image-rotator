<#
    Finish Line Plan helper for the "Harden batch OCR flow" pull request.
    Running this script prints the actionable checklist that should remain lint-clean.
#>
[CmdletBinding()]
param(
    [ValidateSet('All','Checklist','Smoke','Gate')]
    [string]$Section = 'All'
)

$checklist = @"
## Finish Line Checklist
1. **Batch start sanitization** – In `image-manipulator/backend/routes/batch.js`, keep the `IMAGE_DIR` existence guard, enforce API-key presence, and ensure `isPathInside` continues to reject any item path outside the resolved root. Reconfirm chunk-size clamping to avoid runaway payloads.
2. **App origin enforcement & SSE hygiene** – Verify the `/api/batch/progress/:jobId` handler only grants CORS to the configured origin, sends initial heartbeats, and always unregisters listeners on `close` to prevent event leaks.
3. **Job lifecycle correctness** – Exercise `BatchManager` so `_checkJobCompletion` transitions to `COMPLETED`/`COMPLETED_WITH_ERRORS`, schedules TTL cleanup, and never reopens cancelled jobs. Confirm retry bounds respect `MAX_RETRY_COUNT`.
4. **Processor cancellation safety** – In `BatchProcessor`, confirm cancellation flips items to skipped-with-error, requeues pending work appropriately, and `_ensureJobCompletion` fires even when providers throw.
5. **Result persistence hardening** – Double-check `saveOCRResults` and `resolveImagePath` integration so every write stays inside the job's `imageDir`, applying overwrite policies without clobbering sibling folders.
6. **Client batch controls wiring** – Ensure `public/js/enhanced-features.js`, `batch-selection.js`, and `batch-modal.js` wire the toggles, selection presets, and modal actions so UI commands reach the new batch endpoints.
7. **Documentation & environment parity** – Update `.env.example`, `README.md`, and `README-ELECTRON.md` to call out `OPENROUTER_API_KEY`, `APP_ORIGIN`, and new batch controls so deployers configure security-critical settings before shipping.
"@

$smokeTests = @"
## Smoke Test Routine
1. `npm install` (fresh workspace) then `npm run server` to launch the API on the mapped drive path.
2. From another shell run `npm start` (Electron optional) or open `http://localhost:3001` to load the UI.
3. Load the sample directory under `tests/100-test-folders-for-testing/Teresa Whitworth_51951048/` and confirm thumbnails appear.
4. Kick off a batch via the new modal, watch the SSE progress stream, and ensure stats advance to 100%.
5. Pause, resume, and cancel mid-run; verify the stream broadcasts each transition and the UI buttons reflect the new state.
6. Inspect `image-manipulator/.ocr_jobs` for JSON/TXT outputs, ensuring overwrite policies follow the chosen option.
7. Run `npm test` (especially `sse-route.test.js`) to confirm automated coverage passes after the manual session.
"@

$goNoGo = @"
## Go / No-Go Gate
- [ ] Batch start rejects missing keys, empty items, or out-of-root paths with 4xx responses.
- [ ] Progress SSE returns `403` for untrusted origins and closes cleanly after emitting the terminal `end` event.
- [ ] Cancelling a job leaves no processing items and the cleanup timer removes the job after TTL.
- [ ] Client selection presets, batch modal actions, and the pager operate without console errors.
- [ ] Regression suite (`npm test`) and manual smoke trails both finish green.
"@

switch ($Section) {
    'Checklist' { Write-Output $checklist }
    'Smoke'     { Write-Output $smokeTests }
    'Gate'      { Write-Output $goNoGo }
    default     { Write-Output ($checklist + "`n`n" + $smokeTests + "`n`n" + $goNoGo) }
}

