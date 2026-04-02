import { describe, expect, it, vi } from 'vitest';
import { renderBorder } from './border';
import type { RenderItem } from '../renderItems';

const createDoc = () => ({
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  rect: vi.fn(),
  line: vi.fn()
});

const baseStyle = {} as CSSStyleDeclaration;

describe('renderBorder', () => {
  it('draws uniform borders inside the border box', () => {
    const doc = createDoc();
    const item: RenderItem = {
      type: 'border',
      x: 10,
      y: 0,
      w: 100,
      h: 20,
      style: baseStyle,
      zIndex: 10,
      borderSides: { t: 2, r: 2, b: 2, l: 2 },
      borderColors: {
        t: [0, 0, 0],
        r: [0, 0, 0],
        b: [0, 0, 0],
        l: [0, 0, 0]
      },
      borderStyles: { t: 'solid', r: 'solid', b: 'solid', l: 'solid' }
    };

    renderBorder(doc as any, item, 30, (px) => px);

    expect(doc.rect).toHaveBeenCalledWith(11, 31, 98, 18, 'D');
  });

  it('moves per-side borders inward by half the stroke width', () => {
    const doc = createDoc();
    const item: RenderItem = {
      type: 'border',
      x: 10,
      y: 0,
      w: 100,
      h: 20,
      style: baseStyle,
      zIndex: 10,
      borderSides: { t: 0, r: 1, b: 1, l: 1 },
      borderColors: {
        t: [0, 0, 0],
        r: [0, 0, 0],
        b: [0, 0, 0],
        l: [0, 0, 0]
      },
      borderStyles: { t: 'solid', r: 'solid', b: 'solid', l: 'solid' }
    };

    renderBorder(doc as any, item, 20, (px) => px);

    expect(doc.line).toHaveBeenCalledWith(10.5, 39.5, 109.5, 39.5);
    expect(doc.line).toHaveBeenCalledWith(10.5, 20, 10.5, 39.5);
    expect(doc.line).toHaveBeenCalledWith(109.5, 20, 109.5, 39.5);
  });
});
