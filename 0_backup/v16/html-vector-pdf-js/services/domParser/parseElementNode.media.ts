import { RenderItem } from '../renderItems';
import { isSvgImage, svgToDataUrl } from '../svgImage';
import { HtmlToVectorPdfError } from '../errors';
import { imageRasterizeError, rasterizeImageUrlToPngDataUrl } from '../imageRaster';
import { resolveAssetUrl } from '../assetUrl';
import { DomParseContext } from './context';

export const maybeAddCanvasSnapshot = (
  ctx: DomParseContext,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  box: { x: number; y: number; w: number; h: number }
): void => {
  if (el.tagName !== 'CANVAS') return;
  try {
    const canvas = el as HTMLCanvasElement;
    // Use PNG format to preserve transparency
    const dataUrl = canvas.toDataURL('image/png');
    ctx.items.push({ type: 'image', ...box, style, imageSrc: dataUrl, imageFormat: 'PNG', zIndex: 5 });
  } catch (e) {
    // Canvas might be tainted (CORS) or 0x0 size
    if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] Canvas export failed', e);
  }
};

export const maybeAddImg = (
  ctx: DomParseContext,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  box: { x: number; y: number; w: number; h: number },
  imagePromises: Promise<void>[]
): void => {
  if (el.tagName !== 'IMG') return;

  const imgEl = el as HTMLImageElement;
  const imgSrc = imgEl.src;
  const rasterScale = ctx.cfg.render.rasterScale;
  const resolvedImgSrc = resolveAssetUrl(ctx.cfg, imgSrc);

  const imgItem: RenderItem = {
    type: 'image',
    ...box,
    style,
    imageSrc: resolvedImgSrc,
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

  // For non-dataURL <img>, rasterize via a fresh Image() load (supports proxy-rewritten URLs).
  // This also normalizes formats (gif/webp/etc) into PNG.
  const promise = rasterizeImageUrlToPngDataUrl(resolvedImgSrc, rect.width, rect.height, rasterScale)
    .then((dataUrl) => {
      imgItem.imageSrc = dataUrl;
      imgItem.imageFormat = 'PNG';
    })
    .catch((err) => {
      const e = imageRasterizeError(resolvedImgSrc, err);
      ctx.cfg.callbacks.onError?.(e);
      if (ctx.cfg.errors.failOnAssetError) throw e;
      if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] Image rasterize failed:', err);
    });
  imagePromises.push(promise);
  ctx.items.push(imgItem);
};

