import { RenderItem } from '../renderItems';

/**
 * Merges adjacent layout buckets for items in the same layout element (e.g., TD).
 * This fixes cases where text nodes have slight vertical offsets (e.g., from <script> tags)
 * causing them to be split into separate lines.
 */
export const mergeAdjacentLayoutBuckets = (items: RenderItem[]): void => {
  const itemsByLayoutId = new Map<string, RenderItem[]>();
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
};

/**
 * Performs vertical snapping for items in the same alignmentBucket.
 * This ensures that floating elements (like currency symbols) align with the main text baseline.
 */
export const snapItemsInBuckets = (items: RenderItem[]): void => {
  const itemsByBucket = new Map<string, RenderItem[]>();
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

    // 3. Safe re-anchor for table-cell right/center alignment when we had to skip inline grouping.
    // Some ERP HTML patterns wrap cell text in block/padded spans, which makes the parser downgrade alignment to 'left'
    // to avoid overlap. That keeps the browser-measured left edge, but in PDF it can drift due to font metrics.
    // If there's exactly one non-floating text item in the bucket that wanted right/center, we can anchor it safely.
    const reanchorCandidates = bucketItems.filter(
      (it) =>
        it.type === 'text' &&
        !it.inlineGroupId &&
        !it.floatLeft &&
        (it.cellTextAlign === 'right' || it.cellTextAlign === 'center') &&
        it.contentLeftMm !== undefined &&
        it.contentRightMm !== undefined
    );

    if (reanchorCandidates.length === 1) {
      const it = reanchorCandidates[0];
      const left = it.contentLeftMm!;
      const right = it.contentRightMm!;
      if (it.cellTextAlign === 'right') {
        it.x = right;
        it.textAlign = 'right';
      } else if (it.cellTextAlign === 'center') {
        it.x = (left + right) / 2;
        it.textAlign = 'center';
      }
    }
  }
};
