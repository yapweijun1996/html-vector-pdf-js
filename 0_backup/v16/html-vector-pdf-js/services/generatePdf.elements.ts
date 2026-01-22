import { HtmlToVectorPdfError } from './errors';

// ============================================================================
// Element Selection Helpers
// ============================================================================

/**
 * Find HTML elements by selector or direct element reference
 * Supports: ID string, CSS selector, or HTMLElement
 * @param elementOrSelector - Element ID, CSS selector, or HTMLElement
 * @returns Array of found HTMLElements
 * @throws HtmlToVectorPdfError if no elements found
 */
export const findElements = (elementOrSelector: string | HTMLElement): HTMLElement[] => {
    let elements: HTMLElement[] = [];

    if (typeof elementOrSelector === 'string') {
        // Try getElementById first for ID strings
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
        throw new HtmlToVectorPdfError(
            'ELEMENT_NOT_FOUND',
            'Element not found',
            { target: elementOrSelector }
        );
    }

    return elements;
};

/**
 * Validate that elements have non-zero dimensions
 * @param elements - Array of HTMLElements to validate
 * @param elementOrSelector - Original selector for error reporting
 * @throws HtmlToVectorPdfError if any element has zero width or height
 */
export const validateElementSizes = (
    elements: HTMLElement[],
    elementOrSelector: string | HTMLElement
): void => {
    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            throw new HtmlToVectorPdfError(
                'ELEMENT_ZERO_SIZE',
                'Element has zero size',
                {
                    target: typeof elementOrSelector === 'string' ? elementOrSelector : 'HTMLElement',
                    width: rect.width,
                    height: rect.height
                }
            );
        }
    }
};
