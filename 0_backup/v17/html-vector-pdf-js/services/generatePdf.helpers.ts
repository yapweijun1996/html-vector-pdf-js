/**
 * @deprecated This file is kept for backward compatibility.
 * Please import directly from the specific modules:
 * - './generatePdf.config' for configuration helpers
 * - './generatePdf.elements' for element selection helpers
 * - './generatePdf.fonts' for font processing helpers
 * - './generatePdf.types' for type definitions
 */

// Re-export all functions for backward compatibility
export { mergeConfig, getGlobalOverrides, mergeConfigSection } from './generatePdf.config';
export { findElements, validateElementSizes } from './generatePdf.elements';
export { extractTextsFromItems, processFonts } from './generatePdf.fonts';
export type { WindowWithPdfGlobals, GlobalOverrides, FontData, FontLoadResult } from './generatePdf.types';
