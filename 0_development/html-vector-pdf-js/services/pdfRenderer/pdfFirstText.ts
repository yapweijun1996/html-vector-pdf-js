import jsPDF from 'jspdf';
import { PdfConfig } from '../pdfConfig';
import { RenderItem, TextAlign } from '../renderItems';
import { applyTextStyle } from './fonts';
import { buildInlineRuns } from '../textEngine/runBuilder';
import { tokenizeRuns } from '../textEngine/tokenizer';
import { breakTokensToLines } from '../textEngine/lineBreaker';
import { buildTextStyleKey } from '../textLayout';

export const expandPdfFirstTextBlocks = (
  doc: jsPDF,
  items: RenderItem[],
  cfg: Required<PdfConfig>
): RenderItem[] => {
  if ((cfg.textEngine?.mode || 'legacy') === 'legacy') return items;

  const out: RenderItem[] = [];
  // Measurement cache: styleKey|text → width in mm
  const widthCache = new Map<string, number>();

  for (const item of items) {
    if (item.type !== 'textBlock' || !item.element) {
      out.push(item);
      continue;
    }

    const el = item.element;
    const runs = buildInlineRuns(el);
    const tokens = tokenizeRuns(runs);

    const measure = (text: string, tokenStyle: CSSStyleDeclaration): number => {
      const cacheKey = `${buildTextStyleKey(tokenStyle)}|${text}`;
      const cached = widthCache.get(cacheKey);
      if (cached !== undefined) return cached;

      applyTextStyle(doc, tokenStyle, cfg.text.scale, text, cfg.debug);
      const w = doc.getTextWidth(text);
      widthCache.set(cacheKey, w);
      return w;
    };

    const lines = breakTokensToLines(tokens, item.w, measure);
    const lineHeightMm = item.lineHeightMm ?? item.h;
    const align: TextAlign = item.textAlign || 'left';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const baselineY = item.y + lineIdx * lineHeightMm;

      // Calculate total line width for center/right alignment
      let lineWidth = 0;
      for (const t of line.tokens) {
        if (t.kind === 'space') {
          lineWidth += measure(' ', t.style);
        } else {
          lineWidth += measure(t.text, t.style);
        }
      }

      // Determine starting X based on alignment
      let cursorX: number;
      if (align === 'right') {
        cursorX = item.x - lineWidth;
      } else if (align === 'center') {
        cursorX = item.x - lineWidth / 2;
      } else {
        cursorX = item.x;
      }

      for (const t of line.tokens) {
        if (t.kind === 'space') {
          cursorX += measure(' ', t.style);
          continue;
        }

        const text = t.text;
        applyTextStyle(doc, t.style, cfg.text.scale, text, cfg.debug);
        const w = doc.getTextWidth(text);

        out.push({
          type: 'text',
          x: cursorX,
          y: baselineY,
          w,
          h: lineHeightMm,
          style: t.style,
          text,
          textWidthMm: w,
          computedX: cursorX,
          textAlign: 'left',
          noWrap: true,
          cssNoWrap: true,
          maxWidthMm: w,
          lineHeightMm,
          zIndex: item.zIndex
        });

        cursorX += w;
      }
    }
  }

  return out;
};
