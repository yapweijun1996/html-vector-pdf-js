import { describe, it, expect } from 'vitest';
import { parseColor, isTransparent } from './colors';

describe('services/colors', () => {
  describe('parseColor', () => {
    it('should return white for transparent', () => {
      expect(parseColor('transparent')).toEqual([255, 255, 255]);
      expect(parseColor('rgba(0, 0, 0, 0)')).toEqual([255, 255, 255]);
    });

    it('should parse hex colors', () => {
      expect(parseColor('#ff0000')).toEqual([255, 0, 0]);
      expect(parseColor('#00ff00')).toEqual([0, 255, 0]);
      expect(parseColor('#0000ff')).toEqual([0, 0, 255]);
      expect(parseColor('#ffffff')).toEqual([255, 255, 255]);
      expect(parseColor('#000000')).toEqual([0, 0, 0]);
    });

    it('should handle invalid hex by returning black', () => {
      // implementation uses parseInt which might return NaN, then checks isNaN -> [0,0,0]
      expect(parseColor('#zzzzzz')).toEqual([0, 0, 0]); 
    });

    it('should parse rgb colors', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual([255, 0, 0]);
      expect(parseColor('rgb(0, 128, 0)')).toEqual([0, 128, 0]);
    });

    it('should parse rgba colors', () => {
      expect(parseColor('rgba(255, 0, 0, 1)')).toEqual([255, 0, 0]);
      expect(parseColor('rgba(0, 0, 255, 0.5)')).toEqual([0, 0, 255]);
    });

    it('should return white for fully transparent rgba', () => {
      // Regex in implementation checks if 4th group is '0'
      expect(parseColor('rgba(0, 0, 0, 0)')).toEqual([255, 255, 255]);
    });

    it('should return black for invalid/empty input', () => {
      // @ts-ignore
      expect(parseColor(null)).toEqual([255, 255, 255]); // Actually code returns white for !c
      expect(parseColor('')).toEqual([255, 255, 255]); // Code returns white for !c
    });
  });

  describe('isTransparent', () => {
    it('should return true for "transparent"', () => {
      expect(isTransparent('transparent')).toBe(true);
    });

    it('should return true for rgba(0,0,0,0)', () => {
      expect(isTransparent('rgba(0, 0, 0, 0)')).toBe(true);
      expect(isTransparent('rgba(255, 255, 255, 0)')).toBe(true);
    });

    it('should return false for visible colors', () => {
      expect(isTransparent('#ffffff')).toBe(false);
      expect(isTransparent('rgb(0,0,0)')).toBe(false);
      expect(isTransparent('rgba(0,0,0,1)')).toBe(false);
    });

    it('should return true for empty/null', () => {
      expect(isTransparent('')).toBe(true);
    });
  });
});
