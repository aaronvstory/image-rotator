// P0–P3 Implementation Plan for Image Manipulator - WSL Build
// (Senior-level, implementation-ready, aligned to current vanilla JS + modular JS stack)

// =======================================
// 0. Stack & Architectural Baseline
// =======================================
//
// Current:
// - Frontend: vanilla JS with classes [public/script.js:1], modular helpers [public/js/batch-selection.js:1], [public/js/batch-progress.js:1], etc.
// - Markup: [public/index.html:1] single-page layout
// - Styles: [public/style.css:1] modern dark(ish) theme, but inconsistent tokens, gradients, badges, controls
// - Backend: Node/Express + SSE batch endpoint (not detailed here but assumed from /api/batch/* routes)
// - Pattern: Single global ImageManipulator instance [public/script.js:825]
//
// Plan principles:
// - Keep current stack (no React requirement) but structure like a componentized SPA (JS modules/classes for each concern).
// - Introduce a central UI/selection/view state store to eliminate drift between DOM and logic.
// - Design system via CSS variables and BEM/utility-like classes applied to existing HTML, minimal structural change.
// - Performance: Pagination + lightweight virtualization pattern; keep ≤ ~500 DOM cards active.
// - Prepare clean interfaces for AI features without blocking current core work.

// =======================================
// 1. Design System (P2, but informs P0–P1 implementation)
// =======================================
//
// 1.1 Theme Tokens (use as CSS variables on :root)
//
// In public/style.css, define core scales:
//
// :root {
//   /* Colors */
//   --color-bg-app: #020817;                 /* slate/ink */
//   --color-bg-elevated: #0f172a;
//   --color-bg-subtle: #111827;
//   --color-border-subtle: #1f2937;
//   --color-border-strong: #374151;
//   --color-text-primary: #e5e7eb;
//   --color-text-muted: #9ca3af;
//   --color-text-soft: #6b7280;
//   --color-accent: #38bdf8;                 /* primary CTA */
//   --color-accent-soft: #0ea5e9;
//   --color-accent-alt: #8b5cf6;             /* secondary accent for highlights */
//   --color-success: #22c55e;
//   --color-warning: #fbbf24;
//   --color-error: #f97316;
//   --color-danger: #ef4444;
//   --color-info: #38bdf8;
//
//   /* Radii */
//   --radius-xs: 2px;
//   --radius-sm: 4px;
//   --radius-md: 6px;
//   --radius-lg: 8px;
//   --radius-xl: 12px;
//
//   /* Spacing */
//   --space-1: 4px;
//   --space-2: 8px;
//   --space-3: 12px;
//   --space-4: 16px;
//   --space-5: 24px;
//   --space-6: 32px;
//
//   /* Typography */
//   --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', -system-ui, sans-serif;
//   --font-size-xs: 10px;
//   --font-size-sm: 12px;
//   --font-size-md: 14px;
//   --font-size-lg: 16px;
//   --font-size-xl: 20px;
//   --font-size-2xl: 24px;
//   --font-weight-normal: 400;
//   --font-weight-medium: 500;
//   --font-weight-semibold: 600;
//   --font-weight-bold: 700;
//
//   /* Elevation */
//   --elevation-sm: 0 4px 10px rgba(15,23,42,0.5);
//   --elevation-md: 0 10px 30px rgba(15,23,42,0.7);
//
//   /* Component specifics */
//   --btn-height: 32px;
//   --transition-fast: 0.15s ease-out;
//   --transition-med: 0.25s ease;
// }
//
// Apply globally:
// body {
//   font-family: var(--font-sans);
//   background: var(--color-bg-app);
//   color: var(--color-text-primary);
// }
//
// Remove loud gradients / pastel pills from existing CSS and restyle using these tokens:
// - Header: solid/soft gradient within dark palette; no rainbow.
// - Stats/badges: flat, subtle backgrounds; rely on semantic tokens.
//
// 1.2 Buttons (utility classes, reused everywhere)
//
// .btn {
//   display: inline-flex;
//   align-items: center;
//   justify-content: center;
//   gap: var(--space-1);
//   padding: 0 var(--space-3);
//   height: var(--btn-height);
//   border-radius: var(--radius-md);
//   font-size: var(--font-size-sm);
//   font-weight: var(--font-weight-medium);
//   border: 1px solid transparent;
//   background: transparent;
//   color: var(--color-text-primary);
//   cursor: pointer;
//   transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
// }
// .btn-primary {
//   background: var(--color-accent);
//   color: #020817;
//   box-shadow: var(--elevation-sm);
// }
// .btn-primary:hover:not(:disabled) {
//   background: var(--color-accent-soft);
//   box-shadow: var(--elevation-md);
//   transform: translateY(-1px);
// }
// .btn-secondary {
//   background: var(--color-bg-subtle);
//   border-color: var(--color-border-subtle);
//   color: var(--color-text-primary);
// }
// .btn-ghost {
//   background: transparent;
//   color: var(--color-text-muted);
// }
// .btn-destructive {
//   background: var(--color-danger);
//   color: #fff;
// }
// .btn:disabled {
//   opacity: 0.4;
//   cursor: not-allowed;
//   box-shadow: none;
// }
//
// 1.3 Badges
//
// .badge {
//   display: inline-flex;
//   align-items: center;
//   gap: 4px;
//   padding: 2px 6px;
//   border-radius: var(--radius-sm);
//   font-size: var(--font-size-xs);
//   font-weight: var(--font-weight-medium);
// }
// .badge-success  { background: rgba(34,197,94,0.12);  color: var(--color-success); }
// .badge-warning  { background: rgba(251,191,36,0.12); color: var(--color-warning); }
// .badge-error    { background: rgba(239,68,68,0.12);  color: var(--color-danger); }
// .badge-info     { background: rgba(56,189,248,0.12); color: var(--color-info); }
//
// 1.4 Scrollbars
//
// Apply consistent dark scrollbars to body and key scrollable panes, no nested scroll unless necessary:
// * { scrollbar-width: thin; scrollbar-color: var(--color-border-subtle) transparent; }
// ::-webkit-scrollbar { width: 8px; }
// ::-webkit-scrollbar-thumb { background: var(--color-border-subtle); border-radius: 999px; }
//
// 1.5 Componentization Strategy
//
// - Keep HTML structure; clean classes:
//   - .app-header, .controls-section, .toolbar, .image-grid, .image-card.
// - Use semantic modifiers: .toolbar--view, .toolbar--filter, .toolbar--primary.
// - All key layout, colors, radii refer to tokens above.
// - This system underpins all phases; implement tokens first, then refactor usages incrementally.

