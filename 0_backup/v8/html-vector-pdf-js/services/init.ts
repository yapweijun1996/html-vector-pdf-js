import { PdfConfig } from './pdfConfig';
import { generatePdf } from './generatePdf';

export type HtmlToVectorPdfButtonMode = 'inject' | 'bind' | 'none';

export interface HtmlToVectorPdfInitOptions {
  selector?: string;
  button?: {
    mode?: HtmlToVectorPdfButtonMode;
    targetSelector?: string;
    label?: string;
    generatingLabel?: string;
    fixed?: boolean;
  };
  pdf?: Pick<PdfConfig, 'filename' | 'pageSize' | 'orientation' | 'margins'>;
  generate?: Omit<PdfConfig, 'filename' | 'pageSize' | 'orientation' | 'margins'>;
  filename?: string | ((ctx: { now: Date }) => string);
  onProgress?: NonNullable<PdfConfig['callbacks']>['onProgress'];
  onError?: NonNullable<PdfConfig['callbacks']>['onError'];
}

type InitState = {
  options: Required<HtmlToVectorPdfInitOptions>;
  buttonEl: HTMLButtonElement | null;
  boundEl: Element | null;
  clickHandler: ((ev: Event) => void) | null;
};

const defaultFileName = ({ now }: { now: Date }): string => {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `html_export_${yyyy}${mm}${dd}_${hh}${mi}${ss}.pdf`;
};

const DEFAULT_INIT_OPTIONS: Required<HtmlToVectorPdfInitOptions> = {
  selector: '.html_to_vector_pdf',
  button: {
    mode: 'inject',
    targetSelector: '',
    label: 'Download PDF',
    generatingLabel: 'Generating…',
    fixed: true
  },
  pdf: {},
  generate: {},
  filename: defaultFileName,
  onProgress: undefined,
  onError: undefined
};

let state: InitState | null = null;

const applyButtonStyles = (btn: HTMLButtonElement): void => {
  btn.type = 'button';
  btn.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  btn.style.fontSize = '14px';
  btn.style.lineHeight = '1';
  btn.style.padding = '10px 12px';
  btn.style.borderRadius = '10px';
  btn.style.border = '1px solid rgba(0,0,0,0.12)';
  btn.style.background = 'white';
  btn.style.color = '#111827';
  btn.style.boxShadow = '0 6px 24px rgba(0,0,0,0.12)';
  btn.style.cursor = 'pointer';
  btn.style.userSelect = 'none';
  btn.style.touchAction = 'manipulation';
};

const ensureContainerPosition = (container: HTMLElement): void => {
  const style = window.getComputedStyle(container);
  if (style.position === 'static') container.style.position = 'relative';
};

const injectButton = (options: Required<HtmlToVectorPdfInitOptions>): HTMLButtonElement | null => {
  const container = document.querySelector(options.selector) as HTMLElement | null;
  if (!container) return null;
  ensureContainerPosition(container);

  const btn = document.createElement('button');
  btn.id = 'html-to-vector-pdf-btn';
  btn.textContent = options.button.label;
  applyButtonStyles(btn);

  if (options.button.fixed) {
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.top = '16px';
    btn.style.zIndex = '2147483647';
  } else {
    btn.style.position = 'absolute';
    btn.style.right = '12px';
    btn.style.top = '12px';
    btn.style.zIndex = '10';
  }

  (options.button.fixed ? document.body : container).appendChild(btn);
  return btn;
};

const bindButton = (options: Required<HtmlToVectorPdfInitOptions>): Element | null => {
  if (!options.button.targetSelector) return null;
  return document.querySelector(options.button.targetSelector);
};

const setButtonBusy = (btn: HTMLElement, busy: boolean, options: Required<HtmlToVectorPdfInitOptions>): void => {
  if (btn instanceof HTMLButtonElement) btn.disabled = busy;
  btn.textContent = busy ? options.button.generatingLabel : options.button.label;
  btn.style.opacity = busy ? '0.65' : '1';
  btn.style.cursor = busy ? 'not-allowed' : 'pointer';
};

export const exportPdf = async (override?: Partial<HtmlToVectorPdfInitOptions>): Promise<void> => {
  if (!state) throw new Error('HtmlToVectorPDF is not initialized. Call init(options) first.');
  const merged: Required<HtmlToVectorPdfInitOptions> = {
    ...state.options,
    ...(override || {}),
    button: { ...state.options.button, ...(override?.button || {}) },
    pdf: { ...state.options.pdf, ...(override?.pdf || {}) },
    generate: { ...state.options.generate, ...(override?.generate || {}) }
  };

  const filenameSource = merged.filename ?? state.options.filename;
  const filename = typeof filenameSource === 'function' ? filenameSource({ now: new Date() }) : filenameSource;

  await generatePdf(merged.selector, {
    ...(merged.generate || {}),
    ...(merged.pdf || {}),
    filename,
    callbacks: {
      onProgress: merged.onProgress,
      onError: merged.onError
    }
  });
};

export const init = (options: HtmlToVectorPdfInitOptions = {}): void => {
  const merged: Required<HtmlToVectorPdfInitOptions> = {
    ...DEFAULT_INIT_OPTIONS,
    ...options,
    button: { ...DEFAULT_INIT_OPTIONS.button, ...(options.button || {}) },
    pdf: { ...DEFAULT_INIT_OPTIONS.pdf, ...(options.pdf || {}) },
    generate: { ...DEFAULT_INIT_OPTIONS.generate, ...(options.generate || {}) }
  };

  if (state?.clickHandler) {
    if (state.buttonEl) state.buttonEl.removeEventListener('click', state.clickHandler);
    if (state.boundEl) state.boundEl.removeEventListener('click', state.clickHandler);
  }
  if (state?.buttonEl) state.buttonEl.remove();

  const clickHandler = (ev: Event): void => {
    ev.preventDefault();
    void (async () => {
      const btn = state?.buttonEl || (state?.boundEl as HTMLElement | null);
      if (btn) setButtonBusy(btn, true, merged);
      try {
        await exportPdf();
      } finally {
        if (btn) setButtonBusy(btn, false, merged);
      }
    })();
  };

  let buttonEl: HTMLButtonElement | null = null;
  let boundEl: Element | null = null;
  if (merged.button.mode === 'inject') {
    buttonEl = injectButton(merged);
    if (buttonEl) buttonEl.addEventListener('click', clickHandler);
  } else if (merged.button.mode === 'bind') {
    boundEl = bindButton(merged);
    if (boundEl) boundEl.addEventListener('click', clickHandler);
  }

  state = { options: merged, buttonEl, boundEl, clickHandler };
};

export const destroy = (): void => {
  if (!state) return;
  if (state.clickHandler) {
    if (state.buttonEl) state.buttonEl.removeEventListener('click', state.clickHandler);
    if (state.boundEl) state.boundEl.removeEventListener('click', state.clickHandler);
  }
  if (state.buttonEl) state.buttonEl.remove();
  state = null;
};
