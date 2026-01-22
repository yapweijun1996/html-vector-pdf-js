export type TextRun = {
  text: string;
  style: CSSStyleDeclaration;
};

export type TextToken = {
  text: string;
  style: CSSStyleDeclaration;
  kind: 'space' | 'word';
};

export type TextLine = {
  tokens: TextToken[];
};

export type MeasureTextWidthMm = (text: string, style: CSSStyleDeclaration) => number;

