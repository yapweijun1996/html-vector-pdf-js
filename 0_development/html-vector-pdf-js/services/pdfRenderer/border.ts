import jsPDF from 'jspdf';
import { px2pt } from '../pdfUnits';
import { RenderItem } from '../renderItems';
import { drawBorderSide } from './borderRenderer';

const halfStrokeMm = (widthPx: number, px2mm: (px: number) => number): number => px2mm(widthPx) / 2;

const getInsideStrokeCoordinates = (
    item: RenderItem,
    renderY: number,
    px2mm: (px: number) => number
) => {
    const sides = item.borderSides!;
    const topHalf = sides.t > 0 ? halfStrokeMm(sides.t, px2mm) : 0;
    const rightHalf = sides.r > 0 ? halfStrokeMm(sides.r, px2mm) : 0;
    const bottomHalf = sides.b > 0 ? halfStrokeMm(sides.b, px2mm) : 0;
    const leftHalf = sides.l > 0 ? halfStrokeMm(sides.l, px2mm) : 0;

    return {
        top: {
            x1: item.x + leftHalf,
            y1: renderY + topHalf,
            x2: item.x + item.w - rightHalf,
            y2: renderY + topHalf
        },
        bottom: {
            x1: item.x + leftHalf,
            y1: renderY + item.h - bottomHalf,
            x2: item.x + item.w - rightHalf,
            y2: renderY + item.h - bottomHalf
        },
        left: {
            x1: item.x + leftHalf,
            y1: renderY + topHalf,
            x2: item.x + leftHalf,
            y2: renderY + item.h - bottomHalf
        },
        right: {
            x1: item.x + item.w - rightHalf,
            y1: renderY + topHalf,
            x2: item.x + item.w - rightHalf,
            y2: renderY + item.h - bottomHalf
        },
        uniformRect: {
            x: item.x + leftHalf,
            y: renderY + topHalf,
            w: Math.max(0, item.w - leftHalf - rightHalf),
            h: Math.max(0, item.h - topHalf - bottomHalf)
        }
    };
};

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
    const inside = getInsideStrokeCoordinates(item, renderY, px2mm);

    if (hasUniformBorder(item.borderSides, colors, styles)) {
        // Optimized uniform border rendering
        doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
        doc.setLineWidth((px2pt(t) / 72) * 25.4);
        doc.rect(inside.uniformRect.x, inside.uniformRect.y, inside.uniformRect.w, inside.uniformRect.h, 'D');
    } else {
        // Per-side border rendering
        drawBorderSide(doc, inside.top.x1, inside.top.y1, inside.top.x2, inside.top.y2, t, colors.t, styles.t, 't', px2mm);
        drawBorderSide(doc, inside.bottom.x1, inside.bottom.y1, inside.bottom.x2, inside.bottom.y2, b, colors.b, styles.b, 'b', px2mm);
        drawBorderSide(doc, inside.left.x1, inside.left.y1, inside.left.x2, inside.left.y2, l, colors.l, styles.l, 'l', px2mm);
        drawBorderSide(doc, inside.right.x1, inside.right.y1, inside.right.x2, inside.right.y2, r, colors.r, styles.r, 'r', px2mm);
    }
};
