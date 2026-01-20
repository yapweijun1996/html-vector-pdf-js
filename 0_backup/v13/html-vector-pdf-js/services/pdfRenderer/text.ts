import jsPDF from 'jspdf';
import { parseColor } from '../colors';
import { wrapTextToWidth } from '../textLayout';
import { RenderItem } from '../renderItems';
import { PdfConfig } from '../pdfConfig';
import { applyTextStyle } from './fonts';
import { DebugTextRow, TextAlign } from './types';

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
    lineText: string,
    x: number,
    baseY: number,
    lineIndex: number,
    lineHeightMm: number,
    fontSizeMm: number,
    align: TextAlign,
    color: [number, number, number],
    hasUnderline: boolean,
    hasLineThrough: boolean
): void => {
    if (!hasUnderline && !hasLineThrough) return;

    const lineWidth = doc.getTextWidth(lineText);
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

    applyTextStyle(doc, item.style, cfg.text.scale, item.text);

    const x = item.computedX ?? item.x;
    const align: TextAlign = (item.computedX != null ? 'left' : item.textAlign || 'left') as TextAlign;
    const maxWidthMm = item.maxWidthMm ?? 0;
    const lineHeightMm = item.lineHeightMm ?? px2mm(parseFloat(item.style.fontSize)) * 1.2 * cfg.text.scale;
    const pdfTextWidthMm = doc.getTextWidth(item.text);
    const lines = item.noWrap ? [item.text] : wrapTextToWidth(doc, item.text, maxWidthMm);
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
        doc.text(lineText, x, baseY + i * lineHeightMm, { baseline: 'alphabetic', align });

        // Draw decorations if needed
        if (hasUnderline || hasLineThrough) {
            const color = parseColor(item.style.color);
            drawTextDecorations(
                doc,
                lineText,
                x,
                baseY,
                i,
                lineHeightMm,
                fontSizeMm,
                align,
                color,
                hasUnderline,
                hasLineThrough
            );
        }
    }
};
