import jsPDF from 'jspdf';
import { px2pt } from '../pdfUnits';

export const drawBorderSide = (
    doc: jsPDF,
    x1: number, y1: number, x2: number, y2: number,
    widthPx: number, color: [number, number, number], style: string,
    side: 't' | 'b' | 'l' | 'r',
    px2mm: (px: number) => number
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
