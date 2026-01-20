import type { HtmlToVectorPdfError } from './errors';

export interface PdfConfig {
  filename?: string;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  excludeSelectors?: string[];
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
  '.build-status'
];

export const DEFAULT_CONFIG: Required<PdfConfig> = {
  filename: 'document.pdf',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  excludeSelectors: DEFAULT_EXCLUDE_SELECTORS,
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
    rasterScale: 2
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
  }
};
