import { PdfConfig } from './pdfConfig';
import { parseColor, isTransparent } from './colors';
import { parsePx } from './pdfUnits';
import { buildTextStyleKey, parseLineHeightPx, pickTextAlign } from './textLayout';
import { computeAlphabeticBaselineOffsetPx } from './textBaseline';
import { RenderItem } from './renderItems';
import { isSvgImage, svgToDataUrl } from './svgImage';

type ParsedElement = { items: RenderItem[]; pageBreakBeforeYs: number[] };

export const parseElementToItems = async (
  element: HTMLElement,
  cfg: Required<PdfConfig>,
  px2mm: (px: number) => number
): Promise<ParsedElement> => {
  const rootRect = element.getBoundingClientRect();
  const items: RenderItem[] = [];
  const imagePromises: Promise<void>[] = [];
  const pageBreakBeforeYs: number[] = [];

  const layoutIdByElement = new WeakMap<Element, number>();
  let nextLayoutId = 1;
  let nextInlineOrder = 1;
  const getLayoutId = (el: Element): number => {
    const existing = layoutIdByElement.get(el);
    if (existing) return existing;
    const id = nextLayoutId++;
    layoutIdByElement.set(el, id);
    return id;
  };

  const aggregatedTextByKey = new Map<string, RenderItem>();
  const hasMixedTextStylesByCell = new WeakMap<Element, boolean>();
  const cellHasMixedTextStyles = (cell: Element): boolean => {
    const cached = hasMixedTextStylesByCell.get(cell);
    if (typeof cached === 'boolean') return cached;

    const cellStyleKey = buildTextStyleKey(window.getComputedStyle(cell as HTMLElement));
    const textWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    let n = textWalker.nextNode();
    while (n) {
      const t = n as Text;
      if (/\S/.test(t.textContent || '') && t.parentElement) {
        const key = buildTextStyleKey(window.getComputedStyle(t.parentElement));
        if (key !== cellStyleKey) {
          hasMixedTextStylesByCell.set(cell, true);
          return true;
        }
      }
      n = textWalker.nextNode();
    }

    hasMixedTextStylesByCell.set(cell, false);
    return false;
  };

  const shouldExclude = (el: Element | null): boolean => {
    if (!el) return false;
    for (const sel of cfg.excludeSelectors) {
      try {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }
    return false;
  };

  const isPageBreakBefore = (el: Element): boolean => {
    const selectors = cfg.pagination.pageBreakBeforeSelectors || [];
    for (const sel of selectors) {
      try {
        if (el.matches(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }
    return false;
  };

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (isPageBreakBefore(el)) {
        const rect = el.getBoundingClientRect();
        if (rect.height >= 0) {
          const y = px2mm(rect.top - rootRect.top);
          if (y > 0) pageBreakBeforeYs.push(y);
        }
        node = walker.nextNode();
        continue;
      }

      if (shouldExclude(el)) {
        node = walker.nextNode();
        continue;
      }

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      if (style.display !== 'none' && style.opacity !== '0' && rect.width > 0 && rect.height > 0) {
        const x = cfg.margins.left + px2mm(rect.left - rootRect.left);
        const y = px2mm(rect.top - rootRect.top);
        const w = px2mm(rect.width);
        const h = px2mm(rect.height);

        if (cfg.debugOverlay.enabled && (el.tagName === 'TD' || el.tagName === 'TH')) {
          const paddingL = parsePx(style.paddingLeft);
          const paddingR = parsePx(style.paddingRight);
          const paddingT = parsePx(style.paddingTop);
          const paddingB = parsePx(style.paddingBottom);

          const contentLeftPx = rect.left + paddingL;
          const contentRightPx = rect.right - paddingR;
          const contentTopPx = rect.top + paddingT;
          const contentBottomPx = rect.bottom - paddingB;

          const contentX = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
          const contentY = px2mm(contentTopPx - rootRect.top);
          const contentW = px2mm(Math.max(0, contentRightPx - contentLeftPx));
          const contentH = px2mm(Math.max(0, contentBottomPx - contentTopPx));

          items.push({
            type: 'debugRect',
            x: contentX,
            y: contentY,
            w: contentW,
            h: contentH,
            style,
            zIndex: 12
          });
        }

        if (!isTransparent(style.backgroundColor)) {
          items.push({ type: 'background', x, y, w, h, style, zIndex: 0 });
        }

        const bt = parseFloat(style.borderTopWidth);
        const br = parseFloat(style.borderRightWidth);
        const bb = parseFloat(style.borderBottomWidth);
        const bl = parseFloat(style.borderLeftWidth);

        if (bt > 0 || br > 0 || bb > 0 || bl > 0) {
          const borderColors = {
            t: parseColor(style.borderTopColor),
            r: parseColor(style.borderRightColor),
            b: parseColor(style.borderBottomColor),
            l: parseColor(style.borderLeftColor)
          };

          items.push({
            type: 'border',
            x,
            y,
            w,
            h,
            style,
            zIndex: 10,
            borderSides: { t: bt, r: br, b: bb, l: bl },
            borderColors
          });
        }

        if (el.tagName === 'IMG') {
          const imgEl = el as HTMLImageElement;
          const imgSrc = imgEl.src;

          const imgItem: RenderItem = {
            type: 'image',
            x,
            y,
            w,
            h,
            style,
            imageSrc: imgSrc,
            imageFormat: 'PNG',
            zIndex: 5
          };

          if (isSvgImage(imgSrc)) {
            const promise = svgToDataUrl(imgSrc, rect.width, rect.height)
              .then((dataUrl) => {
                imgItem.imageSrc = dataUrl;
                imgItem.imageFormat = 'PNG';
              })
              .catch((err) => {
                if (cfg.debug) console.warn('[html_to_vector_pdf] SVG conversion failed:', err);
              });
            imagePromises.push(promise);
          }

          items.push(imgItem);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const txt = node as Text;
      const rawText = txt.textContent || '';
      if (!/\S/.test(rawText)) {
        node = walker.nextNode();
        continue;
      }

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

      // 重要：保留 NBSP（&nbsp;）作为“有意义的空白”，避免表头用 &nbsp; 做出的视觉对齐在 PDF 中消失。
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

      if (str && txt.parentElement) {
        if (shouldExclude(txt.parentElement)) {
          node = walker.nextNode();
          continue;
        }

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
        const rectsLen = rects.length > 0 ? rects.length : (firstRect.width > 0 && firstRect.height > 0 ? 1 : 0);
        const browserWrapped = rectsLen > 1;
        const noWrap = cssNoWrap || !browserWrapped;

        if (layoutRect.width > 0 && layoutStyle.display !== 'none' && firstRect.width > 0 && firstRect.height > 0) {
          // 在块的开头定义所有共享变量
          const fontSizePx = parseFloat(fontStyle.fontSize);
          const lineHeightPx = parseLineHeightPx(layoutStyle.lineHeight, fontSizePx);
          const lineHeightMm = px2mm(lineHeightPx) * cfg.text.scale;

          const y = px2mm(firstRect.top - rootRect.top);
          const h = px2mm(firstRect.height);
          const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(fontStyle, firstRect.height);
          const baselineOffset = px2mm(baselineOffsetPx) * cfg.text.scale;

          const xLeftMm = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
          const xRightMm = cfg.margins.left + px2mm(contentRightPx - rootRect.left);
          const xMmCellAligned =
            textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
          const xMmActual = cfg.margins.left + px2mm(firstRect.left - rootRect.left);

          const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';
          const yBucketPx = Math.round(firstRect.top / 2) * 2;
          const hasMixedTextStyles = inTableCell ? cellHasMixedTextStyles(layoutEl) : false;

          const canAggregate =
            inTableCell &&
            rectsLen === 1 &&
            !hasMixedTextStyles &&
            buildTextStyleKey(fontStyle) === buildTextStyleKey(window.getComputedStyle(layoutEl));

          if (canAggregate) {
            const layoutId = getLayoutId(layoutEl);
            const styleKey = buildTextStyleKey(fontStyle);
            const key = `${layoutId}|${styleKey}|${yBucketPx}|${textAlign}`;

            const existing = aggregatedTextByKey.get(key);
            if (existing) {
              existing.text = `${existing.text ?? ''}${str}`;
              existing.cssNoWrap = (existing.cssNoWrap ?? false) || cssNoWrap;
              existing.rectsLen = Math.max(existing.rectsLen ?? 0, rectsLen);
              existing.noWrap = (existing.noWrap ?? true) && noWrap;
            } else {
              aggregatedTextByKey.set(key, {
                type: 'text',
                x: xMmCellAligned,
                y: y + baselineOffset,
                w: px2mm(layoutRect.width),
                h,
                style: fontStyle,
                text: str,
                textAlign,
                maxWidthMm: px2mm(contentWidthPx),
                lineHeightMm,
                noWrap,
                cssNoWrap,
                rectsLen,
                zIndex: 20
              });
            }
          } else {
            if (inTableCell) {
              items.push({
                type: 'text',
                x: xMmActual,
                y: y + baselineOffset,
                w: px2mm(firstRect.width),
                h,
                style: fontStyle,
                text: str,
                textAlign: 'left',
                maxWidthMm: px2mm(contentWidthPx),
                lineHeightMm,
                noWrap,
                cssNoWrap,
                rectsLen,
                // Avoid grouping mixed styles - use actual browser positions
                // inlineGroupId: `cell:${getLayoutId(layoutEl)}|y:${yBucketPx}|align:${textAlign}`,
                // inlineOrder: nextInlineOrder++,
                contentLeftMm: xLeftMm,
                contentRightMm: xRightMm,
                zIndex: 20
              });
            } else {
              // 无法聚合的情况（块内混合样式、多行文本等）
              // 使用实际坐标，让 jsPDF 根据 maxWidthMm 自动处理换行
              items.push({
                type: 'text',
                x: xMmActual,
                y: y + baselineOffset,
                w: px2mm(firstRect.width),
                h,
                style: fontStyle,
                text: str,
                textAlign: 'left',
                maxWidthMm: px2mm(contentWidthPx - (firstRect.left - contentLeftPx)),
                lineHeightMm,
                noWrap: !browserWrapped,
                cssNoWrap,
                rectsLen,
                zIndex: 20
              });
            }
          }
        }
      }
    }
    node = walker.nextNode();
  }

  if (aggregatedTextByKey.size > 0) {
    for (const item of aggregatedTextByKey.values()) items.push(item);
  }

  await Promise.all(imagePromises);
  return { items, pageBreakBeforeYs };
};
