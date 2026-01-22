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

## P0 — Font Assets & Registration（Correctness for symbols/quotes/bold）

> Goal：修正 `“ ”`、`●/•` 在 Vector PDF 變形/亂碼與寬度不一致問題，確保「字型註冊」與「字型度量」一致。

### Design (Mermaid)
```mermaid
flowchart TB
  A[extractTextsFromItems\n(includes textBlock runs)] --> B[detectRequiredFonts]
  B --> C[loadFontFamily(name)\nnormal/bold if available]
  C --> D[loadedFonts[] with style]
  D --> E[registerLoadedFonts\naddFileToVFS + addFont(name, style)]
  E --> F[applyTextStyle\nsetFont(name, style)]
  F --> G[getTextWidth + renderText]
```

- [ ] Support per-font, per-style embedded data (e.g. NotoSans normal/bold, NotoSansSC normal/bold).
- [ ] Update inject/cleanup scripts to handle multiple font placeholders.
- [ ] Update font registration to register `normal` and `bold` variants.
- [ ] Validate: curly quotes `“ ”` render without extra spacing vs print baseline (using NotoSans, not NotoSansSC).
