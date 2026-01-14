import { PdfConfig } from './pdfConfig';
import { parseElementToItems } from './domParser';
import { renderToPdf } from './pdfRenderer';
import { getPxToMm } from './pdfUnits';
import { RenderItem } from './renderItems';
import { asHtmlToVectorPdfError } from './errors';
import { createYieldController } from './asyncYield';
import { mergeConfig } from './generatePdf.config';
import { findElements, validateElementSizes } from './generatePdf.elements';
import { extractTextsFromItems, processFonts } from './generatePdf.fonts';

// ============================================================================
// UI Loader Functions
// ============================================================================

const LOADER_ID = 'html-vector-pdf-loader-gen';

/**
 * Show a full-screen loading overlay with spinner
 * @param label - Text to display in the loader (default: 'Generating PDF...')
 */
const showLoaderUI = (label: string = 'Generating PDF...'): void => {
  if (typeof document === 'undefined') return;
  let loader = document.getElementById(LOADER_ID);
  if (!loader) {
    loader = document.createElement('div');
    loader.id = LOADER_ID;
    loader.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483648;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: white; font-family: system-ui, sans-serif; transition: opacity 0.2s;
    `;
    loader.innerHTML = `
      <style>
        .hv-pdf-spinner-gen {
          width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: hv-pdf-spin-gen 1s linear infinite; margin-bottom: 16px;
        }
        @keyframes hv-pdf-spin-gen { to { transform: rotate(360deg); } }
      </style>
      <div class="hv-pdf-spinner-gen"></div>
      <div id="${LOADER_ID}-text" style="font-size: 16px; font-weight: 500;">${label}</div>
    `;
    document.body.appendChild(loader);
  } else {
    const textEl = document.getElementById(`${LOADER_ID}-text`);
    if (textEl) textEl.textContent = label;
    loader.style.display = 'flex';
  }
};

/**
 * Hide the loading overlay with fade-out animation
 */
const hideLoaderUI = (): void => {
  if (typeof document === 'undefined') return;
  const loader = document.getElementById(LOADER_ID);
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 200);
  }
};

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

  const maybeYield = createYieldController({
    yieldEveryNodes: cfg.performance.yieldEveryNodes,
    yieldEveryMs: cfg.performance.yieldEveryMs,
    strategy: cfg.performance.yieldStrategy
  });

  const showLoader = config.ui?.showLoader !== false; // Default true
  if (showLoader) showLoaderUI('Generating PDF...');

  try {
    cfg.callbacks.onProgress?.('select:start', {
      target: typeof elementOrSelector === 'string' ? elementOrSelector : 'HTMLElement'
    });

    // Find and validate elements
    const elements = findElements(elementOrSelector);
    validateElementSizes(elements, elementOrSelector);

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

    // Process fonts: detect required fonts and load from CDN
    const allTexts = extractTextsFromItems(allElementItems);
    const { loadedFonts } = await processFonts(allTexts, cfg);

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

