notes from reviewing wsl build
- styling near idewntical to original more "polished" - only difference - wsl build jhas more functional,.ity => we will need to just set some time aside and give it some thought how to  overall just improve the layouts / sizes / padding / and everything ... we can let go now of "more  polished " build
- drag bar where we set grid size shoul.d also have number input like hobver control does
- they both need to either not have scrollbars inside or need to be hidden / styled better ... the hover draghbar has some kinda arrows inside where we enter the number- when loading project with 2800 images -> site is very slow ... we need to think through some way of handling large batches like that ... perhaps pagination .. or lazy loading...
- should consider skeleton loading and /or proper loading animations ... but main thing is ... site is very sluggish  with large numbers of images ... itr is unrealistic to be working on a site with that many ... cap should probably be 500 at a time ... we have think about how we will handle it when let';s say someone loads 2000 iamges and 500 are already ocr'd ... they need to a) be able to easily hide all already processed and b) be able o move move between pages and for example, we should have an option to "select all on this page"


- what would be truly nexzt level remarkable is
=> if we can figure out how to
a) implement auto-rotation reliably ... we tried with teserract before and it was a total  disaster ... it would
have tobe through imp-lementing actual ai inte;llligence.. a LLM ... no tessreacts etc.
and b) aspiration feature would be ... being able to filter out images which are NOT front driver licenses ... because, our goal is to run OCR onlyon front sides of DLs ... cuirrently we just take a batch approach and do OCR even on selfies + back sides ... which is ok ... but if we couldd also intelligently analyze what is what , it'd bne good ....




what happens now anyways when a back side / selfie gets analyzed?
-> we should also tuighten up the prompts for the AI so it knows what to look for and consider implementing a realistic scoring and show the scoring on each modal where we open to view the results apge how high the confidence level is on that OCR ,.... and eventually we could , after a user runss a batch of for example 500 images , at theend be able to show the user let's say all images which were done and had a confidence score of < 80% and give option to review those + option to rerun them with either a tighter prompt and/or a more expensive more capable model

URGENT BUG NOW!!!
we select 3 messages and this selector #selectionBadge shows 3 selected:


but when we press "Start Batch OCR"
#errorMessage shows up stating "no images selected" and fails ...


a high priority should definitely alsxo be restyling the three "<div class="image-controls">
                    <button class="btn-rotate btn-rotate-ccw" onclick="imageManipulator.rotateImage(7, -90)" title="Rotate Counter-Clockwise">
                        <i class="fas fa-undo-alt"></i>
                    </button>
                    <button class="btn-rotate btn-rotate-flip" onclick="imageManipulator.rotateImage(7, 180)" title="Flip 180°">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn-rotate btn-rotate-cw" onclick="imageManipulator.rotateImage(7, 90)" title="Rotate Clockwise">
                        <i class="fas fa-redo-alt"></i>
                    </button>
                </div>"


		=> the rotate buttons look totally out of place ... the whole site is styled with modern gradients, meanwhile these three buttons are pastel ugly bright .... absolute eysore ... same for the "badges" when rotating / to identiify already OCR'd images => needs cohesive styling with rest of apge ...

		=>> overall we want to make styling mode sleek/ modern/ a bit darker (not black) much tighter radiuses everywhere ... and better spacing .... also better aloignment into proper sectionss for specific controlsd ....








========================= KILO CODE ENHANCED: ======================

You are a senior full-stack engineer and product-minded designer. Based on the notes below, produce a concrete implementation plan and updated UI/UX for the WSL build of our OCR image processing app.

Objectives:
- Unify and modernize styling (more sleek, slightly dark theme, tight radiuses, better spacing, cohesive components).
- Fix critical selection/Batch OCR bug.
- Improve usability for large image sets (performance, navigation, clarity).
- Enhance per-image controls and status indicators.
- Introduce or design for intelligent AI-based features (auto-rotation, document-type filtering, confidence scoring).

Requirements:

