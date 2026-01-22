import { isTransparent } from '../colors';
import { RenderItem } from '../renderItems';
import {
  backgroundImageRasterizeError,
  getBackgroundImageUrlFromStyle,
  rasterizeBackgroundImageToPngDataUrl
} from '../backgroundImage';
import { resolveAssetUrl } from '../assetUrl';
import { DomParseContext } from './context';

export const maybeAddBackgroundColor = (
  ctx: DomParseContext,
  style: CSSStyleDeclaration,
  box: { x: number; y: number; w: number; h: number }
): void => {
  if (isTransparent(style.backgroundColor)) return;
  ctx.items.push({ type: 'background', ...box, style, zIndex: 0 });
};

export const maybeAddBackgroundImage = (
  ctx: DomParseContext,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  box: { x: number; y: number; w: number; h: number },
  imagePromises: Promise<void>[]
): void => {
  // CSS background-image (single url layer): rasterize into a PNG and render as an image item behind content.
  const bgUrl = getBackgroundImageUrlFromStyle(style);
  if (!bgUrl) return;

  const rasterScale = ctx.cfg.render.backgroundRasterScale ?? ctx.cfg.render.rasterScale;
  const resolvedBgUrl = resolveAssetUrl(ctx.cfg, bgUrl);
  const bgItem: RenderItem = {
    type: 'image',
    ...box,
    style,
    imageSrc: resolvedBgUrl,
    imageFormat: 'PNG',
    zIndex: 1
  };

  const promise = rasterizeBackgroundImageToPngDataUrl({
    imageUrl: resolvedBgUrl,
    targetWidthPx: rect.width,
    targetHeightPx: rect.height,
    rasterScale,
    backgroundRepeat: (style.backgroundRepeat || 'repeat') as any,
    backgroundSize: (style.backgroundSize || 'auto') as any,
    backgroundPosition: (style.backgroundPosition || '0% 0%') as any
  })
    .then((dataUrl) => {
      bgItem.imageSrc = dataUrl;
      bgItem.imageFormat = 'PNG';
    })
    .catch((err) => {
      const e = backgroundImageRasterizeError(resolvedBgUrl, err);
      ctx.cfg.callbacks.onError?.(e);
      if (ctx.cfg.errors.failOnAssetError) throw e;
      if (ctx.cfg.debug) console.warn('[html_to_vector_pdf] Background image rasterize failed:', err);
    });

  imagePromises.push(promise);
  ctx.items.push(bgItem);
};

