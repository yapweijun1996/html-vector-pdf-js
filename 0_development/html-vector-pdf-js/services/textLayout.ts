import jsPDF from 'jspdf';
import { TextAlign } from './renderItems';
import { parsePx } from './pdfUnits';

const NBSP = '\u00A0';

const collapseAsciiWhitespace = (s: string): string => s.replace(/[ \t\r\n\f\v]+/g, ' ');
const trimAsciiWhitespace = (s: string): string => s.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');
const rtrimAsciiWhitespace = (s: string): string => s.replace(/[ \t\r\n\f\v]+$/g, '');

// jsPDF (and some fonts) may not treat NBSP consistently. Convert NBSP to normal spaces
// at measurement / output time, but DO NOT collapse them (we use NBSP to preserve indentation).
const toPdfSpaces = (s: string): string => s.replaceAll(NBSP, ' ');

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
  // IMPORTANT:
  // - Preserve NBSP runs (often used as indentation in legacy templates).
  // - Only collapse/trim ASCII whitespace so we don't destroy NBSP-based spacers.
  const cleaned = trimAsciiWhitespace(collapseAsciiWhitespace(text));
  if (!cleaned || !/\S/.test(toPdfSpaces(cleaned))) return [];
  if (maxWidthMm <= 0) return [toPdfSpaces(cleaned)];

  // Keep NBSP runs as tokens so indentation survives wrapping.
  const tokens = cleaned.split(/([ \t\r\n\f\v\u00a0]+|-)/).filter(t => t.length > 0);
  const lines: string[] = [];
  let line = '';

  const pushLine = () => {
    const out = rtrimAsciiWhitespace(line);
    if (out) lines.push(toPdfSpaces(out));
    line = '';
  };

  for (const token of tokens) {
    const candidate = line ? `${line}${token}` : token;
    const width = doc.getTextWidth(toPdfSpaces(candidate));
    if (width <= maxWidthMm) {
      line = candidate;
      continue;
    }

    if (!line) {
      let chunk = '';
      for (const ch of token) {
        const next = chunk + ch;
        if (doc.getTextWidth(toPdfSpaces(next)) <= maxWidthMm) {
          chunk = next;
        } else {
          if (chunk) lines.push(toPdfSpaces(chunk));
          chunk = ch;
        }
      }
      if (chunk) lines.push(toPdfSpaces(chunk));
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

