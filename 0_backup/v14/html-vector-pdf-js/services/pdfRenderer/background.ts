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
export const renderBackground = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number
): void => {
    if (item.type !== 'background') return;

    const [r, g, b] = parseColor(item.style.backgroundColor);
    doc.setFillColor(r, g, b);
    doc.rect(item.x, renderY, item.w, item.h, 'F');
};