// =======================================
// 2. P0 – Selection Model & “No Images Selected” Bug Fix
// =======================================
//
// Goal: Single source of truth for selection, consumed by:
// - Selection badge
// - Checkboxes
// - Start Batch OCR payload
// - Scope-aware select all / clear selection
//
// 2.1 Data Model (frontend)
//
// Extend/normalize image model (no backend change required yet):
// type ImageItem = {
//   id: string;              // stable key (fullPath or hash)
//   fullPath: string;
//   relativePath: string;
//   filename: string;
//   status?: 'unprocessed' | 'processing' | 'processed' | 'error' | 'needs_review';
//   rotation?: 0 | 90 | 180 | 270;
//   docType?: 'dl_front' | 'dl_back' | 'selfie' | 'other';    // P3
//   confidence?: number;                                      // P3
// };
//
// 2.2 Central Selection Store
//
// BatchSelection already exists [public/js/batch-selection.js:6]; ensure it is the only source of truth.
//
// - ImageManipulator.renderImages():
//   - After setting this.images, call batchSelection.setAvailableImages(this.images.map(i => i.fullPath)) [already present at 417–420].
////   - Do NOT manipulate checkboxes directly except via render/update from this store.
//
// - Image card checkbox:
//   - Uses onclick="imageManipulator.toggleImageSelection(image.fullPath)" [public/script.js:451-456].
//   - toggleImageSelection delegates to BatchSelection.toggleImage.
//
// - BatchSelection:
//   - getSelectedItems(images) already derives payload from selectedIds [public/js/batch-selection.js:134-147].
//   - This is the exact data used by startBatchOCR.
//
// 2.3 Start Batch OCR Behavior
//
// In ImageManipulator.startBatchOCR [public/script.js:106]:
// - Always call this.batchSelection.getSelectedItems(this.images) as now.
// - If length === 0:
//   - Show error "No images selected. Use the checkboxes or 'Select All Visible' to choose images."
//   - Do not make network call.
// - On success:
//   - Pass that items array directly to /api/batch/start.
//
// Ensure no competing code path:
// - Remove/avoid any DOM query like document.querySelectorAll('.batch-checkbox:checked') as a source of truth (verify in enhanced-features.js / batch-modal.js during implementation).
//
// 2.4 Defensive Patterns
//
// - When images reload (loadImages):
//   - batchSelection.setAvailableImages(newIds) prunes selections that no longer exist.
//   - onChange callback triggers UI refresh for selection badge and button states.
// - Start Batch OCR:
//   - Reads directly from getSelectedItems; cannot desync from badge.
// - Tests:
//   - Case 1: select 3 images -> badge shows 3 -> start; server receives 3 items.
//   - Case 2: clear selection -> badge 0; start disabled.
//   - Case 3: reload images; stale ids dropped; badge and payload match.
//
// This architecture eliminates the "no images selected" bug by centralizing selection and ensuring the primary action reads only from this store.

