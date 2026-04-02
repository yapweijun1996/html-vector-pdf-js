import { describe, expect, it, vi } from 'vitest';
import { expandPdfFirstTextBlocks } from './pdfFirstText';
import type { RenderItem } from '../renderItems';
import type { PdfConfig } from '../pdfConfig';
import { DEFAULT_CONFIG } from '../pdfConfig';

// Minimal jsPDF mock
const createMockDoc = (charWidthMm: number = 2) => ({
  getTextWidth: vi.fn((text: string) => text.length * charWidthMm),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
});

const mockStyle = {
  fontSize: '12px',
  fontWeight: 'normal',
  fontStyle: 'normal',
  fontFamily: 'Arial',
  color: 'rgb(0, 0, 0)',
} as unknown as CSSStyleDeclaration;

describe('expandPdfFirstTextBlocks', () => {
  it('returns items unchanged in legacy mode', () => {
    const doc = createMockDoc();
    const items: RenderItem[] = [
      { type: 'text', x: 10, y: 20, w: 50, h: 5, style: mockStyle, text: 'Hello', zIndex: 20 },
    ];
    const cfg = { ...DEFAULT_CONFIG, textEngine: { mode: 'legacy' as const, enabledTags: ['P' as const], debug: false } };
    const result = expandPdfFirstTextBlocks(doc as any, items, cfg);
    expect(result).toBe(items); // same reference, early return
  });

  it('passes through non-textBlock items', () => {
    const doc = createMockDoc();
    const items: RenderItem[] = [
      { type: 'background', x: 0, y: 0, w: 100, h: 50, style: mockStyle, zIndex: 0 },
      { type: 'text', x: 10, y: 20, w: 50, h: 5, style: mockStyle, text: 'Hello', zIndex: 20 },
    ];
    const cfg = { ...DEFAULT_CONFIG, textEngine: { mode: 'pdfFirst' as const, enabledTags: ['P' as const], debug: false } };
    const result = expandPdfFirstTextBlocks(doc as any, items, cfg);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('background');
    expect(result[1].type).toBe('text');
  });

  it('skips textBlock items without element', () => {
    const doc = createMockDoc();
    const items: RenderItem[] = [
      { type: 'textBlock', x: 10, y: 20, w: 100, h: 20, style: mockStyle, zIndex: 20 },
    ];
    const cfg = { ...DEFAULT_CONFIG, textEngine: { mode: 'pdfFirst' as const, enabledTags: ['P' as const], debug: false } };
    const result = expandPdfFirstTextBlocks(doc as any, items, cfg);
    // textBlock without element is pushed as-is
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('textBlock');
  });
});
