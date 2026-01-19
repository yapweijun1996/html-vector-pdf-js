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
  /**
   * When table-cell alignment is intentionally downgraded to avoid overlap (e.g. block wrappers),
   * we keep the original desired alignment here so post-processing can safely re-anchor it.
   */
  cellTextAlign?: TextAlign;
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
  alignmentBucket?: string;
  floatLeft?: boolean;
  borderSides?: { t: number; r: number; b: number; l: number };

  borderColors?: {
    t: [number, number, number];
    r: [number, number, number];
    b: [number, number, number];
    l: [number, number, number];
  };
  borderStyles?: {
    t: string;
    r: string;
    b: string;
    l: string;
  };
}