1) Global styling and layout:
- Stop mirroring the “more polished” legacy build; instead, define a distinct, cohesive, production-ready design system for the WSL build.
- Implement:
  - Slightly dark, modern theme (not full black), with clear hierarchy and good contrast.
  - Consistent border-radius scale (small/tight radiuses across all components).
  - Consistent spacing system (vertical rhythm, predictable padding/margins).
  - Cohesive typography: clear heading hierarchy, readable body text, consistent font weights.
  - Unified button styles (primary, secondary, subtle/ghost, destructive), with hover/active states aligned to the new theme.
  - No elements that visually clash with gradients or the overall theme (no random pastels).
- Ensure all scrollable areas:
  - Avoid nested/inner scrollbars when possible.
  - Where scrollbars are necessary, style them minimally and in line with the theme.
  - Eliminate awkward or default-looking scrollbars that break aesthetic.

2) Grid size and control refinements:
- For the grid size/thumbnail size control:
  - Keep the drag bar/slider.
  - Add a synchronized numeric input alongside the slider (similar to the existing hover control pattern).
  - Ensure bi-directional sync (drag updates value, typing updates slider).
  - Make the component compact, clearly labeled, and consistent with the new design system.

3) Image list performance and large-batch handling:
- Target scenario: projects with up to 2000–3000 images.
- Requirements:
  - Page must remain responsive and not become unusably slow with large sets.
  - Implement one or more of:
    - Pagination (e.g., configurable page size with sensible defaults like 100–200).
    - Lazy loading / infinite scroll with efficient virtualization.
  - Hard or soft cap:
    - Operational cap around 500 images “active” at once for intensive operations.
  - Batch handling behavior:
    - If 2000 images are loaded and 500 are already OCR’d:
      - Provide a clear control to hide already processed images.
      - Provide intuitive page navigation (next/prev, jump to page, etc.).
      - Provide “Select all on this page” (and ensure it works reliably).
- Implement skeleton/loading states:
  - Use skeleton loaders or lightweight loading animations when:
    - Changing pages.
    - Loading new image sets.
    - Running OCR batches and fetching results.
  - These should be subtle, modern, and performant (no heavy, janky animations).

4) Selection, batch actions, and URGENT bug:
- Current bug: When 3 images are selected, #selectionBadge shows “3 selected” but clicking “Start Batch OCR” triggers #errorMessage “no images selected”.
- Fix:
  - Ensure the selection state is maintained in a single source of truth (e.g., a central store or a clearly defined JS state object).
  - Ensure “Start Batch OCR” reads from that same state.
  - Add robust checks for:
    - Correct query selectors.
    - Proper event binding.
    - No race conditions or DOM mismatches.
  - Add minimal, clear error messaging only when truly zero images are selected.
- UX:
  - Display number of selected images in a consistent, clearly visible badge or toolbar.
  - Provide “Clear selection” and “Select all on this page” actions.
  - Ensure all batch actions (including OCR, rotate, etc. if applicable) respect the same selection model.

5) Image controls (rotation, status badges, etc.):
- The existing .image-controls (rotate buttons) currently look out of place (pastel, clashing with gradients).
- Redesign:
  - Integrate rotate controls (CCW, 180°, CW) into a compact icon-only control group that:
    - Uses the new color palette and radiuses.
    - Has subtle hover/active states.
    - Aligns visually with the rest of the interface (no “eyesor” elements).
  - Ensure alignment and spacing next to each thumbnail are consistent and not visually noisy.
- Status badges:
  - Redesign badges for:
    - “Already OCR’d”
    - “In progress”
    - “Error/needs review”
  - Make them:
    - Compact, readable, consistent color-coded.
    - Non-pastel, aligned with the theme.
    - Positioned consistently on the thumbnails (e.g., top-right overlay, subtle but visible).
- Group related controls:
  - Organize controls into logical sections (e.g., global controls toolbar, batch actions toolbar, per-image overlay controls).
  - Avoid random, floating, or misaligned controls.

6) OCR intelligence and document classification (design + technical direction):
- Auto-rotation:
  - Design and propose an implementation path for reliable auto-rotation that does NOT rely on Tesseract’s orientation features, given past failures.
  - Requirements:
    - Utilize AI/ML (e.g., vision models or LLM-assisted classification) to:
      - Detect orientation.
      - Auto-rotate images to the correct orientation before OCR.
    - Provide:
      - A clear indicator if auto-rotation was applied.
      - An option to manually override rotation if detection was wrong.
