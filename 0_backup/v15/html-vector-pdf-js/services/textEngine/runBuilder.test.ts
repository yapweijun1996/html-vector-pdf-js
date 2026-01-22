import { describe, expect, it } from 'vitest';
import { buildInlineRuns } from './runBuilder';

describe('buildInlineRuns', () => {
  it('keeps inline styles as separate runs and normalizes whitespace', () => {
    document.body.innerHTML = `
      <p id="p">Hello <strong>World</strong>  !</p>
    `;
    const p = document.getElementById('p') as HTMLElement;
    const runs = buildInlineRuns(p);
    expect(runs.map(r => r.text).join('')).toBe('Hello World !');
    expect(runs.length).toBeGreaterThanOrEqual(2);
  });

  it('treats <br> as hard break', () => {
    document.body.innerHTML = `
      <p id="p">A<br>B</p>
    `;
    const p = document.getElementById('p') as HTMLElement;
    const runs = buildInlineRuns(p);
    expect(runs.map(r => r.text).join('')).toContain('\n');
  });
});

