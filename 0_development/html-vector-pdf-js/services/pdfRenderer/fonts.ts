import jsPDF from 'jspdf';
import { px2pt } from '../pdfUnits';
import { parseColor } from '../colors';
import { detectRequiredFont } from '../fontLoader';
import { PdfFontFamily, PdfFontStyle } from './types';

// ============================================================================
// Font Selection and Style Application
// ============================================================================

/**
 * Pick appropriate PDF font family based on CSS font-family
 * @param cssFontFamily - CSS font-family string
 * @returns PDF font family name
 */
export const pickPdfFontFamily = (cssFontFamily: string | null | undefined): PdfFontFamily => {
    if (!cssFontFamily) return 'helvetica';
    const fam = cssFontFamily.toLowerCase();

    // Explicit CJK font selection
    if (fam.includes('notosanssc')) return 'NotoSansSC';
    if (fam.includes('notosansjp')) return 'NotoSansJP';
    if (fam.includes('notosanstc')) return 'NotoSansTC';
    if (fam.includes('notosanskr')) return 'NotoSansKR';

    /**** AMENDMENT [start] "Map Calibri to Carlito" ****/
    if (fam.includes('calibri')) return 'Carlito';
    /**** AMENDMENT [end] "Map Calibri to Carlito" ****/

    if (fam.includes('times') || fam.includes('serif')) return 'times';
    if (fam.includes('courier') || fam.includes('mono')) return 'courier';
    return 'helvetica';
};

/**
 * Determine PDF font style from CSS font-style and font-weight
 * @param fontStyle - CSS font-style value
 * @param fontWeight - CSS font-weight value
 * @returns PDF font style string
 */
export const determinePdfFontStyle = (
    fontStyle: string,
    fontWeight: string
): PdfFontStyle => {
    const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';
    const isBold = fontWeight === 'bold' || parseInt(fontWeight || '400') >= 700;

    if (isItalic && isBold) return 'bolditalic';
    if (isItalic) return 'italic';
    if (isBold) return 'bold';
    return 'normal';
};

/**
 * Apply text styling to jsPDF document
 * @param doc - jsPDF document instance
 * @param style - CSS style declaration
 * @param textScale - Text scaling factor
 * @param text - Optional text for CJK font auto-detection
 */
export const applyTextStyle = (
    doc: jsPDF,
    style: CSSStyleDeclaration,
    textScale: number,
    text?: string
): void => {
    let fontName: PdfFontFamily = pickPdfFontFamily(style.fontFamily);

    // Auto-detect CJK font if text is provided and current font is standard or Carlito (for symbols)
    if (text && ['helvetica', 'times', 'courier', 'Carlito'].includes(fontName)) {
        const requiredFont = detectRequiredFont(text);
        if (requiredFont) {
            fontName = requiredFont as PdfFontFamily;
        }
    }

    const pdfFontStyle = determinePdfFontStyle(style.fontStyle, style.fontWeight);

    try {
        doc.setFont(fontName, pdfFontStyle);
    } catch (e) {
        // Fallback if font/style combo not found
        doc.setFont(fontName, 'normal');
    }

    const fontSizePx = parseFloat(style.fontSize);
    const fontSizePt = px2pt(fontSizePx) * textScale;
    doc.setFontSize(fontSizePt);

    const color = parseColor(style.color);
    if (color) doc.setTextColor(color[0], color[1], color[2]);
};
