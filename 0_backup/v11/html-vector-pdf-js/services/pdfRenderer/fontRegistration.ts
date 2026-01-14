import jsPDF from 'jspdf';
import { PdfConfig } from '../pdfConfig';

/**
 * Register CJK fonts that were loaded from CDN into jsPDF
 */
export const registerLoadedFonts = (
    doc: jsPDF,
    cfg: Required<PdfConfig>
): void => {
    const loadedFonts = (cfg as any).loadedFonts as Array<{ name: string; data: string; format: string }> | undefined;

    if (!loadedFonts || loadedFonts.length === 0) return;

    for (const font of loadedFonts) {
        try {
            doc.addFileToVFS(`${font.name}.ttf`, font.data);
            doc.addFont(`${font.name}.ttf`, font.name, 'normal');
            if (cfg.debug) {
                console.log(`[html_to_vector_pdf] Registered font to jsPDF: ${font.name}`);
            }
        } catch (err) {
            console.warn(`[html_to_vector_pdf] Failed to register font ${font.name}:`, err);
        }
    }
};
