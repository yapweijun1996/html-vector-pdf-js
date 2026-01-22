import type { HtmlToVectorPdfError } from './errors';

export interface PdfConfig {
  filename?: string;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  excludeSelectors?: string[];
  /**
   * Asset loading controls (images, background-images).
   * NOTE: Due to browser security, cross-origin images without CORS cannot be read into canvas.
   * Use `assets.proxy` or `assets.urlResolver` to rewrite URLs to a same-origin proxy.
   */
  assets?: {
    /** Rewrite all http(s) asset URLs to `${proxy}${encodeURIComponent(originalUrl)}` */
    proxy?: string;
    /** Custom URL resolver (highest priority). */
    urlResolver?: (url: string) => string;
  };
  callbacks?: {
    onProgress?: (stage: string, detail?: Record<string, unknown>) => void;
    onError?: (error: HtmlToVectorPdfError) => void;
  };
  performance?: {
    yieldEveryNodes?: number;
    yieldEveryMs?: number;
    yieldStrategy?: 'raf' | 'timeout';
    /**** AMENDMENT [start] "Add renderReadyTimeout config" ****/
    /** Maximum time to wait for fonts/images/layout before PDF generation (ms). Default: 10000 */
    renderReadyTimeout?: number;
    /**** AMENDMENT [end] "Add renderReadyTimeout config" ****/
  };
  errors?: {
    failOnAssetError?: boolean;
  };
  text?: {
    scale?: number;
  };
  render?: {
    pxToMm?: number;
    rasterScale?: number;
    /**
     * Raster scale specifically for CSS background-image.
     * Default: 4 (higher to avoid blurry cover images).
     */
    backgroundRasterScale?: number;
  };
  pagination?: {
    pageBreakBeforeSelectors?: string[];
  };
  debugOverlay?: {
    enabled?: boolean;
    strokeColorRgb?: [number, number, number];
    lineWidthMm?: number;
  };
  debug?: boolean;
  ui?: {
    showLoader?: boolean;
  };
  /**
   * Text layout engine selection.
   * - legacy: current DOM-fragment based approach
   * - pdfFirst: rebuild text lines from styled runs using PDF font metrics (more correct for mixed inline styles)
   */
  textEngine?: {
    mode?: 'legacy' | 'pdfFirst' | 'auto';
    /** Tags to enable PDF-first text layout (default: ['P']). */
    enabledTags?: Array<'P' | 'DIV'>;
    /** Enable debug logging for the PDF-first text engine */
    debug?: boolean;
  };
}

export const DEFAULT_EXCLUDE_SELECTORS = [
  '.FooterLayerMain_body_fl_001',
  '.cls_footer_layer',
  '.body_fl_001',
  '[style*="display:none"]',
  '[style*="display: none"]',
  'iframe',
  'script',
  'style',
  '#pdf-download-btn',
  '#html-to-vector-pdf-btn',
  '#html-vector-pdf-loader-gen',
  '#html-vector-pdf-loader',
  '.build-status'
];

export const DEFAULT_CONFIG: Required<PdfConfig> = {
  filename: 'document.pdf',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  excludeSelectors: DEFAULT_EXCLUDE_SELECTORS,
  assets: {},
  callbacks: {},
  performance: {
    yieldEveryNodes: 250,
    yieldEveryMs: 16,
    yieldStrategy: 'raf',
    /**** AMENDMENT [start] "Add renderReadyTimeout default" ****/
    renderReadyTimeout: 10000
    /**** AMENDMENT [end] "Add renderReadyTimeout default" ****/
  },
  errors: {
    failOnAssetError: false
  },
  text: {
    scale: 1
  },
  render: {
    rasterScale: 2,
    backgroundRasterScale: 4
  },
  pagination: {
    pageBreakBeforeSelectors: ['.pagebreak_bf_processed', '.pagebreak_bf', '[data-pdf-page-break-before="true"]']
  },
  debugOverlay: {
    enabled: false,
    strokeColorRgb: [255, 0, 0],
    lineWidthMm: 0.15
  },
  debug: false,
  ui: {
    showLoader: true
  },
  textEngine: {
    mode: 'auto',
    enabledTags: ['P'],
    debug: false
  }
};
