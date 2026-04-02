import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { DEFAULT_CONFIG } from '../pdfConfig';
import { applyTextStyle } from './fonts';
import { groupInlineText, calculateInlineGroupOffset, processInlineTextGroups } from './inlineTextGroups';
import { RenderItem } from '../renderItems';

describe('inlineTextGroups', () => {
    describe('groupInlineText', () => {
        it('should group items by inlineGroupId', () => {
            const items = [
                { type: 'text', inlineGroupId: 'g1', text: 'A' },
                { type: 'text', inlineGroupId: 'g1', text: 'B' },
                { type: 'text', inlineGroupId: 'g2', text: 'C' },
                { type: 'text', text: 'D' }
            ] as RenderItem[];

            const groups = groupInlineText(items);

            expect(groups.size).toBe(2);
            expect(groups.get('g1')).toHaveLength(2);
            expect(groups.get('g2')).toHaveLength(1);
            expect(groups.get('g1')![0].text).toBe('A');
            expect(groups.get('g1')![1].text).toBe('B');
        });
    });

    describe('calculateInlineGroupOffset', () => {
        const group = [
            { w: 10 },
            { w: 20 }
        ] as RenderItem[];

        const contentLeft = 10;
        const contentRight = 110;

        it('should return 0 for left align', () => {
            expect(calculateInlineGroupOffset(group, 'left', contentLeft, contentRight)).toBe(0);
        });

        it('should calculate center alignment correctly', () => {
            expect(calculateInlineGroupOffset(group, 'center', contentLeft, contentRight)).toBe(35);
        });

        it('should calculate right alignment correctly', () => {
            expect(calculateInlineGroupOffset(group, 'right', contentLeft, contentRight)).toBe(70);
        });
    });

    describe('processInlineTextGroups', () => {
        it('should compute centered positions for grouped fragments', () => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const cfg = DEFAULT_CONFIG;

            const style = {
                fontFamily: 'Roboto',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: '400',
                color: '#000000'
            } as any as CSSStyleDeclaration;

            const items: RenderItem[] = [
                {
                    type: 'text',
                    inlineGroupId: 'g1',
                    inlineOrder: 0,
                    textAlign: 'center',
                    contentLeftMm: 0,
                    contentRightMm: 100,
                    x: 10,
                    y: 10,
                    w: 0,
                    h: 0,
                    style,
                    text: 'Hello',
                    zIndex: 1
                },
                {
                    type: 'text',
                    inlineGroupId: 'g1',
                    inlineOrder: 1,
                    textAlign: 'center',
                    contentLeftMm: 0,
                    contentRightMm: 100,
                    x: 20,
                    y: 10,
                    w: 0,
                    h: 0,
                    style,
                    text: 'World',
                    zIndex: 1
                }
            ];

            processInlineTextGroups(doc, items, cfg);

            applyTextStyle(doc, style, cfg.text.scale, 'Hello');
            const w1 = doc.getTextWidth('Hello');
            applyTextStyle(doc, style, cfg.text.scale, 'World');
            const w2 = doc.getTextWidth('World');
            const total = w1 + w2;
            const expectedStartX = (100 - total) / 2;

            expect(items[0].computedX).toBeDefined();
            expect(items[1].computedX).toBeDefined();
            expect(items[0].computedX!).toBeCloseTo(expectedStartX, 3);
            expect(items[1].computedX!).toBeCloseTo(expectedStartX + w1, 3);
            expect(items[0].textAlign).toBe('left');
            expect(items[1].textAlign).toBe('left');
        });

        it('prefers browser-measured widths when textWidthMm is available', () => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const cfg = DEFAULT_CONFIG;

            const style = {
                fontFamily: 'Roboto',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: '400',
                color: '#000000'
            } as any as CSSStyleDeclaration;

            const items: RenderItem[] = [
                {
                    type: 'text',
                    inlineGroupId: 'g2',
                    inlineOrder: 0,
                    textAlign: 'right',
                    contentLeftMm: 0,
                    contentRightMm: 100,
                    x: 10,
                    y: 10,
                    w: 5,
                    h: 0,
                    style,
                    text: 'A',
                    textWidthMm: 30,
                    zIndex: 1
                },
                {
                    type: 'text',
                    inlineGroupId: 'g2',
                    inlineOrder: 1,
                    textAlign: 'right',
                    contentLeftMm: 0,
                    contentRightMm: 100,
                    x: 20,
                    y: 10,
                    w: 5,
                    h: 0,
                    style,
                    text: 'B',
                    textWidthMm: 20,
                    zIndex: 1
                }
            ];

            processInlineTextGroups(doc, items, cfg);

            expect(items[0].computedX).toBeCloseTo(50, 3);
            expect(items[1].computedX).toBeCloseTo(80, 3);
        });
    });
});
