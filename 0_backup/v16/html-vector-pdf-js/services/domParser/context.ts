import { PdfConfig } from '../pdfConfig';
import { RenderItem } from '../renderItems';
import { buildTextStyleKey } from '../textLayout';

export type ParsedElement = { items: RenderItem[]; pageBreakBeforeYs: number[] };

export type PxToMm = (px: number) => number;

export interface DomParseContext {
  cfg: Required<PdfConfig>;
  rootRect: DOMRect;
  px2mm: PxToMm;
  items: RenderItem[];
  aggregatedTextByKey: Map<string, RenderItem>;
  getLayoutId: (el: Element) => number;
  cellHasMixedTextStyles: (cell: Element) => boolean;
  /**** AMENDMENT [start] "Track last bucket per cell" ****/
  cellLastTextBucket?: Map<number, number>;
  /**** AMENDMENT [end] "Track last bucket per cell" ****/
  /** Containers handled by PDF-first text engine; descendant text nodes should be skipped. */
  skipTextContainers?: WeakSet<HTMLElement>;
}

export const createLayoutIdGetter = (): ((el: Element) => number) => {
  const layoutIdByElement = new WeakMap<Element, number>();
  let nextLayoutId = 1;
  return (el: Element): number => {
    const existing = layoutIdByElement.get(el);
    if (existing) return existing;
    const id = nextLayoutId++;
    layoutIdByElement.set(el, id);
    return id;
  };
};

export const createCellHasMixedTextStyles = (): ((cell: Element) => boolean) => {
  const hasMixedTextStylesByCell = new WeakMap<Element, boolean>();
  return (cell: Element): boolean => {
    const cached = hasMixedTextStylesByCell.get(cell);
    if (typeof cached === 'boolean') return cached;

    const cellStyleKey = buildTextStyleKey(window.getComputedStyle(cell as HTMLElement));
    const textWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let n = textWalker.nextNode();
    while (n) {
      const t = n as Text;
      if (/\S/.test(t.textContent || '') && t.parentElement) {
        const key = buildTextStyleKey(window.getComputedStyle(t.parentElement));
        if (key !== cellStyleKey) {
          hasMixedTextStylesByCell.set(cell, true);
          return true;
        }
      }
      n = textWalker.nextNode();
    }

    hasMixedTextStylesByCell.set(cell, false);
    return false;
  };
};

