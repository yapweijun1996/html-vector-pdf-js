import { parsePx } from '../pdfUnits';
import { DomParseContext } from './context';

export const maybeAddDebugOverlayForTableCell = (
  ctx: DomParseContext,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  rect: DOMRect
): void => {
  if (!ctx.cfg.debugOverlay.enabled) return;
  if (el.tagName !== 'TD' && el.tagName !== 'TH') return;

  const paddingL = parsePx(style.paddingLeft);
  const paddingR = parsePx(style.paddingRight);
  const paddingT = parsePx(style.paddingTop);
  const paddingB = parsePx(style.paddingBottom);

  const contentLeftPx = rect.left + paddingL;
  const contentRightPx = rect.right - paddingR;
  const contentTopPx = rect.top + paddingT;
  const contentBottomPx = rect.bottom - paddingB;

  const contentX = ctx.cfg.margins.left + ctx.px2mm(contentLeftPx - ctx.rootRect.left);
  const contentY = ctx.px2mm(contentTopPx - ctx.rootRect.top);
  const contentW = ctx.px2mm(Math.max(0, contentRightPx - contentLeftPx));
  const contentH = ctx.px2mm(Math.max(0, contentBottomPx - contentTopPx));

  ctx.items.push({
    type: 'debugRect',
    x: contentX,
    y: contentY,
    w: contentW,
    h: contentH,
    style,
    zIndex: 12
  });
};

