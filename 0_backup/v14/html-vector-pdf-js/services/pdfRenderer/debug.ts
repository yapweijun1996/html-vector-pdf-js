import jsPDF from 'jspdf';
import { RenderItem } from '../renderItems';
import { PdfConfig } from '../pdfConfig';
import { DebugTextRow } from './types';

// ============================================================================
// Debug Rendering
// ============================================================================

/**
 * Render debug rectangle overlay
 * @param doc - jsPDF document instance
 * @param item - Debug rect render item
 * @param renderY - Y coordinate for rendering
 * @param cfg - PDF configuration
 */
export const renderDebugRect = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number,
    cfg: Required<PdfConfig>
): void => {
    if (item.type !== 'debugRect' || !cfg.debugOverlay.enabled) return;

    const [r, g, b] = cfg.debugOverlay.strokeColorRgb;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(cfg.debugOverlay.lineWidthMm);
    doc.rect(item.x, renderY, item.w, item.h, 'D');
};

/**
 * Log debug information to console
 * @param doc - jsPDF document instance
 * @param allElementItems - All element items that were rendered
 * @param debugTextRows - Debug text information collected during rendering
 * @param cfg - PDF configuration
 */
export const logDebugInfo = (
    doc: jsPDF,
    allElementItems: Array<{ items: RenderItem[] }>,
    debugTextRows: DebugTextRow[],
    cfg: Required<PdfConfig>
): void => {
    if (!cfg.debug) return;

    console.log(
        `[html_to_vector_pdf] Generated ${doc.getNumberOfPages()} page(s) from ${allElementItems.length} element(s)`
    );

    if (cfg.debugOverlay.enabled && debugTextRows.length > 0) {
        console.table(debugTextRows);
    }
};
