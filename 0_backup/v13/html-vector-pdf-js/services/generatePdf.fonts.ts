import { PdfConfig } from './pdfConfig';
import { detectRequiredFonts, loadFontFromCDN } from './fontLoader';
import { RenderItem } from './renderItems';
import { FontData, FontLoadResult } from './generatePdf.types';

// ============================================================================
// Font Processing Helpers
// ============================================================================

/**
 * Extract all text content from render items
 * @param allElementItems - Array of element items containing render items
 * @returns Array of text strings found in render items
 */
export const extractTextsFromItems = (
    allElementItems: Array<{ items: RenderItem[] }>
): string[] => {
    return allElementItems.flatMap(elemItems =>
        elemItems.items
            .filter((item): item is RenderItem & { type: 'text'; text: string } =>
                item.type === 'text' && typeof item.text === 'string'
            )
            .map(item => item.text)
    );
};

/**
 * Process font load results and collect successfully loaded fonts
 * @param loadedResults - Results from Promise.allSettled
 * @param requiredFontsArray - Array of required font names (in same order as results)
 * @param cfg - PDF configuration with callbacks and debug settings
 * @returns Array of successfully loaded fonts
 */
const processFontLoadResults = (
    loadedResults: PromiseSettledResult<FontData>[],
    requiredFontsArray: string[],
    cfg: Required<PdfConfig>
): FontData[] => {
    const loadedFonts: FontData[] = [];

    for (let i = 0; i < loadedResults.length; i++) {
        const result = loadedResults[i];
        if (result.status === 'fulfilled') {
            loadedFonts.push(result.value);
            if (cfg.debug) {
                console.log(`[html_to_vector_pdf] Loaded font: ${result.value.name}`);
            }
        } else {
            const fontName = requiredFontsArray[i];
            console.warn(`[html_to_vector_pdf] Failed to load font ${fontName}:`, result.reason);
            cfg.callbacks.onError?.(result.reason);
        }
    }

    return loadedFonts;
};

/**
 * Detect required fonts and load them from CDN
 * @param allTexts - Array of text strings to scan for font requirements
 * @param cfg - PDF configuration with callbacks and debug settings
 * @returns Object containing loaded fonts and required font names
 */
export const processFonts = async (
    allTexts: string[],
    cfg: Required<PdfConfig>
): Promise<FontLoadResult> => {
    cfg.callbacks.onProgress?.('font:detect:start', {});

    const requiredFonts = detectRequiredFonts(allTexts);
    const loadedFonts: FontData[] = [];

    if (requiredFonts.size === 0) {
        return { loadedFonts, requiredFonts };
    }

    // Convert Set to Array once for reuse
    const requiredFontsArray = Array.from(requiredFonts);

    cfg.callbacks.onProgress?.('font:load:start', { fonts: requiredFontsArray });

    if (cfg.debug) {
        console.log('[html_to_vector_pdf] Loading fonts from CDN:', requiredFontsArray);
    }

    // Load all fonts concurrently
    const fontPromises = requiredFontsArray.map(fontName => loadFontFromCDN(fontName));
    const loadedResults = await Promise.allSettled(fontPromises);

    // Process results and collect successfully loaded fonts
    const successfullyLoadedFonts = processFontLoadResults(loadedResults, requiredFontsArray, cfg);

    cfg.callbacks.onProgress?.('font:load:done', { loadedCount: successfullyLoadedFonts.length });

    return { loadedFonts: successfullyLoadedFonts, requiredFonts };
};
