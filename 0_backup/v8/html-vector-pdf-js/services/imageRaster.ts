import { HtmlToVectorPdfError } from './errors';

const waitForImageReady = (img: HTMLImageElement): Promise<void> => {
  if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onLoad = () => cleanup(resolve);
    const onError = () => cleanup(() => reject(new Error('Failed to load image')));
    const cleanup = (done: () => void) => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      done();
    };
    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
  });
};

export const rasterizeImageElementToPngDataUrl = async (
  img: HTMLImageElement,
  targetWidthPx: number,
  targetHeightPx: number,
  rasterScale: number
): Promise<string> => {
  await waitForImageReady(img);

  const scale = Number.isFinite(rasterScale) && rasterScale > 0 ? rasterScale : 2;
  const canvasW = Math.max(1, Math.round(targetWidthPx * scale));
  const canvasH = Math.max(1, Math.round(targetHeightPx * scale));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Keep deterministic output: fill a white background (avoid transparency differences in PDF viewers).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(img, 0, 0, canvasW, canvasH);

  return canvas.toDataURL('image/png');
};

export const imageRasterizeError = (imageSrc: string, cause: unknown): HtmlToVectorPdfError => {
  return new HtmlToVectorPdfError('ASSET_LOAD_FAILED', 'Failed to rasterize image', { imageSrc }, cause);
};

