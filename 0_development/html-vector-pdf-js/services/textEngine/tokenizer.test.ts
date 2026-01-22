import { describe, it, expect } from 'vitest';
import { tokenizeRuns } from './tokenizer';
import { TextRun } from './types';

// Mock TextRun style type since we don't need full object for tokenizer
const mockStyle: any = { fontSize: 12 };

describe('services/textEngine/tokenizer', () => {
  it('should split basic spaces', () => {
    const input: TextRun[] = [{ text: 'Hello World', style: mockStyle }];
    const tokens = tokenizeRuns(input);
    
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ text: 'Hello', style: mockStyle, kind: 'word' });
    expect(tokens[1]).toEqual({ text: ' ', style: mockStyle, kind: 'space' });
    expect(tokens[2]).toEqual({ text: 'World', style: mockStyle, kind: 'word' });
  });

  it('should handle multiple spaces', () => {
    const input: TextRun[] = [{ text: 'Hello   World', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ text: 'Hello', style: mockStyle, kind: 'word' });
    // The regex split(/(\s+)/) keeps the delimiter. If it's multiple spaces, they stay together.
    expect(tokens[1]).toEqual({ text: '   ', style: mockStyle, kind: 'space' });
    expect(tokens[2]).toEqual({ text: 'World', style: mockStyle, kind: 'word' });
  });

  it('should handle leading and trailing spaces', () => {
    const input: TextRun[] = [{ text: ' Hello ', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ text: ' ', style: mockStyle, kind: 'space' });
    expect(tokens[1]).toEqual({ text: 'Hello', style: mockStyle, kind: 'word' });
    expect(tokens[2]).toEqual({ text: ' ', style: mockStyle, kind: 'space' });
  });

  it('should handle newlines as hard breaks', () => {
    const input: TextRun[] = [{ text: 'Line1\nLine2', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    // Implementation:
    // parts = ['Line1', 'Line2']
    // loop i=0: process 'Line1' -> push token
    // i < length-1: push '\n' token
    // loop i=1: process 'Line2' -> push token

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ text: 'Line1', style: mockStyle, kind: 'word' });
    expect(tokens[1]).toEqual({ text: '\n', style: mockStyle, kind: 'word' });
    expect(tokens[2]).toEqual({ text: 'Line2', style: mockStyle, kind: 'word' });
  });

  it('should handle multiple newlines', () => {
    const input: TextRun[] = [{ text: 'A\n\nB', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    // parts = ['A', '', 'B']
    // i=0: A -> push A. Add \n
    // i=1: '' -> (empty, skips split loop). Add \n
    // i=2: B -> push B.

    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toEqual({ text: 'A', style: mockStyle, kind: 'word' });
    expect(tokens[1]).toEqual({ text: '\n', style: mockStyle, kind: 'word' });
    expect(tokens[2]).toEqual({ text: '\n', style: mockStyle, kind: 'word' });
    expect(tokens[3]).toEqual({ text: 'B', style: mockStyle, kind: 'word' });
  });

  it('should NOT split CJK characters (confirming issue)', () => {
    // Current logic uses split(/(\s+)/). CJK chars have no spaces.
    const input: TextRun[] = [{ text: '你好世界', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ text: '你好世界', style: mockStyle, kind: 'word' });
  });

  it('should handle CJK mixed with spaces', () => {
    const input: TextRun[] = [{ text: '你好 世界', style: mockStyle }];
    const tokens = tokenizeRuns(input);

    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ text: '你好', style: mockStyle, kind: 'word' });
    expect(tokens[1]).toEqual({ text: ' ', style: mockStyle, kind: 'space' });
    expect(tokens[2]).toEqual({ text: '世界', style: mockStyle, kind: 'word' });
  });
});
