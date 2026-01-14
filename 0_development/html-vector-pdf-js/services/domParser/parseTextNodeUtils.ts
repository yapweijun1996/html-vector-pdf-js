import { parsePx } from '../pdfUnits';
import { buildTextStyleKey } from '../textLayout';
import { DomParseContext } from './context';

export const processWhitespace = (txt: Text): string | null => {
    const rawText = txt.textContent || '';
    if (!/\S/.test(rawText)) return null;

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
    /**** AMENDMENT [start] "Allow multi-rect text aggregation for document.write cases" ****/
    /****
    if (rectsLen !== 1) return false;
    ****/
    // Removed strict rectsLen check - script-injected text may have multiple rects
    // but should still aggregate if in same cell with same style
    /**** AMENDMENT [end] "Allow multi-rect text aggregation for document.write cases" ****/
    if (hasFloatingChildren) return false;
    if (hasLayoutImpact) return false;
    if (ctx.cellHasMixedTextStyles(layoutEl)) return false;
    if (buildTextStyleKey(fontStyle) !== buildTextStyleKey(window.getComputedStyle(layoutEl))) return false;

    return true;
};
