import { describe, it, expect } from 'vitest';
import { processWhitespace, applyTextTransform } from './parseTextNodeUtils';

describe('parseTextNodeUtils', () => {
  describe('applyTextTransform', () => {
    it('should convert to uppercase', () => {
      const style = { textTransform: 'uppercase' } as CSSStyleDeclaration;
      expect(applyTextTransform('hello', style)).toBe('HELLO');
    });

    it('should convert to lowercase', () => {
      const style = { textTransform: 'lowercase' } as CSSStyleDeclaration;
      expect(applyTextTransform('HELLO', style)).toBe('hello');
    });

    it('should capitalize', () => {
      const style = { textTransform: 'capitalize' } as CSSStyleDeclaration;
      expect(applyTextTransform('hello world', style)).toBe('Hello World');
    });

    it('should handle none', () => {
      const style = { textTransform: 'none' } as CSSStyleDeclaration;
      expect(applyTextTransform('Hello', style)).toBe('Hello');
    });
  });

  describe('processWhitespace', () => {
    it('should return null for empty or whitespace-only strings', () => {
      const textNode = document.createTextNode('   ');
      expect(processWhitespace(textNode)).toBeNull();
    });
    
    // Note: Testing DOM traversal logic (hasMeaningfulSibling) inside processWhitespace 
    // requires more complex DOM setup with JSDOM which is implicitly available
    // but building the tree structure is needed.
  });
});
