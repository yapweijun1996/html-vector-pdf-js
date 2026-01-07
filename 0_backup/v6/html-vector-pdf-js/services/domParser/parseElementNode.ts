import { parseColor, isTransparent } from '../colors';
import { parsePx } from '../pdfUnits';
import { RenderItem } from '../renderItems';
import { isSvgImage, svgToDataUrl } from '../svgImage';
import { HtmlToVectorPdfError } from '../errors';
import { imageRasterizeError, rasterizeImageElementToPngDataUrl } from '../imageRaster';
import { DomParseContext } from './context';

export const parseElementNode = (
  ctx: DomParseContext,
  el: HTMLElement,
  imagePromises: Promise<void>[]
): void => {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  if (style.display === 'none' || style.opacity === '0' || rect.width <= 0 || rect.height <= 0) return;

  const x = ctx.cfg.margins.left + ctx.px2mm(rect.left - ctx.rootRect.left);
  const y = ctx.px2mm(rect.top - ctx.rootRect.top);
  const w = ctx.px2mm(rect.width);
  const h = ctx.px2mm(rect.height);

  if (ctx.cfg.debugOverlay.enabled && (el.tagName === 'TD' || el.tagName === 'TH')) {
    const paddingL = parsePx(style.paddingLeft);
    const paddingR = parsePx(style.paddingRight);
    const paddingT = parsePx(style.paddingTop);
    const paddingB = parsePx(style.paddingBottom);

    const contentLeftPx = rect.left + paddingL;
    const contentRightPx = rect.right - paddingR;
    const contentTopPx = rect.top + paddingT;
    const contentBottomPx = rect.bottom - paddingB;

    const contentX = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
    const contentY = ctx.px2mm(contentTopPx - ctx.rootRect.top);
    const contentW = ctx.px2mm(Math.max(0, contentRightPx - contentLeftPx));
    const contentH = ctx.px2mm(Math.max(0, contentBottomPx - contentTopPx));

    ctx.items.push({
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
    ctx.items.push({ type: 'background', x, y, w, h, style, zIndex: 0 });
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

    ctx.items.push({
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

  if (el.tagName === 'CANVAS') {
    try {
      const canvas = el as HTMLCanvasElement;
      // Use PNG format to preserve transparency
      const dataUrl = canvas.toDataURL('image/png');

      ctx.items.push({
        type: 'image',
        x,
        y,
        w,
        h,
        style,
        imageSrc: dataUrl,
        imageFormat: 'PNG',
        zIndex: 5
      });
    } catch (e) {
      // Canvas might be tainted (CORS) or 0x0 size
      if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] Canvas export failed', e);
    }
  }

  if (el.tagName === 'IMG') {
    const imgEl = el as HTMLImageElement;
    const imgSrc = imgEl.src;
    const rasterScale = ctx.cfg.render.rasterScale;

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

    const dataUrlTypeMatch = imgSrc.match(/^data:image\/(png|jpeg|jpg);/i);
    if (dataUrlTypeMatch) {
      const t = dataUrlTypeMatch[1].toLowerCase();
      imgItem.imageFormat = t === 'png' ? 'PNG' : 'JPEG';
      ctx.items.push(imgItem);
      return;
    }

    if (isSvgImage(imgSrc)) {
      const promise = svgToDataUrl(imgSrc, rect.width, rect.height, rasterScale)
        .then((dataUrl) => {
          imgItem.imageSrc = dataUrl;
          imgItem.imageFormat = 'PNG';
        })
        .catch((err) => {
          const e = new HtmlToVectorPdfError('ASSET_LOAD_FAILED', 'SVG conversion failed', { imageSrc: imgSrc }, err);
          ctx.cfg.callbacks.onError?.(e);
          if (ctx.cfg.errors.failOnAssetError) throw e;
          if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] SVG conversion failed:', err);
        });
      imagePromises.push(promise);
      ctx.items.push(imgItem);
      return;
    }

    // For non-dataURL <img>, rasterize through canvas into PNG to avoid format mismatch (gif/webp/etc).
    const promise = rasterizeImageElementToPngDataUrl(imgEl, rect.width, rect.height, rasterScale)
      .then((dataUrl) => {
        imgItem.imageSrc = dataUrl;
        imgItem.imageFormat = 'PNG';
      })
      .catch((err) => {
        const e = imageRasterizeError(imgSrc, err);
        ctx.cfg.callbacks.onError?.(e);
        if (ctx.cfg.errors.failOnAssetError) throw e;
        if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] Image rasterize failed:', err);
      });
    imagePromises.push(promise);
    ctx.items.push(imgItem);
  }
};
