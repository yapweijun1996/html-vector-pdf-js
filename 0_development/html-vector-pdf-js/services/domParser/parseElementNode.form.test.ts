import { describe, it, expect, vi } from 'vitest';
import { maybeAddFormFieldValueText } from './parseElementNode.form';
import type { DomParseContext } from './context';
import type { PdfConfig } from '../pdfConfig';

vi.mock('../textBaseline', () => ({
  computeAlphabeticBaselineOffsetPx: vi.fn((_style: CSSStyleDeclaration, lineBoxHeightPx: number) => lineBoxHeightPx)
}));

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
  toJSON: () => any;
};

const rect = (left: number, top: number, width: number, height: number): RectLike => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({})
});

describe('maybeAddFormFieldValueText', () => {
  it('anchors input text to the content box instead of the border box', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Hello World';

    const style = {
      textTransform: 'none',
      paddingLeft: '8px',
      paddingRight: '6px',
      paddingTop: '4px',
      paddingBottom: '6px',
      borderLeftWidth: '2px',
      borderRightWidth: '2px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
      textAlign: 'left',
      fontSize: '12px',
      lineHeight: '14px'
    } as CSSStyleDeclaration;

    const ctx: DomParseContext = {
      cfg: {
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        render: { pxToMm: 0.2645833333, rasterScale: 1 },
        debugOverlay: { enabled: false },
        text: { scale: 1 },
        callbacks: {},
        errors: { failOnAssetError: false },
        debug: false,
        textEngine: { mode: 'legacy' }
      } as Required<PdfConfig>,
      px2mm: (px: number) => px * 0.2645833333,
      rootRect: rect(0, 0, 800, 600) as any,
      items: [],
      aggregatedTextByKey: new Map(),
      getLayoutId: vi.fn(),
      getCollapseTableInfo: vi.fn().mockReturnValue(null),
      cellHasMixedTextStyles: vi.fn(),
      collapsedBorderCandidates: [],
      collapseBorderSourceOrder: 0
    };

    maybeAddFormFieldValueText(ctx, input, style, rect(100, 80, 200, 40) as any);

    expect(ctx.items).toHaveLength(1);
    expect(ctx.items[0].x).toBeCloseTo(10 + (100 + 10) * 0.2645833333, 4);
    expect(ctx.items[0].w).toBeCloseTo((200 - 10 - 8) * 0.2645833333, 4);
    expect(ctx.items[0].h).toBeCloseTo((40 - 5 - 7) * 0.2645833333, 4);
    expect(ctx.items[0].y).toBeCloseTo((80 + 5 + 7 + 14) * 0.2645833333, 4);
  });
});
