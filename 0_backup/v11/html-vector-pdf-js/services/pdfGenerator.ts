import { DEFAULT_CONFIG } from './pdfConfig';
import { generatePdf } from './generatePdf';
import { destroy, exportPdf, init } from './init';

// Export for UMD/global usage
export { generatePdf, init, exportPdf, destroy };

const HtmlToVectorPDF = { init, export: exportPdf, destroy };

try {
  if (typeof window !== 'undefined') (window as any).HtmlToVectorPDF = HtmlToVectorPDF;
} catch {
  // ignore
}

export default { generatePdf, init, exportPdf, destroy, DEFAULT_CONFIG };
