import { PdfConfig } from './pdfConfig';
import { detectRequiredFonts, detectRequiredFontsFromFamilies, loadFontFromCDN } from './fontLoader';
import { RenderItem } from './renderItems';
import { FontData, FontLoadResult } from './generatePdf.types';
import { buildInlineRuns } from './textEngine/runBuilder';

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
    return allElementItems.flatMap(elemItems => {
        const texts: string[] = [];

        for (const item of elemItems.items) {
            if (item.type === 'text' && typeof item.text === 'string') {
                texts.push(item.text);
                continue;
            }

            // PDF-first text engine: `textBlock` expands to many styled tokens at render-time.
            // We must include its DOM text now so the correct fonts (e.g. symbols like ●) are loaded beforehand.
            if (item.type === 'textBlock' && item.element) {
                try {
                    const runs = buildInlineRuns(item.element);
                    for (const r of runs) {
                        if (r.text) texts.push(r.text);
                    }
                } catch {
                    // Best-effort: still include raw textContent if run building fails
                    const raw = item.element.textContent || '';
                    if (raw) texts.push(raw);
                }
            }
        }

        return texts;
    });
};

/**** AMENDMENT [start] "Add family extractor" ****/
/**
 * Extract all font families from render items
 * @param allElementItems - Array of element items containing render items
 * @returns Array of unique font-family strings found in render items
 */
export const extractFamiliesFromItems = (
    allElementItems: Array<{ items: RenderItem[] }>
): string[] => {
    const families = new Set<string>();

    for (const elemItems of allElementItems) {
        for (const item of elemItems.items) {
            if (item.style?.fontFamily) {
                families.add(item.style.fontFamily);
            }
        }
    }

    return Array.from(families);
};
/**** AMENDMENT [end] "Add family extractor" ****/

/**
 * Process font load results and collect successfully loaded fonts
 * @param loadedResults - Results from Promise.allSettled
 * @param requiredFontsArray - Array of required font names (in same order as results)
 * @param cfg - PDF configuration with callbacks and debug settings
 * @returns Array of successfully loaded fonts
 */
const processFontLoadResults = (
    loadedResults: PromiseSettledResult<FontData[]>[],
    requiredFontsArray: string[],
    cfg: Required<PdfConfig>
): FontData[] => {
    const loadedFonts: FontData[] = [];

    for (let i = 0; i < loadedResults.length; i++) {
        const result = loadedResults[i];
        if (result.status === 'fulfilled') {
            for (const f of result.value) {
                loadedFonts.push(f);
                if (cfg.debug) {
                    console.log(`[html_to_vector_pdf] Loaded font: ${f.name} (${f.style})`);
                }
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
    allFamilies: string[],
    cfg: Required<PdfConfig>
): Promise<FontLoadResult> => {
    cfg.callbacks.onProgress?.('font:detect:start', {});

    const requiredFontsFromText = detectRequiredFonts(allTexts);
    const requiredFontsFromFamilies = detectRequiredFontsFromFamilies(allFamilies);

    // Merge sets
    const requiredFonts = new Set([...Array.from(requiredFontsFromText), ...Array.from(requiredFontsFromFamilies)]);

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
