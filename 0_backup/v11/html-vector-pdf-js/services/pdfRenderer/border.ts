import jsPDF from 'jspdf';
import { px2pt } from '../pdfUnits';
import { RenderItem } from '../renderItems';
import { drawBorderSide } from './borderRenderer';

// ============================================================================
// Border Rendering
// ============================================================================

/**
 * Check if border has uniform properties (width, color, style)
 * @param borderSides - Border widths for all sides
 * @param borderColors - Border colors for all sides
 * @param borderStyles - Border styles for all sides
 * @returns True if all sides have identical properties
 */
export const hasUniformBorder = (
    borderSides: { t: number; r: number; b: number; l: number },
    borderColors: {
        t: [number, number, number];
        r: [number, number, number];
        b: [number, number, number];
        l: [number, number, number]
    },
    borderStyles: { t: string; r: string; b: string; l: string }
): boolean => {
    const { t, r, b, l } = borderSides;
    const isUniformWidth = t === r && r === b && b === l && t > 0;
    const isUniformColor =
        borderColors.t[0] === borderColors.r[0] &&
        borderColors.t[1] === borderColors.r[1] &&
        borderColors.t[2] === borderColors.r[2] &&
        borderColors.r[0] === borderColors.b[0] &&
        borderColors.r[1] === borderColors.b[1] &&
        borderColors.r[2] === borderColors.b[2] &&
        borderColors.b[0] === borderColors.l[0] &&
        borderColors.b[1] === borderColors.l[1] &&
        borderColors.b[2] === borderColors.l[2];
    const isUniformStyle =
        borderStyles.t === borderStyles.r &&
        borderStyles.r === borderStyles.b &&
        borderStyles.b === borderStyles.l;

    return isUniformWidth && isUniformColor && isUniformStyle && borderStyles.t === 'solid';
};

/**
 * Render border for an item (uniform or per-side)
 * @param doc - jsPDF document instance
 * @param item - Border render item
 * @param renderY - Y coordinate for rendering
 * @param px2mm - Pixel to mm conversion function
 */
export const renderBorder = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number,
    px2mm: (px: number) => number
): void => {
    if (item.type !== 'border' || !item.borderSides || !item.borderColors) return;

    const { t, r, b, l } = item.borderSides;
    const colors = item.borderColors;
    const styles = item.borderStyles || { t: 'solid', r: 'solid', b: 'solid', l: 'solid' };

    if (hasUniformBorder(item.borderSides, colors, styles)) {
        // Optimized uniform border rendering
        doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
        doc.setLineWidth((px2pt(t) / 72) * 25.4);
        doc.rect(item.x, renderY, item.w, item.h, 'D');
    } else {
        // Per-side border rendering
        drawBorderSide(doc, item.x, renderY, item.x + item.w, renderY, t, colors.t, styles.t, 't', px2mm);
        drawBorderSide(doc, item.x, renderY + item.h, item.x + item.w, renderY + item.h, b, colors.b, styles.b, 'b', px2mm);
        drawBorderSide(doc, item.x, renderY, item.x, renderY + item.h, l, colors.l, styles.l, 'l', px2mm);
        drawBorderSide(doc, item.x + item.w, renderY, item.x + item.w, renderY + item.h, r, colors.r, styles.r, 'r', px2mm);
    }
};
