import { buildTextStyleKey, parseLineHeightPx, pickTextAlign } from '../textLayout';
import { computeAlphabeticBaselineOffsetPx } from '../textBaseline';
import { DomParseContext } from './context';
import { getNestedContentBoxFromLayoutPx } from './boxModel';
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

  const isBlockContainer = layoutEl !== parentEl;

  const layoutStyle = window.getComputedStyle(layoutEl);
  const layoutRect = layoutEl.getBoundingClientRect();
  const contentBox = getNestedContentBoxFromLayoutPx(layoutEl, layoutStyle, parentEl);
  const contentLeftPx = contentBox.left;
  const contentRightPx = contentBox.right;
  const contentWidthPx = contentBox.width;

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
  const collapseTableInfo = ctx.getCollapseTableInfo(layoutEl);
  const measuredLineBoxPx = firstRect.height;
  const hasReliableMeasuredLineBox =
    !!collapseTableInfo &&
    Number.isFinite(measuredLineBoxPx) &&
    measuredLineBoxPx > 0 &&
    measuredLineBoxPx <= Math.max(lineHeightPx * 2.5, fontSizePx * 4);
  const effectiveLineBoxPx = hasReliableMeasuredLineBox ? measuredLineBoxPx : lineHeightPx;
  const lineHeightMm = ctx.px2mm(effectiveLineBoxPx) * ctx.cfg.text.scale;
  const textWidthMm = ctx.px2mm(firstRect.width);

  const y = ctx.px2mm(firstRect.top - ctx.rootRect.top);
  const h = ctx.px2mm(firstRect.height);
  const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(fontStyle, effectiveLineBoxPx);
  const baselineOffset = ctx.px2mm(baselineOffsetPx) * ctx.cfg.text.scale;

  const xMmActual = ctx.cfg.margins.left + ctx.px2mm(firstRect.left - ctx.rootRect.left);
  const xLeftMm = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
  const xRightMm = ctx.cfg.margins.left + ctx.px2mm(contentRightPx - ctx.rootRect.left);
  const xMmCellAligned = textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
  const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';
  // Standard bucket calculation based on RELATIVE top position (not viewport)
  const relativeTopPx = firstRect.top - ctx.rootRect.top;
  const rawBucketPx = Math.round(relativeTopPx / 2) * 2;
  let yBucketPx = rawBucketPx;

  // Apply fuzzy bucket logic to ALL text nodes that share the same layout container.
  // This ensures that mixed-style inline fragments (bold/normal) that sit on the same visual line
  // are snapped to the same Y-bucket, even when the text node is a direct child of the container
  // (e.g. a right-aligned <td> with both <b> and plain text).
  const layoutId = ctx.getLayoutId(layoutEl);
  if (ctx.cellLastTextBucket && ctx.cellLastTextBucket.has(layoutId)) {
    const lastBucket = ctx.cellLastTextBucket.get(layoutId)!;
    // Use adaptive threshold based on font size (min 3px for small fonts, max 5px for normal)
    const bucketThreshold = Math.min(Math.max(fontSizePx * 0.4, 3), 5);
    if (Math.abs(rawBucketPx - lastBucket) < bucketThreshold) {
      yBucketPx = lastBucket;
    } else {
      ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
    }
  } else {
    if (!ctx.cellLastTextBucket) ctx.cellLastTextBucket = new Map();
    ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
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
      if (ctx.cfg.debug) console.log(`[DEBUG] Aggregating text: "${finalStr.substring(0, 30)}..." into existing key=${key}`);
      existing.text = `${existing.text ?? ''}${finalStr}`;
      existing.textWidthMm = (existing.textWidthMm ?? 0) + textWidthMm;
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
        collapseTableId: collapseTableInfo?.tableId,
        textWidthMm,
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

  // Use inline grouping when alignment requires width-based positioning (center/right).
  // IMPORTANT: This must apply even when the text node is a direct child of the container (parentEl === layoutEl),
  // otherwise only nested inline elements (e.g. <b>) will be grouped and the line will break into overlapping clusters.
  const shouldUseInlineGroup = !shouldSkipInlineGroup && (textAlign === 'right' || textAlign === 'center');

  // Helper to create the non-aggregated render item
  const createItem = (isFirstItemInWrapped: boolean = false) => ({
    type: 'text' as const,
    x: shouldUseInlineGroup ? xMmCellAligned : xMmActual,
    y: y + baselineOffset,
    w: textWidthMm,
    h,
    style: fontStyle,
    text: finalStr,
    collapseTableId: collapseTableInfo?.tableId,
    textWidthMm,
    // If we are not using inline grouping, `xMmActual` is the LEFT edge of the fragment,
    // so we must always force jsPDF align='left' to avoid shifting by its measured width.
    textAlign: shouldUseInlineGroup ? textAlign : 'left',
    cellTextAlign:
      /****
      inTableCell && shouldSkipInlineGroup && !shouldUseCellAlignedX && (textAlign === 'right' || textAlign === 'center')
      ****/
      inTableCell && shouldSkipInlineGroup && !shouldUseInlineGroup && (textAlign === 'right' || textAlign === 'center')
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
    inlineGroupId: shouldUseInlineGroup
      ? `${ctx.getLayoutId(layoutEl)}|${yBucketPx}`
      : undefined,
    inlineOrder: shouldUseInlineGroup
      ? walked
      : undefined,
    alignmentBucket: `${ctx.getLayoutId(layoutEl)}|${yBucketPx}`,
    floatLeft: isFloatLeft,
    contentLeftMm: xLeftMm,
    contentRightMm: xRightMm,
    zIndex: 20
  });


  // Simplified: All block containers use the same logic now
  ctx.items.push(createItem(isBlockContainer ? false : true));
};
