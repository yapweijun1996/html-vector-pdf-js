import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTextNode } from './parseTextNode';
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

describe('parseTextNode table-cell packing', () => {
  const originalCreateRange = document.createRange;
  const originalGetComputedStyle = window.getComputedStyle;
  let ctx: DomParseContext;
  let td: HTMLTableCellElement;
  let textNode: Text;

  beforeEach(() => {
    td = document.createElement('td');
    td.setAttribute('valign', 'middle');
    textNode = document.createTextNode('AC');
    td.appendChild(textNode);
    document.body.appendChild(td);

    td.getBoundingClientRect = vi.fn().mockReturnValue(rect(20, 10, 70, 46));

    const tdStyle = {
      display: 'table-cell',
      opacity: '1',
      textAlign: 'center',
      whiteSpace: 'normal',
      paddingLeft: '10px',
      paddingRight: '10px',
      paddingTop: '12px',
      paddingBottom: '12px',
      borderLeftWidth: '0px',
      borderRightWidth: '0px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
      fontSize: '22px',
      lineHeight: 'normal',
      textTransform: 'none',
      fontWeight: '700',
      fontStyle: 'normal',
      fontFamily: 'Arial',
      color: 'rgb(255,255,255)',
      float: 'none',
      position: 'static',
      textDecoration: 'none',
      textDecorationLine: 'none',
      verticalAlign: 'middle',
      marginLeft: '0px',
      marginRight: '0px'
    };

    window.getComputedStyle = vi.fn(() => tdStyle as any) as any;

    document.createRange = vi.fn(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => [rect(32, 21, 24, 12)] as any,
      getBoundingClientRect: () => rect(32, 21, 24, 12) as any
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
      cellHasMixedTextStyles: vi.fn().mockReturnValue(true),
      collapsedBorderCandidates: [],
      collapseBorderSourceOrder: 0
    };
  });

  afterEach(() => {
    document.createRange = originalCreateRange as any;
    window.getComputedStyle = originalGetComputedStyle as any;
    td.remove();
  });

  it('packs single-line table-cell text using content box height and valign', () => {
    parseTextNode(ctx, textNode, () => false, 0);

    expect(ctx.items).toHaveLength(1);
    const item = ctx.items[0];
    // content box top = 22; content box height = 22; inferred line box = 26.4; middle offset clamps to 0; baseline = +26.4
    expect(item.y).toBeCloseTo((22 + 26.4) * 0.2645833333, 4);
  });
});
