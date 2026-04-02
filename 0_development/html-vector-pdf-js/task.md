# Task Progress

## Current Task

- [done] Fix font metrics: Arial vs Helvetica text width differences
- [done] Fix line height calculation in PDF renderer
- [done] Fix text baseline/vertical positioning
- [done] Rebuild `dist`
- [done] Run tests and verify

## Notes

- `task.md` was empty at the start of this task.
- Added `LiberationSans` font loading path for `Arial` / `Helvetica` families.
- Text fragment positioning now prefers browser-measured widths when available.
- Baseline calculation now uses the line box height consistently.
- Added a dedicated `collapse table` path:
  - table-aware baseline now prefers measured fragment height
  - collapsed borders are resolved into shared segments and outer strokes are moved inward
- Follow-up investigation shows the remaining `window.print()` vs vector delta is now primarily page-calibration related:
  - templates use `750 x 1050` as the printform page budget
  - current helper maps only width to A4 content width
  - this leaves about `8.08mm` vertical mismatch on A4 with `6.35mm` margins
- Separate dev-console investigation shows `templates/*.html` still load `../dist/printform.js`, but root `dist/` only contains `html_to_vector_pdf.js`.
  - under Vite dev, requesting the missing `dist/printform.js` can return HTML fallback and trigger `Uncaught SyntaxError: expected expression, got '<'`
  - the `Not localhost, script skipped` message was not found in this repo and is likely from an injected extension/userscript
- Root Vite dev/build pipeline now mirrors `sample-project/printform-js/dist/printform.js` into the root `dist/printform.js` path expected by templates.
- Added optional runtime font debug logging:
  - `window.html_to_vector_pdf_debug = true` can enable debug mode globally
  - logs now show required fonts, loaded fonts, font registration, and deduped `applyTextStyle` decisions
- Runtime font debug confirmed the current template export is still using a bundle without injected `LiberationSans` data:
  - `Failed to load font LiberationSans: Font data not injected for required font/style`
  - repeated jsPDF warnings show `LiberationSans` was never registered, so text falls back to standard fonts
- Template calibration in `template-base.js` now prefers CSS 96dpi pixel sizing over width-fit-only scaling.
  - this changes printform export from `0.263066... mm/px` to `0.264583... mm/px`
  - expected effect: vector PDF should be about `0.58%` closer to browser print sizing
- Template calibration now also derives page margins from the actual `.printform_page` rect.
  - printform export centers the measured page box on A4 instead of reusing a fixed `6.35mm` margin
  - debug output now includes `baseHeightPx`, measured content size in mm, chosen margins, and fallback mode
- Parser box-model logic is now shared across text, form fields, and PDF-first text blocks.
  - added a dedicated box-model helper for border-box / content-box conversion
  - form-field text anchoring now respects border + padding on all sides
  - nested inline wrappers with padding/borders now reduce available text width consistently
- Ordinary borders now render with inside-stroke semantics instead of expanding outward from the box edge.
  - `.prowitem`-style single-row tables no longer accumulate half-stroke height on every bottom border
  - uniform border rectangles are inset by half the stroke width on all sides
- Single-line non-collapse table cells now use content-box packing for vertical placement.
  - `valign="middle"` / `vertical-align: middle` cells derive baseline from cell content height
  - this specifically targets logo/header/title style cells where text should visually sit inside the table box, not just follow the fragment top
- `dist/html_to_vector_pdf.js` was rebuilt with `build:with-fonts`.
- Full test suite passed under temporary `Node 20` runtime.
  - current status: `25` test files, `104` tests passing
