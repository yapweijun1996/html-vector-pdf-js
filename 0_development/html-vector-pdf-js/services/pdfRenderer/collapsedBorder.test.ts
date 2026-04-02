import { describe, expect, it, vi } from 'vitest';
import { renderCollapsedBorder } from './collapsedBorder';
import type { RenderItem } from '../renderItems';

const createDoc = () => ({
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn()
});

const baseItem: RenderItem = {
  type: 'collapsedBorder',
  x: 10,
  y: 0,
  w: 100,
  h: 0,
  style: {} as CSSStyleDeclaration,
  zIndex: 10,
  collapseBorderWidthPx: 2,
  collapseBorderColor: [0, 0, 0],
  collapseBorderStyle: 'solid',
  isOuterBorder: true,
  borderSourceOrder: 1
};

describe('renderCollapsedBorder', () => {
  it('moves top outer borders inward by half the stroke width', () => {
    const doc = createDoc();
    renderCollapsedBorder(doc as any, { ...baseItem, collapseBorderSourceSide: 't' }, 0, (px) => px);
    expect(doc.line).toHaveBeenCalledWith(10, 1, 110, 1);
  });

  it('moves bottom outer borders inward by half the stroke width', () => {
    const doc = createDoc();
    renderCollapsedBorder(doc as any, { ...baseItem, y: 20, collapseBorderSourceSide: 'b' }, 20, (px) => px);
    expect(doc.line).toHaveBeenCalledWith(10, 19, 110, 19);
  });
});
