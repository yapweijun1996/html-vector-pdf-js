import { PdfConfig } from './pdfConfig';
import { parseElementToItems } from './domParser';
import { renderToPdf } from './pdfRenderer';
import { getPxToMm } from './pdfUnits';
import { RenderItem } from './renderItems';
import { asHtmlToVectorPdfError } from './errors';
import { createYieldController } from './asyncYield';
import { mergeConfig } from './generatePdf.config';
import { findElements, validateElementSizes } from './generatePdf.elements';
import { extractTextsFromItems, extractFamiliesFromItems, processFonts } from './generatePdf.fonts';
import { waitForElementsReady } from './renderReady';
import { resolveGeneratePdfTarget } from './generatePdf.targetOverride';
import { showLoaderUI, hideLoaderUI } from './uiLoader';

/**
 * Generate PDF from HTML element
 * @param elementOrSelector - Element ID (string), CSS selector (string starting with . or #), or HTMLElement
 * @param config - PDF configuration options
 */
export const generatePdf = async (
  elementOrSelector: string | HTMLElement,
  config: PdfConfig = {}
): Promise<void> => {

  // Merge user config with defaults and global overrides
  const cfg = mergeConfig(config);
  const pxToMm = cfg.render.pxToMm ?? getPxToMm();
  const px2mm = (px: number) => px * pxToMm;
  const effectiveTarget = resolveGeneratePdfTarget(elementOrSelector);

  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  const showLoader = config.ui?.showLoader !== false; // Default true
  if (showLoader) showLoaderUI('Generating PDF...');

  try {
    cfg.callbacks.onProgress?.('select:start', {
      target: typeof effectiveTarget === 'string' ? effectiveTarget : 'HTMLElement'
    });

    // Find and validate elements
    const elements = findElements(effectiveTarget);
    validateElementSizes(elements, effectiveTarget);

    cfg.callbacks.onProgress?.('select:done', { elementCount: elements.length });

    /**** AMENDMENT [start] "Wait for render ready before parsing DOM" ****/
    // Wait for fonts, images, and layout to stabilize before parsing
    // This fixes issues where multi-page PDFs have rendering artifacts on later pages
    // because resources were not fully loaded on first click
    cfg.callbacks.onProgress?.('render:wait:start', { elementCount: elements.length });
    await waitForElementsReady(elements, {
      timeout: cfg.performance.renderReadyTimeout ?? 10000,
      debug: cfg.debug,
      minFrames: 2,
      settleDelay: 50
    });
    cfg.callbacks.onProgress?.('render:wait:done', { elementCount: elements.length });
    /**** AMENDMENT [end] "Wait for render ready before parsing DOM" ****/

    if (cfg.debug) {
      if (effectiveTarget !== elementOrSelector) {
        console.log('[html_to_vector_pdf] target overridden by window.html_to_vector_pdf_target', {
          requested: typeof elementOrSelector === 'string' ? elementOrSelector : 'HTMLElement',
          effective: typeof effectiveTarget === 'string' ? effectiveTarget : 'HTMLElement'
        });
      }
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

    // Process fonts: detect required fonts and load from CDN
    const allTexts = extractTextsFromItems(allElementItems);
    /**** AMENDMENT [start] "Extract families for font detection" ****/
    const allFamilies = extractFamiliesFromItems(allElementItems);
    if (cfg.debug) {
      console.log('[html_to_vector_pdf] Extracted families:', allFamilies);
    }
    const { loadedFonts } = await processFonts(allTexts, allFamilies, cfg);
    /**** AMENDMENT [end] "Extract families for font detection" ****/

    // Pass loaded fonts to renderer via config
    if (loadedFonts.length > 0) {
      (cfg as any).loadedFonts = loadedFonts;
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
  } finally {
    if (showLoader) hideLoaderUI();
  }
};
