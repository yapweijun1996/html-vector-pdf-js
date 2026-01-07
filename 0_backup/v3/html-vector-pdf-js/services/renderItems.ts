export type TextAlign = 'left' | 'center' | 'right';

export interface RenderItem {
  type: 'text' | 'background' | 'border' | 'image' | 'debugRect';
  x: number;
  y: number;
  w: number;
  h: number;
  style: CSSStyleDeclaration;
  text?: string;
  imageSrc?: string;
  imageFormat?: string;
  zIndex: number;
  textAlign?: TextAlign;
  maxWidthMm?: number;
  lineHeightMm?: number;
  noWrap?: boolean;
  cssNoWrap?: boolean;
  rectsLen?: number;
  inlineGroupId?: string;
  inlineOrder?: number;
  contentLeftMm?: number;
  contentRightMm?: number;
  computedX?: number;
  borderSides?: { t: number; r: number; b: number; l: number };
  borderColors?: {
    t: [number, number, number];
    r: [number, number, number];
    b: [number, number, number];
    l: [number, number, number];
  };
}
