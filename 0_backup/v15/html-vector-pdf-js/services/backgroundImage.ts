import { HtmlToVectorPdfError } from './errors';

export type BackgroundRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
export type BackgroundSizeMode = 'cover' | 'contain' | 'explicit' | 'auto';

type BackgroundPositionKeyword = 'left' | 'center' | 'right' | 'top' | 'bottom';

type BackgroundPosition = {
  x: { align: number; offsetPx: number };
  y: { align: number; offsetPx: number };
};

type BackgroundSize = {
  mode: BackgroundSizeMode;
  widthPx?: number;
  heightPx?: number;
};

const parseCssUrl = (backgroundImage: string): string | null => {
  // Supports: url("..."), url('...'), url(...)
  const s = (backgroundImage || '').trim();
  if (!s || s === 'none') return null;
  const m = s.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
  if (!m?.[2]) return null;
  return m[2].trim();
};

const parseRepeat = (repeat: string): BackgroundRepeat => {
  const v = (repeat || '').trim().toLowerCase();
  if (v === 'repeat-x' || v === 'repeat-y' || v === 'no-repeat') return v;
  return 'repeat';
};

const parseLengthOrPercentPx = (raw: string, containerPx: number): number | null => {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return null;
  if (v.endsWith('px')) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v.endsWith('%')) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? (containerPx * n) / 100 : null;
  }
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const keywordAlign = (k: BackgroundPositionKeyword, axis: 'x' | 'y'): number => {
  if (axis === 'x') return k === 'left' ? 0 : k === 'right' ? 1 : 0.5;
  return k === 'top' ? 0 : k === 'bottom' ? 1 : 0.5;
};

const parsePosition = (posRaw: string): BackgroundPosition => {
  // Most common patterns:
  // - "center top"
  // - "left top"
  // - "50% 0%"
  // - "10px 20px"
  const raw = (posRaw || '').trim().toLowerCase();
  const parts = raw.split(/\s+/).filter(Boolean);

  const xPart = (parts[0] || '0%') as string;
  const yPart = (parts[1] || '0%') as string;

  const parseAxis = (p: string, axis: 'x' | 'y') => {
    const kw = p as BackgroundPositionKeyword;
    if (axis === 'x' && (kw === 'left' || kw === 'center' || kw === 'right')) {
      return { align: keywordAlign(kw, 'x'), offsetPx: 0 };
    }
    if (axis === 'y' && (kw === 'top' || kw === 'center' || kw === 'bottom')) {
      return { align: keywordAlign(kw, 'y'), offsetPx: 0 };
    }
    if (p.endsWith('%')) {
      const n = parseFloat(p);
      return { align: Number.isFinite(n) ? n / 100 : 0, offsetPx: 0 };
    }
    if (p.endsWith('px')) {
      const n = parseFloat(p);
      return { align: 0, offsetPx: Number.isFinite(n) ? n : 0 };
    }
    const n = parseFloat(p);
    return { align: 0, offsetPx: Number.isFinite(n) ? n : 0 };
  };

  return {
    x: parseAxis(xPart, 'x'),
    y: parseAxis(yPart, 'y')
  };
};

const parseSize = (sizeRaw: string, naturalW: number, naturalH: number, containerW: number, containerH: number): BackgroundSize => {
  const raw = (sizeRaw || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return { mode: 'auto' };
  if (raw === 'cover') return { mode: 'cover' };
  if (raw === 'contain') return { mode: 'contain' };

  const parts = raw.split(/\s+/).filter(Boolean);
  const wRaw = parts[0] || 'auto';
  const hRaw = parts[1] || 'auto';

  const wPx = wRaw === 'auto' ? null : parseLengthOrPercentPx(wRaw, containerW);
  const hPx = hRaw === 'auto' ? null : parseLengthOrPercentPx(hRaw, containerH);

  if (wPx == null && hPx == null) return { mode: 'auto' };
  if (wPx != null && hPx != null) return { mode: 'explicit', widthPx: wPx, heightPx: hPx };

  // Single axis explicit: preserve aspect ratio
  if (wPx != null) {
    const ratio = naturalH > 0 ? naturalW / naturalH : 1;
    return { mode: 'explicit', widthPx: wPx, heightPx: ratio > 0 ? wPx / ratio : wPx };
  }

  const ratio = naturalW > 0 ? naturalH / naturalW : 1;
  return { mode: 'explicit', widthPx: ratio > 0 ? (hPx as number) / ratio : (hPx as number), heightPx: hPx as number };
};

const computeDrawSize = (size: BackgroundSize, naturalW: number, naturalH: number, containerW: number, containerH: number) => {
  if (size.mode === 'explicit' && size.widthPx && size.heightPx) return { w: size.widthPx, h: size.heightPx };
  if (size.mode === 'auto') return { w: naturalW || containerW, h: naturalH || containerH };

  const imgW = naturalW || containerW || 1;
  const imgH = naturalH || containerH || 1;
  const scaleCover = Math.max(containerW / imgW, containerH / imgH);
  const scaleContain = Math.min(containerW / imgW, containerH / imgH);
  const scale = size.mode === 'cover' ? scaleCover : scaleContain;
  return { w: imgW * scale, h: imgH * scale };
};

const computeTopLeft = (pos: BackgroundPosition, drawW: number, drawH: number, containerW: number, containerH: number) => {
  const x = (containerW - drawW) * pos.x.align + pos.x.offsetPx;
  const y = (containerH - drawH) * pos.y.align + pos.y.offsetPx;
  return { x, y };
};

const waitForImage = (img: HTMLImageElement): Promise<void> => {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onLoad = () => cleanup(resolve);
    const onErr = () => cleanup(() => reject(new Error('Failed to load background image')));
    const cleanup = (done: () => void) => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onErr);
      done();
    };
    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onErr, { once: true });
  });
};

