import { describe, expect, it, vi } from 'vitest';
import { renderText } from './text';
import type { RenderItem } from '../renderItems';
import { DEFAULT_CONFIG } from '../pdfConfig';

const createMockDoc = () => ({
  text: vi.fn(),
  getTextWidth: vi.fn((text: string) => text.length * 2),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
});

const mockStyle = {
  fontSize: '12px',
  fontWeight: 'normal',
  fontStyle: 'normal',
  fontFamily: 'Arial',
  color: 'rgb(0, 0, 0)',
  textDecorationLine: '',
  textDecoration: '',
} as unknown as CSSStyleDeclaration;

const px2mm = (px: number) => px * 0.264583;

describe('renderText', () => {
  it('skips non-text items', () => {
    const doc = createMockDoc();
    const item: RenderItem = { type: 'background', x: 0, y: 0, w: 100, h: 50, style: mockStyle, zIndex: 0 };
    renderText(doc as any, item, 10, DEFAULT_CONFIG, px2mm, []);
    expect(doc.text).not.toHaveBeenCalled();
  });

  it('skips text items without text content', () => {
    const doc = createMockDoc();
    const item: RenderItem = { type: 'text', x: 10, y: 20, w: 50, h: 5, style: mockStyle, text: '', zIndex: 20 };
    renderText(doc as any, item, 10, DEFAULT_CONFIG, px2mm, []);
    expect(doc.text).not.toHaveBeenCalled();
  });

  it('renders simple text with left alignment', () => {
    const doc = createMockDoc();
    const item: RenderItem = {
      type: 'text', x: 10, y: 20, w: 50, h: 5,
      style: mockStyle, text: 'Hello World', noWrap: true,
      zIndex: 20
    };
    renderText(doc as any, item, 15, DEFAULT_CONFIG, px2mm, []);
    expect(doc.text).toHaveBeenCalledTimes(1);
    expect(doc.text).toHaveBeenCalledWith(
      'Hello World', 10, 15, { baseline: 'alphabetic', align: 'left' }
    );
  });

  it('uses computedX when available', () => {
    const doc = createMockDoc();
    const item: RenderItem = {
      type: 'text', x: 10, y: 20, w: 50, h: 5,
      style: mockStyle, text: 'Test', noWrap: true,
      computedX: 15, zIndex: 20
    };
    renderText(doc as any, item, 20, DEFAULT_CONFIG, px2mm, []);
    expect(doc.text).toHaveBeenCalledWith(
      'Test', 15, 20, { baseline: 'alphabetic', align: 'left' }
    );
  });

  it('draws underline decoration', () => {
    const doc = createMockDoc();
    const underlineStyle = {
      ...mockStyle,
      textDecorationLine: 'underline',
    } as unknown as CSSStyleDeclaration;
    const item: RenderItem = {
      type: 'text', x: 10, y: 20, w: 50, h: 5,
      style: underlineStyle, text: 'Underlined', noWrap: true,
      zIndex: 20
    };
    renderText(doc as any, item, 20, DEFAULT_CONFIG, px2mm, []);
    expect(doc.line).toHaveBeenCalled();
  });

  it('draws line-through decoration', () => {
    const doc = createMockDoc();
    const strikeStyle = {
      ...mockStyle,
      textDecorationLine: 'line-through',
    } as unknown as CSSStyleDeclaration;
    const item: RenderItem = {
      type: 'text', x: 10, y: 20, w: 50, h: 5,
      style: strikeStyle, text: 'Struck', noWrap: true,
      zIndex: 20
    };
    renderText(doc as any, item, 20, DEFAULT_CONFIG, px2mm, []);
    expect(doc.line).toHaveBeenCalled();
  });
});
