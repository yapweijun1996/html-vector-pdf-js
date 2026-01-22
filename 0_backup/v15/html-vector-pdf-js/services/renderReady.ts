/**
 * renderReady.ts
 * Utility to wait for DOM rendering to complete before PDF generation.
 * Ensures fonts, images, and layout are fully loaded and stable.
 */

export interface RenderReadyOptions {
    /** Maximum time to wait for all resources (ms). Default: 10000 */
    timeout?: number;
    /** Enable debug logging. Default: false */
    debug?: boolean;
    /** Minimum frames to wait for layout stability. Default: 2 */
    minFrames?: number;
    /** Additional delay after resources load (ms). Default: 50 */
    settleDelay?: number;
}

const DEFAULT_OPTIONS: Required<RenderReadyOptions> = {
    timeout: 10000,
    debug: false,
    minFrames: 2,
    settleDelay: 50
};

/**
 * Wait for N animation frames to ensure layout is stable
 */
const waitForFrames = (count: number): Promise<void> => {
    return new Promise((resolve) => {
        let remaining = count;
        const tick = () => {
            remaining--;
            if (remaining <= 0) {
                resolve();
            } else {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    });
};

/**
 * Wait for document.fonts.ready (browser font loading)
 */
const waitForFonts = async (debug: boolean): Promise<void> => {
    if (typeof document === 'undefined') return;
    if (!document.fonts?.ready) {
        if (debug) console.log('[renderReady] document.fonts.ready not supported, skipping font wait');
        return;
    }

    try {
        await document.fonts.ready;
        if (debug) console.log('[renderReady] Fonts ready');
    } catch (e) {
        if (debug) console.warn('[renderReady] Font loading check failed:', e);
    }
};

/**
 * Wait for all images within an element to load
 */
const waitForImages = (element: HTMLElement, debug: boolean): Promise<void> => {
    return new Promise((resolve) => {
        const images = element.querySelectorAll('img');
        if (images.length === 0) {
            if (debug) console.log('[renderReady] No images found');
            resolve();
            return;
        }

        let loadedCount = 0;
        let errorCount = 0;
        const totalImages = images.length;

        const checkComplete = () => {
            if (loadedCount + errorCount >= totalImages) {
                if (debug) {
                    console.log(`[renderReady] Images complete: ${loadedCount} loaded, ${errorCount} errors, ${totalImages} total`);
                }
                resolve();
            }
        };

        images.forEach((img) => {
            if (img.complete && img.naturalHeight > 0) {
                loadedCount++;
                checkComplete();
            } else if (img.complete) {
                // complete but naturalHeight = 0 means error or empty
                errorCount++;
                checkComplete();
            } else {
                const onLoad = () => {
                    loadedCount++;
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                    checkComplete();
                };
                const onError = () => {
                    errorCount++;
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                    checkComplete();
                };
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
            }
        });

        // Initial check in case all images are already loaded
        checkComplete();
    });
};

/**
 * Wait for background images (CSS) to load
 * This checks computed styles for background-image URLs and preloads them
 */
const waitForBackgroundImages = async (element: HTMLElement, debug: boolean): Promise<void> => {
    const bgUrls = new Set<string>();

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode as HTMLElement;

    while (node) {
        const style = window.getComputedStyle(node);
        const bgImage = style.backgroundImage;

        if (bgImage && bgImage !== 'none') {
            // Extract URL from background-image: url("...")
            const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch && urlMatch[1]) {
                bgUrls.add(urlMatch[1]);
            }
        }
        node = walker.nextNode() as HTMLElement;
    }

    if (bgUrls.size === 0) {
        if (debug) console.log('[renderReady] No background images found');
        return;
    }

    if (debug) console.log(`[renderReady] Found ${bgUrls.size} background images to preload`);

    const preloadPromises = Array.from(bgUrls).map((url) => {
        return new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Don't fail on error
            img.src = url;
        });
    });

    await Promise.all(preloadPromises);
    if (debug) console.log('[renderReady] Background images loaded');
};

/**
 * Main entry: Wait for rendering to be ready
 * @param element - The root element to check for resources
 * @param options - Configuration options
 */
export const waitForRenderReady = async (
    element: HTMLElement,
    options: RenderReadyOptions = {}
): Promise<void> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { timeout, debug, minFrames, settleDelay } = opts;

    if (debug) console.log('[renderReady] Starting render ready check...');

    // Create a timeout promise
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), timeout);
    });

    // Create the actual wait promise
    const waitPromise = (async (): Promise<'done'> => {
        // Step 1: Wait for fonts
        await waitForFonts(debug);

        // Step 2: Wait for images (parallel with background images)
        await Promise.all([
            waitForImages(element, debug),
            waitForBackgroundImages(element, debug)
        ]);

        // Step 3: Wait for layout frames
        if (debug) console.log(`[renderReady] Waiting for ${minFrames} animation frames...`);
        await waitForFrames(minFrames);

        // Step 4: Settle delay for any final reflows
        if (settleDelay > 0) {
            if (debug) console.log(`[renderReady] Settle delay: ${settleDelay}ms`);
            await new Promise((r) => setTimeout(r, settleDelay));
        }

        // Step 5: One more frame after settle
        await waitForFrames(1);

        if (debug) console.log('[renderReady] Render ready complete');
        return 'done';
    })();

    // Race: complete or timeout
    const result = await Promise.race([waitPromise, timeoutPromise]);

    if (result === 'timeout') {
        if (debug) console.warn(`[renderReady] Timed out after ${timeout}ms, proceeding anyway`);
    }
};

/**
 * Wait for render ready on multiple elements
 */
export const waitForElementsReady = async (
    elements: HTMLElement[],
    options: RenderReadyOptions = {}
): Promise<void> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { debug } = opts;

    if (elements.length === 0) return;

    if (debug) console.log(`[renderReady] Checking ${elements.length} element(s)...`);

    // Wait for fonts first (global)
    await waitForFonts(debug);

    // Wait for all elements' images in parallel
    const imagePromises = elements.flatMap((el) => [
        waitForImages(el, debug),
        waitForBackgroundImages(el, debug)
    ]);

    await Promise.all(imagePromises);

    // Layout frames
    await waitForFrames(opts.minFrames);

    // Settle
    if (opts.settleDelay > 0) {
        await new Promise((r) => setTimeout(r, opts.settleDelay));
    }

    // Final frame
    await waitForFrames(1);

    if (debug) console.log('[renderReady] All elements ready');
};
