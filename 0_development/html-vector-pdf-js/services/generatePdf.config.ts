import { PdfConfig, DEFAULT_CONFIG, DEFAULT_EXCLUDE_SELECTORS } from './pdfConfig';
import { WindowWithPdfGlobals, GlobalOverrides } from './generatePdf.types';

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Extract global overrides from window object (if available)
 * @returns Global overrides or empty object if window is undefined
 */
export const getGlobalOverrides = (): GlobalOverrides => {
    if (typeof window === 'undefined') {
        return {};
    }

    const win = window as WindowWithPdfGlobals;
    return {
        margins: win.html_to_vector_pdf_margins,
        pageSize: win.html_to_vector_pdf_page_size,
        orientation: win.html_to_vector_pdf_orientation
    };
};

/**
 * Merge a specific config section with defaults
 * @param defaultValue - Default value from DEFAULT_CONFIG
 * @param userValue - User-provided value
 * @returns Merged configuration object
 */
export const mergeConfigSection = <T extends object>(
    defaultValue: T,
    userValue?: Partial<T>
): T => ({
    ...defaultValue,
    ...(userValue || {})
});

/**
 * Merge user config with defaults and global overrides
 * Priority: Global overrides > User config > Defaults
 * @param config - User-provided PDF configuration
 * @returns Complete configuration with all defaults applied
 */
export const mergeConfig = (config: PdfConfig): Required<PdfConfig> => {
    // Extract global overrides from window object
    const globalOverrides = getGlobalOverrides();

    return {
        ...DEFAULT_CONFIG,
        ...config,
        // Global overrides (highest priority)
        ...(globalOverrides.pageSize ? { pageSize: globalOverrides.pageSize } : {}),
        ...(globalOverrides.orientation ? { orientation: globalOverrides.orientation } : {}),
        margins: {
            ...DEFAULT_CONFIG.margins,
            ...config.margins,
            ...(globalOverrides.margins || {})
        },
        excludeSelectors: [
            ...DEFAULT_EXCLUDE_SELECTORS,
            ...(config.excludeSelectors || [])
        ],
        callbacks: mergeConfigSection(DEFAULT_CONFIG.callbacks, config.callbacks),
        performance: mergeConfigSection(DEFAULT_CONFIG.performance, config.performance),
        errors: mergeConfigSection(DEFAULT_CONFIG.errors, config.errors),
        text: mergeConfigSection(DEFAULT_CONFIG.text, config.text),
        render: mergeConfigSection(DEFAULT_CONFIG.render, config.render),
        pagination: {
            ...DEFAULT_CONFIG.pagination,
            ...(config.pagination || {}),
            pageBreakBeforeSelectors: [
                ...(DEFAULT_CONFIG.pagination.pageBreakBeforeSelectors || []),
                ...((config.pagination?.pageBreakBeforeSelectors || []) as string[])
            ]
        },
        debugOverlay: mergeConfigSection(DEFAULT_CONFIG.debugOverlay, config.debugOverlay),
        textEngine: mergeConfigSection(DEFAULT_CONFIG.textEngine, config.textEngine)
    };
};
