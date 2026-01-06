export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type PageSize = 'a4' | 'letter';
export type Orientation = 'portrait' | 'landscape';

export interface PdfConfig {
  filename: string;
  pageSize: PageSize;
  orientation: Orientation;
  margins: PdfMargins;
  fontFamily: string;
  debug: boolean;
}

export interface RenderNode {
  type: 'text' | 'rect' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  styles: CSSStyleDeclaration;
  src?: string; // For images
}

// Internal structure for the DOM Parser
export interface ParsedElement {
  tagName: string;
  styles: CSSStyleDeclaration;
  rect: DOMRect;
  text?: string;
  children: ParsedElement[];
  isImg?: boolean;
}
