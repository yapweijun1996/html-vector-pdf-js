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

  const parentEl = txt.parentElement;
  const fontStyle = window.getComputedStyle(parentEl);
  const layoutEl = (parentEl.closest('td,th') as HTMLElement | null) || parentEl;
  const layoutStyle = window.getComputedStyle(layoutEl);
  const layoutRect = layoutEl.getBoundingClientRect();

  // Check if there's a direct div parent with padding that should be respected
  const directDivParent = parentEl.closest('div');
  const useNestedDivPadding = directDivParent && directDivParent !== layoutEl && layoutEl.contains(directDivParent);

  let paddingLeftPx = parsePx(layoutStyle.paddingLeft);
  let paddingRightPx = parsePx(layoutStyle.paddingRight);

  if (useNestedDivPadding) {
    const divStyle = window.getComputedStyle(directDivParent);
    paddingLeftPx += parsePx(divStyle.paddingLeft);
    paddingRightPx += parsePx(divStyle.paddingRight);
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
  /**** AMENDMENT [start] "Force aggregation for text in same TD to fix overlay" ****/
  // Standard bucket calculation based on top position
  const rawBucketPx = Math.round(firstRect.top / 2) * 2;
  let yBucketPx = rawBucketPx;

  if (inTableCell) {
    const layoutId = ctx.getLayoutId(layoutEl);

    // Check if we have a "forced" bucket for this cell from a previous sibling text node
    // This handles the document.write case where split text nodes should be on the same line
    if (ctx.cellLastTextBucket && ctx.cellLastTextBucket.has(layoutId)) {
      const lastBucket = ctx.cellLastTextBucket.get(layoutId)!;
      // Only force-merge if the vertical difference is small (e.g. < 5px)
      // This prevents merging distinct lines, but catches script-induced shifts
      if (Math.abs(rawBucketPx - lastBucket) < 5) {
        console.log(`[DEBUG] Forcing bucket: raw=${rawBucketPx}, forced=${lastBucket}, text="${finalStr.substring(0, 30)}..."`);
        yBucketPx = lastBucket;
      } else {
        // It's a new visual line, update the master bucket
        console.log(`[DEBUG] New line: raw=${rawBucketPx}, last=${lastBucket}, text="${finalStr.substring(0, 30)}..."`);
        ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
      }
    } else {
      // First text in this cell, initialize
      console.log(`[DEBUG] First text in cell: bucket=${rawBucketPx}, text="${finalStr.substring(0, 30)}..."`);
      if (!ctx.cellLastTextBucket) ctx.cellLastTextBucket = new Map();
      ctx.cellLastTextBucket.set(layoutId, rawBucketPx);
    }
  }
  /**** AMENDMENT [end] "Force aggregation for text in same TD to fix overlay" ****/

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

  // Helper to create the non-aggregated render item
  const createItem = (isFirstItemInWrapped: boolean = false) => ({
    type: 'text' as const,
    x: xMmActual,
    y: y + baselineOffset,
    w: ctx.px2mm(firstRect.width),
    h,
    style: fontStyle,
    text: finalStr,
    textAlign: shouldSkipInlineGroup ? 'left' : textAlign, // Force left if not aggregating to respect xMmActual
    maxWidthMm: ctx.px2mm(contentWidthPx - (isFirstItemInWrapped ? firstRect.left - contentLeftPx : 0)),
    lineHeightMm,
    noWrap: !browserWrapped,
    cssNoWrap,
    rectsLen,
    inlineGroupId: !shouldSkipInlineGroup ? `${ctx.getLayoutId(layoutEl)}|${yBucketPx}` : undefined,
    inlineOrder: !shouldSkipInlineGroup ? walked : undefined,
    alignmentBucket: `${ctx.getLayoutId(layoutEl)}|${yBucketPx}`,
    floatLeft: isFloatLeft,
    contentLeftMm: xLeftMm,
    contentRightMm: xRightMm,
    zIndex: 20
  });

  if (inTableCell) {
    ctx.items.push(createItem(false));
    return;
  }

  ctx.items.push(createItem(true));
};
