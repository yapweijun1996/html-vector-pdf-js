import { DEFAULT_CONFIG, DEFAULT_EXCLUDE_SELECTORS, PdfConfig } from './pdfConfig';
import { parseElementToItems } from './domParser';
import { renderToPdf } from './pdfRenderer';
import { getPxToMm } from './pdfUnits';
import { RenderItem } from './renderItems';
import { HtmlToVectorPdfError, asHtmlToVectorPdfError } from './errors';
import { createYieldController } from './asyncYield';

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
    excludeSelectors: [...DEFAULT_EXCLUDE_SELECTORS, ...(config.excludeSelectors || [])],
    callbacks: { ...DEFAULT_CONFIG.callbacks, ...(config.callbacks || {}) },
    performance: { ...DEFAULT_CONFIG.performance, ...(config.performance || {}) },
    errors: { ...DEFAULT_CONFIG.errors, ...(config.errors || {}) },
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

  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  try {
    cfg.callbacks.onProgress?.('select:start', {
      target: typeof elementOrSelector === 'string' ? elementOrSelector : 'HTMLElement'
    });

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
      throw new HtmlToVectorPdfError('ELEMENT_NOT_FOUND', 'Element not found', { target: elementOrSelector });
    }

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new HtmlToVectorPdfError('ELEMENT_ZERO_SIZE', 'Element has zero size', {
          target: typeof elementOrSelector === 'string' ? elementOrSelector : 'HTMLElement',
          width: rect.width,
          height: rect.height
        });
      }
    }

    cfg.callbacks.onProgress?.('select:done', { elementCount: elements.length });

    if (cfg.debug) {
      console.log(`[html_to_vector_pdf] Found ${elements.length} element(s) to convert`);
      console.log('[html_to_vector_pdf] debug', {
        pxToMm,
        marginsMm: cfg.margins,
        textScale: cfg.text.scale,
        pageBreakBeforeSelectors: cfg.pagination.pageBreakBeforeSelectors
      });
    }

    const allElementItems: Array<{ items: RenderItem[]; pageBreakBeforeYs: number[] }> = [];

    for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
      cfg.callbacks.onProgress?.('parse:element:start', { elementIndex: elemIdx, elementCount: elements.length });
      const element = elements[elemIdx];
      const parsed = await parseElementToItems(element, cfg, px2mm);
      if (cfg.debug) {
        console.log(`[html_to_vector_pdf] Element ${elemIdx + 1}: Parsed ${parsed.items.length} render items`);
      }
      allElementItems.push(parsed);
      cfg.callbacks.onProgress?.('parse:element:done', {
        elementIndex: elemIdx,
        elementCount: elements.length,
        renderItemCount: parsed.items.length
      });
      await maybeYield(elemIdx + 1);
    }

    cfg.callbacks.onProgress?.('render:start', { elementCount: allElementItems.length });
    const doc = await renderToPdf(allElementItems, cfg, px2mm);
    cfg.callbacks.onProgress?.('render:done', { pageCount: doc.getNumberOfPages() });
    cfg.callbacks.onProgress?.('save:start', { filename: cfg.filename });
    doc.save(cfg.filename);
    cfg.callbacks.onProgress?.('save:done', { filename: cfg.filename });
  } catch (err) {
    const e = asHtmlToVectorPdfError(err, { code: 'GENERATION_FAILED', message: 'PDF generation failed' });
    cfg.callbacks.onError?.(e);
    throw e;
  }
};