- Document-type filtering:
  - Goal: Identify and prioritize front-side driver’s licenses for OCR.
  - Behavior:
    - Detect and label:
      - Front of driver’s license.
      - Back of driver’s license.
      - Selfies/human photos.
      - Other/unrelated documents.
    - Default behavior:
      - Run OCR primarily on detected front-side driver’s licenses.
    - Allow user to:
      - Filter by doc type (front DL, back DL, selfie, other).
      - Exclude non-relevant images (e.g., selfies, backs) from batch OCR with one or two clicks.
- Clarify current behavior:
  - Document what currently happens when a back side or selfie is analyzed.
  - Update logic and prompts so that:
    - The AI knows exactly what to extract from valid IDs.
    - It handles irrelevant images gracefully (e.g., “No valid ID front side detected” instead of hallucinating).

7) AI prompt tightening, scoring, and review workflow:
- Refine OCR/analysis prompts:
  - Make them explicit about:
    - Target: front side of driver’s licenses.
    - Expected fields and formats.
    - What to do when the image does not match a front-side ID (return structured “no match”/“not applicable” signals).
- Implement realistic confidence scoring:
  - For each OCR result:
    - Compute or receive a confidence score (0–100% or 0–1 scaled).
    - Display the score clearly in the result modal or detail view for each image.
  - Show:
    - Confidence indicator next to each processed image (badge or subtle label).
- Post-batch review:
  - After a user runs OCR on a batch (e.g., 500 images), provide:
    - A view listing images sorted or filterable by confidence.
    - Quick filter: “Show all results with confidence < 80%”.
    - Option to:
      - Select those low-confidence images.
      - Rerun OCR with:
        - Tighter prompts, and/or
        - A more advanced/more expensive model.
- Design this workflow to be:
  - Clear and efficient.
  - Minimal clicks to review and re-run.
  - Visually consistent with the new UI.

Deliverables:
- A detailed implementation plan covering:
  - Frontend (HTML/CSS/JS framework or vanilla) structure changes.
  - State management for selection, pagination, filters, and batch operations.
  - Styling system: colors, radiuses, spacing, typography, button and badge styles, scrollbars.
  - Performance strategy for large sets (virtualization/pagination/lazy loading).
  - Integration points for AI features (auto-rotation, doc-type detection, confidence scoring).
- Updated UI/UX:
  - Concrete descriptions of the updated layout, navigation, toolbars, per-image cards/tiles, batch controls, and modals.
  - Example HTML/CSS snippets for:
    - The grid size control (slider + numeric input).
    - The redesigned rotate controls.
    - The processed-status badges.
    - The selection toolbar and Batch OCR entry point.
- Explicit resolution for the “no images selected” bug, including how the new architecture prevents similar issues.

Focus on clarity, implementability, and consistency. The output should be immediately actionable by an engineering team.



=========== gemini 2,.5 flash analysis ============

Conversation with Gemini
can u view this apge and analyze it? froma d eveloper / style point of view?

That's an interesting request! I can definitely analyze the web page from a developer/style point of view based on the content and screenshot you've shared.

Here's an analysis of the "Image Manipulator - Bulk Photo Management" page:

