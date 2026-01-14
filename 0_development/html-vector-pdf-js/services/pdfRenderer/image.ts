import jsPDF from 'jspdf';
import { RenderItem } from '../renderItems';
import { PdfConfig } from '../pdfConfig';
import { HtmlToVectorPdfError } from '../errors';

// ============================================================================
// Image Rendering
// ============================================================================

/**
 * Render image item to PDF
 * @param doc - jsPDF document instance
 * @param item - Image render item
 * @param renderY - Y coordinate for rendering
 * @param cfg - PDF configuration
 */
export const renderImage = (
    doc: jsPDF,
    item: RenderItem,
    renderY: number,
    cfg: Required<PdfConfig>
): void => {
    if (item.type !== 'image' || !item.imageSrc) return;

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
};
