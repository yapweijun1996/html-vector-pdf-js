import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTextNode } from './parseTextNode';
import type { DomParseContext } from './context';
import type { PdfConfig } from '../pdfConfig';

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

describe('parseTextNode content box', () => {
  const originalCreateRange = document.createRange;
  const originalGetComputedStyle = window.getComputedStyle;
  let ctx: DomParseContext;
  let layout: HTMLDivElement;
  let span: HTMLSpanElement;
  let inner: HTMLSpanElement;
  let textNode: Text;

  beforeEach(() => {
    layout = document.createElement('div');
    span = document.createElement('span');
    inner = document.createElement('span');
    textNode = document.createTextNode('Nested text');
    inner.appendChild(textNode);
    span.appendChild(inner);
    layout.appendChild(span);
    document.body.appendChild(layout);

    layout.getBoundingClientRect = vi.fn().mockReturnValue(rect(20, 10, 200, 40));

    const layoutStyle = {
      display: 'block',
      opacity: '1',
      textAlign: 'left',
      whiteSpace: 'normal',
      paddingLeft: '10px',
      paddingRight: '8px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderLeftWidth: '2px',
      borderRightWidth: '1px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
      fontSize: '16px',
      lineHeight: 'normal',
      textTransform: 'none',
      fontWeight: '400',
      fontStyle: 'normal',
      fontFamily: 'Arial',
      color: 'rgb(0,0,0)',
      float: 'none',
      position: 'static',
      textDecoration: 'none',
      textDecorationLine: 'none',
      marginLeft: '0px',
      marginRight: '0px'
    };
    const spanStyle = {
      ...layoutStyle,
      display: 'inline',
      paddingLeft: '5px',
      paddingRight: '4px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderLeftWidth: '1px',
      borderRightWidth: '2px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px'
    };
    const innerStyle = {
      ...spanStyle,
      paddingLeft: '3px',
      paddingRight: '6px',
      borderLeftWidth: '1px',
      borderRightWidth: '0px'
    };

    window.getComputedStyle = vi.fn((el: any) => {
      if (el === layout) return layoutStyle as any;
      if (el === span) return spanStyle as any;
      if (el === inner) return innerStyle as any;
      return layoutStyle as any;
    }) as any;

    document.createRange = vi.fn(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => [rect(50, 16, 60, 12)] as any,
      getBoundingClientRect: () => rect(50, 16, 60, 12) as any
    })) as any;

    ctx = {
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
      getLayoutId: vi.fn().mockReturnValue(1),
      getCollapseTableInfo: vi.fn().mockReturnValue(null),
      cellHasMixedTextStyles: vi.fn().mockReturnValue(false),
      collapsedBorderCandidates: [],
      collapseBorderSourceOrder: 0
    };
  });

  afterEach(() => {
    document.createRange = originalCreateRange as any;
    window.getComputedStyle = originalGetComputedStyle as any;
    layout.remove();
  });

  it('uses the nested content box width when intermediate inline wrappers add padding or borders', () => {
    parseTextNode(ctx, textNode, () => false, 0);

    expect(ctx.items).toHaveLength(1);
    const item = ctx.items[0];
    expect(item.maxWidthMm).toBeCloseTo((200 - 12 - 9 - 6 - 6 - 4 - 6) * 0.2645833333, 4);
    expect(item.contentLeftMm).toBeCloseTo(10 + (20 + 12 + 6 + 4) * 0.2645833333, 4);
    expect(item.contentRightMm).toBeCloseTo(10 + (220 - 9 - 6 - 6) * 0.2645833333, 4);
  });
});
