import { parsePx } from '../pdfUnits';
import { buildTextStyleKey } from '../textLayout';
import { DomParseContext } from './context';

export const processWhitespace = (txt: Text): string | null => {
    const rawText = txt.textContent || '';
    // \u00a0 (non-breaking space from &nbsp;) is treated as \s by JS regex,
    // so !\S alone would drop text nodes that contain only &nbsp; characters.
    // Keep any text node that has real content (\S) OR non-breaking spaces (\u00a0).
    if (!/[\S\u00a0]/.test(rawText)) return null;

    if (txt.parentElement && txt.parentElement.closest('canvas')) return null;

    const parentElForWhitespace = txt.parentElement;
    const parentWhiteSpace = parentElForWhitespace ? (window.getComputedStyle(parentElForWhitespace).whiteSpace || '') : '';
    const ws = parentWhiteSpace.toLowerCase();
    const preservesBoundaryWhitespace = ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces';

    const hasMeaningfulSibling = (direction: 'prev' | 'next'): boolean => {
        let sib: Node | null = direction === 'prev' ? txt.previousSibling : txt.nextSibling;
        while (sib) {
            if (sib.nodeType === Node.ELEMENT_NODE) {
                const tag = (sib as HTMLElement).tagName.toUpperCase();
                if (tag === 'BR') return false;
                return true;
            }
            if (sib.nodeType === Node.TEXT_NODE) {
                const t = (sib.textContent || '').replace(/\u00a0/g, ' ');
                if (/\S/.test(t)) return true;
            }
            sib = direction === 'prev' ? sib.previousSibling : sib.nextSibling;
        }
        return false;
    };

    const startsWithSpace = /^[\s\u00a0]/.test(rawText);
    const endsWithSpace = /[\s\u00a0]$/.test(rawText);

    const collapseNonNbspWhitespace = (s: string): string => s.replace(/[ \t\r\n\f\v]+/g, ' ');
    const trimNonNbspWhitespace = (s: string): string => s.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');

    let str = trimNonNbspWhitespace(collapseNonNbspWhitespace(rawText));

    if (!preservesBoundaryWhitespace) {
        if (startsWithSpace && hasMeaningfulSibling('prev')) str = ` ${str}`;
        if (endsWithSpace && hasMeaningfulSibling('next')) str = `${str} `;
    } else {
        if (startsWithSpace) str = ` ${str}`;
        if (endsWithSpace) str = `${str} `;
    }

    return str;
};

export const applyTextTransform = (str: string, style: CSSStyleDeclaration): string => {
    const tt = (style.textTransform || 'none').toLowerCase();
    if (tt === 'uppercase') return str.toUpperCase();
    if (tt === 'lowercase') return str.toLowerCase();
    if (tt === 'capitalize') return str.replace(/\b[a-z]/gi, (l) => l.toUpperCase());
    return str;
};

export const checkIsFloating = (el: HTMLElement | null, limit: HTMLElement): boolean => {
    let curr: HTMLElement | null = el;
    while (curr && curr !== limit && curr !== document.body) {
        const s = window.getComputedStyle(curr);
        if ((s.float !== 'none' && s.float !== '') || s.position === 'absolute' || s.position === 'fixed') {
            return true;
        }
        curr = curr.parentElement;
    }
    return false;
};

export const checkHasLayoutImpact = (parentEl: HTMLElement, layoutEl: HTMLElement): boolean => {
    if (parentEl === layoutEl) return false;

    let curr: HTMLElement | null = parentEl;
    while (curr && curr !== layoutEl) {
        const s = window.getComputedStyle(curr);
        if (
            s.display === 'block' ||
            s.display === 'inline-block' ||
            parsePx(s.paddingLeft) > 0 ||
            parsePx(s.paddingRight) > 0 ||
            parsePx(s.paddingTop) > 0 ||
            parsePx(s.paddingBottom) > 0 ||
            parsePx(s.marginLeft) > 0 ||
            parsePx(s.marginRight) > 0 ||
            parsePx(s.borderLeftWidth) > 0 ||
            parsePx(s.borderRightWidth) > 0
        ) {
            return true;
        }
        curr = curr.parentElement;
    }
    return false;
};

export const canAggregateText = (
    ctx: DomParseContext,
    layoutEl: HTMLElement,
    fontStyle: CSSStyleDeclaration,
    rectsLen: number,
    inTableCell: boolean,
    hasFloatingChildren: boolean,
    hasLayoutImpact: boolean
): boolean => {
    if (!inTableCell) return false;
    if (hasFloatingChildren) return false;
    if (hasLayoutImpact) return false;
    if (ctx.cellHasMixedTextStyles(layoutEl)) return false;

    // Don't aggregate when the cell contains inline-block children mixed in text flow.
    // Inline-block elements occupy space in the text run; merging all text into one
    // chunk causes jsPDF to re-lay it out without knowing where the boxes break the flow,
    // resulting in text and boxes rendered at wrong x positions.
    const hasInlineBlockChild = Array.from(layoutEl.childNodes).some(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        return window.getComputedStyle(node as HTMLElement).display === 'inline-block';
    });
    if (hasInlineBlockChild) return false;

    return true;
};