// =======================================
// 3. P1 – Performance: Virtualization, Pagination, Skeletons
// =======================================
//
// Target: Smooth with 2,000–3,000 images; ~≤500 active DOM nodes.
//
// 3.1 Pagination Model
//
// Extend ImageManipulator state:
//
// class ImageManipulator {
//   constructor() {
//     // ...
//     this.pageSize = 100;            // default
//     this.currentPage = 1;
//     this.filteredImages = [];       // after status/docType filters
//   }
// }
//
// Filtering pipeline:
// - base: this.images from backend
// - apply status filter, docType (future), hide processed, etc.
// - paginate over filteredImages.
//
// 3.2 Pagination Controls (Top or above grid)
//
// Add to HTML (conceptual):
// - Page size select: 50 / 100 / 200
// - Prev / Next buttons
// - Page indicator: "Page X of Y (Showing A–B of N)"
//
// Behavior:
// - Changing pageSize resets currentPage=1.
// - Changing filters resets to page 1.
// - Selection semantics (explicit):
//   - "Select All Visible" affects only images on current page.
//   - If future "Select All Filtered" is added, label explicitly.
//
// 3.3 Virtualized Rendering (lightweight)
//
// Implement windowed rendering per page to handle large thumbs without external libs:
//
// ImageManipulator.renderImages():
// - Compute visible slice:
//   const start = (this.currentPage - 1) * this.pageSize;
//   const end = start + this.pageSize;
//   const pageItems = this.filteredImages.slice(start, end);
//
// - Render only pageItems into #imageGrid.
// - Keep selection store across pages:
//   - setAvailableImages(this.filteredImages.map(i => i.fullPath)) so selection is across filtered set.
//   - checkboxes on current page read from isSelected().
//
// This ensures:
// - Max DOM nodes ≈ pageSize (100–200).
// - Virtualization is effectively achieved via paging.
//
// 3.4 Skeleton Loaders
//
// Use subtle skeleton cards matching dark theme:
//
// - While loading images or changing page/filter:
//   - Show skeleton grid: 12–24 skeleton-card divs with pulsing shimmer.
//   - Once data loaded, replace with real cards.
// - Implement CSS:
//   .skeleton-card {
//     background: var(--color-bg-subtle);
//     border-radius: var(--radius-lg);
//     height: 180px;
//     animation: pulse 1.2s ease-in-out infinite;
//   }
//
// Triggers:
// - showLoading(): for initial load/folder change.
// - On page/filters change: show skeleton only within grid area while awaiting response or computing.
//
// 3.5 Performance Considerations
//
// - Debounce expensive operations:
//   - Hover preview uses hoverDelay; already debounced via setTimeout [public/script.js:782].
// - Avoid layout thrash:
//   - batchSelection.onChange should update badge and a minimal set of checkboxes, which is O(pageSize).
// - Backend:
//   - /api/images can stay as is (return full set); paging is client-side for now.

