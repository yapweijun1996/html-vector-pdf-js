# PrintForm.js + HTML-to-Vector-PDF: Template Guide

## Architecture

Two libraries work together:
1. **printform.js** — Auto-paginates HTML into A4 pages (header repeat, table header repeat, page numbers)
2. **html_to_vector_pdf.js** — Exports the paginated HTML as vector PDF (selectable text, sharp at any zoom)

Flow: `printform.js` runs on page load → splits content into pages → user clicks Download → `html_to_vector_pdf.js` exports PDF.

---

## PrintForm Class Structure

```
.printform (data-papersize-width="750" data-papersize-height="1050")
│
├── .pheader              → Page header (repeats every page)
│
├── .pdocinfo             → Document info (repeats every page by default)
│
├── .prowheader           → Table column header (repeats every page)
│
├── .prowitem             → Data row (auto-paginated, one per row)
├── .prowitem             → Each row is NEVER split across pages
├── .prowitem             → ...
│
├── .prowitem_subtotal    → Subtotal row (pairs with next prowitem_footer)
├── .prowitem_footer      → Grand total row (stays with subtotal)
│
├── .ptac                 → Terms/conditions (auto-split at ~200 words)
│
├── .pfooter              → Business footer / signatures (last page only by default)
│
├── .pfooter_logo         → Company branding footer
│
└── .pfooter_pagenum      → "Page X of Y" (auto-updated)
```

---

## Key Rules

### 1. Container Setup

```html
<div class="printform paper_width"
     data-papersize-width="750"
     data-papersize-height="1050"
     data-repeat-header="y"
     data-repeat-docinfo="y"
     data-repeat-rowheader="y"
     data-repeat-footer-logo="y"
     data-repeat-footer-pagenum="y"
     data-insert-dummy-row-item-while-format-table="y">
```

- Width: always 750px
- Height: 1050px (A4 ratio)
- `data-repeat-*="y"` controls what repeats on each page

### 2. Page Header (.pheader)

Repeats at top of every page. Put company name, logo, document title here.

```html
<div class="pheader block">
  <h1>PURCHASE ORDER</h1>
  <small>ACME CORP PTE LTD — PO-2026-0042</small>
</div>
```

### 3. Document Info (.pdocinfo)

Repeats on each page (configurable). Put addresses, reference numbers, dates.

```html
<div class="pdocinfo block grid">
  <div><b>Vendor:</b> OMEGA SUPPLIES PTE LTD</div>
  <div><b>Date:</b> 02 Apr 2026</div>
  <div><b>Ship To:</b> Warehouse B, Tuas</div>
  <div><b>Terms:</b> Net 30</div>
</div>
```

Set `data-repeat-docinfo="n"` if you only want it on page 1.

### 4. Table Header (.prowheader)

Column headers. Repeats on each page so reader always knows what each column is.

```html
<div class="prowheader">
  <table class="paper_width">
    <tr>
      <th class="col-no">S/N</th>
      <th>Description</th>
      <th class="col-qty">Qty</th>
      <th class="col-price">Unit Price</th>
      <th class="col-amount">Amount</th>
    </tr>
  </table>
</div>
```

### 5. Data Rows (.prowitem)

Each row is ONE `.prowitem` wrapping ONE `<table>`. printform.js moves entire rows to new pages — never splits a row.

```html
<div class="prowitem">
  <table class="paper_width">
    <tr>
      <td class="col-no">1</td>
      <td>Heavy-duty nitrile gloves, Size L (Box of 100)</td>
      <td class="col-qty">50</td>
      <td class="col-price">18.50</td>
      <td class="col-amount">925.00</td>
    </tr>
  </table>
</div>
```

**CRITICAL:** A single .prowitem must not exceed page height. Keep rows short.

### 6. Totals (.prowitem_subtotal + .prowitem_footer)

Subtotal and grand total are special row types that stay together:

```html
<div class="prowitem_subtotal">
  <table class="paper_width">
    <tr>
      <td colspan="3"></td>
      <td class="totals-label">Subtotal:</td>
      <td class="totals-value">5,191.00</td>
    </tr>
    <tr>
      <td colspan="3"></td>
      <td class="totals-label">GST (9%):</td>
      <td class="totals-value">443.83</td>
    </tr>
  </table>
</div>
<div class="prowitem_footer">
  <table class="paper_width">
    <tr>
      <td colspan="3"></td>
      <td class="totals-label" style="border-top:2px solid black;"><b>Grand Total:</b></td>
      <td class="totals-value" style="border-top:2px solid black;"><b>SGD 5,375.28</b></td>
    </tr>
  </table>
</div>
```

