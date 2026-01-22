/**
 * UI Loader Functions
 * Handles the full-screen loading overlay
 */

const LOADER_ID = 'html-vector-pdf-loader-gen';

/**
 * Show a full-screen loading overlay with spinner
 * @param label - Text to display in the loader (default: 'Generating PDF...')
 */
export const showLoaderUI = (label: string = 'Generating PDF...'): void => {
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
export const hideLoaderUI = (): void => {
  if (typeof document === 'undefined') return;
  const loader = document.getElementById(LOADER_ID);
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 200);
  }
};
