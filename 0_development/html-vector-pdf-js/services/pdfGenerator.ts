import jsPDF from 'jspdf';

// ============================================================================
// Globe3 PDF Generator - Vector PDF from HTML
// Version: 2.1.0
// Fixes: Image SVG support, text spacing, border detection, cell padding
// ============================================================================

const SCREEN_DPI = 96;
const FALLBACK_PX_TO_MM = 25.4 / SCREEN_DPI;

let cachedPxToMm: number | null = null;

const getPxToMm = (): number => {
  if (cachedPxToMm) return cachedPxToMm;
  if (typeof document === 'undefined') return FALLBACK_PX_TO_MM;
  const body = document.body;
  if (!body) return FALLBACK_PX_TO_MM;

  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.left = '-10000px';
  probe.style.top = '0';
  probe.style.width = '100mm';
  probe.style.height = '1px';
  probe.style.visibility = 'hidden';
  body.appendChild(probe);

  const rect = probe.getBoundingClientRect();
  probe.remove();
  if (!rect.width || rect.width <= 0) return FALLBACK_PX_TO_MM;

  cachedPxToMm = 100 / rect.width;
  return cachedPxToMm;
};

// Types
export interface PdfConfig {
  filename?: string;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  excludeSelectors?: string[];
  text?: {
    scale?: number;
    baselineFactor?: number;
  };
  render?: {
    pxToMm?: number;
  };
  pagination?: {
    pageBreakBeforeSelectors?: string[];
  };
  debug?: boolean;
}

interface RenderItem {
  type: 'text' | 'background' | 'border' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  style: CSSStyleDeclaration;
  text?: string;
  imageSrc?: string;
  imageFormat?: string;
  zIndex: number;
  borderSides?: { t: number; r: number; b: number; l: number };
  borderColors?: {
    t: [number, number, number];
    r: [number, number, number];
    b: [number, number, number];
    l: [number, number, number];
  };
}

// Default exclusions for Globe3 print forms
const DEFAULT_EXCLUDE_SELECTORS = [
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

// Default config
const DEFAULT_CONFIG: Required<PdfConfig> = {
  filename: 'document.pdf',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  excludeSelectors: DEFAULT_EXCLUDE_SELECTORS,
  text: {
    scale: 1,
    baselineFactor: 0.78
  },
  render: {},
  pagination: {
    pageBreakBeforeSelectors: ['.pagebreak_bf_processed', '[data-pdf-page-break-before="true"]']
  },
  debug: false
};

// Utility functions
const parseColor = (c: string): [number, number, number] => {
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return [255, 255, 255];
  if (c.startsWith('#')) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return isNaN(r) ? [0, 0, 0] : [r, g, b];
  }
  const m = c.match(/\d+/g);
  if (c.startsWith('rgba') && m && m[3] === '0') return [255, 255, 255];
  return m && m.length >= 3 ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [0, 0, 0];
};

const isTransparent = (c: string): boolean => {
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return true;
  if (c.startsWith('rgba')) {
    const m = c.match(/\d+/g);
    if (m && m[3] === '0') return true;
  }
  return false;
};

const px2pt = (px: string | number) => parseFloat(String(px)) * 0.75;

/**
 * Convert SVG to PNG data URL using canvas
 */
const svgToDataUrl = (svgSrc: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // 2x for better quality
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load SVG image'));
    };

    img.src = svgSrc;
  });
};

/**
 * Check if image source is SVG
 */
