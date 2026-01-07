import { parsePx } from '../pdfUnits';
import { buildTextStyleKey, parseLineHeightPx, pickTextAlign } from '../textLayout';
import { computeAlphabeticBaselineOffsetPx } from '../textBaseline';
import { DomParseContext } from './context';

export const parseTextNode = (ctx: DomParseContext, txt: Text, shouldExclude: (el: Element | null) => boolean): void => {
  const rawText = txt.textContent || '';
  if (!/\S/.test(rawText)) return;

  if (txt.parentElement && txt.parentElement.closest('canvas')) return;

  const parentElForWhitespace = txt.parentElement;
  const parentWhiteSpace = parentElForWhitespace ? (window.getComputedStyle(parentElForWhitespace).whiteSpace || '') : '';
  const ws = parentWhiteSpace.toLowerCase();
  const preservesBoundaryWhitespace = ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces';

  const hasMeaningfulSibling = (direction: 'prev' | 'next'): boolean => {
    let sib: Node | null = direction === 'prev' ? txt.previousSibling : txt.nextSibling;
    while (sib) {
      if (sib.nodeType === Node.ELEMENT_NODE) return true;
      if (sib.nodeType === Node.TEXT_NODE) {
        const t = (sib.textContent || '').replace(/\u00a0/g, ' ');
        if (/\S/.test(t)) return true;
      }
      sib = direction === 'prev' ? sib.previousSibling : sib.nextSibling;
    }
    return false;
  };

  const startsWithSpace = /^[\s\u00a0]/.test(rawText);
  const endsWithSpace = /[\s\u00a0]$/.test(rawText);

  // 保留 NBSP（&nbsp;）作为“有意义的空白”，避免表头用 &nbsp; 做出的视觉对齐在 PDF 中消失。
  // 同时移除由 HTML 缩排/换行带来的普通空白，避免影响对齐计算。
  const collapseNonNbspWhitespace = (s: string): string => s.replace(/[ \t\r\n\f\v]+/g, ' ');
  const trimNonNbspWhitespace = (s: string): string => s.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');

  let str = trimNonNbspWhitespace(collapseNonNbspWhitespace(rawText));

  if (!preservesBoundaryWhitespace) {
    if (startsWithSpace && hasMeaningfulSibling('prev')) str = ` ${str}`;
    if (endsWithSpace && hasMeaningfulSibling('next')) str = `${str} `;
  } else {
    if (startsWithSpace) str = ` ${str}`;
    if (endsWithSpace) str = `${str} `;
  }

  if (!str || !txt.parentElement) return;
  if (shouldExclude(txt.parentElement)) return;

  const parentEl = txt.parentElement;
  const fontStyle = window.getComputedStyle(parentEl);
  const layoutEl = (parentEl.closest('td,th') as HTMLElement | null) || parentEl;
  const layoutStyle = window.getComputedStyle(layoutEl);
  const layoutRect = layoutEl.getBoundingClientRect();

  const paddingLeftPx = parsePx(layoutStyle.paddingLeft);
  const paddingRightPx = parsePx(layoutStyle.paddingRight);
  const contentLeftPx = layoutRect.left + paddingLeftPx;
  const contentRightPx = layoutRect.right - paddingRightPx;
  const contentWidthPx = Math.max(0, contentRightPx - contentLeftPx);

  const textAlign = pickTextAlign(layoutEl, layoutStyle.textAlign || '');
  const whiteSpace = (layoutStyle.whiteSpace || '').toLowerCase();
  const cssNoWrap = whiteSpace.includes('nowrap');

  const range = document.createRange();
  range.selectNodeContents(txt);
  const rects = range.getClientRects();
  const firstRect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  const rectsLen = rects.length > 0 ? rects.length : firstRect.width > 0 && firstRect.height > 0 ? 1 : 0;
  const browserWrapped = rectsLen > 1;
  const noWrap = cssNoWrap || !browserWrapped;

  if (!(layoutRect.width > 0 && layoutStyle.display !== 'none' && firstRect.width > 0 && firstRect.height > 0)) return;

  const fontSizePx = parseFloat(fontStyle.fontSize);
  const lineHeightPx = parseLineHeightPx(layoutStyle.lineHeight, fontSizePx);
  const lineHeightMm = ctx.px2mm(lineHeightPx) * ctx.cfg.text.scale;

  const y = ctx.px2mm(firstRect.top - ctx.rootRect.top);
  const h = ctx.px2mm(firstRect.height);
  const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(fontStyle, firstRect.height);
  const baselineOffset = ctx.px2mm(baselineOffsetPx) * ctx.cfg.text.scale;

  const xLeftMm = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
  const xRightMm = ctx.cfg.margins.left + ctx.px2mm(contentRightPx - ctx.rootRect.left);
  const xMmCellAligned = textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
  const xMmActual = ctx.cfg.margins.left + ctx.px2mm(firstRect.left - ctx.rootRect.left);

  const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';
  const yBucketPx = Math.round(firstRect.top / 2) * 2;
  const hasMixedTextStyles = inTableCell ? ctx.cellHasMixedTextStyles(layoutEl) : false;

  const canAggregate =
    inTableCell &&
    rectsLen === 1 &&
    !hasMixedTextStyles &&
    buildTextStyleKey(fontStyle) === buildTextStyleKey(window.getComputedStyle(layoutEl));

  if (canAggregate) {
    const layoutId = ctx.getLayoutId(layoutEl);
    const styleKey = buildTextStyleKey(fontStyle);
    const key = `${layoutId}|${styleKey}|${yBucketPx}|${textAlign}`;

    const existing = ctx.aggregatedTextByKey.get(key);
    if (existing) {
      existing.text = `${existing.text ?? ''}${str}`;
      existing.cssNoWrap = (existing.cssNoWrap ?? false) || cssNoWrap;
      existing.rectsLen = Math.max(existing.rectsLen ?? 0, rectsLen);
      existing.noWrap = (existing.noWrap ?? true) && noWrap;
    } else {
      ctx.aggregatedTextByKey.set(key, {
        type: 'text',
        x: xMmCellAligned,
        y: y + baselineOffset,
        w: ctx.px2mm(layoutRect.width),
        h,
        style: fontStyle,
        text: str,
        textAlign,
        maxWidthMm: ctx.px2mm(contentWidthPx),
        lineHeightMm,
        noWrap,
        cssNoWrap,
        rectsLen,
        zIndex: 20
      });
    }
    return;
  }

  if (inTableCell) {
    ctx.items.push({
      type: 'text',
      x: xMmActual,
      y: y + baselineOffset,
      w: ctx.px2mm(firstRect.width),
      h,
      style: fontStyle,
      text: str,
      textAlign: 'left',
      maxWidthMm: ctx.px2mm(contentWidthPx),
      lineHeightMm,
      noWrap,
      cssNoWrap,
      rectsLen,
      contentLeftMm: xLeftMm,
      contentRightMm: xRightMm,
      zIndex: 20
    });
    return;
  }

  // 无法聚合的情况（块内混合样式、多行文本等）
  // 使用实际坐标，让 jsPDF 根据 maxWidthMm 自动处理换行
  ctx.items.push({
    type: 'text',
    x: xMmActual,
    y: y + baselineOffset,
    w: ctx.px2mm(firstRect.width),
    h,
    style: fontStyle,
    text: str,
    textAlign: 'left',
    maxWidthMm: ctx.px2mm(contentWidthPx - (firstRect.left - contentLeftPx)),
    lineHeightMm,
    noWrap: !browserWrapped,
    cssNoWrap,
    rectsLen,
    zIndex: 20
  });
};