export const rasterizeBackgroundImageToPngDataUrl = async (args: {
  imageUrl: string;
  targetWidthPx: number;
  targetHeightPx: number;
  rasterScale: number;
  backgroundRepeat: string;
  backgroundSize: string;
  backgroundPosition: string;
}): Promise<string> => {
  const {
    imageUrl,
    targetWidthPx,
    targetHeightPx,
    rasterScale,
    backgroundRepeat,
    backgroundSize,
    backgroundPosition
  } = args;

  const scale = Number.isFinite(rasterScale) && rasterScale > 0 ? rasterScale : 2;
  const canvasW = Math.max(1, Math.round(targetWidthPx * scale));
  const canvasH = Math.max(1, Math.round(targetHeightPx * scale));

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;
  await waitForImage(img);

  const naturalW = img.naturalWidth || 0;
  const naturalH = img.naturalHeight || 0;

  const repeatMode = parseRepeat(backgroundRepeat);
  const size = parseSize(backgroundSize, naturalW, naturalH, targetWidthPx, targetHeightPx);
  const drawSize = computeDrawSize(size, naturalW, naturalH, targetWidthPx, targetHeightPx);
  const pos = parsePosition(backgroundPosition);
  const topLeft = computeTopLeft(pos, drawSize.w, drawSize.h, targetWidthPx, targetHeightPx);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Improve downscale quality (browser-dependent).
  ctx.imageSmoothingEnabled = true;
  try {
    (ctx as any).imageSmoothingQuality = 'high';
  } catch {
    // ignore
  }

  // Draw in element-local coordinates; multiply by raster scale.
  const dw = drawSize.w * scale;
  const dh = drawSize.h * scale;
  const baseX = topLeft.x * scale;
  const baseY = topLeft.y * scale;

  const drawOnce = (x: number, y: number) => {
    ctx.drawImage(img, x, y, dw, dh);
  };

  if (repeatMode === 'no-repeat') {
    drawOnce(baseX, baseY);
    return canvas.toDataURL('image/png');
  }

  const stepX = repeatMode === 'repeat-y' ? canvasW + 1 : Math.max(1, Math.round(dw));
  const stepY = repeatMode === 'repeat-x' ? canvasH + 1 : Math.max(1, Math.round(dh));

  const normStart = (posPx: number, step: number) => {
    if (step <= 0) return posPx;
    const m = ((posPx % step) + step) % step;
    return posPx - m - step;
  };

  const startX = repeatMode === 'repeat-y' ? baseX : normStart(baseX, stepX);
  const startY = repeatMode === 'repeat-x' ? baseY : normStart(baseY, stepY);

  for (let y = startY; y < canvasH; y += stepY) {
    for (let x = startX; x < canvasW; x += stepX) {
      drawOnce(x, y);
    }
  }

  return canvas.toDataURL('image/png');
};

export const getBackgroundImageUrlFromStyle = (style: CSSStyleDeclaration): string | null => {
  return parseCssUrl(style.backgroundImage || '');
};

export const backgroundImageRasterizeError = (imageUrl: string, cause: unknown): HtmlToVectorPdfError => {
  return new HtmlToVectorPdfError('ASSET_LOAD_FAILED', 'Failed to rasterize background image', { imageUrl }, cause);
};
