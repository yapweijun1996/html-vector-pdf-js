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
import { chainLeftAlignedText } from './domParser/postProcess';
import { applyTextStyle } from './pdfRenderer/fonts';
import { expandPdfFirstTextBlocks } from './pdfRenderer/pdfFirstText';

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

    // Expand PDF-first text blocks into concrete text items (measured with registered fonts)
    const expandedItems = expandPdfFirstTextBlocks(doc, items, cfg);

    // Process inline text groups (for center/right aligned text)
    processInlineTextGroups(doc, expandedItems, cfg);

    // Mark items for chaining
    chainLeftAlignedText(expandedItems);

    // Calculate chained X positions for left-aligned text
    // This eliminates subpixel gaps by making subsequent items start exactly
    // where the previous item ends (based on jsPDF width measurement)
    const chainedGroups = new Map<string, RenderItem[]>();
    for (const item of expandedItems) {
      if (item.chainBucket && item.chainOrder !== undefined) {
        if (!chainedGroups.has(item.chainBucket)) {
          chainedGroups.set(item.chainBucket, []);
        }
        chainedGroups.get(item.chainBucket)!.push(item);
      }
    }

    for (const groupItems of chainedGroups.values()) {
      // Sort by chain order
      groupItems.sort((a, b) => (a.chainOrder ?? 0) - (b.chainOrder ?? 0));

      let cursorX = groupItems[0].x; // First item uses browser coordinate
      for (let i = 0; i < groupItems.length; i++) {
        const item = groupItems[i];

        // Apply font to get accurate width measurement
        applyTextStyle(doc, item.style, cfg.text.scale, item.text);
        /**** AMENDMENT [start] "Normalize text and prevent overlap in chaining" ****/
        const textForPdfWidth = (item.text || '').replaceAll('\u00A0', ' ');
        const textWidth = doc.getTextWidth(textForPdfWidth);

        if (i === 0) {
          // First item keeps browser coordinate - it's the anchor
          item.computedX = item.x;
        } else {
          // Subsequent items start where previous ended, but NEVER earlier than browser X
          // to prevent overlap if PDF measurement is too narrow.
          item.computedX = Math.max(item.x, cursorX);
        }

        cursorX = (item.computedX || item.x) + textWidth;
        /**** AMENDMENT [end] "Normalize text and prevent overlap in chaining" ****/
      }
    }

    // Render items sorted by z-index
    const sorted = expandedItems.slice().sort((a, b) => a.zIndex - b.zIndex);
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
