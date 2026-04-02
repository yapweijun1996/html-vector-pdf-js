import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getContentBoxFromRectPx, getNestedContentBoxFromLayoutPx } from './boxModel';

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
  toJSON: () => any;
};

const rect = (left: number, top: number, width: number, height: number): RectLike => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({})
});

describe('boxModel helpers', () => {
  const originalGetComputedStyle = window.getComputedStyle;

  beforeEach(() => {
    window.getComputedStyle = vi.fn((el: any) => el.__mockStyle) as any;
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle as any;
  });

  it('computes the content box from padding and border insets', () => {
    const style = {
      paddingLeft: '8px',
      paddingRight: '6px',
      paddingTop: '4px',
      paddingBottom: '10px',
      borderLeftWidth: '2px',
      borderRightWidth: '1px',
      borderTopWidth: '3px',
      borderBottomWidth: '2px'
    } as CSSStyleDeclaration;

    const contentBox = getContentBoxFromRectPx(rect(100, 50, 200, 80) as any, style);

    expect(contentBox.left).toBe(110);
    expect(contentBox.right).toBe(293);
    expect(contentBox.top).toBe(57);
    expect(contentBox.bottom).toBe(118);
    expect(contentBox.width).toBe(183);
    expect(contentBox.height).toBe(61);
  });

  it('accumulates nested padding and border insets between layout and leaf element', () => {
    const layoutEl = document.createElement('div');
    const leafEl = document.createElement('span');
    layoutEl.appendChild(leafEl);
    document.body.appendChild(layoutEl);

    layoutEl.getBoundingClientRect = vi.fn().mockReturnValue(rect(20, 30, 300, 90));
    (layoutEl as any).__mockStyle = {
      paddingLeft: '12px',
      paddingRight: '8px',
      paddingTop: '6px',
      paddingBottom: '4px',
      borderLeftWidth: '2px',
      borderRightWidth: '1px',
      borderTopWidth: '1px',
      borderBottomWidth: '3px'
    };
    (leafEl as any).__mockStyle = {
      paddingLeft: '5px',
      paddingRight: '4px',
      paddingTop: '2px',
      paddingBottom: '1px',
      borderLeftWidth: '1px',
      borderRightWidth: '2px',
      borderTopWidth: '0px',
      borderBottomWidth: '1px'
    };

    const contentBox = getNestedContentBoxFromLayoutPx(layoutEl, (layoutEl as any).__mockStyle, leafEl);

    expect(contentBox.left).toBe(40);
    expect(contentBox.right).toBe(305);
    expect(contentBox.top).toBe(39);
    expect(contentBox.bottom).toBe(111);
    expect(contentBox.width).toBe(265);
    expect(contentBox.height).toBe(72);

    layoutEl.remove();
  });
});
