import { PdfConfig } from './pdfConfig';

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const resolveAssetUrl = (cfg: Required<PdfConfig>, url: string): string => {
  const raw = String(url || '').trim();
  if (!raw) return raw;

  const resolver = cfg.assets?.urlResolver;
  if (typeof resolver === 'function') {
    try {
      return String(resolver(raw));
    } catch {
      return raw;
    }
  }

  const proxy = cfg.assets?.proxy;
  if (proxy && isHttpUrl(raw)) {
    return `${proxy}${encodeURIComponent(raw)}`;
  }

  return raw;
};

