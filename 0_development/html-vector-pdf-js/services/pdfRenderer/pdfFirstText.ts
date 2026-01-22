import jsPDF from 'jspdf';
import { PdfConfig } from '../pdfConfig';
import { RenderItem } from '../renderItems';
import { applyTextStyle } from './fonts';
import { buildInlineRuns } from '../textEngine/runBuilder';
import { tokenizeRuns } from '../textEngine/tokenizer';
import { breakTokensToLines } from '../textEngine/lineBreaker';

export const expandPdfFirstTextBlocks = (
  doc: jsPDF,
  items: RenderItem[],
  cfg: Required<PdfConfig>
): RenderItem[] => {
  if ((cfg.textEngine?.mode || 'legacy') === 'legacy') return items;

  const out: RenderItem[] = [];

  for (const item of items) {
    if (item.type !== 'textBlock' || !item.element) {
      out.push(item);
      continue;
    }

    const el = item.element;
    const runs = buildInlineRuns(el);
    const tokens = tokenizeRuns(runs);

    const measure = (text: string, tokenStyle: CSSStyleDeclaration): number => {
      applyTextStyle(doc, tokenStyle, cfg.text.scale, text);
      return doc.getTextWidth(text);
    };

    const lines = breakTokensToLines(tokens, item.w, measure);
    const lineHeightMm = item.lineHeightMm ?? item.h;

    const lineWidthMm = (line: (typeof lines)[number]): number => {
      let w = 0;
      for (const t of line.tokens) {
        if (t.kind === 'space') w += measure(' ', t.style);
        else w += measure(t.text, t.style);
      }
      return w;
    };

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const baselineY = item.y + lineIdx * lineHeightMm;

      const wLine = lineWidthMm(line);
      const left = item.contentLeftMm ?? item.x;
      const right = item.contentRightMm ?? (left + item.w);
      const align = item.textAlign || 'left';

      let cursorX = left;
      if (align === 'right') cursorX = right - wLine;
      else if (align === 'center') cursorX = (left + right - wLine) / 2;

      for (const t of line.tokens) {
        if (t.kind === 'space') {
          cursorX += measure(' ', t.style);
          continue;
        }

        const text = t.text;
        applyTextStyle(doc, t.style, cfg.text.scale, text);
        const w = doc.getTextWidth(text);

        out.push({
          type: 'text',
          x: cursorX,
          y: baselineY,
          w,
          h: lineHeightMm,
          style: t.style,
          text,
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
