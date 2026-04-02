import { describe, expect, it } from 'vitest';
import { pickPdfFontFamily, determinePdfFontStyle } from './fonts';

describe('pickPdfFontFamily', () => {
  it('returns helvetica for null/undefined', () => {
    expect(pickPdfFontFamily(null)).toBe('helvetica');
    expect(pickPdfFontFamily(undefined)).toBe('helvetica');
    expect(pickPdfFontFamily('')).toBe('helvetica');
  });

  it('maps CJK font families', () => {
    expect(pickPdfFontFamily('NotoSansSC, sans-serif')).toBe('NotoSansSC');
    expect(pickPdfFontFamily('NotoSansJP')).toBe('NotoSansJP');
    expect(pickPdfFontFamily('NotoSansTC')).toBe('NotoSansTC');
    expect(pickPdfFontFamily('NotoSansKR')).toBe('NotoSansKR');
  });

  it('maps Calibri to Carlito', () => {
    expect(pickPdfFontFamily('Calibri, sans-serif')).toBe('Carlito');
    expect(pickPdfFontFamily('calibri')).toBe('Carlito');
  });

  it('maps Arial/Helvetica families to LiberationSans', () => {
    expect(pickPdfFontFamily('Arial, sans-serif')).toBe('LiberationSans');
    expect(pickPdfFontFamily('Helvetica Neue')).toBe('LiberationSans');
    expect(pickPdfFontFamily('Liberation Sans')).toBe('LiberationSans');
  });

  it('maps serif fonts to times', () => {
    expect(pickPdfFontFamily('Times New Roman, serif')).toBe('times');
    expect(pickPdfFontFamily('Georgia, serif')).toBe('times');
  });

  it('maps monospace fonts to courier', () => {
    expect(pickPdfFontFamily('Courier New, monospace')).toBe('courier');
    expect(pickPdfFontFamily('Monaco, mono')).toBe('courier');
  });

  it('defaults to helvetica for unknown fonts', () => {
    expect(pickPdfFontFamily('Roboto')).toBe('helvetica');
    expect(pickPdfFontFamily('Open Sans')).toBe('helvetica');
  });

  it('does not confuse sans-serif with serif', () => {
    expect(pickPdfFontFamily('sans-serif')).toBe('helvetica');
    expect(pickPdfFontFamily('Georgia, serif')).toBe('times');
  });
});

describe('determinePdfFontStyle', () => {
  it('returns normal for default values', () => {
    expect(determinePdfFontStyle('normal', 'normal')).toBe('normal');
    expect(determinePdfFontStyle('normal', '400')).toBe('normal');
  });

  it('returns bold for bold weight', () => {
    expect(determinePdfFontStyle('normal', 'bold')).toBe('bold');
    expect(determinePdfFontStyle('normal', '700')).toBe('bold');
    expect(determinePdfFontStyle('normal', '800')).toBe('bold');
  });

  it('returns italic for italic style', () => {
    expect(determinePdfFontStyle('italic', 'normal')).toBe('italic');
    expect(determinePdfFontStyle('oblique', '400')).toBe('italic');
  });

  it('returns bolditalic for both', () => {
    expect(determinePdfFontStyle('italic', 'bold')).toBe('bolditalic');
    expect(determinePdfFontStyle('oblique', '700')).toBe('bolditalic');
  });
});
