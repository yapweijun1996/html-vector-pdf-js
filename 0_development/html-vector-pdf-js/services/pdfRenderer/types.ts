// ============================================================================
// Type Definitions for PDF Renderer
// ============================================================================

/**
 * PDF font families supported by jsPDF
 */
export type PdfFontFamily =
    | 'helvetica'
    | 'times'
    | 'courier'
    | 'NotoSansSC'
    | 'NotoSansJP'
    | 'NotoSansTC'
    | 'NotoSansKR'
    | 'NotoSans'
    | 'Carlito';

/**
 * PDF font styles
 */
export type PdfFontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Pagination calculation result
 */
export interface PaginationInfo {
    renderY: number;
    localPageIndex: number;
    absolutePageIndex: number;
}

/**
 * Debug text row for console.table output
 */
export interface DebugTextRow {
    text: string;
    rectsLen: number | null;
    cssNoWrap: boolean | null;
    noWrapFinal: boolean | null;
    maxWidthMm: number;
    pdfTextWidthMm: number;
    wrappedLines: number;
    align: string;
}
