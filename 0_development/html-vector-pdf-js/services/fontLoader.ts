import { HtmlToVectorPdfError } from './errors';

/**
 * Detects which font to use based on text content
 */
export const detectRequiredFont = (text: string): string | null => {
    /****
    // OLD: Only checked Latin-1, then returned null for non-CJK characters
    // This caused symbols like ● (U+25CF) to render as garbage in Helvetica
    if (/^[\x00-\xFF]*$/.test(text)) {
        return null; // Use standard fonts
    }
    ****/
    // NEW: First check if text contains ONLY basic ASCII/Latin-1 (0-255)
    // If yes, use standard fonts (Helvetica/Times/Courier)
    // If no, proceed to check for specific scripts
    const hasOnlyLatin1 = /^[\x00-\xFF]*$/.test(text);
    if (hasOnlyLatin1) {
        return null; // Use standard fonts
    }

    // CJK Unified Ideographs (Chinese/Japanese/Korean)
    if (/[\u4E00-\u9FFF]/.test(text)) {
        return 'NotoSansSC'; // Simplified Chinese (also covers Japanese Kanji)
    }

    // Japanese Hiragana/Katakana
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
        return 'NotoSansJP';
    }

    // Korean Hangul
    if (/[\uAC00-\uD7AF]/.test(text)) {
        return 'NotoSansKR';
    }

    /****
    // OLD: Returned 'NotoSans' for "other" characters, but this was never reached
    // because the Latin-1 check above would return null first
    return 'NotoSans';
    ****/
    // NEW: For any non-Latin-1 character that's not CJK/Japanese/Korean,
    // use NotoSans which has broader Unicode coverage (symbols, arrows, etc.)
    // This fixes rendering of ●, →, ©, ™, etc.
    return 'NotoSans';
};

interface FontDefinition {
    name: string;
    url: string;
    format: 'truetype' | 'opentype';
}

/**
 * Local font files (Embedded)
 */
const FONT_CDN_URLS: Record<string, FontDefinition> = {
    NotoSansSC: {
        name: 'NotoSansSC',
        url: 'EMBEDDED',
        format: 'truetype'
    },
    NotoSansJP: {
        name: 'NotoSansJP',
        url: 'EMBEDDED',
        format: 'truetype'
    },
    NotoSansKR: {
        name: 'NotoSansKR',
        url: 'EMBEDDED',
        format: 'truetype'
    },
    NotoSans: {
        name: 'NotoSans',
        url: 'EMBEDDED',
        format: 'truetype'
    }
};

// This string will be replaced by the build script/command with the actual Base64 content
const EMBEDDED_FONT_DATA = "EMBEDDED_FONT_DATA_PLACEHOLDER";
/**
 * Load font from embedded base64 data or CDN
 */
export const loadFont = async (fontName: string): Promise<ArrayBuffer> => {
    const fontDef = FONT_CDN_URLS[fontName];

    if (!fontDef) {
        throw new HtmlToVectorPdfError(`Font ${fontName} not found`);
    }

    if (fontDef.url === 'EMBEDDED') {
        // Use embedded font data
        if (EMBEDDED_FONT_DATA === 'EMBEDDED_FONT_DATA_PLACEHOLDER') {
            throw new HtmlToVectorPdfError(
                'Font data not injected. Please run build script first.'
            );
        }

        // Convert base64 to ArrayBuffer
        const binaryString = atob(EMBEDDED_FONT_DATA);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Fallback to CDN (if needed in future)
    throw new HtmlToVectorPdfError('CDN loading not implemented');
};

/**
 * Detect required fonts from multiple text strings
 * @param texts - Array of text strings to analyze
 * @returns Set of required font names
 */
export const detectRequiredFonts = (texts: string[]): Set<string> => {
    const requiredFonts = new Set<string>();

    for (const text of texts) {
        const fontName = detectRequiredFont(text);
        if (fontName) {
            requiredFonts.add(fontName);
        }
    }

    return requiredFonts;
};

/**
 * Load font from CDN and return formatted data for jsPDF
 * @param fontName - Name of the font to load
 * @returns Font data with name, base64 data, and format
 */
export const loadFontFromCDN = async (fontName: string): Promise<{
    name: string;
    data: string;
    format: string;
}> => {
    const fontDef = FONT_CDN_URLS[fontName];

    if (!fontDef) {
        throw new HtmlToVectorPdfError(`Font ${fontName} not found`);
    }

    // Load font data
    const arrayBuffer = await loadFont(fontName);

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return {
        name: fontDef.name,
        data: base64,
        format: fontDef.format
    };
};
