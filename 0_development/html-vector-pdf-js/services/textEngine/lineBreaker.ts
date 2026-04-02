import { MeasureTextWidthMm, TextLine, TextToken } from './types';

const isHardBreak = (t: TextToken): boolean => t.text === '\n';

const measureToken = (measure: MeasureTextWidthMm, token: TextToken): number => {
  if (token.kind === 'space') return measure(' ', token.style);
  return measure(token.text, token.style);
};

/** Split text into grapheme clusters (safe for emoji and CJK).
 *  Falls back to Array.from() if Intl.Segmenter is unavailable. */
const splitGraphemes = (text: string): string[] => {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s: any) => s.segment);
  }
  return Array.from(text);
};

/**
 * Split an oversized word into chunks that fit within maxWidth.
 * Returns tokens pushed into the provided callback.
 */
const splitLongWord = (
  text: string,
  style: CSSStyleDeclaration,
  maxWidthMm: number,
  measure: MeasureTextWidthMm,
  emitChunk: (token: TextToken) => void,
  emitLineBreak: () => void
): void => {
  const graphemes = splitGraphemes(text);
  let chunk = '';
  for (const g of graphemes) {
    const next = chunk + g;
    const nextW = measure(next, style);
    if (nextW <= maxWidthMm) {
      chunk = next;
    } else {
      if (chunk) {
        emitChunk({ text: chunk, style, kind: 'word' });
        emitLineBreak();
      }
      chunk = g;
    }
  }
  if (chunk) emitChunk({ text: chunk, style, kind: 'word' });
};

/**
 * Break tokens into lines using PDF-side measurement.
 * - Breaks at token boundaries (space/word).
 * - If a single word is longer than maxWidth, it will be split by characters.
 */
export const breakTokensToLines = (
  tokens: TextToken[],
  maxWidthMm: number,
  measure: MeasureTextWidthMm
): TextLine[] => {
  const lines: TextLine[] = [];
  let current: TextToken[] = [];
  let currentW = 0;

  const pushLine = () => {
    // trim leading/trailing spaces
    while (current.length && current[0].kind === 'space') current.shift();
    while (current.length && current[current.length - 1].kind === 'space') current.pop();
    if (current.length) lines.push({ tokens: current });
    current = [];
    currentW = 0;
  };

  const pushToken = (t: TextToken) => {
    if (t.kind === 'space') {
      // collapse multiple spaces inside a line
      const last = current[current.length - 1];
      if (last && last.kind === 'space') return;
      current.push({ ...t, text: ' ' });
      currentW += measureToken(measure, t);
      return;
    }
    current.push(t);
    currentW += measureToken(measure, t);
  };

  for (const token of tokens) {
    if (isHardBreak(token)) {
      pushLine();
      continue;
    }

    if (token.kind === 'space' && current.length === 0) continue;

    const w = measureToken(measure, token);
    if (currentW + w <= maxWidthMm || current.length === 0) {
      // If the first token is an oversized word, it will be handled below.
      if (current.length === 0 && token.kind === 'word' && w > maxWidthMm) {
        splitLongWord(token.text, token.style, maxWidthMm, measure, pushToken, pushLine);
        continue;
      }

      pushToken(token);
      continue;
    }

    // New line
    pushLine();
    if (token.kind === 'space') continue;

    const w2 = measureToken(measure, token);
    if (token.kind === 'word' && w2 > maxWidthMm) {
      splitLongWord(token.text, token.style, maxWidthMm, measure, pushToken, pushLine);
      continue;
    }

    pushToken(token);
  }

  pushLine();
  return lines;
};

