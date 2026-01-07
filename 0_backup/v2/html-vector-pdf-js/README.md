<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Globe3 PDF Converter (Vector Engine)

A powerful, client-side library for generating vector-based PDFs from HTML content. Unlike traditional screenshot-based converters, this engine renders text as true text (selectable & searchable) and shapes as vectors, ensuring high-quality output at any zoom level.

## 🚀 Features

- **Vector-First Rendering**: Text remains text, borders become vector lines. High-quality print output.
- **Client-Side Only**: Runs entirely in the browser using `jspdf`. No server required.
- **Single File Drop-in**: Zero-dependency integration (except the bundled jspdf) via a single script file.
- **Smart Layout**:
  - Handles text wrapping and alignment matching browser behavior.
  - Supports standard CSS borders (individual side colors/widths).
  - Background colors.
  - Image rendering (including automatic SVG-to-PNG conversion).
- **Pagination Control**: Automatic page breaks with support for manual break triggers.
- **Configurable**: extensive options for margins, page size, and format.

## 📦 Usage

### 1. Include the Script
Include the generated script in your HTML file.

```html
<script src="./dist/globe3-pdf.js"></script>
```

### 2. Basic Export
Call `Globe3PdfGenerator.generatePdf(target, config)`.

`target` can be:
- an element id (e.g. `"my-report"`)
- a CSS selector (e.g. `"#my-report"` / `".html_to_vector_pdf"`)
- an `HTMLElement`

If a selector matches multiple nodes, they are exported in DOM order and appended into the same PDF (see `index_multi.html`).

```html
<div class="html_to_vector_pdf" id="my-report">
  <h1>Monthly Report</h1>
  <p>This text will be selectable in the PDF.</p>
</div>

<button onclick="downloadReport()">Download PDF</button>

<script>
  function downloadReport() {
    Globe3PdfGenerator.generatePdf('.html_to_vector_pdf', {
      filename: 'report.pdf',
      pageSize: 'a4',
      margins: { top: 10, right: 10, bottom: 10, left: 10 }
    });
  }
</script>
```

### 3. Forced Page Breaks
Add a `data-pdf-page-break-before="true"` attribute to force a new page before an element.

```html
<div data-pdf-page-break-before="true"></div>
```

### 4. Consistent Scaling (Recommended)
If your printable area uses a fixed pixel width (example: `.pdf-page { width: 750px; }`), you can map that width to the PDF page width to reduce overflow/wrapping differences:

```js
const margins = { top: 6.35, right: 6.35, bottom: 6.35, left: 6.35 };
const pageWidthMm = 210; // A4 portrait width
const baseWidthPx = document.querySelector('.pdf-page')?.getBoundingClientRect().width || 750;
const pxToMm = (pageWidthMm - margins.left - margins.right) / baseWidthPx;

await Globe3PdfGenerator.generatePdf('.html_to_vector_pdf', { margins, render: { pxToMm } });
```

## ⚙️ Configuration

The `generatePdf` function accepts a configuration object with the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | `"document.pdf"` | Name of the output file. |
| `pageSize` | `"a4" \| "letter"` | `"a4"` | Page size standard. |
| `orientation` | `"portrait" \| "landscape"` | `"portrait"` | Page orientation. |
| `margins` | `{ top, right, bottom, left }` | `{ top:10, right:10, bottom:10, left:10 }` | Margins in millimeters. |
| `excludeSelectors` | `string[]` | (built-in list) | Elements matching these selectors are skipped (scripts/styles/iframes + Globe3-specific defaults). |
| `text.scale` | `number` | `1` | Global scaling factor for text size. |
| `text.baselineFactor` | `number` | `0.78` | Baseline alignment tweak for better text positioning. |
| `render.pxToMm` | `number` | (auto) | Override px→mm conversion for consistent scaling across layouts. |
| `pagination.pageBreakBeforeSelectors` | `string[]` | `[".pagebreak_bf_processed","[data-pdf-page-break-before=\"true\"]"]` | CSS selectors that force a new page before an element. |
| `debugOverlay.enabled` | `boolean` | `false` | Draws debug rectangles (table cell content boxes). |
| `debug` | `boolean` | `false` | Enable console logging for layout debugging. |

## ⚠️ Notes / Limitations

- **Not a full browser print engine**: complex CSS (filters, transforms, pseudo elements, advanced layout) may not match exactly.
- **Cross-origin images**: SVG-to-canvas conversion requires CORS headers; otherwise the browser may block rendering.
- **Defaults are Globe3-oriented**: `excludeSelectors` includes several project-specific class names; override with `excludeSelectors: []` (or your own list) if you want generic behavior.

## 🧭 PRD Status

See `prd.md` for the target "one-click `.html_to_vector_pdf` export" product shape. Current codebase exposes a lower-level `generatePdf(...)` API (no `init()` button-injection wrapper yet).

## 🛠️ Development

This project is built with **Vite**, **TypeScript**, and **React** (for the test harness).

### Prerequisites
- Node.js (v18+)

### Installation
```bash
npm install
```

### Run Dev Server
Starts the interactive test environment where you can preview changes live.
```bash
npm run dev
```

### Build Library
Builds the standalone `globe3-pdf.js` library to the `dist/` folder.
```bash
npm run build
```

### Demo Files
- `test.html`: single `.html_to_vector_pdf` example (loads `./dist/globe3-pdf.js`)
- `index_multi.html`: multiple `.html_to_vector_pdf` elements merged into one PDF
- `test-production.html`: production-like smoke test for the UMD global `Globe3PdfGenerator`

After `npm run build`, HTML demo files are copied into `dist/` with the script path rewritten to `./globe3-pdf.js` so you can open them directly.

## 📄 License
Private (Globe3)
