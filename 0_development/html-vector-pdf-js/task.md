```md
# Task — html-vector-pdf-js

> 目标：实现「一键把 `.html_to_vector_pdf` 导出为以矢量为主的 PDF」的单 JS 文件交付（对不支持样式做最小块级栅格化降级），并保证性能与可维护性。

## 0. 当前状态（基于代码库观察）
- 已有：`services/pdfGenerator.ts`（基于 DOMRect 的矢量渲染：背景色/边框/文本，支持简单分页偏移）
- 已有：Vite demo UI（React + Tailwind CDN）与 `dist/globe3-pdf.js` UMD 构建产物
- 缺失：PRD 里的 `window.HtmlToVectorPDF.init/export` API 与 `.html_to_vector_pdf` 默认选择器流程
- 风险：图片处理、字体/多行文本、分页 keep-together、配置类型重复与“硬编码”较多

---

## 1. P0（必须优先）
1) **对齐 PRD API/命名**
   - 输出：`html_to_vector_pdf.js`（或在 PRD 中统一项目命名/产物命名）
   - 提供：`window.HtmlToVectorPDF.init(options)` / `window.HtmlToVectorPDF.export(override)`
   - 默认选择器：`.html_to_vector_pdf`，并支持 `multiNodeMode: "first" | "all"`

2) **统一配置类型与默认值来源**
   - 合并 `types.ts:PdfConfig` 与 `services/pdfGenerator.ts:PdfConfig`（避免重复/漂移）
   - 明确：哪些配置是 UI 需要，哪些是引擎专用（建议分层：`UiConfig` / `EngineConfig`）

3) **图片渲染可用性（不栅格化整页）**
   - `IMG`：将 `src` 转换成可被 `jsPDF.addImage` 使用的 dataURL / ImageData
   - 处理跨域：同源直接 canvas；跨域给出可预测错误与降级策略（跳过/占位/提示）
   - SVG：把当前固定 `2x` 放入可配置 `rasterScale`，默认以性能为先（例如 1.5–2）

4) **消除关键“硬编码”换算**
   - 当前同时存在：动态 `pxToMm` 与固定 `px -> pt (0.75)` 的混用
   - 统一到单一换算源：`pxToMm`（字体大小/线宽/布局都从同一基准推导）

---

## 2. P1（重要）
5) **文本布局正确性**
   - 处理多行文本：不要用单个 `Range.getBoundingClientRect()` 直接 `doc.text()` 一行输出
   - 方向：用 `Range.getClientRects()` 做逐行定位（或按分词测量换行），保证可选中文本

6) **分页质量**
   - 支持 PRD 的：
     - `data-pdf-keep-together="true"`
     - `data-pdf-page-break-before="true"`
     - `data-pdf-page-break-after="true"`
   - 避免切断：表格行/段落（至少对 `tr` 做 keep-together）

7) **性能与 UI 不冻结**
   - 长文档遍历与图片转换：引入 `await new Promise(r=>requestAnimationFrame(r))` 级别的让步
   - 增加可选 `onProgress(stage, detail)`（PRD 9.2）

---

## 3. P2（增强/体验）
8) **更完整的样式覆盖**
   - `background-image`、基础 `border-radius`（可先降级为矩形）
   - `<a href>` 链接转成可点击（过滤 `javascript:`）

9) **工程化与可维护性**
   - `services/pdfGenerator.ts` 拆分为：`domParser.ts` / `renderer.ts` / `units.ts` / `images.ts`
   - 提供最小示例 `test.html`（同源图片为默认示例，避免 CORS 误导）

---

## 4. 验收清单（对齐 PRD）
- 一键导出 `.html_to_vector_pdf`，多页工作正常
- 常规文本可选/可搜，不是整页截图
- 表格基本可读（边框/背景/对齐）
- 同源图片正常；跨域图片有清晰限制说明与回退行为
- Chrome/Firefox 最新稳定版 Happy Path 无控制台错误
```
