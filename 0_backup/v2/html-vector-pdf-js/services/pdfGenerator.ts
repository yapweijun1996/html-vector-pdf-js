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
  debugOverlay?: {
    enabled?: boolean;
    strokeColorRgb?: [number, number, number];
    lineWidthMm?: number;
  };
  debug?: boolean;
}

interface RenderItem {
  type: 'text' | 'background' | 'border' | 'image' | 'debugRect';
  x: number;
  y: number;
  w: number;
  h: number;
  style: CSSStyleDeclaration;
  text?: string;
  imageSrc?: string;
  imageFormat?: string;
  zIndex: number;
  textAlign?: 'left' | 'center' | 'right';
  maxWidthMm?: number;
  lineHeightMm?: number;
  noWrap?: boolean;
  cssNoWrap?: boolean;
  rectsLen?: number;
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
  debugOverlay: {
    enabled: false,
    strokeColorRgb: [255, 0, 0],
    lineWidthMm: 0.15
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

const parsePx = (value: string | null | undefined): number => {
  if (!value) return 0;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

const parseLineHeightPx = (lineHeight: string, fontSizePx: number): number => {
  const lh = (lineHeight || '').trim().toLowerCase();
  if (!lh || lh === 'normal') return fontSizePx * 1.2;
  if (lh.endsWith('px')) return parsePx(lh);
  const num = parseFloat(lh);
  if (!Number.isFinite(num)) return fontSizePx * 1.2;
  // unitless line-height multiplier
  return num * fontSizePx;
};

const pickTextAlign = (el: Element, computedTextAlign: string): RenderItem['textAlign'] => {
  const attr = (el.getAttribute('align') || '').toLowerCase();
  if (attr === 'right' || attr === 'center' || attr === 'left') return attr as RenderItem['textAlign'];
  const raw = (computedTextAlign || '').toLowerCase();
  if (raw === 'right' || raw === 'end') return 'right';
  if (raw === 'center') return 'center';
  return 'left';
};

const wrapTextToWidth = (doc: jsPDF, text: string, maxWidthMm: number): string[] => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (maxWidthMm <= 0) return [cleaned];

  // Break opportunities at spaces and hyphens to mimic browser wrapping for codes like "AAA-BBB-CCC".
  const tokens = cleaned.split(/(\s+|-)/).filter(t => t.length > 0);
  const lines: string[] = [];
  let line = '';

  const pushLine = () => {
    const out = line.trim();
    if (out) lines.push(out);
    line = '';
  };

  for (const token of tokens) {
    const candidate = line ? `${line}${token}` : token;
    const width = doc.getTextWidth(candidate);
    if (width <= maxWidthMm) {
      line = candidate;
      continue;
    }

    if (!line) {
      // Hard-break long tokens (rare for this invoice), fallback to char-level.
      let chunk = '';
      for (const ch of token) {
        const next = chunk + ch;
        if (doc.getTextWidth(next) <= maxWidthMm) {
          chunk = next;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      if (chunk) lines.push(chunk);
      line = '';
      continue;
    }

    pushLine();
    line = token;
  }

  pushLine();
  return lines;
};

const buildTextStyleKey = (style: CSSStyleDeclaration): string => {
  return [
    style.fontSize,
    style.fontWeight,
    style.fontStyle,
    style.color
  ].join('|');
};

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
    console.log(`[Globe3PDF] Found ${elements.length} element(s) to convert`);
  }

  if (cfg.debug) {
    console.log('[Globe3PDF] debug', {
      pxToMm,
      marginsMm: cfg.margins,
      textScale: cfg.text.scale,
      pageBreakBeforeSelectors: cfg.pagination.pageBreakBeforeSelectors
    });
  }

  // Collect all render items from all elements
  const allElementItems: { items: RenderItem[]; pageBreakBeforeYs: number[] }[] = [];

  for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
    const element = elements[elemIdx];
    const rootRect = element.getBoundingClientRect();
    const items: RenderItem[] = [];
    const imagePromises: Promise<void>[] = [];
    const pageBreakBeforeYs: number[] = [];
    const debugCells: Array<{
      tag: string;
      left: number;
      top: number;
      width: number;
      height: number;
      paddingL: number;
      paddingR: number;
      paddingT: number;
      paddingB: number;
      contentWidthPx: number;
    }> = [];

    const layoutIdByElement = new WeakMap<Element, number>();
    let nextLayoutId = 1;
    const getLayoutId = (el: Element): number => {
      const existing = layoutIdByElement.get(el);
      if (existing) return existing;
      const id = nextLayoutId++;
      layoutIdByElement.set(el, id);
      return id;
    };

    const aggregatedTextByKey = new Map<string, RenderItem>();

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

          if (cfg.debugOverlay.enabled && (el.tagName === 'TD' || el.tagName === 'TH')) {
            const paddingL = parsePx(style.paddingLeft);
            const paddingR = parsePx(style.paddingRight);
            const paddingT = parsePx(style.paddingTop);
            const paddingB = parsePx(style.paddingBottom);

            const contentLeftPx = rect.left + paddingL;
            const contentRightPx = rect.right - paddingR;
            const contentTopPx = rect.top + paddingT;
            const contentBottomPx = rect.bottom - paddingB;

            const contentX = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
            const contentY = px2mm(contentTopPx - rootRect.top);
            const contentW = px2mm(Math.max(0, contentRightPx - contentLeftPx));
            const contentH = px2mm(Math.max(0, contentBottomPx - contentTopPx));

            items.push({
              type: 'debugRect',
              x: contentX,
              y: contentY,
              w: contentW,
              h: contentH,
              style,
              zIndex: 12
            });

            debugCells.push({
              tag: el.tagName,
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              paddingL,
              paddingR,
              paddingT,
              paddingB,
              contentWidthPx: Math.max(0, contentRightPx - contentLeftPx)
            });
          }

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

          const parentEl = txt.parentElement;
          const fontStyle = window.getComputedStyle(parentEl);
          const layoutEl = (parentEl.closest('td,th') as HTMLElement | null) || parentEl;
          const layoutStyle = window.getComputedStyle(layoutEl);
          const layoutRect = layoutEl.getBoundingClientRect();

          const paddingLeftPx = parsePx(layoutStyle.paddingLeft);
          const paddingRightPx = parsePx(layoutStyle.paddingRight);
          const contentLeftPx = layoutRect.left + paddingLeftPx;
          const contentRightPx = layoutRect.right - paddingRightPx;
          const contentWidthPx = Math.max(0, contentRightPx - contentLeftPx);

          const textAlign = pickTextAlign(layoutEl, layoutStyle.textAlign || '');
          const whiteSpace = (layoutStyle.whiteSpace || '').toLowerCase();
          const cssNoWrap = whiteSpace.includes('nowrap');

          const range = document.createRange();
          range.selectNodeContents(txt);
          const rects = range.getClientRects();
          const firstRect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
          const rectsLen = rects.length > 0 ? rects.length : (firstRect.width > 0 && firstRect.height > 0 ? 1 : 0);
          const browserWrapped = rectsLen > 1;
          const noWrap = cssNoWrap || !browserWrapped;

          if (layoutRect.width > 0 && layoutStyle.display !== 'none' && firstRect.width > 0 && firstRect.height > 0) {
            // Use the actual text fragment position to avoid stacking multiple text nodes at the same y.
            const y = px2mm(firstRect.top - rootRect.top);
            const h = px2mm(firstRect.height);
            const fontSizePx = parseFloat(fontStyle.fontSize);
            const fontSizeMm = px2mm(fontSizePx);
            const baselineOffset = fontSizeMm * cfg.text.baselineFactor * cfg.text.scale;
            const lineHeightPx = parseLineHeightPx(layoutStyle.lineHeight, fontSizePx);
            const lineHeightMm = px2mm(lineHeightPx) * cfg.text.scale;

            const xLeftMm = cfg.margins.left + px2mm(contentLeftPx - rootRect.left);
            const xRightMm = cfg.margins.left + px2mm(contentRightPx - rootRect.left);
            // For cell-aligned text, use cell content edges
            const xMmCellAligned = textAlign === 'right' ? xRightMm : textAlign === 'center' ? (xLeftMm + xRightMm) / 2 : xLeftMm;
            // For inline text (mixed styles), use actual text position from browser
            const xMmActual = cfg.margins.left + px2mm(firstRect.left - rootRect.left);

            const inTableCell = layoutEl.tagName === 'TD' || layoutEl.tagName === 'TH';

            // Check if this cell has mixed styles by looking for child elements with different styles
            const hasMixedStyles = inTableCell && layoutEl.querySelectorAll('b, strong, i, em, span').length > 0;

            // Only aggregate if:
            // 1. We're in a table cell
            // 2. The text style matches the cell's style (no inline formatting)
            // 3. There are no mixed styles in the cell (no <b>, <strong>, etc.)
            const canAggregate = inTableCell &&
              !hasMixedStyles &&
              buildTextStyleKey(fontStyle) === buildTextStyleKey(window.getComputedStyle(layoutEl));

            if (canAggregate) {
              const layoutId = getLayoutId(layoutEl);
              const styleKey = buildTextStyleKey(fontStyle);
              const yBucketPx = Math.round(firstRect.top / 2) * 2; // tolerate small pixel drift
              const key = `${layoutId}|${styleKey}|${yBucketPx}|${textAlign}`;

              const existing = aggregatedTextByKey.get(key);
              if (existing) {
                existing.text = `${existing.text ?? ''}${str}`;
                existing.cssNoWrap = (existing.cssNoWrap ?? false) || cssNoWrap;
                existing.rectsLen = Math.max(existing.rectsLen ?? 0, rectsLen);
                existing.noWrap = (existing.noWrap ?? true) && noWrap;
              } else {
                aggregatedTextByKey.set(key, {
                  type: 'text',
                  x: xMmCellAligned,
                  y: y + baselineOffset,
                  w: px2mm(layoutRect.width),
                  h,
                  style: fontStyle,
                  text: str,
                  textAlign,
                  maxWidthMm: px2mm(contentWidthPx),
                  lineHeightMm,
                  noWrap,
                  cssNoWrap,
                  rectsLen,
                  zIndex: 20
                });
              }
            } else {
              // For non-aggregated text (mixed styles like <b>bold</b> normal),
              // use actual text position to avoid overlap
              items.push({
                type: 'text',
                x: xMmActual,
                y: y + baselineOffset,
                w: px2mm(firstRect.width),
                h,
                style: fontStyle,
                text: str,
                textAlign: 'left', // Use left align since we're positioning at actual x
                maxWidthMm: px2mm(contentWidthPx - (firstRect.left - contentLeftPx)), // Remaining width from text position
                lineHeightMm,
                noWrap,
                cssNoWrap,
                rectsLen,
                zIndex: 20
              });
            }
          }
        }
      }
      node = walker.nextNode();
    }

    if (aggregatedTextByKey.size > 0) {
      for (const item of aggregatedTextByKey.values()) {
        items.push(item);
      }
    }

    // Wait for all image conversions to complete
    await Promise.all(imagePromises);

    if (cfg.debug) {
      console.log(`[Globe3PDF] Element ${elemIdx + 1}: Parsed ${items.length} render items`);
    }

    // Store items for this element
    allElementItems.push({ items, pageBreakBeforeYs });
  } // End of elements loop

  // --- Module 2: PDF Renderer ---
  const doc = new jsPDF({
    orientation: cfg.orientation,
    unit: 'mm',
    format: cfg.pageSize
  });

  const pageH = doc.internal.pageSize.getHeight();
  const contentH = pageH - cfg.margins.top - cfg.margins.bottom;

  const debugTextRows: Array<Record<string, unknown>> = [];

  // Track the starting page for each element (for multi-element support)
  let currentStartPage = 1;

  // Process each element's items
  for (let elemIdx = 0; elemIdx < allElementItems.length; elemIdx++) {
    const { items, pageBreakBeforeYs } = allElementItems[elemIdx];

    // For elements after the first, start on a new page
    if (elemIdx > 0) {
      doc.addPage();
      currentStartPage = doc.getNumberOfPages();
    }

    const uniqueBreaks = Array.from(new Set(pageBreakBeforeYs.filter((y: number) => Number.isFinite(y) && y > 0))).sort((a, b) => a - b);

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

    items.sort((a: RenderItem, b: RenderItem) => a.zIndex - b.zIndex).forEach((item: RenderItem) => {
      // Pagination
      const forcedBreakCount = uniqueBreaks.length ? countBreaksAtOrBefore(item.y) : 0;
      const forcedOffset = forcedBreakCount > 0 ? uniqueBreaks[forcedBreakCount - 1] : 0;
      const relativeY = item.y - forcedOffset;

      let renderY = cfg.margins.top + relativeY;
      // pageIndex is relative to this element, add currentStartPage offset for absolute page number
      const localPageIndex = forcedBreakCount + Math.floor(relativeY / contentH) + 1;
      const absolutePageIndex = currentStartPage + localPageIndex - 1;

      // Adjust Y for subsequent pages within this element
      if (localPageIndex > 1) {
        renderY = cfg.margins.top + (relativeY % contentH);
      }

      // Ensure page exists
      while (doc.getNumberOfPages() < absolutePageIndex) {
        doc.addPage();
      }
      doc.setPage(absolutePageIndex);

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

      // Render debug rect (cell content box)
      else if (item.type === 'debugRect' && cfg.debugOverlay.enabled) {
        const [r, g, b] = cfg.debugOverlay.strokeColorRgb;
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(cfg.debugOverlay.lineWidthMm);
        doc.rect(item.x, renderY, item.w, item.h, 'D');
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

        const align = item.textAlign || 'left';
        const maxWidthMm = item.maxWidthMm ?? 0;
        const lineHeightMm = item.lineHeightMm ?? px2mm(parseFloat(item.style.fontSize)) * 1.2 * cfg.text.scale;
        const pdfTextWidthMm = doc.getTextWidth(item.text);
        const lines = item.noWrap ? [item.text] : wrapTextToWidth(doc, item.text, maxWidthMm);
        const baseY = renderY;

        if (cfg.debug && cfg.debugOverlay.enabled && maxWidthMm > 0) {
          debugTextRows.push({
            text: item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text,
            rectsLen: item.rectsLen ?? null,
            cssNoWrap: item.cssNoWrap ?? null,
            noWrapFinal: item.noWrap ?? null,
            maxWidthMm: Number(maxWidthMm.toFixed(2)),
            pdfTextWidthMm: Number(pdfTextWidthMm.toFixed(2)),
            wrappedLines: lines.length,
            align
          });
        }

        for (let i = 0; i < lines.length; i++) {
          doc.text(lines[i], item.x, baseY + i * lineHeightMm, { baseline: 'alphabetic', align });
        }
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

    // Update currentStartPage for the next element (start on a new page)
    currentStartPage = doc.getNumberOfPages() + 1;
  } // End of allElementItems loop

  if (cfg.debug) {
    console.log(`[Globe3PDF] Generated ${doc.getNumberOfPages()} page(s) from ${allElementItems.length} element(s)`);
  }

  if (cfg.debug && cfg.debugOverlay.enabled && debugTextRows.length > 0) {
    console.table(debugTextRows);
  }

  doc.save(cfg.filename);
};

// Export for UMD/global usage
export default { generatePdf, DEFAULT_CONFIG };
