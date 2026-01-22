const SCREEN_DPI = 96;
const FALLBACK_PX_TO_MM = 25.4 / SCREEN_DPI;

let cachedPxToMm: number | null = null;

export const getPxToMm = (): number => {
  if (cachedPxToMm) return cachedPxToMm;
  if (typeof document === 'undefined') return FALLBACK_PX_TO_MM;
  const body = document.body;
  if (!body) return FALLBACK_PX_TO_MM;

  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.left = '-10000px';
  probe.style.top = '0';
  probe.style.width = '100mm';
  probe.style.height = '1px';
  probe.style.visibility = 'hidden';
  body.appendChild(probe);

  const rect = probe.getBoundingClientRect();
  probe.remove();
  if (!rect.width || rect.width <= 0) return FALLBACK_PX_TO_MM;

  cachedPxToMm = 100 / rect.width;
  return cachedPxToMm;
};

export const px2pt = (px: string | number) => parseFloat(String(px)) * 0.75;

export const parsePx = (value: string | null | undefined): number => {
  if (!value) return 0;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