**printform.js treats subtotal + footer as a unit.** If they don't fit on current page, both move to next page together. Do NOT put totals in .ptac.

### 7. Terms & Conditions (.ptac)

Long text content that appears after all data rows. Auto-split at ~200 words per segment.

```html
<table class="paper_width ptac">
  <tr><td>
    <h3>Terms &amp; Conditions</h3>
    <p>1. Delivery must be made during business hours.</p>
    <p>2. All goods must conform to specifications.</p>
    <p>3. Payment within 30 days of invoice.</p>
  </td></tr>
</table>
```

**Rules:**
- Use `<p>` tags for paragraphs (printform splits at paragraph boundaries)
- Do NOT put tables, totals, or complex HTML inside PTAC
- PTAC is for TEXT ONLY (terms, conditions, notes, legal clauses)
- If content is short (< 200 words), it stays as one segment

### 8. Signatures (.pfooter)

Business footer with signatures. Only appears on last page by default.

```html
<div class="pfooter block">
  <table class="paper_width" style="border:none;">
    <tr>
      <td style="width:50%;border:none;text-align:center;">
        <br><br>___________________<br>
        <b>Prepared By</b><br>Sarah Tan
      </td>
      <td style="width:50%;border:none;text-align:center;">
        <br><br>___________________<br>
        <b>Approved By</b><br>James Wong
      </td>
    </tr>
  </table>
</div>
```

Set `data-repeat-footer="y"` to show on every page.

### 9. Company Footer (.pfooter_logo)

Branding line at very bottom. Can repeat on every page.

```html
<div class="pfooter_logo">ACME CORPORATION PTE LTD</div>
```

### 10. Page Numbers (.pfooter_pagenum)

Auto-updated by printform.js.

```html
<div class="pfooter_pagenum">
  Page <span data-page-number></span> of <span data-page-total></span>
</div>
```

---

## CSS Important: _processed Suffix

printform.js renames classes after processing:
- `.pheader` → `.pheader_processed`
- `.prowheader` → `.prowheader_processed`
- `.prowitem` → `.prowitem_processed`
- etc.

**Always style BOTH versions:**

```css
.pheader h1, .pheader_processed h1 { color: navy; }
.prowheader th, .prowheader_processed th { background: navy; color: white; }
```

Or use CSS variables in `:root` which both versions inherit.

---

## Dummy Rows

printform.js inserts invisible spacer rows to push footers to the bottom of each page. These are `.dummy_row_item` elements with `height: 18px` each.

Configure:
- `data-insert-dummy-row-item-while-format-table="y"` — enable (default)
- `data-height-of-dummy-row-item="18"` — height of each dummy

---

