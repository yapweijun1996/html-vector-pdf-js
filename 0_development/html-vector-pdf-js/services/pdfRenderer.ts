import jsPDF from 'jspdf';
import { PdfConfig } from './pdfConfig';
import { RenderItem } from './renderItems';
import { createYieldController } from './asyncYield';

// Import modularized renderers
import { registerLoadedFonts } from './pdfRenderer/fontRegistration';
import { createBreakCounter, normalizePageBreaks } from './pdfRenderer/pageBreaks';
import { processInlineTextGroups } from './pdfRenderer/inlineTextGroups';
import { renderBorder } from './pdfRenderer/border';
import { renderBackground } from './pdfRenderer/background';
import { renderText } from './pdfRenderer/text';
import { renderImage } from './pdfRenderer/image';
import { renderDebugRect, logDebugInfo } from './pdfRenderer/debug';
import { calculatePagination, ensurePageExists } from './pdfRenderer/pagination';
import { DebugTextRow } from './pdfRenderer/types';

/**
 * Main PDF rendering function
 * @param allElementItems - Array of element items with render items and page breaks
 * @param cfg - PDF configuration
 * @param px2mm - Pixel to mm conversion function
 * @returns Promise resolving to jsPDF document
 */
export const renderToPdf = async (
  allElementItems: Array<{ items: RenderItem[]; pageBreakBeforeYs: number[] }>,
  cfg: Required<PdfConfig>,
  px2mm: (px: number) => number
): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: cfg.orientation,
    unit: 'mm',
    format: cfg.pageSize
  });

  registerLoadedFonts(doc, cfg);

  const pageH = doc.internal.pageSize.getHeight();
  const contentH = pageH - cfg.margins.top - cfg.margins.bottom;
  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  const debugTextRows: DebugTextRow[] = [];
  let currentStartPage = 1;

  // Process each element
  for (let elemIdx = 0; elemIdx < allElementItems.length; elemIdx++) {
    cfg.callbacks.onProgress?.('render:element:start', { elementIndex: elemIdx, elementCount: allElementItems.length });
    const { items, pageBreakBeforeYs } = allElementItems[elemIdx];

    // Add new page for subsequent elements
    if (elemIdx > 0) {
      doc.addPage();
      currentStartPage = doc.getNumberOfPages();
    }

    const uniqueBreaks = normalizePageBreaks(pageBreakBeforeYs);
    const countBreaksAtOrBefore = createBreakCounter(uniqueBreaks);

    // Process inline text groups
    processInlineTextGroups(doc, items, cfg);

    // Render items sorted by z-index
    const sorted = items.slice().sort((a, b) => a.zIndex - b.zIndex);
    for (let itemIdx = 0; itemIdx < sorted.length; itemIdx++) {
      await maybeYield(itemIdx + 1);
      const item = sorted[itemIdx];

      // Calculate pagination
      const forcedBreakCount = uniqueBreaks.length ? countBreaksAtOrBefore(item.y) : 0;
      const pagination = calculatePagination(
        item.y,
        forcedBreakCount,
        uniqueBreaks,
        contentH,
        cfg.margins.top,
        currentStartPage
      );

      // Ensure page exists and set to target page
      ensurePageExists(doc, pagination.absolutePageIndex);

      // Render based on item type
      if (item.type === 'background') {
        renderBackground(doc, item, pagination.renderY);
        continue;
      }

      if (item.type === 'border') {
        renderBorder(doc, item, pagination.renderY, px2mm);
        continue;
      }

      if (item.type === 'debugRect') {
        renderDebugRect(doc, item, pagination.renderY, cfg);
        continue;
      }

      if (item.type === 'text') {
        renderText(doc, item, pagination.renderY, cfg, px2mm, debugTextRows);
        continue;
      }

      if (item.type === 'image') {
        renderImage(doc, item, pagination.renderY, cfg);
        continue;
      }
    }

    currentStartPage = doc.getNumberOfPages() + 1;
    cfg.callbacks.onProgress?.('render:element:done', { elementIndex: elemIdx, elementCount: allElementItems.length });
  }

  // Log debug information
  logDebugInfo(doc, allElementItems, debugTextRows, cfg);

  return doc;
};
