import { PdfConfig } from './pdfConfig';
import { createYieldController } from './asyncYield';
import { ParsedElement, DomParseContext, createCellHasMixedTextStyles, createLayoutIdGetter } from './domParser/context';
import { createIsPageBreakBefore, createShouldExclude } from './domParser/selectors';
import { parseElementNode } from './domParser/parseElementNode';
import { parseTextNode } from './domParser/parseTextNode';

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
    cellHasMixedTextStyles
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
  const itemsByLayoutId = new Map<string, DomParseContext['items']>();
  for (const item of items) {
    if (item.type === 'text' && item.alignmentBucket) {
      const layoutId = item.alignmentBucket.split('|')[0];
      if (!itemsByLayoutId.has(layoutId)) itemsByLayoutId.set(layoutId, []);
      itemsByLayoutId.get(layoutId)!.push(item);
    }
  }

  for (const [layoutId, layoutItems] of itemsByLayoutId) {
    if (layoutItems.length <= 1) continue;

    // Extract unique yBucketPx values
    const buckets = new Set<number>();
    for (const item of layoutItems) {
      const parts = item.alignmentBucket!.split('|');
      if (parts.length >= 2) {
        const bucketPx = parseInt(parts[1], 10);
        if (!isNaN(bucketPx)) buckets.add(bucketPx);
      }
    }

    if (buckets.size <= 1) continue;

    const sortedBuckets = Array.from(buckets).sort((a, b) => a - b);
    const bucketMapping = new Map<number, number>();

    // Determine merges: if diff <= 4px (2 buckets distance), merge to the master bucket
    let masterBucket = sortedBuckets[0];
    bucketMapping.set(masterBucket, masterBucket);

    for (let i = 1; i < sortedBuckets.length; i++) {
      const current = sortedBuckets[i];
      // Compare with current master bucket. If within tolerance, merge.
      // 4px is generous enough to catch subpixel/script/font-size shifts, 
      // but small enough to avoid merging distinct lines (usually >12px)
      if (current - masterBucket <= 4) {
        bucketMapping.set(current, masterBucket);
      } else {
        masterBucket = current;
        bucketMapping.set(current, current);
      }
    }

    // Apply mapping
    for (const item of layoutItems) {
      const parts = item.alignmentBucket!.split('|');
      if (parts.length < 2) continue;

      const currentBucketPx = parseInt(parts[1], 10);
      if (isNaN(currentBucketPx)) continue;

      const newBucketPx = bucketMapping.get(currentBucketPx);
      if (newBucketPx !== undefined && newBucketPx !== currentBucketPx) {
        const newBucketStr = newBucketPx.toString();
        // Update both alignmentBucket and inlineGroupId to match the master bucket
        item.alignmentBucket = `${layoutId}|${newBucketStr}`;
        if (item.inlineGroupId) {
          item.inlineGroupId = `${layoutId}|${newBucketStr}`;
        }
      }
    }
  }
  /**** AMENDMENT [end] "Merge adjacent layout buckets to fix text overlay issues" ****/

  // Post-process: Vertical snapping for items in the same alignmentBucket（Original）
  // This ensures that floating elements (like currency symbols) align with the main text baseline
  const itemsByBucket = new Map<string, DomParseContext['items']>();
  for (const item of items) {
    if (item.type === 'text' && item.alignmentBucket) {
      const bucket = itemsByBucket.get(item.alignmentBucket);
      if (bucket) bucket.push(item);
      else itemsByBucket.set(item.alignmentBucket, [item]);
    }
  }

  for (const bucketItems of itemsByBucket.values()) {
    if (bucketItems.length === 0) continue;

    // 1. Vertical snapping
    let anchorY: number | null = null;
    let fallbackY: number | null = null;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const item of bucketItems) {
      if (item.inlineGroupId) {
        if (anchorY === null) anchorY = item.y;
      }
      if (fallbackY === null) fallbackY = item.y;
      minY = Math.min(minY, item.y);
      maxY = Math.max(maxY, item.y);
    }

    const targetY = anchorY ?? fallbackY;
    if (targetY !== null && bucketItems.length > 1) {
      if (maxY - minY < 2.0) {
        for (const item of bucketItems) {
          item.y = targetY;
        }
      }
    }

    // 2. Horizontal snap for float-left elements (like S$)
    // Many ERP layouts use float:left for currency symbols. 
    // We ensure they actually hit the left padding of the container even if browser rect measurement is slightly off
    for (const item of bucketItems) {
      // If it's a floating element and was intended to be on the left
      if (item.floatLeft && item.contentLeftMm !== undefined) {
        item.x = item.contentLeftMm;
      }
    }
  }

  await Promise.all(imagePromises);
  return { items, pageBreakBeforeYs };
};
