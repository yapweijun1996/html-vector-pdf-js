import { parsePx } from '../pdfUnits';

export interface BoxInsetsPx {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ContentBoxRectPx {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  insets: BoxInsetsPx;
}

export const getBorderPaddingInsetsPx = (style: CSSStyleDeclaration): BoxInsetsPx => ({
  left: parsePx(style.paddingLeft) + parsePx(style.borderLeftWidth),
  right: parsePx(style.paddingRight) + parsePx(style.borderRightWidth),
  top: parsePx(style.paddingTop) + parsePx(style.borderTopWidth),
  bottom: parsePx(style.paddingBottom) + parsePx(style.borderBottomWidth)
});

export const getContentBoxFromRectAndInsetsPx = (rect: DOMRect | DOMRectReadOnly, insets: BoxInsetsPx): ContentBoxRectPx => {
  const left = rect.left + insets.left;
  const right = rect.right - insets.right;
  const top = rect.top + insets.top;
  const bottom = rect.bottom - insets.bottom;

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    insets
  };
};

export const getContentBoxFromRectPx = (
  rect: DOMRect | DOMRectReadOnly,
  style: CSSStyleDeclaration
): ContentBoxRectPx => getContentBoxFromRectAndInsetsPx(rect, getBorderPaddingInsetsPx(style));

export const getNestedContentBoxFromLayoutPx = (
  layoutEl: HTMLElement,
  layoutStyle: CSSStyleDeclaration,
  leafEl: HTMLElement | null
): ContentBoxRectPx => {
  const layoutRect = layoutEl.getBoundingClientRect();
  const insets = getBorderPaddingInsetsPx(layoutStyle);

  let curr: HTMLElement | null = leafEl;
  while (curr && curr !== layoutEl && layoutEl.contains(curr)) {
    const style = window.getComputedStyle(curr);
    const childInsets = getBorderPaddingInsetsPx(style);
    insets.left += childInsets.left;
    insets.right += childInsets.right;
    insets.top += childInsets.top;
    insets.bottom += childInsets.bottom;
    curr = curr.parentElement;
  }

  return getContentBoxFromRectAndInsetsPx(layoutRect, insets);
};
