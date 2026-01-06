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
Call the `generatePdf` function, passing the ID of the element you want to convert.

```html
<div id="my-report">
  <h1>Monthly Report</h1>
  <p>This text will be selectable in the PDF.</p>
</div>

<button onclick="downloadReport()">Download PDF</button>

<script>
  function downloadReport() {
    Globe3PdfGenerator.generatePdf('my-report', {
      filename: 'report.pdf',
      pageSize: 'a4',
      margins: { top: 10, right: 10, bottom: 10, left: 10 }
    });
  }
</script>
```

## ⚙️ Configuration

The `generatePdf` function accepts a configuration object with the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | `"document.pdf"` | Name of the output file. |
| `pageSize` | `"a4" \| "letter"` | `"a4"` | Page size standard. |
| `orientation` | `"portrait" \| "landscape"` | `"portrait"` | Page orientation. |
| `margins` | `object` | `{t:10,r:10,b:10,l:10}` | Margins in millimeters. |
| `text.scale` | `number` | `1.0` | Global scaling factor for text size. |
| `pagination.pageBreakBeforeSelectors` | `string[]` | `[]` | CSS selectors that force a new page. |
| `debug` | `boolean` | `false` | Enable console logging for layout debugging. |

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

## 📄 License
Private (Globe3)
