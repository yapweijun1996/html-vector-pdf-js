export interface PdfConfig {
  filename?: string;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  excludeSelectors?: string[];
  text?: {
    scale?: number;
  };
  render?: {
    pxToMm?: number;
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
  '.build-status'
];

export const DEFAULT_CONFIG: Required<PdfConfig> = {
  filename: 'document.pdf',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  excludeSelectors: DEFAULT_EXCLUDE_SELECTORS,
  text: {
    scale: 1
  },
  render: {},
  pagination: {
    pageBreakBeforeSelectors: ['.pagebreak_bf_processed', '[data-pdf-page-break-before="true"]']
  },
  debugOverlay: {
    enabled: false,
    strokeColorRgb: [255, 0, 0],
    lineWidthMm: 0.15
  },
  debug: false
};

