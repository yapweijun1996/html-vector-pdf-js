## 目標（我的理解）
- 找出 `index_multi.html` 裡右對齊 `<td>` 混合粗體/一般字時，輸出 PDF 產生文字重疊（`INV NO:` 與 `DATE:` 疊在一起）的原因，並修好。

## TODO（小步快跑）
- [x] 盤點重疊案例：`index_multi.html` 右對齊 `<td>` + `<b>` 混排
- [x] 定位 root cause：inline 文字分組（inlineGroup）只覆蓋了部分 fragments，導致分段各自右對齊後互相重疊
- [x] 修正：讓同一行的所有 fragments 都進入同一個 inlineGroup（包含 `<td>` 直接文字節點）
- [x] 修正：同一 layout container 的 yBucket 需 fuzzy 對齊（避免 bold/normal top 差 1~2px 被分到不同 bucket）
- [x] 加回歸測試：確保 right-aligned `<td>` 混排會產生單一 inlineGroup
- [x] 重新 build：更新 `dist/html_to_vector_pdf.js`
- [ ] 你在瀏覽器實測：`http://localhost:4173/index_multi.html` 下載 PDF 確認不再重疊

## 進度紀錄
- 2026-01-22：完成修正與測試，等待你實測確認
