import { describe, it, expect } from 'vitest';
import { calculatePagination } from './pagination';

describe('pagination', () => {
    describe('calculatePagination', () => {
        const contentH = 200;
        const marginTop = 10;
        const currentStartPage = 1;

        it('should calculate first page correctly', () => {
            const result = calculatePagination(
                50, // itemY
                0,  // forcedBreakCount
                [], // uniqueBreaks
                contentH,
                marginTop,
                currentStartPage
            );

            expect(result.localPageIndex).toBe(1);
            expect(result.absolutePageIndex).toBe(1);
            expect(result.renderY).toBe(60); // 10 + 50
        });

        it('should calculate natural page break correctly', () => {
            const result = calculatePagination(
                250, // itemY (exceeds contentH 200)
                0,
                [],
                contentH,
                marginTop,
                currentStartPage
            );

            expect(result.localPageIndex).toBe(2);
            expect(result.absolutePageIndex).toBe(2);
            expect(result.renderY).toBe(60); // 10 + (250 % 200) = 10 + 50
        });

        it('should handle forced page breaks', () => {
            const uniqueBreaks = [100]; // Page break at Y=100
            
            // Item at 150, which is 50 units after the break at 100
            const result = calculatePagination(
                150, // itemY
                1,   // forcedBreakCount (means we passed 1 break)
                uniqueBreaks,
                contentH,
                marginTop,
                currentStartPage
            );

            // forcedOffset = 100
            // relativeY = 150 - 100 = 50
            // localPageIndex = 1 + floor(50/200) + 1 = 2
            
            expect(result.localPageIndex).toBe(2);
            expect(result.absolutePageIndex).toBe(2);
            expect(result.renderY).toBe(60); // 10 + 50
        });

        it('should handle multiple forced page breaks', () => {
            const uniqueBreaks = [100, 300]; 
            
            // Item at 350, which is 50 units after the second break at 300
            const result = calculatePagination(
                350,
                2, // Passed 2 breaks
                uniqueBreaks,
                contentH,
                marginTop,
                currentStartPage
            );

            // forcedOffset = 300
            // relativeY = 350 - 300 = 50
            // localPageIndex = 2 + floor(50/200) + 1 = 3
            
            expect(result.localPageIndex).toBe(3);
            expect(result.renderY).toBe(60);
        });
    });
});
