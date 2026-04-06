import jsPDF from 'jspdf';
import { parseColor } from '../colors';
import { wrapTextToWidth } from '../textLayout';
import { RenderItem } from '../renderItems';
import { PdfConfig } from '../pdfConfig';
import { applyTextStyle } from './fonts';
import { detectRequiredFont } from '../fontLoader';
import { DebugTextRow, TextAlign } from './types';

// ============================================================================
// Per-character font splitting
// ============================================================================

interface FontSegment {
    text: string;
    font: string | null; // null = use the item's default font
}

/**
 * Split a text string into segments that each need the same font.
 * This enables mixed-font rendering (e.g. "RECEIPT ✓" where ✓ needs a symbol font).
 * Returns a single segment when no splitting is needed (fast path).
 */
const splitTextByFont = (text: string): FontSegment[] | null => {
    // Quick check: if all chars are Latin-1, no splitting needed
    if (/^[\x00-\xFF]*$/.test(text)) return null;

    const segments: FontSegment[] = [];
    let currentFont: string | null = null;
    let currentText = '';
    let needsSplit = false;

    for (const char of text) {
        const font = detectRequiredFont(char);
        if (segments.length === 0 && currentText === '') {
            // First character
            currentFont = font;
            currentText = char;
        } else if (font === currentFont) {
            currentText += char;
        } else {
            // Font changed — we need splitting
            needsSplit = true;
            segments.push({ text: currentText, font: currentFont });
            currentFont = font;
            currentText = char;
        }
    }

    if (currentText) {
        segments.push({ text: currentText, font: currentFont });
    }

    return needsSplit ? segments : null;
};

const getRenderedLineWidthMm = (
    doc: jsPDF,
    lineText: string,
    item: RenderItem,
    totalLines: number
): number => {
    if (
        totalLines === 1 &&
        typeof item.textWidthMm === 'number' &&
        item.textWidthMm > 0
    ) {
        return item.textWidthMm;
    }

    return doc.getTextWidth(lineText);
};

// ============================================================================
// Text Rendering
// ============================================================================

/**
 * Calculate text decoration line positions
 * @param baseY - Base Y coordinate
 * @param lineIndex - Line index (for multi-line text)
 * @param lineHeightMm - Line height in mm
 * @param fontSizeMm - Font size in mm
 * @returns Object with underline and strike-through Y positions
 */
const calculateDecorationPositions = (
    baseY: number,
    lineIndex: number,
    lineHeightMm: number,
    fontSizeMm: number
) => ({
    underlineY: baseY + lineIndex * lineHeightMm + (fontSizeMm * 0.1),
    strikeThroughY: baseY + lineIndex * lineHeightMm - (fontSizeMm * 0.3)
});

/**
 * Draw text decoration lines (underline, strike-through)
 * @param doc - jsPDF document instance
 * @param lineText - Text content of the line
 * @param x - X coordinate
 * @param baseY - Base Y coordinate
 * @param lineIndex - Line index
 * @param lineHeightMm - Line height in mm
 * @param fontSizeMm - Font size in mm
 * @param align - Text alignment
 * @param color - Text color RGB array
 * @param hasUnderline - Whether to draw underline
 * @param hasLineThrough - Whether to draw strike-through
 */
const drawTextDecorations = (
    doc: jsPDF,
    item: RenderItem,
    lineText: string,
    x: number,
    baseY: number,
    lineIndex: number,
    lineHeightMm: number,
    fontSizeMm: number,
    align: TextAlign,
    totalLines: number,
    color: [number, number, number],
    hasUnderline: boolean,
    hasLineThrough: boolean
): void => {
    if (!hasUnderline && !hasLineThrough) return;

    const lineWidth = getRenderedLineWidthMm(doc, lineText, item, totalLines);
    let lineStartX = x;
    if (align === 'center') lineStartX = x - lineWidth / 2;
    else if (align === 'right') lineStartX = x - lineWidth;

    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(fontSizeMm / 15); // Simple thickness heuristic

    const { underlineY, strikeThroughY } = calculateDecorationPositions(
        baseY,
        lineIndex,
        lineHeightMm,
        fontSizeMm
    );

    if (hasUnderline) {
        doc.line(lineStartX, underlineY, lineStartX + lineWidth, underlineY);
    }
    if (hasLineThrough) {
        doc.line(lineStartX, strikeThroughY, lineStartX + lineWidth, strikeThroughY);
    }
};

