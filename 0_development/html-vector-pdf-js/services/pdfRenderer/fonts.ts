import jsPDF from 'jspdf';
import { px2pt } from '../pdfUnits';
import { parseColor } from '../colors';
import { detectRequiredFont } from '../fontLoader';
import { PdfFontFamily, PdfFontStyle } from './types';

const loggedFontSelections = new WeakMap<jsPDF, Set<string>>();

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
    if (fam.includes('calibri')) return 'Carlito';
    if (fam.includes('arial') || fam.includes('helvetica') || fam.includes('liberation sans')) return 'LiberationSans';

    if (fam.includes('times') || (fam.includes('serif') && !fam.includes('sans-serif'))) return 'times';
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
    text?: string,
    debug: boolean = false
): void => {
    let fontName: PdfFontFamily = pickPdfFontFamily(style.fontFamily);

    // Auto-detect CJK font if text is provided and current font is standard or Carlito (for symbols)
    if (text && ['helvetica', 'times', 'courier', 'Carlito', 'LiberationSans'].includes(fontName)) {
        const requiredFont = detectRequiredFont(text);
        if (requiredFont) {
            fontName = requiredFont as PdfFontFamily;
        }
    }

    const pdfFontStyle = determinePdfFontStyle(style.fontStyle, style.fontWeight);

    try {
        doc.setFont(fontName, pdfFontStyle);
    } catch {
        try {
            // Fallback 1: try same font with 'normal' style
            doc.setFont(fontName, 'normal');
        } catch {
            // Fallback 2: font not registered at all, use jsPDF built-in helvetica
            // (closest to Arial/LiberationSans among built-in fonts)
            try {
                doc.setFont('helvetica', pdfFontStyle);
            } catch {
                doc.setFont('helvetica', 'normal');
            }
        }
    }

    const fontSizePx = parseFloat(style.fontSize);
    const fontSizePt = px2pt(fontSizePx) * textScale;
    doc.setFontSize(fontSizePt);

    const color = parseColor(style.color);
    if (color) doc.setTextColor(color[0], color[1], color[2]);

    if (debug) {
        const currentFont = doc.getFont();
        const textPreview = (text || '').slice(0, 40);
        const dedupeKey = [
            style.fontFamily || '',
            style.fontWeight || '',
            style.fontStyle || '',
            fontName,
            pdfFontStyle,
            currentFont?.fontName || '',
            currentFont?.fontStyle || '',
            textPreview
        ].join('|');
        const seen = loggedFontSelections.get(doc) || new Set<string>();
        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            loggedFontSelections.set(doc, seen);
            console.log('[html_to_vector_pdf] applyTextStyle', {
                cssFontFamily: style.fontFamily,
                cssFontWeight: style.fontWeight,
                cssFontStyle: style.fontStyle,
                resolvedPdfFontFamily: fontName,
                resolvedPdfFontStyle: pdfFontStyle,
                jsPdfCurrentFont: currentFont,
                textPreview
            });
        }
    }
};
