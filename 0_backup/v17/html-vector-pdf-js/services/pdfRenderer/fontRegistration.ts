import jsPDF from 'jspdf';
import { PdfConfig } from '../pdfConfig';

/**
 * Register CJK fonts that were loaded from CDN into jsPDF
 */
export const registerLoadedFonts = (
    doc: jsPDF,
    cfg: Required<PdfConfig>
): void => {
    const loadedFonts = (cfg as any).loadedFonts as Array<{ name: string; style: 'normal' | 'bold'; data: string; format: string }> | undefined;

    if (!loadedFonts || loadedFonts.length === 0) return;

    for (const font of loadedFonts) {
        try {
            const vfsName = `${font.name}-${font.style}.ttf`;
            if (cfg.debug) {
                console.log(`[html_to_vector_pdf] Registering font to jsPDF: ${font.name} (${font.style}) data length: ${font.data.length}`);
            }
            doc.addFileToVFS(vfsName, font.data);
            doc.addFont(vfsName, font.name, font.style);
            if (cfg.debug) {
                console.log(`[html_to_vector_pdf] Registered font to jsPDF: ${font.name} (${font.style})`);
            }
        } catch (err) {
            console.warn(`[html_to_vector_pdf] Failed to register font ${font.name} (${font.style}):`, err);
        }
    }
};
