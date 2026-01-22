## 2026-01-22 Vitest 現況盤點（Codex）

### 已完成
- `npm test -- --run`：12 個檔案、61 個測試，全數通過

### 觀察
- `vitest.config.ts` 目前全域使用 `jsdom`，導致純邏輯測試也付出較高的環境成本
- 執行時出現 `HTMLCanvasElement.getContext()` 在 jsdom 未實作的警告（測試仍通過，但 CI 可能會變成噪音或阻礙）
- `globals: true` 但測試檔仍使用顯式 import（目前不影響，但容易造成團隊習慣不一致）

### 建議（不改行為、降低維護成本）
- 調整成「預設 node、DOM 相關才用 jsdom」（例如用 environment match globs）
- 加入 test setup：統一 mock `canvas.getContext`，讓測試輸出乾淨可讀
- 腳本分流：`test` 固定用 `vitest run`、另提供 `test:watch`（避免本機/CI 行為不一致）

### 已採用（A）
- 已加入 `vitest.setup.ts` 並在 `vitest.config.ts` 掛上 `setupFiles`，讓 `npm test -- --run` 不再出現 `HTMLCanvasElement.getContext()` 警告
