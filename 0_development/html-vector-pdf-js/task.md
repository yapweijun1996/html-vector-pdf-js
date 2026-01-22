1. [completed] 修复 demo 在本地 server 运行时 `dist/html_to_vector_pdf.js` 404，导致 `html_to_vector_pdf is not defined`
2. [in_progress] 你本地验证：`http://localhost:3001/index_multi.html` 点击下载按钮可正常生成 PDF（不出现 `Failed to load font NotoSans`；已把 demo 内的 `USB‑C` 非 ASCII 连字符改为 `USB-C`，避免触发 NotoSans）
3. [completed] 字体策略选择 B：已补齐 `fonts/NotoSans-Bold.base64.txt`（并同步补齐 `fonts/NotoSans-Regular.base64.txt`、`fonts/NotoSansSC-Bold.base64.txt`），可用 `npm run build:with-fonts` 产出包含字体的 `dist/html_to_vector_pdf.js`；新增 `npm run fonts:prepare` 便于一键生成缺失字体文件
4. [in_progress] 修复 `text-align:right` 且同一行混合 `<b>` / 文本节点时 PDF 文字重叠（已处理同一行；仍需处理“自动换行 + 混合样式”的情况）
5. [pending] 你本地验证：`index_multi.html` 的 `INV NO / DATE` 行在“未换行”时不再重叠
6. [completed] 调查：当该 TD 在浏览器已换成 2 行时，PDF 仍按 1 行 bucket 渲染导致跨行重叠（根因：混合样式碎片各自换行/各自对齐）
7. [completed] 实作：对 `TD/TH` 默认启用 PDF-first text engine（textBlock + runs + 行内换行），并补上 right/center 对齐的行级排版
8. [in_progress] 你本地验证：`index_multi.html` 的 `INV NO / DATE` 行在“换行/不换行”两种情况下都不再重叠
