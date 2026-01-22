import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTextNode } from './parseTextNode';
import { DomParseContext } from './context';
import { PdfConfig } from '../pdfConfig';

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

describe('parseTextNode - inline grouping in right-aligned TD', () => {
  const originalCreateRange = document.createRange;
  const originalGetComputedStyle = window.getComputedStyle;
  let ctx: DomParseContext;
  let td: HTMLTableCellElement;
  let b1: HTMLElement;
  let b2: HTMLElement;
  let tBold1: Text;
  let tNormal1: Text;
  let tBold2: Text;
  let tNormal2: Text;

  const baseCfg: any = {
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    render: { pxToMm: 0.2645833333, rasterScale: 1 },
    debugOverlay: { enabled: false },
    text: { scale: 1 },
    callbacks: {},
    errors: { failOnAssetError: false },
    debug: false,
    textEngine: { mode: 'legacy' }
  };

  beforeEach(() => {
    td = document.createElement('td');
    td.setAttribute('align', 'right');
    td.getBoundingClientRect = vi.fn().mockReturnValue(rect(0, 0, 500, 30));

    b1 = document.createElement('b');
    b2 = document.createElement('b');

    tBold1 = document.createTextNode('INV NO:');
    tNormal1 = document.createTextNode(' INV-2026-0001 | ');
    tBold2 = document.createTextNode('DATE:');
    tNormal2 = document.createTextNode(' 01 JAN 2026');

    b1.appendChild(tBold1);
    b2.appendChild(tBold2);
    td.appendChild(b1);
    td.appendChild(tNormal1);
    td.appendChild(b2);
    td.appendChild(tNormal2);
    document.body.appendChild(td);

    const tdStyle = {
      display: 'table-cell',
      opacity: '1',
      textAlign: 'right',
      whiteSpace: 'normal',
      paddingLeft: '0px',
      paddingRight: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderLeftWidth: '0px',
      borderRightWidth: '0px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
      marginLeft: '0px',
      marginRight: '0px',
      fontSize: '16px',
      lineHeight: 'normal',
      textTransform: 'none',
      fontWeight: '400',
      fontStyle: 'normal',
      color: 'rgb(0,0,0)',
      float: 'none',
      position: 'static',
      textDecoration: 'none',
      textDecorationLine: 'none'
    };

    const boldStyle = { ...tdStyle, display: 'inline', fontWeight: '700' };

    window.getComputedStyle = vi.fn((el: any) => {
      if (el === td) return tdStyle as any;
      if (el === b1 || el === b2) return boldStyle as any;
      return tdStyle as any;
    }) as any;

    const rectByText = new Map<Text, RectLike>([
      // Simulate tiny vertical differences between bold/normal fragments on the same line
      [tBold1, rect(300, 10, 30, 12)],
      [tNormal1, rect(340, 11, 80, 12)],
      [tBold2, rect(430, 10, 25, 12)],
      [tNormal2, rect(460, 11, 70, 12)]
    ]);

    document.createRange = vi.fn(() => {
      let selected: Text | null = null;
      return {
        selectNodeContents: (n: Node) => {
          selected = n as Text;
        },
        getClientRects: () => {
          const r = selected ? rectByText.get(selected) : undefined;
          return r ? [r as any] : ([] as any);
        },
        getBoundingClientRect: () => {
          const r = selected ? rectByText.get(selected) : undefined;
          return (r ?? rect(0, 0, 0, 0)) as any;
        }
      } as any;
    }) as any;

    ctx = {
      cfg: baseCfg as Required<PdfConfig>,
      px2mm: (px: number) => px * 0.2645833333,
      rootRect: rect(0, 0, 800, 600) as any,
      items: [],
      aggregatedTextByKey: new Map(),
      getLayoutId: vi.fn().mockReturnValue(1),
      cellHasMixedTextStyles: vi.fn().mockReturnValue(true)
    };
  });

  afterEach(() => {
    document.createRange = originalCreateRange as any;
    window.getComputedStyle = originalGetComputedStyle as any;
    td.remove();
  });

  it('groups all inline fragments (bold + plain text) into the same inlineGroupId', () => {
    const shouldExclude = () => false;

    parseTextNode(ctx, tBold1, shouldExclude, 0);
    parseTextNode(ctx, tNormal1, shouldExclude, 1);
    parseTextNode(ctx, tBold2, shouldExclude, 2);
    parseTextNode(ctx, tNormal2, shouldExclude, 3);

    const textItems = ctx.items.filter((i) => i.type === 'text');
    expect(textItems).toHaveLength(4);

    const groupIds = new Set(textItems.map((i: any) => i.inlineGroupId));
    expect(groupIds.size).toBe(1);
    expect(Array.from(groupIds)[0]).toBeTruthy();

    // Inline grouping should preserve desired alignment (renderer later sets computedX + left align)
    for (const it of textItems as any[]) {
      expect(it.inlineOrder).not.toBeUndefined();
      expect(it.textAlign).toBe('right');
    }
  });
});