// =======================================
// 4. P1 – Top Control Panels Restructure
// =======================================
//
// Reorganize into three toolbars stacked in controls-section:
//   1) View Controls
//   2) Filtering & Selection
//   3) Primary Action Bar
//
// 4.1 View Controls (Grid Size + Hover Delay)
//
// HTML (concept):
// <div class="toolbar toolbar--view">
//   <div class="field-inline">
//     <label for="gridSize">Grid size</label>
//     <input type="range" id="gridSize" ...>
//     <input type="number" id="gridSizeInput" ...>
//   </div>
//   <div class="field-inline">
//     <label for="hoverDelay">Hover delay</label>
//     <input type="range" id="hoverDelay" ...>
//     <input type="number" id="hoverDelayInput" ...>
//   </div>
// </div>
//
// Behavior:
// - Grid size slider + numeric input (bi-directional):
//   - min: 100, max: 400, step: 20.
//   - #gridSizeInput shows px; updates slider and CSS var --grid-size.
// - Hover delay (already has slider + numeric in seconds):
//   - Keep; visually align with grid control.
//
// Implementation in ImageManipulator.setupGridControls() [public/script.js:149]:
// - Add gridSizeInput element.
// - Apply shared helper:
//   function setGridSize(px) { clamp 100–400; update slider, numeric, and --grid-size. }
//   Events:
//     slider input -> setGridSize(value)
//     numeric input -> setGridSize(value)
//
// Accessibility:
// - Labels associated via for / id.
// - Inputs focusable; slider+number both keyboard operable.
//
// 4.2 Filtering & Selection Toolbar
//
// HTML:
// <div class="toolbar toolbar--filter">
//   <!-- Status filters -->
//   <div class="segmented-control">
//     [All] [Processed] [Unprocessed] [Error] [Needs review] [Not DL]
//   </div>
//   <!-- Selection actions -->
//   <div class="selection-actions">
//     <button class="btn btn-secondary" id="selectAllVisible">Select All Visible</button>
//     <button class="btn btn-secondary" id="selectAllUnprocessedVisible">Select All Unprocessed Visible</button>
//     <button class="btn btn-ghost" id="clearSelectionBtn">Clear Selection</button>
//   </div>
// </div>
//
// Behavior:
// - Status filter buttons:
//   - Update this.currentFilter and recompute filteredImages.
//   - Then reset page to 1 and re-render.
// - Selection actions operate only on current page items, using batchSelection.add/remove APIs (to be added):
//   - selectAllVisible: adds all pageItems ids.
//   - selectAllUnprocessedVisible: adds only those with status=unprocessed (future).
// - Explicit scope copy near buttons, e.g., small text "Selection scope: visible page".
//
// 4.3 Primary Action Bar
//
// HTML:
// <div class="toolbar toolbar--primary">
//   <div class="selection-summary">
//     <span class="badge badge-info">Selected: <span id="selectionCount">0</span></span>
//   </div>
//   <button id="startBatchOCRBtn" class="btn btn-primary">
//     Start Batch OCR
//   </button>
// </div>
//
// Rules:
// - Start Batch OCR:
//   - Disabled when selectionCount === 0.
//   - On click, calls startBatchOCR() which uses batchSelection (P0 behavior).
// - Selection badge:
//   - Updated in updateBatchUI() [public/script.js:82].
//
// This grouping clarifies hierarchy and keeps the primary CTA visually distinct.