🖥️ Developer/Structure Analysis
Technology & Purpose: The page title is "Image Manipulator - Bulk Photo Management," indicating its primary function is a utility for managing a large number of images. The local URL (http://localhost:3015/) suggests this is a development environment or a locally run application.

Data Handling: The page shows 2885 images loaded, implying it's designed to handle a significant volume of data, which is a key technical consideration for performance.

Core Functionality: Key features appear to include:

Folder Management: Input for a folder path, a Load button, and a Refresh button.

Bulk Processing: An OCR All button suggests the capability for Optical Character Recognition across all loaded images.

Display & Performance Controls: Settings for Grid Size (500 nw and 180px are mentioned, possibly width/size parameters) and a Preview Delay (2000ms, or 2 seconds). These indicate the developer is conscious of performance and user experience with large grids.

Image Operations (Per-Image): Each image thumbnail has several controls, suggesting granular control:

Image Filename (e.g., 2017 M.jpeg)

Rotation/Manipulation Icons: [] (Zoom/Magnify?), [] (Rotate?), and [] (Delete/Remove?). The instructions confirm a simple 90° CW rotation on click and precision buttons for other angles.

🎨 Style and User Interface (UI) Analysis
Design Aesthetic: The overall look is very utilitarian, dark-themed, and functional. The minimal styling and heavy use of text/icons suggest a focus on efficiency over flashy design—common for developer tools or internal applications.

Color Palette: It uses a dark background (black/dark blue) with light text and icons, which is popular for applications used for extended periods (dark mode).

Typography & Icons:

The title uses a large, prominent font with an icon (possibly a settings or gear icon: ).

Font usage seems clean and sans-serif.

It relies heavily on Font Awesome-style icons (e.g., , , ) next to text labels, which is an effective way to save space and quickly communicate action/status.

Layout:

The top section contains global controls (Path, Load, Refresh, OCR, Grid Size, Preview Delay).

The main area uses a grid layout for image thumbnails, which is the standard, efficient way to display many images at once, confirmed by the "Grid Size" control.

Image information and actions are neatly grouped below each thumbnail, making the per-image controls immediately available.

User Instructions: A prominent block of instructional text ( Click thumbnails for 90° CW rotation...) is included, which is necessary for a function-heavy tool with non-obvious controls.

In summary, the page is built as a high-volume, feature-rich utility prioritizing speed, dark-mode usability, and bulk functionality over complex graphical design.

Would you like me to focus on a specific element, like the performance implications of having 2885 images or the accessibility of the UI?

Current tab
Ask Gemini


================================= COMBINED =========
This is an excellent, actionable engineering plan.

You're right to be impressed—that "KILO CODE ENHANCED" prompt is outstanding. It successfully captured all of your original points, integrated the critical developer feedback (like virtualization), and structured it into a professional, actionable plan. It is *exactly* what a senior engineer would hand off to a team.

It's so good, it's essentially the deliverable you asked me to create.

Here is the high-level roadmap, organized by priority, that this plan creates. Below that, I've included the full prompt, which is ready to be given directly to your coding agent.

### 🗺️ Priority Roadmap & Task List
x
Here is the logical order of operations based on that plan:

* **P0: Critical Bug Fix (Showstopper)**
    * **Task:** Fix the "no images selected" state management bug. The app is unusable until this is resolved. (Corresponds to Section 4 of the plan).

* **P1: Core Performance & UX (The Foundation)**
    * **Task:** Implement list virtualization or pagination. This is the fix for the "site is very sluggish" issue with 2,800 images. (Section 3)
    * **Task:** Implement skeleton loaders during page/data loading to improve *perceived* performance. (Section 3)
    * **Task:** Re-group the top control panels into logical sections (Filters, Selection, Actions) for better usability. (Section 5)

* **P2: Design System & Cohesion (The "Polish")**
    * **Task:** Implement the new "sleek, modern, dark" theme (colors, fonts, spacing, radiuses). (Section 1)
    * **Task:** Redesign the "eyesore" pastel rotate buttons (`.image-controls`) to match the new theme. (Section 5)
    * **Task:** Redesign all status badges ("OCR'd," etc.) to be cohesive. (Section 5)
    * **Task:** Fix the "Grid Size" slider to include a number input, matching the Hover Delay control. (Section 2)

* **P3: "Next Level" AI Features (The Future)**
    * **Task:** Implement the AI-based image classification (DL-front, DL-back, selfie, other) to enable filtering. (Section 6)
    * **Task:** Implement AI-based auto-rotation (using a CV model, *not* Tesseract). (Section 6)
    * **Task:** Implement the confidence scoring and the "< 80% review queue" workflow. (Section 7)

---

### 🤖 Implementation Prompt for Your Agent

Here is the complete, comprehensive prompt. It hits every one of your points and is ready for your agent.

> You are a senior full-stack engineer and product-minded designer. Based on the notes below, produce a concrete implementation plan and updated UI/UX for the WSL build of our OCR image processing app.
>
> **Objectives:**
> * Unify and modernize styling (more sleek, slightly dark theme, tight radiuses, better spacing, cohesive components).
> * Fix critical selection/Batch OCR bug.
> * Improve usability for large image sets (performance, navigation, clarity).
> * Enhance per-image controls and status indicators.
> * Introduce or design for intelligent AI-based features (auto-rotation, document-type filtering, confidence scoring).
>
> **Requirements:**
>
> **1) Global Styling and Layout:**
> * Stop mirroring the “more polished” legacy build; instead, define a distinct, cohesive, production-ready design system for the WSL build.
> * Implement:
>     * Slightly dark, modern theme (not full black), with clear hierarchy and good contrast.
>     * Consistent border-radius scale (small/tight radiuses across all components).
>     * Consistent spacing system (vertical rhythm, predictable padding/margins).
>     * Cohesive typography: clear heading hierarchy, readable body text, consistent font weights.
>     * Unified button styles (primary, secondary, subtle/ghost, destructive), with hover/active states aligned to the new theme.
>     * No elements that visually clash with gradients or the overall theme (no random pastels).
> * Ensure all scrollable areas:
>     * Avoid nested/inner scrollbars when possible.
>     * Where scrollbars are necessary, style them minimally and in line with the theme.
>     * Eliminate awkward or default-looking scrollbars that break aesthetic.
>
> **2) Grid Size and Control Refinements:**
> * For the grid size/thumbnail size control:
>     * Keep the drag bar/slider.
>     * Add a synchronized numeric input alongside the slider (similar to the existing hover control pattern).
>     * Ensure bi-directional sync (drag updates value, typing updates slider).
>     * Make the component compact, clearly labeled, and consistent with the new design system.
>
> **3) Image List Performance and Large-Batch Handling:**
> * Target scenario: projects with up to 2,000–3,000 images.
> * Requirements:
>     * Page must remain responsive and not become unusably slow with large sets.
>     * Implement one or more of:
>         * **Pagination** (e.g., configurable page size with sensible defaults like 100–200).
>         * **Lazy loading / infinite scroll with efficient virtualization (windowing).**
> * Operational cap around 500 images “active” at once for intensive operations.
> * Batch handling behavior:
>     * If 2,000 images are loaded and 500 are already OCR’d:
>         * Provide a clear control to **hide already processed images**.
>         * Provide intuitive page navigation (next/prev, jump to page, etc.).
>         * Provide **“Select all on this page”** (and ensure it works reliably).
> * Implement skeleton/loading states:
>     * Use skeleton loaders or lightweight loading animations when:
>         * Changing pages.
>         * Loading new image sets.
>         * Running OCR batches and fetching results.
>
> **4) Selection, Batch Actions, and URGENT Bug:**
> * **Current bug:** When 3 images are selected, `#selectionBadge` shows “3 selected” but clicking “Start Batch OCR” triggers `#errorMessage` “no images selected”.
> * **Fix:**
>     * Ensure the selection state is maintained in a **single source of truth** (e.g., a central store or a clearly defined JS state object).
>     * Ensure “Start Batch OCR” reads from that same state.
>     * Add robust checks for correct query selectors, proper event binding, and no race conditions.
>
> **5) Image Controls (Rotation, Status Badges, etc.):**
> * The existing `.image-controls` (rotate buttons) currently look out of place (pastel, clashing with gradients).
> * **Redesign:**
>     * Integrate rotate controls (CCW, 180°, CW) into a compact icon-only control group that uses the new color palette and radiuses.
>     * Ensure alignment and spacing next to each thumbnail are consistent.
> * **Status badges:**
>     * Redesign badges for “Already OCR’d”, “In progress”, “Error/needs review”.
>     * Make them compact, readable, and aligned with the new theme (no pastels).
> * **Group related controls:**
>     * Organize controls into logical sections (e.g., global controls toolbar, batch actions toolbar, per-image overlay controls).
>
> **6) OCR Intelligence and Document Classification (Design + Technical Direction):**
> * **Auto-rotation:**
>     * Design an implementation path for reliable auto-rotation that **does NOT rely on Tesseract’s** orientation features.
>     * Utilize AI/ML (e.g., vision models) to detect and auto-rotate images *before* OCR.
> * **Document-type filtering:**
>     * Goal: Identify and prioritize **front-side driver’s licenses** for OCR.
>     * Detect and label: "Front of driver’s license," "Back of driver’s license," "Selfie/human photo," "Other."
>     * Allow user to filter by doc type and exclude non-relevant images (e.g., selfies, backs) from batch OCR.
>
> **7) AI Prompt Tightening, Scoring, and Review Workflow:**
> * **Refine OCR/analysis prompts:**
>     * Make them explicit about the target (front side of driver’s licenses) and expected fields.
>     * What to do when the image does not match: return structured “no match”/“not applicable” signals.
> * **Implement realistic confidence scoring:**
>     * Compute or receive a confidence score (0–100%) for each OCR result.
>     * Display the score clearly in the result modal for each image.
> * **Post-batch review:**
>     * After a batch run, provide:
>         * A quick filter: **“Show all results with confidence < 80%”**.
>         * An option to select those low-confidence images and **rerun OCR** with:
>             * Tighter prompts, and/or
>             * A more advanced/more expensive model.
>
> **Deliverables:**
> * A detailed implementation plan covering:
>     * Frontend (HTML/CSS/JS) structure changes.
>     * State management for selection, pagination, filters, and batch operations.
>     * Styling system: colors, radiuses, spacing, typography, button and badge styles.
>     * Performance strategy for large sets (virtualization/pagination).
>     * Integration points for AI features (auto-rotation, doc-type detection, confidence scoring).
> * Explicit resolution for the “no images selected” bug, including how the new architecture prevents similar issues.

