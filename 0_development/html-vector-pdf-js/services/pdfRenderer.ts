import jsPDF from 'jspdf';
import { PdfConfig } from './pdfConfig';
import { parseColor } from './colors';
import { px2pt } from './pdfUnits';
import { RenderItem } from './renderItems';
import { wrapTextToWidth } from './textLayout';
import { createYieldController } from './asyncYield';
import { HtmlToVectorPdfError } from './errors';
/**** AMENDMENT [start] "Import font detection for CJK support" ****/
import { detectRequiredFont } from './fontLoader';
/**** AMENDMENT [end] "Import font detection for CJK support" ****/

type PdfFontFamily = 'helvetica' | 'times' | 'courier';

const pickPdfFontFamily = (cssFontFamily: string | null | undefined): PdfFontFamily => {
  const ff = (cssFontFamily || '').toLowerCase();
  if (
    ff.includes('courier') ||
    ff.includes('consolas') ||
    ff.includes('monaco') ||
    ff.includes('menlo') ||
    ff.includes('monospace')
  ) {
    return 'courier';
  }
  if (ff.includes('times') || ff.includes('georgia') || ff.includes('serif')) return 'times';
  return 'helvetica';
};

/**** AMENDMENT [start] "Support auto font selection for CJK characters" ****/
const applyTextStyle = (doc: jsPDF, style: CSSStyleDeclaration, textScale: number, text?: string): void => {
  doc.setFontSize(px2pt(style.fontSize) * textScale);

  // Auto-detect font for non-Latin characters
  let fontFamily: string;
  let variant: string;

  if (text) {
    const detectedFont = detectRequiredFont(text);
    if (detectedFont) {
      // Use CJK font if detected
      fontFamily = detectedFont;
      variant = 'normal'; // CJK fonts may not have bold/italic variants
    } else {
      // Use standard PDF fonts for Latin text
      const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
      const isItalic = style.fontStyle === 'italic';
      variant = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
      fontFamily = pickPdfFontFamily(style.fontFamily);
    }
  } else {
    // Fallback: no text provided, use standard fonts
    const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
    const isItalic = style.fontStyle === 'italic';
    variant = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
    fontFamily = pickPdfFontFamily(style.fontFamily);
  }

  doc.setFont(fontFamily, variant);

  const [r, g, b] = parseColor(style.color);
  doc.setTextColor(r, g, b);
};
/**** AMENDMENT [end] "Support auto font selection for CJK characters" ****/

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

  /**** AMENDMENT [start] "Register loaded CJK fonts to jsPDF" ****/
  // Register fonts that were loaded from CDN
  const loadedFonts = (cfg as any).loadedFonts as Array<{ name: string; data: string; format: string }> | undefined;
  if (loadedFonts && loadedFonts.length > 0) {
    for (const font of loadedFonts) {
      try {
        doc.addFileToVFS(`${font.name}.ttf`, font.data);
        doc.addFont(`${font.name}.ttf`, font.name, 'normal');
        if (cfg.debug) {
          console.log(`[html_to_vector_pdf] Registered font to jsPDF: ${font.name}`);
        }
      } catch (err) {
        console.warn(`[html_to_vector_pdf] Failed to register font ${font.name}:`, err);
      }
    }
  }
  /**** AMENDMENT [end] "Register loaded CJK fonts to jsPDF" ****/

  const pageH = doc.internal.pageSize.getHeight();
  const contentH = pageH - cfg.margins.top - cfg.margins.bottom;
  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  const debugTextRows: Array<Record<string, unknown>> = [];
  let currentStartPage = 1;

  for (let elemIdx = 0; elemIdx < allElementItems.length; elemIdx++) {
    cfg.callbacks.onProgress?.('render:element:start', { elementIndex: elemIdx, elementCount: allElementItems.length });
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

    const inlineTextGroups = new Map<string, RenderItem[]>();
    for (const item of items) {
      if (item.type !== 'text' || !item.text || !item.inlineGroupId) continue;
      const arr = inlineTextGroups.get(item.inlineGroupId);
      if (arr) arr.push(item);
      else inlineTextGroups.set(item.inlineGroupId, [item]);
    }

    for (const groupItems of inlineTextGroups.values()) {
      groupItems.sort((a, b) => (a.inlineOrder ?? 0) - (b.inlineOrder ?? 0));
      const first = groupItems[0];
      const contentLeftMm = first.contentLeftMm ?? first.x;
      const contentRightMm =
        first.contentRightMm ?? (first.maxWidthMm ? contentLeftMm + first.maxWidthMm : contentLeftMm);
      const align = first.textAlign || 'left';

      const widthsMm: number[] = [];
      let totalWidthMm = 0;
      for (let i = 0; i < groupItems.length; i++) {
        const item = groupItems[i];
        applyTextStyle(doc, item.style, cfg.text.scale, item.text);
        const w = doc.getTextWidth(item.text || '');
        widthsMm.push(w);
        totalWidthMm += w;
      }

      const availableWidthMm = Math.max(0, contentRightMm - contentLeftMm);
      let startX = contentLeftMm;
      if (align === 'center') startX = contentLeftMm + (availableWidthMm - totalWidthMm) / 2;
      else if (align === 'right') startX = contentRightMm - totalWidthMm;

      let cursorX = startX;
      for (let i = 0; i < groupItems.length; i++) {
        const item = groupItems[i];
        item.computedX = cursorX;
        item.textAlign = 'left';
        cursorX += widthsMm[i];
      }
    }

    const sorted = items.slice().sort((a, b) => a.zIndex - b.zIndex);
    for (let itemIdx = 0; itemIdx < sorted.length; itemIdx++) {
      await maybeYield(itemIdx + 1);
      const item = sorted[itemIdx];
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
        continue;
      }

      if (item.type === 'border' && item.borderSides && item.borderColors) {
        const { t, r, b, l } = item.borderSides;
        const colors = item.borderColors;
        const styles = item.borderStyles || { t: 'solid', r: 'solid', b: 'solid', l: 'solid' };

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
        const isUniformStyle =
          styles.t === styles.r &&
          styles.r === styles.b &&
          styles.b === styles.l;

        if (isUniformWidth && isUniformColor && isUniformStyle && styles.t === 'solid') {
          doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
          doc.setLineWidth((px2pt(t) / 72) * 25.4);
          doc.rect(item.x, renderY, item.w, item.h, 'D');
        } else {
          const drawSide = (
            x1: number, y1: number, x2: number, y2: number,
            widthPx: number, color: [number, number, number], style: string,
            side: 't' | 'b' | 'l' | 'r'
          ) => {
            if (widthPx <= 0) return;

            doc.setDrawColor(color[0], color[1], color[2]);

            if (style === 'double' && widthPx >= 3) {
              // Convert px to mm for all calculations
              const widthMm = px2mm(widthPx);
              // Each line should be about 1/3 of total width, but ensure minimum visibility
              const lineThicknessMm = Math.max(widthMm / 3, 0.15); // Minimum 0.15mm per line
              const gapMm = widthMm - (2 * lineThicknessMm);

              doc.setLineWidth(lineThicknessMm);

              if (side === 't') {
                // Top border: first line at top, second line below gap
                doc.line(x1, y1, x2, y1);
                doc.line(x1, y1 + lineThicknessMm + gapMm, x2, y1 + lineThicknessMm + gapMm);
              } else if (side === 'b') {
                // Bottom border: first line at bottom, second line above gap
                doc.line(x1, y2, x2, y2);
                doc.line(x1, y2 - lineThicknessMm - gapMm, x2, y2 - lineThicknessMm - gapMm);
              } else if (side === 'l') {
                // Left border
                doc.line(x1, y1, x1, y2);
                doc.line(x1 + lineThicknessMm + gapMm, y1, x1 + lineThicknessMm + gapMm, y2);
              } else if (side === 'r') {
                // Right border
                doc.line(x2, y1, x2, y2);
                doc.line(x2 - lineThicknessMm - gapMm, y1, x2 - lineThicknessMm - gapMm, y2);
              }
            } else {
              doc.setLineWidth((px2pt(widthPx) / 72) * 25.4);
              doc.line(x1, y1, x2, y2);
            }
          };

          drawSide(item.x, renderY, item.x + item.w, renderY, t, colors.t, styles.t, 't');
          drawSide(item.x, renderY + item.h, item.x + item.w, renderY + item.h, b, colors.b, styles.b, 'b');
          drawSide(item.x, renderY, item.x, renderY + item.h, l, colors.l, styles.l, 'l');
          drawSide(item.x + item.w, renderY, item.x + item.w, renderY + item.h, r, colors.r, styles.r, 'r');
        }
        continue;
      }

      if (item.type === 'debugRect' && cfg.debugOverlay.enabled) {
        const [r, g, b] = cfg.debugOverlay.strokeColorRgb;
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(cfg.debugOverlay.lineWidthMm);
        doc.rect(item.x, renderY, item.w, item.h, 'D');
        continue;
      }

      if (item.type === 'text' && item.text) {
        applyTextStyle(doc, item.style, cfg.text.scale, item.text);

        const x = item.computedX ?? item.x;
        const align = item.computedX != null ? 'left' : item.textAlign || 'left';
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

        const decoration = (item.style.textDecorationLine || item.style.textDecoration || '').toLowerCase();
        const hasUnderline = decoration.includes('underline');
        const hasLineThrough = decoration.includes('line-through');
        const fontSizeMm = px2mm(parseFloat(item.style.fontSize)) * cfg.text.scale;

        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          doc.text(lineText, x, baseY + i * lineHeightMm, { baseline: 'alphabetic', align });

          if (hasUnderline || hasLineThrough) {
            const lineWidth = doc.getTextWidth(lineText);
            let lineStartX = x;
            if (align === 'center') lineStartX = x - lineWidth / 2;
            else if (align === 'right') lineStartX = x - lineWidth;

            const [r, g, b] = parseColor(item.style.color);
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(fontSizeMm / 15); // Simple thickness heuristic

            if (hasUnderline) {
              // Draw underline slightly below baseline (alphabetic baseline is 0)
              const underlineY = baseY + i * lineHeightMm + (fontSizeMm * 0.1);
              doc.line(lineStartX, underlineY, lineStartX + lineWidth, underlineY);
            }
            if (hasLineThrough) {
              // Draw strike-through at roughly 35% of font height above baseline
              const strikeY = baseY + i * lineHeightMm - (fontSizeMm * 0.3);
              doc.line(lineStartX, strikeY, lineStartX + lineWidth, strikeY);
            }
          }
        }
        continue;
      }

      if (item.type === 'image' && item.imageSrc) {
        try {
          const format = item.imageFormat || 'PNG';
          doc.addImage(item.imageSrc, format, item.x, renderY, item.w, item.h);
        } catch (e) {
          const err = new HtmlToVectorPdfError(
            'ASSET_LOAD_FAILED',
            'Failed to add image to PDF',
            { imageSrc: item.imageSrc },
            e
          );
          cfg.callbacks.onError?.(err);
          if (cfg.errors.failOnAssetError) throw err;
          if (cfg.debug) console.warn('[html_to_vector_pdf] Failed to add image:', e);
        }
      }
    }

    currentStartPage = doc.getNumberOfPages() + 1;
    cfg.callbacks.onProgress?.('render:element:done', { elementIndex: elemIdx, elementCount: allElementItems.length });
  }

  if (cfg.debug) {
    console.log(
      `[html_to_vector_pdf] Generated ${doc.getNumberOfPages()} page(s) from ${allElementItems.length} element(s)`
    );
  }
  if (cfg.debug && cfg.debugOverlay.enabled && debugTextRows.length > 0) console.table(debugTextRows);

  return doc;
};
