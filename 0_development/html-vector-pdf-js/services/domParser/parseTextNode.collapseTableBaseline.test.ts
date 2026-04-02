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

describe('parseTextNode collapse-table baseline', () => {
  const originalCreateRange = document.createRange;
  const originalGetComputedStyle = window.getComputedStyle;
  let ctx: DomParseContext;
  let table: HTMLTableElement;
  let td: HTMLTableCellElement;
  let span: HTMLSpanElement;
  let textNode: Text;

  beforeEach(() => {
    table = document.createElement('table');
    td = document.createElement('td');
    span = document.createElement('span');
    textNode = document.createTextNode('Net 30');
    span.appendChild(textNode);
    td.appendChild(span);
    table.appendChild(document.createElement('tbody')).appendChild(document.createElement('tr')).appendChild(td);
    document.body.appendChild(table);

    table.getBoundingClientRect = vi.fn().mockReturnValue(rect(0, 0, 300, 40));
    td.getBoundingClientRect = vi.fn().mockReturnValue(rect(20, 10, 120, 20));

    const tableStyle = {
      display: 'table',
      opacity: '1',
      borderCollapse: 'collapse'
    };
    const tdStyle = {
      display: 'table-cell',
      opacity: '1',
      textAlign: 'left',
      whiteSpace: 'normal',
      paddingLeft: '0px',
      paddingRight: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderLeftWidth: '0px',
      borderRightWidth: '0px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
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
      textDecorationLine: 'none'
    };
    const spanStyle = { ...tdStyle, display: 'inline' };

    window.getComputedStyle = vi.fn((el: any) => {
      if (el === table) return tableStyle as any;
      if (el === td) return tdStyle as any;
      if (el === span) return spanStyle as any;
      return tdStyle as any;
    }) as any;

    document.createRange = vi.fn(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => [rect(30, 12, 60, 12)] as any,
      getBoundingClientRect: () => rect(30, 12, 60, 12) as any
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
      getLayoutId: vi.fn().mockImplementation((el: Element) => el === table ? 99 : 1),
      getCollapseTableInfo: vi.fn().mockReturnValue({
        table,
        tableId: 99,
        rect: rect(0, 0, 300, 40) as any
      }),
      cellHasMixedTextStyles: vi.fn().mockReturnValue(true),
      collapsedBorderCandidates: [],
      collapseBorderSourceOrder: 0
    };
  });

  afterEach(() => {
    document.createRange = originalCreateRange as any;
    window.getComputedStyle = originalGetComputedStyle as any;
    table.remove();
  });

  it('uses the measured fragment height instead of inferred normal line-height', () => {
    parseTextNode(ctx, textNode, () => false, 0);

    expect(ctx.items).toHaveLength(1);
    const item = ctx.items[0];
    expect(item.lineHeightMm).toBeCloseTo(12 * 0.2645833333, 4);
    expect(item.y).toBeCloseTo((12 + 12) * 0.2645833333, 4);
    expect(item.collapseTableId).toBe(99);
  });
});
