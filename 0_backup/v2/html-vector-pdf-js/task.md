```md
# Tasks (derived from `prd.md`)

## P0 — Product API / UX
- [ ] Add `window.HtmlToVectorPDF.init(options)` + optional button inject/bind flow (keep `html_to_vector_pdf.generatePdf` as low-level API).
- [ ] Add deterministic error codes + `onError` callback (missing element, zero-size, dependency/image failure, generation failure).
- [ ] Add progress hook `onProgress(stage, detail)` and async yields to reduce UI freezes on long documents.

## P1 — Generic library hardcoding cleanup
- [ ] Replace project-specific `DEFAULT_EXCLUDE_SELECTORS` with:
  - [ ] empty-by-default library defaults, and
  - [ ] optional `preset` presets (or external preset file).

## P1 — Maintainability refactor
- [ ] Split `services/pdfGenerator.ts` (>300 LOC) into small modules:
  - config/types, px↔mm utils, DOM traversal, text layout, borders/backgrounds, image handling, pagination, renderer.
- [ ] Add a minimal unit/integration test harness (even one smoke test in headless browser) for `generatePdf` happy path.

## P2 — Rendering improvements (PRD gaps)
- [ ] Add "keep together" hints (`data-pdf-keep-together="true"`) and avoid splitting table rows when feasible.
- [ ] Add link preservation for `<a href>` (safe URL allowlist; block `javascript:`).
```
