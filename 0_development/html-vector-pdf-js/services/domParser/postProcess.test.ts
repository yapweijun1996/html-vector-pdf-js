import { describe, it, expect, beforeEach } from 'vitest';
import { mergeAdjacentLayoutBuckets, snapItemsInBuckets } from './postProcess';
import { RenderItem } from '../renderItems';

describe('postProcess', () => {
  describe('mergeAdjacentLayoutBuckets', () => {
    it('should merge buckets that are within tolerance (<= 4px)', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'layout1|10', // master bucket
          x: 0, y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'layout1|14', // diff 4, should merge
          x: 0, y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'layout1|20', // diff 10 (from 10), new bucket
          x: 0, y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      mergeAdjacentLayoutBuckets(items);

      // First two should share the master bucket (10)
      expect(items[0].alignmentBucket).toBe('layout1|10');
      expect(items[1].alignmentBucket).toBe('layout1|10');
      
      // Third one should keep its own (20)
      expect(items[2].alignmentBucket).toBe('layout1|20');
    });

    it('should not merge buckets from different layoutIds', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'layout1|10',
          x: 0, y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'layout2|12', // diff 2 but different layout
          x: 0, y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      mergeAdjacentLayoutBuckets(items);

      expect(items[0].alignmentBucket).toBe('layout1|10');
      expect(items[1].alignmentBucket).toBe('layout2|12');
    });
  });

  describe('snapItemsInBuckets', () => {
    it('should snap items vertically if variance is small (< 2.0)', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          y: 10.0,
          inlineGroupId: 'group1', // Anchor
          x: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          y: 10.5, // Within 2.0 range
          x: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      snapItemsInBuckets(items);

      expect(items[0].y).toBe(10.0);
      expect(items[1].y).toBe(10.0); // Should snap to anchor
    });

    it('should not snap items vertically if variance is large (>= 2.0)', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          y: 10.0,
          inlineGroupId: 'group1',
          x: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          y: 13.0, // > 2.0 range
          x: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      snapItemsInBuckets(items);

      expect(items[0].y).toBe(10.0);
      expect(items[1].y).toBe(13.0);
    });

    it('should snap float-left items to contentLeftMm', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          floatLeft: true,
          contentLeftMm: 5.0,
          x: 6.0, // Slightly off
          y: 0, w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      snapItemsInBuckets(items);

      expect(items[0].x).toBe(5.0);
    });

    it('should re-anchor a single right-aligned cell text to contentRightMm', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          floatLeft: true,
          contentLeftMm: 5.0,
          contentRightMm: 15.0,
          x: 6.0,
          y: 10.0,
          w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          // Parser downgraded alignment to left, but we retained desired align
          textAlign: 'left',
          cellTextAlign: 'right',
          contentLeftMm: 5.0,
          contentRightMm: 15.0,
          x: 9.0,
          y: 10.0,
          w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      snapItemsInBuckets(items);

      expect(items[1].x).toBe(15.0);
      expect(items[1].textAlign).toBe('right');
    });

    it('should not re-anchor when multiple non-floating right/center candidates exist (avoid overlap)', () => {
      const items: RenderItem[] = [
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          textAlign: 'left',
          cellTextAlign: 'right',
          contentLeftMm: 5.0,
          contentRightMm: 15.0,
          x: 9.0,
          y: 10.0,
          w: 0, h: 0, style: {} as any, zIndex: 0
        },
        {
          type: 'text',
          alignmentBucket: 'bucket1',
          textAlign: 'left',
          cellTextAlign: 'right',
          contentLeftMm: 5.0,
          contentRightMm: 15.0,
          x: 11.0,
          y: 10.0,
          w: 0, h: 0, style: {} as any, zIndex: 0
        }
      ];

      snapItemsInBuckets(items);

      expect(items[0].x).toBe(9.0);
      expect(items[0].textAlign).toBe('left');
      expect(items[1].x).toBe(11.0);
      expect(items[1].textAlign).toBe('left');
    });
  });
});
