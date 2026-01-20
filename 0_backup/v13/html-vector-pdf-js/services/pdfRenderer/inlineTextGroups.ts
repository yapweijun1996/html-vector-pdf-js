import jsPDF from 'jspdf';
import { RenderItem } from '../renderItems';
import { PdfConfig } from '../pdfConfig';
import { applyTextStyle } from './fonts';

/**
 * Group inline text items by their inlineGroupId
 */
export const groupInlineText = (items: RenderItem[]): Map<string, RenderItem[]> => {
    const groups = new Map<string, RenderItem[]>();

    for (const item of items) {
        if (item.type === 'text' && item.inlineGroupId) {
            const existing = groups.get(item.inlineGroupId);
            if (existing) {
                existing.push(item);
            } else {
                groups.set(item.inlineGroupId, [item]);
            }
        }
    }

    return groups;
};

/**
 * Calculate horizontal alignment offset for inline text groups
 */
export const calculateInlineGroupOffset = (
    group: RenderItem[],
    textAlign: string,
    contentLeftMm: number | undefined,
    contentRightMm: number | undefined
): number => {
    if (textAlign === 'left' || !contentLeftMm || !contentRightMm) return 0;

    const totalWidth = group.reduce((sum, item) => sum + (item.w || 0), 0);
    const availableWidth = contentRightMm - contentLeftMm;

    if (textAlign === 'center') {
        return (availableWidth - totalWidth) / 2;
    } else if (textAlign === 'right') {
        return availableWidth - totalWidth;
    }

    return 0;
};

/**
 * Process inline text groups and calculate positions
 * @param doc - jsPDF document instance
 * @param items - Array of render items
 * @param cfg - PDF configuration
 */
export const processInlineTextGroups = (
    doc: jsPDF,
    items: RenderItem[],
    cfg: Required<PdfConfig>
): void => {
    const inlineTextGroups = groupInlineText(items);

    for (const groupItems of inlineTextGroups.values()) {
        groupItems.sort((a, b) => (a.inlineOrder ?? 0) - (b.inlineOrder ?? 0));
        const first = groupItems[0];
        const contentLeftMm = first.contentLeftMm ?? first.x;
        const contentRightMm =
            first.contentRightMm ?? (first.maxWidthMm ? contentLeftMm + first.maxWidthMm : contentLeftMm);
        const align = first.textAlign || 'left';

        // Calculate widths for all items in the group
        const widthsMm: number[] = [];
        let totalWidthMm = 0;
        for (let i = 0; i < groupItems.length; i++) {
            const item = groupItems[i];
            applyTextStyle(doc, item.style, cfg.text.scale, item.text);
            const w = doc.getTextWidth(item.text || '');
            widthsMm.push(w);
            totalWidthMm += w;
        }

        // Calculate starting X position based on alignment
        const availableWidthMm = Math.max(0, contentRightMm - contentLeftMm);
        let startX = contentLeftMm;
        if (align === 'center') startX = contentLeftMm + (availableWidthMm - totalWidthMm) / 2;
        else if (align === 'right') startX = contentRightMm - totalWidthMm;

        // Assign computed positions to each item
        let cursorX = startX;
        for (let i = 0; i < groupItems.length; i++) {
            const item = groupItems[i];
            item.computedX = cursorX;
            item.textAlign = 'left';
            cursorX += widthsMm[i];
        }
    }
};
