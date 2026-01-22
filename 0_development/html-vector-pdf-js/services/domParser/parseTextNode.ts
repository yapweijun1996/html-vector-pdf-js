import { parsePx } from '../pdfUnits';
import { buildTextStyleKey, parseLineHeightPx, pickTextAlign } from '../textLayout';
import { computeAlphabeticBaselineOffsetPx } from '../textBaseline';
import { DomParseContext } from './context';
import {
  processWhitespace,
  applyTextTransform,
  checkIsFloating,
  checkHasLayoutImpact,
  canAggregateText
} from './parseTextNodeUtils';

export const parseTextNode = (ctx: DomParseContext, txt: Text, shouldExclude: (el: Element | null) => boolean, walked: number): void => {
  const str = processWhitespace(txt);
  if (!str) return;
  if (!txt.parentElement || shouldExclude(txt.parentElement)) return;

  // PDF-first text engine: skip text nodes inside containers handled as `textBlock`
  if ((ctx.cfg.textEngine?.mode || 'legacy') !== 'legacy' && ctx.skipTextContainers) {
    let p: HTMLElement | null = txt.parentElement;
    while (p && p !== document.body) {
      if (ctx.skipTextContainers.has(p)) return;
      p = p.parentElement;
    }
  }

  const parentEl = txt.parentElement;
  const fontStyle = window.getComputedStyle(parentEl);

  // New: Find nearest block-level container (p, div, td, th, li, etc.)
  // This enables inline grouping for mixed-style text in ALL block contexts, not just tables
  const findBlockContainer = (el: HTMLElement): HTMLElement => {
    let curr: HTMLElement | null = el;
    while (curr && curr !== document.body) {
      const display = window.getComputedStyle(curr).display;
      const tag = curr.tagName.toUpperCase();
      // Block-level elements that should serve as layout containers
      if (
        display === 'block' ||
        display === 'table-cell' ||
        tag === 'TD' ||
        tag === 'TH' ||
        tag === 'P' ||
        tag === 'DIV' ||
        tag === 'LI' ||
        tag === 'BLOCKQUOTE' ||
        tag === 'ARTICLE' ||
        tag === 'SECTION'
      ) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return el; // Fallback to original element
  };
  const layoutEl = findBlockContainer(parentEl);

  // NOTE: `layoutEl` is our alignment/layout container. For a text node whose parent is the container itself
  // (e.g. direct text children of <td align="right">), we still must treat it as a "block container" case
  // for center/right alignment; otherwise we'd use browser-left coordinates combined with PDF right-align,
  // causing multiple fragments to overlap.
  const isBlockContainer = layoutEl !== parentEl;

  const layoutStyle = window.getComputedStyle(layoutEl);
  const layoutRect = layoutEl.getBoundingClientRect();

  // `getBoundingClientRect()` measures the border box, so to compute the content box
  // we must subtract both padding and border (margin is outside the border box).
  let paddingLeftPx = parsePx(layoutStyle.paddingLeft) + parsePx(layoutStyle.borderLeftWidth);
  let paddingRightPx = parsePx(layoutStyle.paddingRight) + parsePx(layoutStyle.borderRightWidth);

  // Traverse up from parentEl to layoutEl to accumulate padding/borders of intermediate blocks
  // This replaces the old check which only looked for the closest 'div'
  let curr: HTMLElement | null = parentEl;
  while (curr && curr !== layoutEl && layoutEl.contains(curr)) {
    const s = window.getComputedStyle(curr);
    paddingLeftPx += parsePx(s.paddingLeft) + parsePx(s.borderLeftWidth);
    paddingRightPx += parsePx(s.paddingRight) + parsePx(s.borderRightWidth);
    curr = curr.parentElement;
  }
  const contentLeftPx = layoutRect.left + paddingLeftPx;
  const contentRightPx = layoutRect.right - paddingRightPx;
  const contentWidthPx = Math.max(0, contentRightPx - contentLeftPx);

  const finalStr = applyTextTransform(str, fontStyle);

  const textAlign = pickTextAlign(layoutEl, layoutStyle.textAlign || '');
  const whiteSpace = (layoutStyle.whiteSpace || '').toLowerCase();
  const cssNoWrap = whiteSpace.includes('nowrap');

  const range = document.createRange();
  range.selectNodeContents(txt);
  const rects = range.getClientRects();
  const firstRect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  const rectsLen = rects.length > 0 ? rects.length : firstRect.width > 0 && firstRect.height > 0 ? 1 : 0;
  const browserWrapped = rectsLen > 1;
  const noWrap = cssNoWrap || !browserWrapped;

  if (!(layoutRect.width > 0 && layoutStyle.display !== 'none' && firstRect.width > 0 && firstRect.height > 0)) return;

  const fontSizePx = parseFloat(fontStyle.fontSize);
  const lineHeightPx = parseLineHeightPx(layoutStyle.lineHeight, fontSizePx);
  const lineHeightMm = ctx.px2mm(lineHeightPx) * ctx.cfg.text.scale;

  const y = ctx.px2mm(firstRect.top - ctx.rootRect.top);
  const h = ctx.px2mm(firstRect.height);
  const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(fontStyle, firstRect.height);
  const baselineOffset = ctx.px2mm(baselineOffsetPx) * ctx.cfg.text.scale;

  const xMmActual = ctx.cfg.margins.left + ctx.px2mm(firstRect.left - ctx.rootRect.left);
  const xLeftMm = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
  const xRightMm = ctx.cfg.margins.left + ctx.px2mm(contentRightPx - ctx.rootRect.left);
  const xMmCellAligned = textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
  const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';
  // Standard bucket calculation based on top position
  const rawBucketPx = Math.round(firstRect.top / 2) * 2;
  let yBucketPx = rawBucketPx;

  // New: Apply fuzzy bucket logic to ALL block containers.
  // This ensures that bold/normal text in a <p> tag (which might differ by 1-2px in height)
  // are snapped to the same Y-bucket and thus grouped together in the same line.
  if (isBlockContainer) {
    const layoutId = ctx.getLayoutId(layoutEl);

    if (ctx.cellLastTextBucket && ctx.cellLastTextBucket.has(layoutId)) {
      const lastBucket = ctx.cellLastTextBucket.get(layoutId)!;
      // Use 5px threshold to catch font-size variations on the same line
      if (Math.abs(rawBucketPx - lastBucket) < 5) {
        yBucketPx = lastBucket;
      } else {
        ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
      }
    } else {
      if (!ctx.cellLastTextBucket) ctx.cellLastTextBucket = new Map();
      ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
    }
  }

  // Check if this cell contains any floating elements (like currency symbols with float:left)
  const hasFloatingChildren = inTableCell && layoutEl.querySelector('[style*="float:"]') !== null;

  const hasLayoutImpact = checkHasLayoutImpact(parentEl, layoutEl);

  const canAggregate = canAggregateText(
    ctx,
    layoutEl,
    fontStyle,
    rectsLen,
    inTableCell,
    hasFloatingChildren,
    hasLayoutImpact
  );

  if (canAggregate) {
    const layoutId = ctx.getLayoutId(layoutEl);
    const styleKey = buildTextStyleKey(fontStyle);
    const key = `${layoutId}|${styleKey}|${yBucketPx}|${textAlign}`;

    const existing = ctx.aggregatedTextByKey.get(key);
    if (existing) {
      console.log(`[DEBUG] Aggregating text: "${finalStr.substring(0, 30)}..." into existing key=${key}`);
      existing.text = `${existing.text ?? ''}${finalStr}`;
      existing.cssNoWrap = (existing.cssNoWrap ?? false) || cssNoWrap;
      existing.rectsLen = Math.max(existing.rectsLen ?? 0, rectsLen);
      existing.noWrap = (existing.noWrap ?? true) && noWrap;
    } else {
      ctx.aggregatedTextByKey.set(key, {
        type: 'text',
        x: xMmCellAligned,
        y: y + baselineOffset,
        w: ctx.px2mm(layoutRect.width),
        h,
        style: fontStyle,
        text: finalStr,
        textAlign,
        maxWidthMm: ctx.px2mm(contentWidthPx),
        lineHeightMm,
        noWrap,
        cssNoWrap,
        rectsLen,
        alignmentBucket: `${ctx.getLayoutId(layoutEl)}|${yBucketPx}`,
        zIndex: 20
      });
    }
    return;
  }

  const isFloating = checkIsFloating(parentEl, layoutEl);
  const isFloatLeft = isFloating && window.getComputedStyle(parentEl.closest('[style*="float"]') || parentEl).float === 'left';

  // When hasLayoutImpact is true (element has padding/margin/block display), we must NOT set inlineGroupId
  // Otherwise the renderer will recalculate the x position based on group alignment, ignoring our exact coordinates
  const shouldSkipInlineGroup = isFloating || hasLayoutImpact;

  // New: Assign inlineGroupId for ALL block containers (p, div, td, etc.)
  // This is the KEY FIX: mixed-style text in <p> tags now gets grouped and positioned correctly
  // const isBlockContainer = layoutEl !== parentEl; // Redundant - defined at top
  // For center/right aligned lines, we anchor all fragments to the container's content box and use inline grouping
  // so the renderer can compute correct per-fragment X positions.
  const shouldGroupForAlignedLine = !shouldSkipInlineGroup && (textAlign === 'right' || textAlign === 'center');
  const shouldUseCellAlignedX = shouldGroupForAlignedLine;

  // Helper to create the non-aggregated render item
  const createItem = (isFirstItemInWrapped: boolean = false) => ({
    type: 'text' as const,
    x: shouldUseCellAlignedX ? xMmCellAligned : xMmActual,
    y: y + baselineOffset,
    w: ctx.px2mm(firstRect.width),
    h,
    style: fontStyle,
    text: finalStr,
    textAlign: shouldUseCellAlignedX ? textAlign : shouldSkipInlineGroup ? 'left' : textAlign,
    cellTextAlign: shouldSkipInlineGroup && !shouldUseCellAlignedX && (textAlign === 'right' || textAlign === 'center')
      ? textAlign
      : undefined,
    maxWidthMm: ctx.px2mm(contentWidthPx - (isFirstItemInWrapped ? firstRect.left - contentLeftPx : 0)),
    lineHeightMm,
    noWrap: !browserWrapped,
    cssNoWrap,
    rectsLen,
    /****
    // OLD: Assigned inlineGroupId to ALL block containers, causing jsPDF width errors to accumulate
    inlineGroupId: isBlockContainer && !shouldSkipInlineGroup ? `${ctx.getLayoutId(layoutEl)}|${yBucketPx}` : undefined,
    inlineOrder: isBlockContainer && !shouldSkipInlineGroup ? walked : undefined,
    ****/
    // NEW: Only use inline grouping when alignment requires position recalculation (center/right).
    // For left-aligned text, use browser's exact coordinates (xMmActual) directly.
    // This eliminates jsPDF width measurement errors that cause text overlapping.
    // WHY THIS WORKS: Browser already calculated perfect positions. We just need to use them.
    // WHY WE STILL NEED GROUPING FOR CENTER/RIGHT: Those alignments require knowing total line width
    // to calculate the starting X position, which we can only know after measuring all fragments.
    inlineGroupId: shouldGroupForAlignedLine ? `${ctx.getLayoutId(layoutEl)}|${yBucketPx}` : undefined,
    inlineOrder: shouldGroupForAlignedLine ? walked : undefined,
    alignmentBucket: `${ctx.getLayoutId(layoutEl)}|${yBucketPx}`,
    floatLeft: isFloatLeft,
    contentLeftMm: xLeftMm,
    contentRightMm: xRightMm,
    zIndex: 20
  });


  // Simplified: All block containers use the same logic now
  ctx.items.push(createItem(isBlockContainer ? false : true));
};
