import { describe, expect, it } from 'vitest';
import { computeAlphabeticBaselineOffsetPx } from './textBaseline';

const mockStyle = (fontSize: string = '16px', fontFamily: string = 'Arial') => ({
  fontSize,
  fontFamily,
  fontWeight: 'normal',
  fontStyle: 'normal',
  fontVariant: 'normal',
  lineHeight: 'normal',
} as unknown as CSSStyleDeclaration);

describe('computeAlphabeticBaselineOffsetPx', () => {
  it('returns a positive value for standard font', () => {
    const offset = computeAlphabeticBaselineOffsetPx(mockStyle('16px'), 20);
    expect(offset).toBeGreaterThan(0);
  });

  it('returns larger offset for larger font sizes', () => {
    const small = computeAlphabeticBaselineOffsetPx(mockStyle('12px'), 16);
    const large = computeAlphabeticBaselineOffsetPx(mockStyle('24px'), 32);
    expect(large).toBeGreaterThan(small);
  });

  it('respects a taller line box for the same font size', () => {
    const compact = computeAlphabeticBaselineOffsetPx(mockStyle('16px'), 16);
    const relaxed = computeAlphabeticBaselineOffsetPx(mockStyle('16px'), 24);
    expect(relaxed).toBeGreaterThanOrEqual(compact);
  });

  it('caches results for identical inputs', () => {
    const style = mockStyle('14px');
    const first = computeAlphabeticBaselineOffsetPx(style, 18);
    const second = computeAlphabeticBaselineOffsetPx(style, 18);
    expect(first).toBe(second);
  });

  it('falls back to fontSize when lineBoxHeight is 0', () => {
    const offset = computeAlphabeticBaselineOffsetPx(mockStyle('16px'), 0);
    expect(offset).toBeGreaterThan(0);
  });

  it('handles negative lineBoxHeight gracefully', () => {
    const offset = computeAlphabeticBaselineOffsetPx(mockStyle('16px'), -5);
    expect(offset).toBeGreaterThan(0);
  });
});
