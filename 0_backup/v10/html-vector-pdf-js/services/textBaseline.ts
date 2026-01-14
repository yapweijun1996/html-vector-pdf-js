type FontMetricsPx = { ascent: number; descent: number };

let cachedCtx: CanvasRenderingContext2D | null = null;
const cachedMetrics = new Map<string, FontMetricsPx | null>();
const cachedBaselineOffsets = new Map<string, number>();

const getCanvasContext = (): CanvasRenderingContext2D | null => {
  if (cachedCtx) return cachedCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  cachedCtx = ctx;
  return cachedCtx;
};

const buildCanvasFont = (style: CSSStyleDeclaration): string => {
  // Canvas font syntax doesn't support line-height; only include the font properties.
  const fontStyle = style.fontStyle && style.fontStyle !== 'normal' ? style.fontStyle : '';
  const fontVariant = style.fontVariant && style.fontVariant !== 'normal' ? style.fontVariant : '';
  const fontWeight = style.fontWeight && style.fontWeight !== 'normal' ? style.fontWeight : '';
  const fontStretch = (style as any).fontStretch && (style as any).fontStretch !== 'normal' ? (style as any).fontStretch : '';
  const fontSize = style.fontSize || '16px';
  const fontFamily = style.fontFamily || 'sans-serif';

  return [fontStyle, fontVariant, fontWeight, fontStretch, fontSize, fontFamily].filter(Boolean).join(' ');
};

const buildBaselineCacheKey = (style: CSSStyleDeclaration, lineBoxHeightPx: number): string => {
  const font = buildCanvasFont(style);
  const lineBox = Number.isFinite(lineBoxHeightPx) && lineBoxHeightPx > 0 ? Math.round(lineBoxHeightPx * 100) / 100 : 0;
  return `${font}|lh:${lineBox}`;
};

const getFontMetricsPx = (style: CSSStyleDeclaration): FontMetricsPx | null => {
  const ctx = getCanvasContext();
  if (!ctx) return null;

  const font = buildCanvasFont(style);
  const cacheKey = font;
  if (cachedMetrics.has(cacheKey)) return cachedMetrics.get(cacheKey) ?? null;

  ctx.font = font;
  // Use a mixed-case sample to get representative ascent/descent.
  const m = ctx.measureText('Mg');
  const ascent = (m as any).actualBoundingBoxAscent;
  const descent = (m as any).actualBoundingBoxDescent;

  const out =
    typeof ascent === 'number' && typeof descent === 'number' && Number.isFinite(ascent) && Number.isFinite(descent)
      ? { ascent, descent }
      : null;

  cachedMetrics.set(cacheKey, out);
  return out;
};

const tryComputeBaselineOffsetViaDomPx = (style: CSSStyleDeclaration, lineBoxHeightPx: number): number | null => {
  if (typeof document === 'undefined') return null;
  const body = document.body;
  if (!body) return null;

  const container = document.createElement('span');
  container.style.position = 'absolute';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.border = '0';
  container.style.whiteSpace = 'nowrap';
  container.style.display = 'inline-block';
  container.style.lineHeight = Number.isFinite(lineBoxHeightPx) && lineBoxHeightPx > 0 ? `${lineBoxHeightPx}px` : style.lineHeight || 'normal';

  // Copy font-related properties only (keep this cheap and deterministic).
  container.style.fontFamily = style.fontFamily;
  container.style.fontSize = style.fontSize;
  container.style.fontWeight = style.fontWeight;
  container.style.fontStyle = style.fontStyle;
  container.style.fontVariant = style.fontVariant;
  (container.style as any).fontStretch = (style as any).fontStretch;

  const text = document.createElement('span');
  text.textContent = 'Mg';
  const baselineProbe = document.createElement('span');
  baselineProbe.style.display = 'inline-block';
  baselineProbe.style.width = '0';
  baselineProbe.style.height = '0';
  baselineProbe.style.verticalAlign = 'baseline';

  container.appendChild(text);
  container.appendChild(baselineProbe);
  body.appendChild(container);

  const containerRect = container.getBoundingClientRect();
  const probeRect = baselineProbe.getBoundingClientRect();
  container.remove();

  if (!containerRect.height || !Number.isFinite(containerRect.top) || !Number.isFinite(probeRect.top)) return null;
  return probeRect.top - containerRect.top;
};

export const computeAlphabeticBaselineOffsetPx = (style: CSSStyleDeclaration, lineBoxHeightPx: number): number => {
  const cacheKey = buildBaselineCacheKey(style, lineBoxHeightPx);
  const cached = cachedBaselineOffsets.get(cacheKey);
  if (cached !== undefined) return cached;

  const viaDom = tryComputeBaselineOffsetViaDomPx(style, lineBoxHeightPx);
  if (viaDom !== null && Number.isFinite(viaDom) && viaDom > 0) {
    cachedBaselineOffsets.set(cacheKey, viaDom);
    return viaDom;
  }

  const metrics = getFontMetricsPx(style);
  if (metrics) {
    const lineBox = Number.isFinite(lineBoxHeightPx) && lineBoxHeightPx > 0 ? lineBoxHeightPx : metrics.ascent + metrics.descent;
    const leading = Math.max(0, lineBox - (metrics.ascent + metrics.descent));
    const viaCanvas = leading / 2 + metrics.ascent;
    cachedBaselineOffsets.set(cacheKey, viaCanvas);
    return viaCanvas;
  }

  const fontSizePx = parseFloat(style.fontSize || '0') || 0;
  cachedBaselineOffsets.set(cacheKey, fontSizePx);
  return fontSizePx;
};