// =======================================
// 5. P2 – Cohesive Cards, Rotate Controls, Status Badges
// =======================================
//
// 5.1 Image Card Layout
//
// Card elements:
// - Checkbox (top-left)
// - Status / Doc-type badges (top-right)
// - Thumbnail
// - Filename
// - Hover controls (rotate / view OCR)
//
// Card behavior states:
// - Default: subtle border.
// - Hover: slight elevation.
// - Selected: accent border/background.
// - Error/Needs Review: same layout + badge; not only color-coded.
//
// CSS refinements (tokens):
// .image-card {
//   position: relative;
//   background: var(--color-bg-elevated);
//   border-radius: var(--radius-lg);
//   border: 1px solid var(--color-border-subtle);
//   box-shadow: var(--elevation-sm);
//   transition: all var(--transition-med);
// }
// .image-card:hover {
//   box-shadow: var(--elevation-md);
//   border-color: var(--color-accent);
// }
// .image-card--selected {
//   border-color: var(--color-accent);
//   box-shadow: 0 0 0 1px rgba(56,189,248,0.4), var(--elevation-md);
// }
//
// 5.2 Rotate Controls
//
// Replace pastel gradient buttons with icon-only subtle controls:
//
// .image-controls {
//   display: flex;
//   justify-content: flex-end;
//   gap: var(--space-1);
//   margin-top: var(--space-1);
// }
// .icon-button {
//   width: 22px;
//   height: 22px;
//   display: inline-flex;
//   align-items: center;
//   justify-content: center;
//   border-radius: var(--radius-sm);
//   background: var(--color-bg-subtle);
//   color: var(--color-text-muted);
//   border: 1px solid transparent;
//   cursor: pointer;
//   transition: all var(--transition-fast);
//   font-size: 10px;
// }
// .icon-button:hover {
//   background: var(--color-bg-elevated);
//   color: var(--color-accent);
//   border-color: var(--color-border-subtle);
// }
// .image-card:hover .image-controls,
// .image-card:focus-within .image-controls {
//   opacity: 1;
// }
//
// HTML fragment in createImageCard():
// - Use <button class="icon-button" aria-label="Rotate left 90 degrees"> with appropriate icons.
// - Shown on hover/focus to reduce clutter, but remain keyboard reachable (tab index).
//
// 5.3 Status & Doc-Type Badges
//
// Standardize:
// - Status (OCR):
//   - Processed -> .badge-success "OCR'd"
//   - In progress -> .badge-info with subtle spinner
//   - Needs review -> .badge-warning "Needs review"
//   - Error -> .badge-error "Error"
// - Doc-type (P3):
//   - e.g., .badge-info with "DL Front" / "Selfie".
//
// Position:
// - Container top-right:
//   <div class="card-badges">
//     <span class="badge badge-success">OCRd</span>
//     <span class="badge badge-info">DL Front</span>
//   </div>
//
// Implementation:
// - Map server-side status fields to these semantic badges in createImageCard().
// - Remove legacy .ocr-processed-badge; replace with unified badge system.

// =======================================
// 6. P3 – AI Features: Classification, Auto-Rotation, Confidence
// =======================================
//
// Design for future, implementable via backend endpoints and lightweight models.
//
// 6.1 Data Contract
//
// For each image, backend can provide:
//
// {
//   ...base image fields,
//   docType: 'dl_front' | 'dl_back' | 'selfie' | 'other' | 'unknown',
//   docTypeConfidence: number,        // 0–1
//   orientationDegrees: 0 | 90 | 180 | 270 | null,
//   ocr: {
//     status: 'none' | 'queued' | 'running' | 'success' | 'error',
//     confidence: number | null,      // 0–1
//     model: 'tesseract' | 'gpt-4o' | 'custom-vlm',
//     lastRunAt: string
//   }
// }
//
// 6.2 Auto-Rotation Pipeline
//
// - Run on backend (Node + Python worker or Node + native lib), not Tesseract orientation.
// - When loading images or starting batch:
//   - If orientationDegrees is provided and != 0, rotate preview and store rotation.
// - Manual override:
//   - User rotate action updates authoritative rotation state via /api/rotate.
//   - Backend persists final orientation; auto-rotation suggestions do not override manual changes.
//
// Frontend:
// - On createImageCard, display image with correct orientation via updated thumbnail.
// - Orientation is transparent to user except for consistent display.
//
// 6.3 Document-Type Classification
//
// Backend:
// - Endpoint /api/classify-docs runs classifier for given images or pre-populates on /api/images.
// - Caches predictions; includes docType + confidence in response.
// - Uncertain predictions (confidence < threshold) => docType = 'unknown', surfaced as Needs Review.
//
// UI:
// - Top filter bar adds "DL Front", "Exclude Selfies", "Exclude Backs" toggles.
// - Default: show DL Front + Others; optionally hide selfies/backs from batch unless explicitly included.
// - Cards show doc-type badge (e.g., 'DL Front').
//
// 6.4 Confidence & Review Queue
//
// - For OCR results, ensure backend returns:
//   - overallConfidence (0–1), field-level if available.
// - Store in image.ocr.confidence.
//
// UI:
// - In card or modal, show confidence badge: e.g., 76%.
// - After batch completes, show quick filter "Show < 80% confidence":
//   - filters to review queue list.
// - Provide "Select all low-confidence" + "Rerun OCR with [Model X]" button.
//
// Batch rerun safety:
// - Rerun triggers confirmation dialog summarizing count and model/price tier.
// - Backend tags each OCR run with model + timestamp to avoid accidental double billing.

