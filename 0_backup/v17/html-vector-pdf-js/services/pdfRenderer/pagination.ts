import { PaginationInfo } from './types';

// ============================================================================
// Pagination Calculation
// ============================================================================

/**
 * Calculate pagination information for a render item
 * @param itemY - Item's Y coordinate
 * @param forcedBreakCount - Number of forced page breaks before this item
 * @param uniqueBreaks - Array of unique page break Y positions
 * @param contentH - Content height per page (excluding margins)
 * @param marginTop - Top margin in mm
 * @param currentStartPage - Starting page number for current element
 * @returns Pagination information including render Y and page indices
 */
export const calculatePagination = (
    itemY: number,
    forcedBreakCount: number,
    uniqueBreaks: number[],
    contentH: number,
    marginTop: number,
    currentStartPage: number
): PaginationInfo => {
    const forcedOffset = forcedBreakCount > 0 ? uniqueBreaks[forcedBreakCount - 1] : 0;
    const relativeY = itemY - forcedOffset;

    let renderY = marginTop + relativeY;
    const localPageIndex = forcedBreakCount + Math.floor(relativeY / contentH) + 1;
    const absolutePageIndex = currentStartPage + localPageIndex - 1;

    // Adjust renderY for pages beyond the first
    if (localPageIndex > 1) {
        renderY = marginTop + (relativeY % contentH);
    }

    return {
        renderY,
        localPageIndex,
        absolutePageIndex
    };
};

/**
 * Ensure PDF document has enough pages and set to target page
 * @param doc - jsPDF document instance
 * @param targetPage - Target page number (1-indexed)
 */
export const ensurePageExists = (doc: any, targetPage: number): void => {
    while (doc.getNumberOfPages() < targetPage) {
        doc.addPage();
    }
    doc.setPage(targetPage);
};
