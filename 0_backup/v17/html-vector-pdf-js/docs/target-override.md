# Target Override（只輸出指定區塊）

## 目標

在不修改既有呼叫端（例如：`download_vector_pdf()` 仍傳入 `'body'`）的前提下，透過 `window` 全域變數覆寫輸出 target，讓 PDF 只輸出指定區塊（例如：`.html_to_vector_pdf_print_area`）。

## 流程設計

```mermaid
flowchart TB
  A[呼叫 html_to_vector_pdf.generatePdf(target, config)] --> B{window.html_to_vector_pdf_target 有值?}
  B -->|否| C[使用呼叫端 target]
  B -->|是| D[使用 window.html_to_vector_pdf_target]
  C --> E[findElements + validate]
  D --> E[findElements + validate]
  E --> F[parseElementToItems]
  F --> G[renderToPdf]
  G --> H[doc.save(filename)]
```

## 使用方式

在你的頁面任一處（`html_to_vector_pdf.js` 載入後、點 PDF 前）加入：

```html
<script>
  // 覆寫輸出範圍：只輸出這個區塊
  window.html_to_vector_pdf_target = '.html_to_vector_pdf_print_area';
</script>
```

要恢復預設行為（跟呼叫端一致，例如 `'body'`），可設為空字串或刪除：

```js
window.html_to_vector_pdf_target = '';
// 或 delete window.html_to_vector_pdf_target
```

