import { TextRun } from './types';

const normalizeTextNode = (raw: string): string => {
  if (!raw) return '';
  const hasLeading = /^[\s\u00a0]/.test(raw);
  const hasTrailing = /[\s\u00a0]$/.test(raw);
  let s = raw
    .replace(/\u00a0/g, ' ')
    // Normalize common "black circle" placeholder to a safer bullet.
    // This avoids font/style fallback differences between browser and jsPDF for U+25CF in bold runs.
    .replace(/\u25CF/g, '\u2022')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (hasLeading) s = ` ${s}`;
  if (hasTrailing) s = `${s} `;
  return s;
};

const canIgnoreElement = (el: HTMLElement): boolean => {
  const tag = el.tagName.toUpperCase();
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME';
};

const isLineBreakElement = (el: HTMLElement): boolean => el.tagName.toUpperCase() === 'BR';

export const buildInlineRuns = (container: HTMLElement): TextRun[] => {
  const runs: TextRun[] = [];

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  const push = (text: string, style: CSSStyleDeclaration) => {
    if (!text) return;
    const prev = runs[runs.length - 1];
    if (prev && prev.style === style) {
      prev.text += text;
      return;
    }
    runs.push({ text, style });
  };

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (canIgnoreElement(el)) {
        node = walker.nextNode();
        continue;
      }
      if (isLineBreakElement(el)) {
        const style = window.getComputedStyle(el.parentElement || container);
        push('\n', style);
      }
      node = walker.nextNode();
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node as Text;
      const parent = txt.parentElement;
      if (parent && canIgnoreElement(parent)) {
        node = walker.nextNode();
        continue;
      }
      const raw = txt.textContent || '';
      const normalized = normalizeTextNode(raw);
      if (normalized) {
        const style = window.getComputedStyle(parent || container);
        push(normalized, style);
      }
      node = walker.nextNode();
      continue;
    }

    node = walker.nextNode();
  }

  // Collapse multiple spaces across run boundaries.
  for (let i = 1; i < runs.length; i++) {
    const prev = runs[i - 1];
    const curr = runs[i];
    if (prev.text.endsWith(' ') && curr.text.startsWith(' ')) {
      curr.text = curr.text.slice(1);
    }
  }

  return runs.filter(r => r.text.length > 0);
};
