import jsPDF from 'jspdf';
import { TextAlign } from './renderItems';
import { parsePx } from './pdfUnits';

export const parseLineHeightPx = (lineHeight: string, fontSizePx: number): number => {
  const lh = (lineHeight || '').trim().toLowerCase();
  if (!lh || lh === 'normal') return fontSizePx * 1.2;
  if (lh.endsWith('px')) return parsePx(lh);
  const num = parseFloat(lh);
  if (!Number.isFinite(num)) return fontSizePx * 1.2;
  return num * fontSizePx;
};

export const pickTextAlign = (el: Element, computedTextAlign: string): TextAlign => {
  const attr = (el.getAttribute('align') || '').toLowerCase();
  if (attr === 'right' || attr === 'center' || attr === 'left') return attr as TextAlign;
  const raw = (computedTextAlign || '').toLowerCase();
  if (raw === 'right' || raw === 'end') return 'right';
  if (raw === 'center') return 'center';
  return 'left';
};

export const wrapTextToWidth = (doc: jsPDF, text: string, maxWidthMm: number): string[] => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (maxWidthMm <= 0) return [cleaned];

  const tokens = cleaned.split(/(\s+|-)/).filter(t => t.length > 0);
  const lines: string[] = [];
  let line = '';

  const pushLine = () => {
    const out = line.trim();
    if (out) lines.push(out);
    line = '';
  };

  for (const token of tokens) {
    const candidate = line ? `${line}${token}` : token;
    const width = doc.getTextWidth(candidate);
    if (width <= maxWidthMm) {
      line = candidate;
      continue;
    }

    if (!line) {
      let chunk = '';
      for (const ch of token) {
        const next = chunk + ch;
        if (doc.getTextWidth(next) <= maxWidthMm) {
          chunk = next;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      if (chunk) lines.push(chunk);
      line = '';
      continue;
    }

    pushLine();
    line = token;
  }

  pushLine();
  return lines;
};

export const buildTextStyleKey = (style: CSSStyleDeclaration): string => {
  return [style.fontSize, style.fontWeight, style.fontStyle, style.color].join('|');
};

