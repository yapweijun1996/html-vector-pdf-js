import { WindowWithPdfGlobals } from './generatePdf.types';

export const resolveGeneratePdfTarget = (
  target: string | HTMLElement
): string | HTMLElement => {
  if (typeof window === 'undefined') return target;

  const win = window as WindowWithPdfGlobals;
  const override = win.html_to_vector_pdf_target;
  if (typeof override !== 'string') return target;

  const trimmed = override.trim();
  if (!trimmed) return target;

  return trimmed;
};