---

### My Take on This Plan

This plan is solid. It correctly prioritizes the **critical performance bottleneck** (Section 3). Your note about the site being "very sluggish" and my analysis of the 2,885 DOM elements are the exact same problem. Implementing **virtualization** will change the app from "unusable" to "instantaneous."

It also correctly identifies that the **"URGENT BUG" is a state management failure** (Section 4), which is a P0 blocker. Finally, it takes your "next level" AI ideas and turns them from aspirations into concrete product features (Sections 6 & 7), which is how you build a great product.

This plan is comprehensive and ready to go.

============ DESIGN ONLY =============

This is a great idea. A focused design brief will get you the best results.

Here is a comprehensive prompt you can give to a front-end UI/UX designer. I've structured it as a professional brief, incorporating all your goals for a "sleek, simple, and lovable" interface.

---

### **Design Brief: UI/UX Redesign for "Image Manipulator" OCR Tool**

**Project:** UI/UX & Visual Redesign for a "WSL Build" Image Manipulator.
**Goal:** To transform a highly functional, developer-oriented utility into a professional, sleek, and intuitive application. The primary objective is to create a "lovable" and "complete" product that feels simple, modern, and professional.

**Core Vision & Aesthetic:**
* **Professional & Sleek:** The design should inspire confidence. It's a professional tool, not a creative experiment.
* **Minimal & Simple:** Reduce cognitive load. Every element should have a clear purpose. Avoid clutter.
* **Cohesive:** All components, icons, fonts, and colors must feel like they belong to a single, unified design system.
* **Dark & Modern:** We are targeting a "slightly dark" theme (not pure black). Use modern conventions like tight (small) border-radiuses and a strict spacing system.

