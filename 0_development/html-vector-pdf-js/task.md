## P0 — PDF-first Text Engine（Correctness, replace legacy text flow）

> Goal：針對長段落（例如 `0_test/SQ-10038-ATL_2026_01_22_09_33_28.htm` 的 T&C `<p>`，混合 `<strong>` + `●` + curly quotes）做到「不缺字、不重疊、跨樣式可正確換行」。
> Strategy：不再依賴瀏覽器的 inline 片段座標拼貼；改為把 DOM 解析成 styled runs，使用 PDF 端同一套字型度量做 line breaking，再渲染到 jsPDF。

### Design (Mermaid)
```mermaid
flowchart TB
  A[DOM Block Container\n(P/DIV/TD...)] --> B[Inline Run Builder\n(text + style runs)]
  B --> C[Tokenizer\n(space/punct/cjk)]
  C --> D[Font Resolver\n(consistent metrics)]
  D --> E[Measurer\n(jsPDF getTextWidth)]
  E --> F[Line Breaker\n(across runs)]
  F --> G[Line Layout\n(baseline/lineHeight)]
  G --> H[RenderItems\n(pre-wrapped, computedX)]
  H --> I[jsPDF RenderText\n(noWrap=true)]
```

- [x] Add `PdfConfig.textEngine` options (mode + feature flags).
- [x] Implement `services/textEngine/*` (runs → tokens → lines).
- [x] Integrate in `services/domParser.ts` for `<p>` (feature-flagged, default `auto`).
- [x] Ensure renderer never re-wraps PDF-first items (`noWrap: true`, `computedX` set) via `textBlock` expansion.
- [x] Add unit tests for run builder + line breaker (vitest).
- [ ] Add a debug mode to log line breaks for the failing paragraph (wire to UI/query param).
- [ ] Validate on `0_test/SQ-10038-ATL_2026_01_22_09_33_28.htm` (T&C paragraph): no overlap, symbols render.
