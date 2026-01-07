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
          const y = px2mm(rect.top - rootRect.top);
          if (y > 0) pageBreakBeforeYs.push(y);
        }
        node = walker.nextNode();
        continue;
      }

      if (shouldExclude(el)) {
        node = walker.nextNode();
        continue;
      }
      parseElementNode(ctx, el, imagePromises);
    } else if (node.nodeType === Node.TEXT_NODE) {
      parseTextNode(ctx, node as Text, shouldExclude);
    }
    node = walker.nextNode();
  }

  if (aggregatedTextByKey.size > 0) {
    for (const item of aggregatedTextByKey.values()) items.push(item);
  }

  await Promise.all(imagePromises);
  return { items, pageBreakBeforeYs };
};
