/**
 * Binary search to count page breaks at or before a given Y position
 */
export const createBreakCounter = (uniqueBreaks: number[]) => {
    return (y: number): number => {
        let lo = 0;
        let hi = uniqueBreaks.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (uniqueBreaks[mid] <= y) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    };
};

/**
 * Normalize and sort page break positions
 */
export const normalizePageBreaks = (pageBreakBeforeYs: number[]): number[] => {
    return Array.from(
        new Set(pageBreakBeforeYs.filter((y) => Number.isFinite(y) && y > 0))
    ).sort((a, b) => a - b);
};
