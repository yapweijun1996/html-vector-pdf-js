import jsPDF from 'jspdf';
import { PdfConfig } from './pdfConfig';
import { parseColor } from './colors';
import { px2pt } from './pdfUnits';
import { RenderItem } from './renderItems';
import { wrapTextToWidth } from './textLayout';

export const renderToPdf = (
  allElementItems: Array<{ items: RenderItem[]; pageBreakBeforeYs: number[] }>,
  cfg: Required<PdfConfig>,
  px2mm: (px: number) => number
): jsPDF => {
  const doc = new jsPDF({
    orientation: cfg.orientation,
    unit: 'mm',
    format: cfg.pageSize
  });

  const pageH = doc.internal.pageSize.getHeight();
  const contentH = pageH - cfg.margins.top - cfg.margins.bottom;

  const debugTextRows: Array<Record<string, unknown>> = [];
  let currentStartPage = 1;

  for (let elemIdx = 0; elemIdx < allElementItems.length; elemIdx++) {
    const { items, pageBreakBeforeYs } = allElementItems[elemIdx];

    if (elemIdx > 0) {
      doc.addPage();
      currentStartPage = doc.getNumberOfPages();
    }

    const uniqueBreaks = Array.from(new Set(pageBreakBeforeYs.filter((y) => Number.isFinite(y) && y > 0))).sort(
      (a, b) => a - b
    );

    const countBreaksAtOrBefore = (y: number): number => {
      let lo = 0;
      let hi = uniqueBreaks.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (uniqueBreaks[mid] <= y) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    items
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((item) => {
        const forcedBreakCount = uniqueBreaks.length ? countBreaksAtOrBefore(item.y) : 0;
        const forcedOffset = forcedBreakCount > 0 ? uniqueBreaks[forcedBreakCount - 1] : 0;
        const relativeY = item.y - forcedOffset;

        let renderY = cfg.margins.top + relativeY;
        const localPageIndex = forcedBreakCount + Math.floor(relativeY / contentH) + 1;
        const absolutePageIndex = currentStartPage + localPageIndex - 1;

        if (localPageIndex > 1) renderY = cfg.margins.top + (relativeY % contentH);

        while (doc.getNumberOfPages() < absolutePageIndex) doc.addPage();
        doc.setPage(absolutePageIndex);

        if (item.type === 'background') {
          const [r, g, b] = parseColor(item.style.backgroundColor);
          doc.setFillColor(r, g, b);
          doc.rect(item.x, renderY, item.w, item.h, 'F');
          return;
        }

        if (item.type === 'border' && item.borderSides && item.borderColors) {
          const { t, r, b, l } = item.borderSides;
          const colors = item.borderColors;

          const isUniformWidth = t === r && r === b && b === l && t > 0;
          const isUniformColor =
            colors.t[0] === colors.r[0] &&
            colors.t[1] === colors.r[1] &&
            colors.t[2] === colors.r[2] &&
            colors.r[0] === colors.b[0] &&
            colors.r[1] === colors.b[1] &&
            colors.r[2] === colors.b[2] &&
            colors.b[0] === colors.l[0] &&
            colors.b[1] === colors.l[1] &&
            colors.b[2] === colors.l[2];

          if (isUniformWidth && isUniformColor) {
            doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
            doc.setLineWidth((px2pt(t) / 72) * 25.4);
            doc.rect(item.x, renderY, item.w, item.h, 'D');
          } else {
            if (t > 0) {
              doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
              doc.setLineWidth((px2pt(t) / 72) * 25.4);
              doc.line(item.x, renderY, item.x + item.w, renderY);
            }
            if (b > 0) {
              doc.setDrawColor(colors.b[0], colors.b[1], colors.b[2]);
              doc.setLineWidth((px2pt(b) / 72) * 25.4);
              doc.line(item.x, renderY + item.h, item.x + item.w, renderY + item.h);
            }
            if (l > 0) {
              doc.setDrawColor(colors.l[0], colors.l[1], colors.l[2]);
              doc.setLineWidth((px2pt(l) / 72) * 25.4);
              doc.line(item.x, renderY, item.x, renderY + item.h);
            }
            if (r > 0) {
              doc.setDrawColor(colors.r[0], colors.r[1], colors.r[2]);
              doc.setLineWidth((px2pt(r) / 72) * 25.4);
              doc.line(item.x + item.w, renderY, item.x + item.w, renderY + item.h);
            }
          }
          return;
        }

        if (item.type === 'debugRect' && cfg.debugOverlay.enabled) {
          const [r, g, b] = cfg.debugOverlay.strokeColorRgb;
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(cfg.debugOverlay.lineWidthMm);
          doc.rect(item.x, renderY, item.w, item.h, 'D');
          return;
        }

        if (item.type === 'text' && item.text) {
          doc.setFontSize(px2pt(item.style.fontSize) * cfg.text.scale);
          const [r, g, b] = parseColor(item.style.color);
          doc.setTextColor(r, g, b);

          const isBold = item.style.fontWeight === 'bold' || parseInt(item.style.fontWeight) >= 600;
          const isItalic = item.style.fontStyle === 'italic';
          doc.setFont('helvetica', isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal');

          const align = item.textAlign || 'left';
          const maxWidthMm = item.maxWidthMm ?? 0;
          const lineHeightMm = item.lineHeightMm ?? px2mm(parseFloat(item.style.fontSize)) * 1.2 * cfg.text.scale;
          const pdfTextWidthMm = doc.getTextWidth(item.text);
          const lines = item.noWrap ? [item.text] : wrapTextToWidth(doc, item.text, maxWidthMm);
          const baseY = renderY;

          if (cfg.debug && cfg.debugOverlay.enabled && maxWidthMm > 0) {
            debugTextRows.push({
              text: item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text,
              rectsLen: item.rectsLen ?? null,
              cssNoWrap: item.cssNoWrap ?? null,
              noWrapFinal: item.noWrap ?? null,
              maxWidthMm: Number(maxWidthMm.toFixed(2)),
              pdfTextWidthMm: Number(pdfTextWidthMm.toFixed(2)),
              wrappedLines: lines.length,
              align
            });
          }

          for (let i = 0; i < lines.length; i++) {
            doc.text(lines[i], item.x, baseY + i * lineHeightMm, { baseline: 'alphabetic', align });
          }
          return;
        }

        if (item.type === 'image' && item.imageSrc) {
          try {
            const format = item.imageFormat || 'PNG';
            doc.addImage(item.imageSrc, format, item.x, renderY, item.w, item.h);
          } catch (e) {
            if (cfg.debug) console.warn('[html_to_vector_pdf] Failed to add image:', e);
          }
        }
      });

    currentStartPage = doc.getNumberOfPages() + 1;
  }

  if (cfg.debug) {
    console.log(
      `[html_to_vector_pdf] Generated ${doc.getNumberOfPages()} page(s) from ${allElementItems.length} element(s)`
    );
  }
  if (cfg.debug && cfg.debugOverlay.enabled && debugTextRows.length > 0) console.table(debugTextRows);

  return doc;
};

