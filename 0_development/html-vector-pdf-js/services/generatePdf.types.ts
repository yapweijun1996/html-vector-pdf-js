import { PdfConfig } from './pdfConfig';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Window object with optional PDF global overrides
 */
export interface WindowWithPdfGlobals extends Window {
    html_to_vector_pdf_margins?: Partial<PdfConfig['margins']>;
    html_to_vector_pdf_page_size?: PdfConfig['pageSize'];
    html_to_vector_pdf_orientation?: PdfConfig['orientation'];
    /**
     * Override the export target for `generatePdf(target, config)`.
     * Example: window.html_to_vector_pdf_target = '.html_to_vector_pdf_print_area'
     */
    html_to_vector_pdf_target?: string;
}

/**
 * Global overrides extracted from window object
 */
export interface GlobalOverrides {
    margins?: Partial<PdfConfig['margins']>;
    pageSize?: PdfConfig['pageSize'];
    orientation?: PdfConfig['orientation'];
}

/**
 * Font data structure returned by loadFontFromCDN
 */
export interface FontData {
    name: string;
    style: 'normal' | 'bold';
    data: string;
    format: string;
}

/**
 * Result of font processing operation
 */
export interface FontLoadResult {
    loadedFonts: FontData[];
    requiredFonts: Set<string>;
}
