import { DEFAULT_CONFIG, DEFAULT_EXCLUDE_SELECTORS, PdfConfig } from './pdfConfig';
import { parseElementToItems } from './domParser';
import { renderToPdf } from './pdfRenderer';
import { getPxToMm } from './pdfUnits';
import { RenderItem } from './renderItems';

/**
 * Generate PDF from HTML element
 * @param elementOrSelector - Element ID (string), CSS selector (string starting with . or #), or HTMLElement
 * @param config - PDF configuration options
 */
export const generatePdf = async (
  elementOrSelector: string | HTMLElement,
  config: PdfConfig = {}
): Promise<void> => {
  const pxToMm = config.render?.pxToMm ?? getPxToMm();
  const px2mm = (px: number) => px * pxToMm;

  // Merge config with defaults
  const cfg: Required<PdfConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    margins: { ...DEFAULT_CONFIG.margins, ...config.margins },
    excludeSelectors: [
      ...DEFAULT_EXCLUDE_SELECTORS,
      ...(config.excludeSelectors || [])
    ],
    text: { ...DEFAULT_CONFIG.text, ...(config.text || {}) },
    render: { ...DEFAULT_CONFIG.render, ...(config.render || {}) },
    pagination: {
      ...DEFAULT_CONFIG.pagination,
      ...(config.pagination || {}),
      pageBreakBeforeSelectors: [
        ...(DEFAULT_CONFIG.pagination.pageBreakBeforeSelectors || []),
        ...((config.pagination?.pageBreakBeforeSelectors || []) as string[])
      ]
    },
    debugOverlay: { ...DEFAULT_CONFIG.debugOverlay, ...(config.debugOverlay || {}) }
  };

  // Find element(s) - support multiple elements with querySelectorAll
  let elements: HTMLElement[] = [];

  if (typeof elementOrSelector === 'string') {
    // First try getElementById for ID strings
    const byId = document.getElementById(elementOrSelector);
    if (byId) {
      elements = [byId];
    } else {
      // Use querySelectorAll to find all matching elements
      const nodeList = document.querySelectorAll(elementOrSelector);
      elements = Array.from(nodeList) as HTMLElement[];
    }
  } else {
    elements = [elementOrSelector];
  }

  if (elements.length === 0) {
    throw new Error(`Element not found: ${elementOrSelector}`);
  }

  if (cfg.debug) {
    console.log(`[html_to_vector_pdf] Found ${elements.length} element(s) to convert`);
  }

  if (cfg.debug) {
    console.log('[html_to_vector_pdf] debug', {
      pxToMm,
      marginsMm: cfg.margins,
      textScale: cfg.text.scale,
      pageBreakBeforeSelectors: cfg.pagination.pageBreakBeforeSelectors
    });
  }

  const allElementItems: Array<{ items: RenderItem[]; pageBreakBeforeYs: number[] }> = [];

  for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
    const element = elements[elemIdx];
    const parsed = await parseElementToItems(element, cfg, px2mm);
    if (cfg.debug) {
      console.log(`[html_to_vector_pdf] Element ${elemIdx + 1}: Parsed ${parsed.items.length} render items`);
    }
    allElementItems.push(parsed);
  }

  const doc = renderToPdf(allElementItems, cfg, px2mm);
  doc.save(cfg.filename);
};

// Export for UMD/global usage
export default { generatePdf, DEFAULT_CONFIG };
