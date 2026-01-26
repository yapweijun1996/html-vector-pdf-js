import { TextRun, TextToken } from './types';

export const tokenizeRuns = (runs: TextRun[]): TextToken[] => {
  const tokens: TextToken[] = [];

  for (const run of runs) {
    // Keep explicit newlines as hard breaks.
    if (run.text.includes('\n')) {
      const parts = run.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part) {
          const split = part.split(/(\s+)/).filter(t => t.length > 0);
          for (const s of split) {
            tokens.push({ text: s, style: run.style, kind: /^\s+$/.test(s) ? 'space' : 'word' });
          }
        }
        if (i < parts.length - 1) {
          tokens.push({ text: '\n', style: run.style, kind: 'word' });
        }
      }
      continue;
    }

    const split = run.text.split(/(\s+)/).filter(t => t.length > 0);
    for (const s of split) {
      tokens.push({ text: s, style: run.style, kind: /^\s+$/.test(s) ? 'space' : 'word' });
    }
  }

  return tokens;
};