const isSvgImage = (src: string): boolean => {
  return src.startsWith('data:image/svg') || src.endsWith('.svg');
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
    }
  };

  // Find element
  let element: HTMLElement | null = null;

  if (typeof elementOrSelector === 'string') {
    element = document.getElementById(elementOrSelector) ||
              document.querySelector(elementOrSelector) as HTMLElement;
  } else {
    element = elementOrSelector;
  }

  if (!element) {
    throw new Error(`Element not found: ${elementOrSelector}`);
  }

  const rootRect = element.getBoundingClientRect();
  const items: RenderItem[] = [];
  const imagePromises: Promise<void>[] = [];
  const pageBreakBeforeYs: number[] = [];

  // Create exclusion checker
  const shouldExclude = (el: Element | null): boolean => {
    if (!el) return false;
    for (const sel of cfg.excludeSelectors) {
      try {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return false;
  };

  const isPageBreakBefore = (el: Element): boolean => {
    const selectors = cfg.pagination.pageBreakBeforeSelectors || [];
    for (const sel of selectors) {
      try {
        if (el.matches(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }
    return false;
  };

  // --- Module 1: DOM Parser ---
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (isPageBreakBefore(el)) {
        const rect = el.getBoundingClientRect();
        if (rect.height >= 0) {
          const y = px2mm(rect.top - rootRect.top);
          if (y > 0) pageBreakBeforeYs.push(y);
        }
        node = walker.nextNode();
        continue;
      }

      // Skip excluded elements
      if (shouldExclude(el)) {
        node = walker.nextNode();
        continue;
      }

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      if (style.display !== 'none' && style.opacity !== '0' && rect.width > 0 && rect.height > 0) {
        const x = cfg.margins.left + px2mm(rect.left - rootRect.left);
        const y = px2mm(rect.top - rootRect.top);
        const w = px2mm(rect.width);
        const h = px2mm(rect.height);

        // 1. Backgrounds
        if (!isTransparent(style.backgroundColor)) {
          items.push({ type: 'background', x, y, w, h, style, zIndex: 0 });
        }

        // 2. Borders - capture all four sides with their individual colors
        const bt = parseFloat(style.borderTopWidth);
        const br = parseFloat(style.borderRightWidth);
        const bb = parseFloat(style.borderBottomWidth);
        const bl = parseFloat(style.borderLeftWidth);

        if (bt > 0 || br > 0 || bb > 0 || bl > 0) {
          // Get individual border colors
          const borderColors = {
            t: parseColor(style.borderTopColor),
            r: parseColor(style.borderRightColor),
            b: parseColor(style.borderBottomColor),
            l: parseColor(style.borderLeftColor)
          };

          items.push({
            type: 'border', x, y, w, h, style, zIndex: 10,
            borderSides: { t: bt, r: br, b: bb, l: bl },
            borderColors
          });
        }

        // 3. Images - handle SVG conversion
        if (el.tagName === 'IMG') {
          const imgEl = el as HTMLImageElement;
          const imgSrc = imgEl.src;

          const imgItem: RenderItem = {
            type: 'image', x, y, w, h, style,
            imageSrc: imgSrc,
            imageFormat: 'PNG',
            zIndex: 5
          };

          // Convert SVG to PNG
          if (isSvgImage(imgSrc)) {
            const promise = svgToDataUrl(imgSrc, rect.width, rect.height)
              .then(dataUrl => {
                imgItem.imageSrc = dataUrl;
                imgItem.imageFormat = 'PNG';
              })
              .catch(err => {
                if (cfg.debug) console.warn('[Globe3PDF] SVG conversion failed:', err);
              });
            imagePromises.push(promise);
          }

          items.push(imgItem);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const txt = node as Text;
      const rawText = txt.textContent || '';
      if (!/\S/.test(rawText)) {
        node = walker.nextNode();
        continue;
      }

      const startsWithSpace = /^\s/.test(rawText);
      const endsWithSpace = /\s$/.test(rawText);
      let str = rawText.replace(/\s+/g, ' ').trim();
      if (startsWithSpace) str = ` ${str}`;
      if (endsWithSpace) str = `${str} `;

      if (str && txt.parentElement) {
        // Skip text in excluded elements
        if (shouldExclude(txt.parentElement)) {
          node = walker.nextNode();
          continue;
        }

        const range = document.createRange();
        range.selectNode(txt);
        const rect = range.getBoundingClientRect();
        const parentStyle = window.getComputedStyle(txt.parentElement);

        if (rect.width > 0 && parentStyle.display !== 'none') {
          const y = px2mm(rect.top - rootRect.top);
          const h = px2mm(rect.height);
          const fontSizeMm = px2mm(parseFloat(parentStyle.fontSize));
          const baselineOffset = fontSizeMm * cfg.text.baselineFactor * cfg.text.scale;

          items.push({
            type: 'text',
            x: cfg.margins.left + px2mm(rect.left - rootRect.left),
            y: y + baselineOffset,
            w: px2mm(rect.width),
            h,
            style: parentStyle,
            text: str,
            zIndex: 20
          });
        }
      }
    }
    node = walker.nextNode();
  }

  // Wait for all image conversions to complete
  await Promise.all(imagePromises);

  if (cfg.debug) {
    console.log(`[Globe3PDF] Parsed ${items.length} render items`);
  }

  // --- Module 2: PDF Renderer ---
  const doc = new jsPDF({
    orientation: cfg.orientation,
    unit: 'mm',
    format: cfg.pageSize
  });

  const pageH = doc.internal.pageSize.getHeight();
  const contentH = pageH - cfg.margins.top - cfg.margins.bottom;

  const uniqueBreaks = Array.from(new Set(pageBreakBeforeYs.filter(y => Number.isFinite(y) && y > 0))).sort((a, b) => a - b);

  const countBreaksAtOrBefore = (y: number): number => {
    let lo = 0;
    let hi = uniqueBreaks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (uniqueBreaks[mid] <= y) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  items.sort((a, b) => a.zIndex - b.zIndex).forEach(item => {
    // Pagination
    const forcedBreakCount = uniqueBreaks.length ? countBreaksAtOrBefore(item.y) : 0;
    const forcedOffset = forcedBreakCount > 0 ? uniqueBreaks[forcedBreakCount - 1] : 0;
    const relativeY = item.y - forcedOffset;

    let renderY = cfg.margins.top + relativeY;
    let pageIndex = forcedBreakCount + Math.floor(relativeY / contentH) + 1;

    // Adjust Y for subsequent pages
    if (pageIndex > 1) {
      renderY = cfg.margins.top + (relativeY % contentH);
    }

    // Ensure page exists
    while (doc.getNumberOfPages() < pageIndex) {
      doc.addPage();
    }
    doc.setPage(pageIndex);

    // Render Background
    if (item.type === 'background') {
      const [r, g, b] = parseColor(item.style.backgroundColor);
      doc.setFillColor(r, g, b);
      doc.rect(item.x, renderY, item.w, item.h, 'F');
    }

    // Render Border - with individual side colors
    else if (item.type === 'border' && item.borderSides && item.borderColors) {
      const { t, r, b, l } = item.borderSides;
      const colors = item.borderColors;

      // Check if all sides are same width and color for optimization
      const isUniformWidth = (t === r) && (r === b) && (b === l) && (t > 0);
      const isUniformColor =
        colors.t[0] === colors.r[0] && colors.t[1] === colors.r[1] && colors.t[2] === colors.r[2] &&
        colors.r[0] === colors.b[0] && colors.r[1] === colors.b[1] && colors.r[2] === colors.b[2] &&
        colors.b[0] === colors.l[0] && colors.b[1] === colors.l[1] && colors.b[2] === colors.l[2];

      if (isUniformWidth && isUniformColor) {
        doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
        doc.setLineWidth(px2pt(t) / 72 * 25.4);
        doc.rect(item.x, renderY, item.w, item.h, 'D');
      } else {
        // Draw individual lines with their own colors
        if (t > 0) {
          doc.setDrawColor(colors.t[0], colors.t[1], colors.t[2]);
          doc.setLineWidth(px2pt(t) / 72 * 25.4);
          doc.line(item.x, renderY, item.x + item.w, renderY);
        }
        if (b > 0) {
          doc.setDrawColor(colors.b[0], colors.b[1], colors.b[2]);
          doc.setLineWidth(px2pt(b) / 72 * 25.4);
          doc.line(item.x, renderY + item.h, item.x + item.w, renderY + item.h);
        }
        if (l > 0) {
          doc.setDrawColor(colors.l[0], colors.l[1], colors.l[2]);
          doc.setLineWidth(px2pt(l) / 72 * 25.4);
          doc.line(item.x, renderY, item.x, renderY + item.h);
        }
        if (r > 0) {
          doc.setDrawColor(colors.r[0], colors.r[1], colors.r[2]);
          doc.setLineWidth(px2pt(r) / 72 * 25.4);
          doc.line(item.x + item.w, renderY, item.x + item.w, renderY + item.h);
        }
      }
    }

    // Render Text
    else if (item.type === 'text' && item.text) {
      doc.setFontSize(px2pt(item.style.fontSize) * cfg.text.scale);
      const [r, g, b] = parseColor(item.style.color);
      doc.setTextColor(r, g, b);

      const isBold = item.style.fontWeight === 'bold' || parseInt(item.style.fontWeight) >= 600;
      const isItalic = item.style.fontStyle === 'italic';
      doc.setFont(
        'helvetica',
        isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal'
      );

      doc.text(item.text, item.x, renderY, { baseline: 'alphabetic' });
    }

    // Render Image
    else if (item.type === 'image' && item.imageSrc) {
      try {
        const format = item.imageFormat || 'PNG';
        doc.addImage(item.imageSrc, format, item.x, renderY, item.w, item.h);
      } catch (e) {
        if (cfg.debug) console.warn('[Globe3PDF] Failed to add image:', e);
      }
    }
  });

  if (cfg.debug) {
    console.log(`[Globe3PDF] Generated ${doc.getNumberOfPages()} page(s)`);
  }

  doc.save(cfg.filename);
};

// Export for UMD/global usage
export default { generatePdf, DEFAULT_CONFIG };
