import { parsePx } from '../pdfUnits';
import { computeAlphabeticBaselineOffsetPx } from '../textBaseline';
import { parseLineHeightPx } from '../textLayout';
import { DomParseContext } from './context';

export const maybeAddFormFieldValueText = (
  ctx: DomParseContext,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  rect: DOMRect
): void => {
  // Handle Form Inputs (INPUT, TEXTAREA, SELECT) - Legacy ERP Support
  const isSupportedInput =
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      (el as HTMLInputElement).type !== 'hidden' &&
      (el as HTMLInputElement).type !== 'checkbox' &&
      (el as HTMLInputElement).type !== 'radio' &&
      (el as HTMLInputElement).type !== 'file' &&
      (el as HTMLInputElement).type !== 'button' &&
      (el as HTMLInputElement).type !== 'submit');

  if (!isSupportedInput) return;

  let valueText = '';
  if (el.tagName === 'SELECT') {
    const selectEl = el as HTMLSelectElement;
    if (selectEl.selectedIndex >= 0) valueText = selectEl.options[selectEl.selectedIndex].text;
  } else {
    valueText = (el as HTMLInputElement | HTMLTextAreaElement).value;
  }
  if (!valueText || !/\S/.test(valueText)) return;

  const tt = (style.textTransform || 'none').toLowerCase();
  if (tt === 'uppercase') valueText = valueText.toUpperCase();
  else if (tt === 'lowercase') valueText = valueText.toLowerCase();
  else if (tt === 'capitalize') valueText = valueText.replace(/\b[a-z]/gi, (l) => l.toUpperCase());

  // Calculate text position similar to parseTextNode but using element bounds
  const paddingL = parsePx(style.paddingLeft);
  const paddingR = parsePx(style.paddingRight);
  const paddingT = parsePx(style.paddingTop);

  const contentLeftPx = rect.left + paddingL;
  const contentRightPx = rect.right - paddingR;
  const contentWidthPx = Math.max(0, contentRightPx - contentLeftPx);

  // Text alignment inside input
  const textAlign = style.textAlign || 'left';

  const fontSizePx = parseFloat(style.fontSize);
  const lineHeightPx = parseLineHeightPx(style.lineHeight, fontSizePx);
  const lineHeightMm = ctx.px2mm(lineHeightPx) * ctx.cfg.text.scale;

  // Vertical alignment approx (inputs usually center text vertically if single line)
  const contentHeightPx = rect.height - paddingT - parsePx(style.paddingBottom);
  let yOffsetPx = paddingT; // Default top aligned

  // Simple heuristic for vertical center in inputs
  if (el.tagName === 'INPUT' && contentHeightPx > fontSizePx) {
    yOffsetPx += (contentHeightPx - fontSizePx) / 2;
  }

  const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(style, fontSizePx); // approx using font size as height
  const baselineOffset = ctx.px2mm(baselineOffsetPx) * ctx.cfg.text.scale;

  const xLeftMm = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
  const xRightMm = ctx.cfg.margins.left + ctx.px2mm(contentRightPx - ctx.rootRect.left);
  const textX =
    textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
  const textY = ctx.px2mm(rect.top + yOffsetPx - ctx.rootRect.top) + baselineOffset;

  ctx.items.push({
    type: 'text',
    x: textX,
    y: textY,
    w: ctx.px2mm(contentWidthPx),
    h: ctx.px2mm(contentHeightPx),
    style,
    text: valueText,
    textAlign: textAlign as any,
    maxWidthMm: ctx.px2mm(contentWidthPx),
    lineHeightMm,
    noWrap: el.tagName !== 'TEXTAREA',
    zIndex: 20
  });
};