---

### **1. Global Design System (The Foundation)**

This is the most critical part. We need a unified system before we can fix individual components.

* **Color Palette:**
    * **Base:** A dark, "off-black" or "slate gray" for the primary background.
    * **Surfaces:** A slightly lighter gray for modal windows, control panels, and image "cards" to create depth and separation.
    * **Primary Action:** A single, strong, modern color (e.g., a vibrant blue, green, or purple) to be used *exclusively* for the main call-to-action (`Start Batch OCR`) and other key interactive elements.
    * **Secondary/Subtle:** A more muted color (or a light gray) for secondary buttons (`Clear Selection`) and interactive-but-not-primary elements.
    * **Status Colors:** A clear set for:
        * **Success/Processed:** (e.g., Green)
        * **Warning/Review:** (e.g., Yellow/Orange)
        * **Error:** (e.g., Red)
        * **In Progress:** (e.g., an animated blue)
    * **Text:** Clean white/light-gray for primary text, with a softer gray for secondary/helper text.
* **Typography:**
    * Select a single, clean, sans-serif font family (e.g., Inter, Poppins, Rubik) and use it for everything.
    * Establish a clear type scale (e.g., H1, H2, H3, Body, Small) to create hierarchy. The app title, section headers, and image filenames should be visually distinct.