// =======================================
// 7. OCR Prompt Templates (Backend-Driven Spec)
// =======================================
//
// Not implemented in frontend here, but define contracts.
//
// Example: For DL front extraction:
//
// System prompt snippet:
// - "You are an OCR and data extraction engine for US driver license front images."
// - "If the image is not a US driver license front, respond with {'isDlFront': false, 'reason': '...'} and do not hallucinate fields."
//
// User/content schema:
// {
//   "imageDescription": "Base64 or reference",
//   "expectedType": "us_dl_front",
//   "requiredFields": [
//     "fullName","address","dateOfBirth","licenseNumber",
//     "issueDate","expiryDate","class","restrictions"
//   ]
// }
//
// Response schema:
// {
//   "isDlFront": boolean,
//   "fields": { ... },
//   "confidence": number,            // 0–1
//   "fieldConfidence": { ... }
// }
//
// Frontend relies on:
// - Structured JSON from backend for formatted view.
// - confidence and isDlFront to drive badges and review queues (P3).

// =======================================
// 8. Phase-Aligned, Ticket-Ready Breakdown
// =======================================
//
// P0 – Immediate (Blocker)
// ------------------------
// 1) Centralize selection state
//    - Verify all selection reads/writes use BatchSelection [public/js/batch-selection.js:6].
//    - Remove any alternative DOM-based selection logic (other JS files).
//    - Ensure ImageManipulator.startBatchOCR() uses getSelectedItems() only.
// 2) Robust Start Batch OCR
//    - Disable button when selectionCount=0.
//    - Show explicit error when no selected items.
//    - Add tests around reload, filter, recalc.
//
// P1 – Core Performance & UX
// --------------------------
// 3) Implement client-side filters + pagination
//    - Add status filter buttons and handlers.
//    - Track filteredImages, pageSize, currentPage.
//    - Render only pageItems (<= pageSize).
// 4) Add explicit "Select All Visible" / "Select All Unprocessed Visible" actions
//    - Add methods to BatchSelection: selectMany(ids: string[]).
//    - Wire toolbar buttons to operate on pageItems.
//    - Label scope clearly.
// 5) Skeleton loading states
//    - Show skeletons on initial load, directory change, and page transitions.
// 6) Restructure top controls into three toolbars
//    - View: grid + hover controls with dual inputs.
//    - Filter & Selection: status filters + scoped selection buttons.
//    - Primary: selection count + Start Batch OCR (primary CTA).
//
// P2 – Design System & Cohesion
// -----------------------------
// 7) Introduce CSS tokens and unify theme
//    - Implement :root variables and refactor key components off gradients/pastels.
// 8) Normalize buttons, badges, scrollbars
//    - Replace ad hoc styles with .btn, .badge, themed scrollbars.
// 9) Redesign image cards
//    - Compact, modern dark cards.
//    - Hover-only rotate controls via icon buttons.
//    - Unified status/doc-type badges.
// 10) Grid Size numeric input
//    - Implement bi-directional sync with slider, matching Hover Delay.
//
// P3 – AI & Review Workflow
// -------------------------
// 11) Backend: implement classification + orientation prediction
//    - Expose via /api/images or dedicated endpoints.
// 12) Frontend: show doc-type badges + filters
//    - Add filters for DL front/back/selfie/other.
// 13) Backend: extend OCR API for confidence scores and metadata
//    - Include model, confidence, field confidence.
// 14) Frontend: review queue
//    - Quick filter for < 80% confidence.
//    - Bulk rerun control with model selection and confirmation.
// 15) Ensure auditability
//    - Display which model/settings were used per run in OCR viewer.
//
// This plan is ready for the engineering team to split into tickets by phase, implement incrementally on the existing WSL build, and evolve toward AI-powered, production-grade UX without a disruptive rewrite.