## Complete Template Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Document Title</title>
<link rel="stylesheet" href="../template-base.css">
<style>
  :root { --accent: #1a3a5c; }
  .pheader h1, .pheader_processed h1 { color: var(--accent); }
  .prowheader th, .prowheader_processed th { background: var(--accent); color: white; }
</style>
</head>
<body>

<div class="controls">
  <a href="../index.html">&larr; Back to Gallery</a>
  <button class="btn-pdf" onclick="downloadPdf('document.pdf')">Download PDF</button>
</div>

<div class="printform paper_width"
     data-papersize-width="750"
     data-papersize-height="1050"
     data-repeat-header="y"
     data-repeat-docinfo="n"
     data-repeat-rowheader="y"
     data-repeat-footer-logo="y"
     data-repeat-footer-pagenum="y"
     data-insert-dummy-row-item-while-format-table="y">

  <!-- Page Header (repeats) -->
  <div class="pheader block">
    <h1>DOCUMENT TITLE</h1>
    <small>ACME CORP PTE LTD — DOC-2026-0001</small>
  </div>

  <!-- Doc Info (page 1 only if data-repeat-docinfo="n") -->
  <div class="pdocinfo block grid">
    <div><b>To:</b> <span contenteditable="true">Client Name</span></div>
    <div><b>Date:</b> <span contenteditable="true">02 Apr 2026</span></div>
  </div>

  <!-- Table Header (repeats) -->
  <div class="prowheader">
    <table class="paper_width">
      <tr>
        <th class="col-no">S/N</th>
        <th>Description</th>
        <th class="col-qty">Qty</th>
        <th class="col-price">Price</th>
        <th class="col-amount">Amount</th>
      </tr>
    </table>
  </div>

  <!-- Data Rows -->
  <div class="prowitem">
    <table class="paper_width">
      <tr>
        <td class="col-no">1</td>
        <td><span contenteditable="true">Item description</span></td>
        <td class="col-qty">10</td>
        <td class="col-price">100.00</td>
        <td class="col-amount">1,000.00</td>
      </tr>
    </table>
  </div>
  <!-- More .prowitem rows... -->

  <!-- Subtotal + Grand Total -->
  <div class="prowitem_subtotal">
    <table class="paper_width">
      <tr><td colspan="3"></td><td class="totals-label">Subtotal:</td><td class="totals-value">1,000.00</td></tr>
      <tr><td colspan="3"></td><td class="totals-label">GST (9%):</td><td class="totals-value">90.00</td></tr>
    </table>
  </div>
  <div class="prowitem_footer">
    <table class="paper_width">
      <tr><td colspan="3"></td><td class="totals-label" style="border-top:2px solid black;"><b>TOTAL:</b></td><td class="totals-value" style="border-top:2px solid black;"><b>SGD 1,090.00</b></td></tr>
    </table>
  </div>

  <!-- Terms (PTAC — text only, auto-split) -->
  <table class="paper_width ptac">
    <tr><td>
      <h3>Terms &amp; Conditions</h3>
      <p>1. Payment due within 30 days.</p>
      <p>2. Goods subject to inspection.</p>
    </td></tr>
  </table>

  <!-- Signatures (last page only) -->
  <div class="pfooter block">
    <table class="paper_width" style="border:none;">
      <tr>
        <td style="width:50%;border:none;text-align:center;">
          <br>___________________<br><b>Prepared By</b>
        </td>
        <td style="width:50%;border:none;text-align:center;">
          <br>___________________<br><b>Approved By</b>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div class="pfooter_logo">ACME CORP PTE LTD</div>
  <div class="pfooter_pagenum">Page <span data-page-number></span> of <span data-page-total></span></div>
</div>

<!-- Scripts: printform FIRST, then PDF engine, then helper -->
<script src="../dist/printform.js"></script>
<script src="../dist/html_to_vector_pdf.js"></script>
<script src="../template-base.js"></script>
</body>
</html>
```

---

## What NOT To Do

| Wrong | Right |
|-------|-------|
| Put totals in .ptac | Use .prowitem_subtotal + .prowitem_footer |
| Put complex HTML in .ptac | PTAC is for text paragraphs only |
| Use `<ol>/<ul>/<li>` | Use `<br>` + manual numbering |
| Use `width: 100%` on tables | Use `class="paper_width"` (750px fixed) |
| Use percentage column widths | Use fixed pixel widths |
| Style only `.pheader` | Style both `.pheader` AND `.pheader_processed` |
| Put signatures in .ptac | Put in .pfooter |
| Put page numbers manually | Use `<span data-page-number>` + `<span data-page-total>` |

---

## Data Attributes Reference

| Attribute | Default | Description |
|-----------|---------|-------------|
| data-papersize-width | 750 | Page width in px |
| data-papersize-height | 1050 | Page height in px |
| data-repeat-header | y | Repeat .pheader on every page |
| data-repeat-docinfo | y | Repeat .pdocinfo on every page |
| data-repeat-rowheader | y | Repeat .prowheader on every page |
| data-repeat-footer | n | Repeat .pfooter on every page |
| data-repeat-footer-logo | n | Repeat .pfooter_logo on every page |
| data-repeat-footer-pagenum | n | Repeat .pfooter_pagenum on every page |
| data-insert-dummy-row-item-while-format-table | y | Insert spacer rows |
| data-height-of-dummy-row-item | 18 | Height of each spacer row |
| data-debug | n | Console logging |

---

## Checklist

- [ ] Container: `class="printform paper_width"` with data attributes
- [ ] .pheader: company name + document title
- [ ] .pdocinfo: addresses, references, dates
- [ ] .prowheader: table column headers in `<table class="paper_width">`
- [ ] .prowitem: one per data row, each in own table
- [ ] .prowitem_subtotal + .prowitem_footer: totals (paired)
- [ ] .ptac: text-only terms/conditions using `<p>` tags
- [ ] .pfooter: signatures (last page only)
- [ ] .pfooter_logo: company branding
- [ ] .pfooter_pagenum: with data-page-number and data-page-total spans
- [ ] CSS: style both `.classname` AND `.classname_processed`
- [ ] Scripts: printform.js → html_to_vector_pdf.js → template-base.js
- [ ] No ol/ul/li — use br + manual numbering
- [ ] contenteditable="true" on editable fields