/**
 * Render text item with optional wrapping and decorations
 * @param doc - jsPDF document instance
 * @param item - Text render item
 * @param renderY - Y coordinate for rendering
 * @param cfg - PDF configuration
 * @param px2mm - Pixel to mm conversion function
 * @param debugTextRows - Array to collect debug information
 */
export const renderText = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number,
    cfg: Required<PdfConfig>,
    px2mm: (px: number) => number,
    debugTextRows: DebugTextRow[]
): void => {
    if (item.type !== 'text' || !item.text) return;

    applyTextStyle(doc, item.style, cfg.text.scale, item.text, cfg.debug);

    const x = item.computedX ?? item.x;
    const align: TextAlign = (item.computedX != null ? 'left' : item.textAlign || 'left') as TextAlign;
    const maxWidthMm = item.maxWidthMm ?? 0;
    const lineHeightMm = item.lineHeightMm ?? item.h ?? px2mm(parseFloat(item.style.fontSize)) * 1.2 * cfg.text.scale;
    const textForPdfWidth = item.text.replaceAll('\u00A0', ' ');
    const pdfTextWidthMm = doc.getTextWidth(textForPdfWidth);

    // If we don't wrap, still normalize NBSP to normal spaces for consistent rendering in PDF.
    // If we do wrap, wrapTextToWidth() preserves NBSP indentation and converts to spaces per-line.
    const lines = item.noWrap ? [textForPdfWidth] : wrapTextToWidth(doc, item.text, maxWidthMm);
    const baseY = renderY;

    // Collect debug information
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

    // Render each line
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const fontSegments = splitTextByFont(lineText);

        if (!fontSegments) {
            // Fast path: single font — render normally
            doc.text(lineText, x, baseY + i * lineHeightMm, { baseline: 'alphabetic', align });
        } else {
            // Multi-font: render each segment with its own font, advancing x
            const lineY = baseY + i * lineHeightMm;
            let segX = x;

            // For center/right align, compute total width first to find the starting x
            if (align === 'center' || align === 'right') {
                let totalWidth = 0;
                for (const seg of fontSegments) {
                    if (seg.font) {
                        try { doc.setFont(seg.font, 'normal'); } catch { /* keep current */ }
                    } else {
                        applyTextStyle(doc, item.style, cfg.text.scale, undefined, false);
                    }
                    totalWidth += doc.getTextWidth(seg.text.replaceAll('\u00A0', ' '));
                }
                if (align === 'center') segX = x - totalWidth / 2;
                else if (align === 'right') segX = x - totalWidth;
            }

            for (const seg of fontSegments) {
                if (seg.font) {
                    const pdfFontStyle = (item.style.fontWeight === 'bold' || parseInt(item.style.fontWeight || '400') >= 700) ? 'bold' : 'normal';
                    try { doc.setFont(seg.font, pdfFontStyle); } catch {
                        try { doc.setFont(seg.font, 'normal'); } catch { /* font not available */ }
                    }
                } else {
                    applyTextStyle(doc, item.style, cfg.text.scale, undefined, false);
                }
                const segText = seg.text.replaceAll('\u00A0', ' ');
                doc.text(segText, segX, lineY, { baseline: 'alphabetic', align: 'left' });
                segX += doc.getTextWidth(segText);
            }
            // Restore the item's default font for subsequent lines/decorations
            applyTextStyle(doc, item.style, cfg.text.scale, undefined, false);
        }

        // Draw decorations if needed
        if (hasUnderline || hasLineThrough) {
            const color = parseColor(item.style.color);
            drawTextDecorations(
                doc,
                item,
                lineText,
                x,
                baseY,
                i,
                lineHeightMm,
                fontSizeMm,
                align,
                lines.length,
                color,
                hasUnderline,
                hasLineThrough
            );
        }
    }
};
