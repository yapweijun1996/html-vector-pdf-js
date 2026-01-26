import { describe, expect, it } from 'vitest';
import { breakTokensToLines } from './lineBreaker';
import type { MeasureTextWidthMm, TextToken } from './types';

const measureMono: MeasureTextWidthMm = (text) => {
  // 1mm per char, and spaces count as 1.
  return Array.from(text).length;
};

const mk = (text: string, kind: 'space' | 'word' = 'word'): TextToken => ({
  text,
  kind,
  // style is not used by this mono measurer; provide a dummy cast.
  style: {} as CSSStyleDeclaration
});

describe('breakTokensToLines', () => {
  it('breaks by maxWidth and trims spaces', () => {
    const tokens: TextToken[] = [mk('Hello'), mk(' ', 'space'), mk('World')];
    const lines = breakTokensToLines(tokens, 5, measureMono);
    expect(lines).toHaveLength(2);
    expect(lines[0].tokens.map(t => t.text).join('')).toBe('Hello');
    expect(lines[1].tokens.map(t => t.text).join('')).toBe('World');
  });

  it('honors hard breaks', () => {
    const tokens: TextToken[] = [mk('A'), mk('\n'), mk('B')];
    const lines = breakTokensToLines(tokens, 100, measureMono);
    expect(lines).toHaveLength(2);
    expect(lines[0].tokens.map(t => t.text).join('')).toBe('A');
    expect(lines[1].tokens.map(t => t.text).join('')).toBe('B');
  });

  it('splits a long word by characters', () => {
    const tokens: TextToken[] = [mk('ABCDEFGHIJ')];
    const lines = breakTokensToLines(tokens, 3, measureMono);
    expect(lines.map(l => l.tokens.map(t => t.text).join(''))).toEqual(['ABC', 'DEF', 'GHI', 'J']);
  });
});