* **Spacing & Sizing:**
    * Implement a strict spacing system (e.g., an 8px grid). All padding and margins between elements (buttons, panels, grid items) should follow this system (e.g., 8px, 16px, 24px). This is key to fixing the current cluttered feel.
* **Iconography:**
    * Replace all current icons (Font Awesome, etc.) with a single, unified, modern icon set (e.g., Heroicons, Phosphor Icons, or a custom set). The style should be consistent (e.g., all "line" or all "solid").

---

### **2. Key Areas for Redesign**

#### **Area 1: The Main Control Panels (Highest Priority)**

* **Problem:** The current two rows of controls are cluttered, poorly grouped, and have no visual hierarchy.
* **Solution:** Re-organize all controls into logical, visually distinct sections.
    * **Section 1: View Controls:**
        * Should contain: `Grid Size` slider and the `Hover Delay` input.
        * **Task:** Redesign the `Grid Size` slider to *also* include a number input, making it identical in function to the `Hover Delay` control. Style both to be compact and modern.
    * **Section 2: Filtering & Selection:**
        * Should contain: Filters (`All`, `Processed`, `Unprocessed`) and Selection Actions (`Select All`, `Select All Unprocessed`, `Clear Selection`).
        * **Task:** Redesign these as a clean button group or tab-like interface. `Clear Selection` should be visually distinct (e.t., secondary button).
    * **Section 3: The Primary Action Bar:**
        * This area must be dominant and clear.
        * Should contain: The `[Start Batch OCR]` button.
        * **Task:** Make `[Start Batch OCR]` the *most prominent* button on the page. It should use the **Primary Action** color and be visually separated. The "Selected: 0" badge should be closely associated with it.

#### **Area 2: The Image Grid & Thumbnails**

* **Problem:** The individual image "cards" are basic.
* **Solution:**
    * Design a clean, modern "card" for each image. This includes the image preview, the checkbox, the filename, and the per-image controls.
    * The checkbox should be large, modern, and easy to click.
    * The filename text should be clean, legible, and truncate gracefully if too long.
    * The selected state of a card should be obvious (e.g., a colored border, a background tint).

#### **Area 3: Per-Image Controls & Status Badges (The "Eyesores")**

* **Problem:** The current rotate buttons (`.image-controls`) are "pastel ugly bright" and clash with the theme. The status badges are also inconsistent.
* **Solution:**
    * **Rotate Buttons:**
        * Redesign these to be subtle, dark-theme-friendly, icon-only buttons.
        * They should be perfectly aligned on every card.
        * **Crucially:** They should probably be hidden by default and only appear on hover/focus of a specific image card to reduce visual noise.
    * **Status Badges:**
        * Design a new, cohesive set of "badges" or "tags" that can be overlaid on the image thumbnail (e.g., in a corner).
        * We need designs for: `Processed` (success), `Needs Review` (warning), `Error` (error), `In Progress` (animated), and (for the future) `Not a DL`.
        * These must use the new, approved **Status Colors** and be small and unobtrusive.

### **Designer Deliverables:**

1.  **A Simple Style Guide / Component Sheet:**
    * Color Palette
    * Typography Scale
    * Icon set
    * Styled components (Primary Button, Secondary Button, Icon Button, Sliders, Checkboxes, Badges/Tags).
2.  **High-Fidelity Mockups:**
    * A single "hero" mockup of the main application screen, showing all controls and the image grid.
    * Mockups showing key states:
        * An image card in its default state.
        * An image card in its `hover` state (showing the rotate buttons).
        * An image card in its `selected` state.
        * Examples of cards with different status badges (`Processed`, `Error`, etc.).



