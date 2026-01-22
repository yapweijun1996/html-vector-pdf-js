import { PdfConfig } from './pdfConfig';
import { createYieldController } from './asyncYield';
import { ParsedElement, DomParseContext, createCellHasMixedTextStyles, createLayoutIdGetter } from './domParser/context';
import { createIsPageBreakBefore, createShouldExclude } from './domParser/selectors';
import { parseElementNode } from './domParser/parseElementNode';
import { parseTextNode } from './domParser/parseTextNode';
import { mergeAdjacentLayoutBuckets, snapItemsInBuckets } from './domParser/postProcess';
import { parsePx } from './pdfUnits';
import { parseLineHeightPx } from './textLayout';
import { computeAlphabeticBaselineOffsetPx } from './textBaseline';

export const parseElementToItems = async (
  element: HTMLElement,
  cfg: Required<PdfConfig>,
  px2mm: (px: number) => number
): Promise<ParsedElement> => {
  const rootRect = element.getBoundingClientRect();
  const imagePromises: Promise<void>[] = [];
  const pageBreakBeforeYs: number[] = [];
  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  const items: DomParseContext['items'] = [];
  const getLayoutId = createLayoutIdGetter();
  const aggregatedTextByKey = new Map<string, DomParseContext['items'][number]>();
  const cellHasMixedTextStyles = createCellHasMixedTextStyles();
  const shouldExclude = createShouldExclude(cfg.excludeSelectors);
  const isPageBreakBefore = createIsPageBreakBefore(cfg.pagination.pageBreakBeforeSelectors);

  const ctx: DomParseContext = {
    cfg,
    rootRect,
    px2mm,
    items,
    aggregatedTextByKey,
    getLayoutId,
    cellHasMixedTextStyles,
    skipTextContainers: (cfg.textEngine?.mode || 'legacy') !== 'legacy' ? new WeakSet<HTMLElement>() : undefined
  };

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let walked = 0;

  while (node) {
    walked++;
    await maybeYield(walked);
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (isPageBreakBefore(el)) {
        const rect = el.getBoundingClientRect();
        if (rect.height >= 0) {
          /**** AMENDMENT [start] "Smart Break: Break AFTER for footer containers, BEFORE for others" ****/
          // Check if this pagebreak element is actually a wrapper for the footer
          // If so, we want the footer on THIS page, and the break AFTER it.
          const isFooterWrapper = el.classList.contains('pagebreak_bf_processed') &&
            el.querySelector('.cls_footer_layer_onscreen') !== null;

          const breakY = isFooterWrapper
            ? px2mm(rect.bottom - rootRect.top) // Break After Footer
            : px2mm(rect.top - rootRect.top);   // Standard Break Before

          if (breakY > 0) pageBreakBeforeYs.push(breakY);
          /**** AMENDMENT [end] "Smart Break: Break AFTER for footer containers, BEFORE for others" ****/
        }
        /**** AMENDMENT [start] "Allow pagebreak element children (e.g. footer) to be processed" ****/
        /****
        node = walker.nextNode();
        continue;
        ****/
        // Don't skip - let the walker continue into pagebreak element's children
        // This allows footer content inside pagebreak elements to be rendered before the break
        /**** AMENDMENT [end] "Allow pagebreak element children (e.g. footer) to be processed" ****/
      }

      if (shouldExclude(el)) {
        node = walker.nextNode();
        continue;
      }

      // PDF-first text engine: create a single text block item for supported containers (e.g. <p>)
      const textEngineMode = cfg.textEngine?.mode || 'legacy';
      if (textEngineMode !== 'legacy') {
        const tag = el.tagName.toUpperCase();
        const enabledTags = cfg.textEngine.enabledTags || ['P'];
        if (enabledTags.includes(tag as any)) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          // In auto mode, only enable PDF-first for "risky" containers (mixed inline styles / special chars / <br>).
          const autoEnabled =
            textEngineMode === 'pdfFirst' ||
            (textEngineMode === 'auto' &&
              (el.querySelector('strong,b,em,i,span,br') !== null || /[^\x00-\xFF]/.test(el.textContent || '')));

          if (autoEnabled && style.display !== 'none' && style.opacity !== '0' && rect.width > 0 && rect.height > 0) {
            if (!/\S/.test(el.textContent || '')) {
              // No meaningful text content; skip.
              node = walker.nextNode();
              continue;
            }

            const paddingLeftPx = parsePx(style.paddingLeft) + parsePx(style.borderLeftWidth);
            const paddingRightPx = parsePx(style.paddingRight) + parsePx(style.borderRightWidth);
            const paddingTopPx = parsePx(style.paddingTop) + parsePx(style.borderTopWidth);

            const contentLeftPx = rect.left + paddingLeftPx;
            const contentRightPx = rect.right - paddingRightPx;
            const contentWidthPx = Math.max(0, contentRightPx - contentLeftPx);

            const fontSizePx = parseFloat(style.fontSize || '0') || 0;
            const lineHeightPx = parseLineHeightPx(style.lineHeight, fontSizePx);
            const lineHeightMm = px2mm(lineHeightPx) * cfg.text.scale;
            const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(style, lineHeightPx);
            const baselineOffsetMm = px2mm(baselineOffsetPx) * cfg.text.scale;

            const xMm = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
            const yTopMm = px2mm(rect.top + paddingTopPx - rootRect.top);
            const yBaselineMm = yTopMm + baselineOffsetMm;
            const wMm = px2mm(contentWidthPx);

            ctx.items.push({
              type: 'textBlock',
              x: xMm,
              y: yBaselineMm,
              w: wMm,
              h: lineHeightMm,
              style,
              element: el,
              maxWidthMm: wMm,
              lineHeightMm,
              noWrap: true,
              cssNoWrap: true,
              zIndex: 20
            });

            ctx.skipTextContainers?.add(el);
          }
        }
      }
      parseElementNode(ctx, el, imagePromises);
    } else if (node.nodeType === Node.TEXT_NODE) {
      parseTextNode(ctx, node as Text, shouldExclude, walked);
    }
    node = walker.nextNode();
  }

  if (aggregatedTextByKey.size > 0) {
    for (const item of aggregatedTextByKey.values()) items.push(item);
  }

  // Post-process: Vertical snapping for items in the same alignmentBucket
  // But first: Merge adjacent layout buckets for items in same layoutEl (e.g. TD)
  // This fixes cases where text nodes have slight vertical offsets (e.g. from <script> tags) causing them to be split into separate lines
  /**** AMENDMENT [start] "Merge adjacent layout buckets to fix text overlay issues" ****/
  mergeAdjacentLayoutBuckets(items);
  /**** AMENDMENT [end] "Merge adjacent layout buckets to fix text overlay issues" ****/

  // Post-process: Vertical snapping for items in the same alignmentBucket（Original）
  // This ensures that floating elements (like currency symbols) align with the main text baseline
  snapItemsInBuckets(items);

  await Promise.all(imagePromises);
  return { items, pageBreakBeforeYs };
};
