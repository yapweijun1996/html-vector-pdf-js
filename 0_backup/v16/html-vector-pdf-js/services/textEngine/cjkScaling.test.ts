import { describe, expect, it } from 'vitest';
import { tokenizeRuns } from './tokenizer';
import { breakTokensToLines } from './lineBreaker';
import type { MeasureTextWidthMm, TextRun } from './types';

const mockStyle = { fontSize: '16px', fontFamily: 'sans-serif' } as any as CSSStyleDeclaration;

const isCjk = (ch: string): boolean => {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  // Rough coverage for common CJK ranges (enough for testing).
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana/Katakana
    (cp >= 0xac00 && cp <= 0xd7af) // Hangul syllables
  );
};

const isEmojiLike = (ch: string): boolean => {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  // Broad heuristic for emoji/symbol blocks; only used for stable fake measurement.
  return cp >= 0x1f000;
};

const createMeasure = (scale: number): MeasureTextWidthMm => {
  return (text) => {
    let w = 0;
    for (const ch of Array.from(text)) {
      if (ch === ' ') {
        w += 1;
        continue;
      }
      if (isCjk(ch)) {
        w += 2;
        continue;
      }
      if (isEmojiLike(ch)) {
        w += 2;
        continue;
      }
      w += 1;
    }
    // Keep floating-point comparisons stable across environments.
    return Math.round(w * scale * 1e6) / 1e6;
  };
};

const mkRun = (text: string): TextRun => ({ text, style: mockStyle });

describe('services/textEngine - CJK edge cases under scaling', () => {
  it('splits long CJK text by characters safely across scales', () => {
    const text = '漢字假名交じり文測試'.repeat(12); // long CJK, no spaces
    const tokens = tokenizeRuns([mkRun(text)]);

    for (const scale of [0.25, 0.5, 1, 2, 4]) {
      const measure = createMeasure(scale);
      const lines = breakTokensToLines(tokens, 10, measure);

      expect(lines.length).toBeGreaterThan(0);
      expect(lines.flatMap(l => l.tokens).map(t => t.text).join('')).toBe(text);

      // No empty lines; and lines are trimmed by the breaker.
      for (const line of lines) {
        expect(line.tokens.length).toBeGreaterThan(0);
        expect(line.tokens[0].kind).not.toBe('space');
        expect(line.tokens[line.tokens.length - 1].kind).not.toBe('space');
      }
    }
  });

  it('does not hang when a single CJK character is wider than maxWidth', () => {
    const text = '測試中文換行';
    const tokens = tokenizeRuns([mkRun(text)]);

    const measure = createMeasure(10);
    const lines = breakTokensToLines(tokens, 1, measure);

    const chars = Array.from(text);
    expect(lines).toHaveLength(chars.length);
    expect(lines.map(l => l.tokens.map(t => t.text).join(''))).toEqual(chars);
  });

  it('handles mixed CJK + emoji + punctuation without crashing (various scales)', () => {
    const text = '中文👩‍💻測試，OK!再來一段中文';
    const tokens = tokenizeRuns([mkRun(text)]);

    for (const scale of [0.5, 1, 2]) {
      const measure = createMeasure(scale);
      const lines = breakTokensToLines(tokens, 8, measure);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.flatMap(l => l.tokens).map(t => t.text).join('')).toBe(text);
    }
  });
});

