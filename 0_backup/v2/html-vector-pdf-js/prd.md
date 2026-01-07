```md
# PRD — One-Click HTML → Vector PDF Export (Single JS Output)

## 1. Overview
We need a **single JavaScript file** that, when included on any web page, enables users to click one button and download a **PDF** generated from the current DOM content inside:

- `.html_to_vector_pdf`

Primary requirement: **vector-first PDF** (selectable/searchable text where possible), with a **graceful fallback** for unsupported styling.

## 2. Problem Statement
Users want a simple “Download PDF” action that converts a specific on-screen HTML section into a PDF file, without manual copy/paste and without server-side rendering.

## 3. Goals / Success Criteria
1. **One click → PDF download** (no page refresh).
2. Export content from `.html_to_vector_pdf` with **reasonable layout fidelity** (text flow, tables, spacing).
3. PDF is **vector-first**:
   - Text is selectable/searchable whenever feasible.
   - Lines/borders/shapes render as vector where feasible.
4. Supports **multi-page pagination** (A4 portrait by default).
5. Works on modern desktop browsers: **Chrome, Firefox, Edge** latest stable.

## 4. Non-Goals (Out of Scope)
- Backend rendering, storage, or uploads.
- Perfect pixel-identical rendering for all CSS (e.g., complex filters, 3D transforms).
- Full print engine parity (no need to replicate the browser PDF print pipeline).
- Mobile Safari reliability guarantees (best-effort only unless explicitly added later).

## 5. Users & Use Cases
### Primary user
- An end-user who wants to export a report/invoice/summary displayed in the page.

### Core use cases
- Export a single report panel.
- Export a long report that spans multiple pages.
- Export a report with tables, images, headings, and links.

## 6. Deliverable
### Single output artifact
- `html_to_vector_pdf.js` (one file)

### Integration requirements
- Must work via:
  - `<script src="html_to_vector_pdf.js"></script>` (classic script) OR
  - `<script type="module" src="html_to_vector_pdf.js"></script>`
- No build step required for the consumer.

## 7. Product Requirements

### 7.1 Target Selection
- Default: export **the first** element matching `.html_to_vector_pdf`.
- If multiple matches exist:
  - Export all matches in DOM order, appended sequentially into the same PDF (configurable).

### 7.2 Button / Trigger
- Provide a default button injected into the page OR allow binding to an existing button.

Minimum requirements:
- Label: `Download PDF`
- Disabled state while generating
- Status text: `Generating…`

### 7.3 Output PDF
Default settings:
- Paper: **A4**
- Orientation: **Portrait**
- Margins: configurable (default 12–20mm equivalent)

Filename:
- Default: `html_export_YYYYMMDD_HHMMSS.pdf` (local time)
- Allow override: `fileName` option or callback.

### 7.4 Vector-First Rendering Rules
We must implement a **two-tier render strategy**:

**Tier A: Vector-first conversion**
- Convert DOM to a PDF document model that preserves text as text and draws shapes as vectors where possible.
- Preserve:
  - Text content, basic styling (font size/weight/style), alignment
  - Lists (ul/ol)
  - Tables (basic grid layout)
  - Borders/backgrounds (basic)
  - Hyperlinks (anchor tags) when feasible

**Tier B: Fallback (minimal rasterization)**
- If an element or style is unsupported in Tier A, rasterize only that sub-tree as an image and embed it into the PDF at the correct position.
- Fallback must be isolated to the smallest reasonable blocks (e.g., charts/canvas/complex CSS), not the entire page by default.

### 7.5 Pagination
- Automatic page breaks for overflow.
- Avoid breaking:
  - lines of text mid-line
  - table rows (prefer `row keep together` when feasible)
- Support optional CSS hints:
  - `data-pdf-keep-together="true"`
  - `data-pdf-page-break-before="true"`
  - `data-pdf-page-break-after="true"`

### 7.6 Assets & Fonts
- Images:
  - Support `<img>` and CSS `background-image` (best-effort).
- Fonts:
  - Use browser-available fonts by default.
  - Optional: allow providing font URLs for embedding to improve fidelity.
  - If embedding fonts increases complexity, document the limitation and keep a predictable fallback.

### 7.7 Links
- Preserve clickable links for `<a href="...">` where feasible:
  - External URLs
  - `mailto:`
- Non-required: internal anchors within PDF.

## 8. Configuration API (JS)
The single JS file must expose a minimal API.

### 8.1 Global API (example shape)
- `window.HtmlToVectorPDF.init(options)`
- `window.HtmlToVectorPDF.export(optionsOverride)`

### 8.2 Options (minimum)
- `selector` (default: `.html_to_vector_pdf`)
- `button`:
  - `mode`: `"inject"` | `"bind"`
  - `targetSelector` (if bind)
  - `label`, `generatingLabel`
- `pdf`:
  - `format`: `"A4"` (default)
  - `orientation`: `"portrait"` (default)
  - `marginMm`: number | { top, right, bottom, left }
  - `fileName`: string | (ctx) => string
- `multiNodeMode`: `"first"` | `"all"`
- `render`:
  - `mode`: `"vector-first"` (default)
  - `fallbackRaster`: true (default)
  - `rasterScale`: number (default 2)
- `debug`:
  - `enabled`: boolean
  - `logLevel`: `"silent" | "info" | "verbose"`

## 9. Technical Requirements

### 9.1 Single JS File Constraint
- The project must produce exactly **one** `.js` file as the deliverable.
- External dependencies are allowed **only** if loaded dynamically at runtime (e.g., via ESM dynamic import or script injection), but:
  - The consumer still only adds **one** script file.
  - The behavior must fail clearly if CDN is blocked (error callback + message).
- If runtime dependencies are used, we must support:
  - Configurable CDN URLs
  - Integrity/caching considerations documented

### 9.2 Performance
- First click export time target:
  - Typical report (1–3 pages): under 2–5 seconds on modern desktop
- Must not freeze the UI entirely:
  - Use async yields (`await`, `requestAnimationFrame`) during heavy work
- Provide progress hooks (optional) for UI updates:
  - `onProgress(stage, detail)`

### 9.3 Security
- No exfiltration: all processing is local in browser.
- No network calls except optional CDN dependency fetches.
- Sanitize/ignore `javascript:` links in anchors (do not embed unsafe actions).

### 9.4 Browser Compatibility
- Latest stable:
  - Chrome
  - Firefox
  - Edge
- Best-effort Safari desktop (document known issues if any).

## 10. UX Requirements
- Button placement (inject mode):
  - Default: top-right corner of `.html_to_vector_pdf` container OR fixed corner of viewport (configurable)
- States:
  - Idle: `Download PDF`
  - Working: disabled + `Generating…`
  - Success: triggers download immediately, then returns to idle
  - Error: returns to idle + emits readable error message (console + optional callback)

## 11. Error Handling
Must emit deterministic errors:
- No element found by selector
- Element hidden or zero-size
- Dependency load failure (if using CDN)
- Asset fetch failure (cross-origin image tainting)
- PDF generation failure

Provide:
- `onError(error)` callback
- Error codes (string) for predictable handling

## 12. Acceptance Criteria (Definition of Done)
1. Including the single JS file and calling `init()` produces a working button and export.
2. Exported PDF:
   - Contains the content of `.html_to_vector_pdf`
   - Multi-page works for long content
3. Text is selectable/searchable for normal text blocks (not a single full-page screenshot PDF).
4. Tables render with readable row/column structure (basic grid).
5. Images render when same-origin; for cross-origin images, a clear limitation is documented and a fallback behavior exists.
6. Works in latest Chrome and Firefox with no console errors in the happy path.

## 13. Risks & Mitigations
- **HTML/CSS coverage is large** → use a limited “supported subset” for vector mode + minimal raster fallback for the rest.
- **Cross-origin images** can block canvas-based fallback → document requirement: same-origin or CORS-enabled images; optionally prefetch + convert to data URL if allowed.
- **Font fidelity** may vary → allow optional font embedding configuration; document defaults.

## 14. Test Plan
Minimum test pages:
1. Simple report: headings + paragraphs + lists + link
2. Table-heavy report: 20–50 rows, multi-page
3. Mixed assets: images + backgrounds + icons
4. Long content: 10+ pages
5. Multiple `.html_to_vector_pdf` blocks (multiNodeMode = all)

Validation checks:
- PDF downloads with correct filename
- Text selection works in PDF viewer
- No clipped content at page boundaries
- Reasonable layout match vs on-screen view

## 15. Milestones (Engineering)
- M1: Basic export button + single-page vector-first text/layout subset
- M2: Pagination + tables + links
- M3: Fallback rasterization for unsupported blocks
- M4: Hardening (errors, config, performance), docs and demo page
```
