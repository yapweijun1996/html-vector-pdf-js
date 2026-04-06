import jsPDF from 'jspdf';
import { parseColor } from '../colors';
import { RenderItem } from '../renderItems';

// ============================================================================
// Background Rendering
// ============================================================================

/**
 * Render background color for an item
 * @param doc - jsPDF document instance
 * @param item - Render item with background type
 * @param renderY - Y coordinate for rendering
 */
// PDF viewers anti-alias adjacent filled rects even when they share an exact edge,
// producing hairline white gaps. A tiny downward overlap lets each background paint
// over the seam. Backgrounds render in source order so the next row covers the bleed.
const GAP_OVERLAP_MM = 0.35;

export const renderBackground = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number
): void => {
    if (item.type !== 'background') return;

    const [r, g, b] = parseColor(item.style.backgroundColor);
    doc.setFillColor(r, g, b);
    doc.rect(item.x, renderY, item.w, item.h + GAP_OVERLAP_MM, 'F');
};
