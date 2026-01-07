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
  const getLayoutId = (el: Element): number => {
    const existing = layoutIdByElement.get(el);
    if (existing) return existing;
    const id = nextLayoutId++;
    layoutIdByElement.set(el, id);
    return id;
  };

  const aggregatedTextByKey = new Map<string, RenderItem>();

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

      const startsWithSpace = /^\s/.test(rawText);
      const endsWithSpace = /\s$/.test(rawText);
      let str = rawText.replace(/\s+/g, ' ').trim();
      if (startsWithSpace) str = ` ${str}`;
      if (endsWithSpace) str = `${str} `;

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
          const y = px2mm(firstRect.top - rootRect.top);
          const h = px2mm(firstRect.height);
          const fontSizePx = parseFloat(fontStyle.fontSize);
          const baselineOffsetPx = computeAlphabeticBaselineOffsetPx(fontStyle, firstRect.height);
          const baselineOffset = px2mm(baselineOffsetPx) * cfg.text.scale;
          const lineHeightPx = parseLineHeightPx(layoutStyle.lineHeight, fontSizePx);
          const lineHeightMm = px2mm(lineHeightPx) * cfg.text.scale;

          const xLeftMm = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
          const xRightMm = cfg.margins.left + px2mm(contentRightPx - rootRect.left);
          const xMmCellAligned =
            textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
          const xMmActual = cfg.margins.left + px2mm(firstRect.left - rootRect.left);

          const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';
          const hasMixedStyles = inTableCell && layoutEl.querySelectorAll('b, strong, i, em, span').length > 0;
          const canAggregate =
            inTableCell &&
            !hasMixedStyles &&
            buildTextStyleKey(fontStyle) === buildTextStyleKey(window.getComputedStyle(layoutEl));

          if (canAggregate) {
            const layoutId = getLayoutId(layoutEl);
            const styleKey = buildTextStyleKey(fontStyle);
            const yBucketPx = Math.round(firstRect.top / 2) * 2;
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
              noWrap,
              cssNoWrap,
              rectsLen,
              zIndex: 20
            });
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

