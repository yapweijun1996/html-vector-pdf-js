import { DomParseContext } from './context';
import { maybeAddDebugOverlayForTableCell } from './parseElementNode.debug';
import { maybeAddBackgroundColor, maybeAddBackgroundImage } from './parseElementNode.background';
import { maybeAddBorder } from './parseElementNode.border';
import { maybeAddFormFieldValueText } from './parseElementNode.form';
import { maybeAddCanvasSnapshot, maybeAddImg } from './parseElementNode.media';

export const parseElementNode = (
  ctx: DomParseContext,
  el: HTMLElement,
  imagePromises: Promise<void>[]
): void => {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  if (style.display === 'none' || style.opacity === '0' || rect.width <= 0 || rect.height <= 0) return;

  const x = ctx.cfg.margins.left + ctx.px2mm(rect.left - ctx.rootRect.left);
  const y = ctx.px2mm(rect.top - ctx.rootRect.top);
  const w = ctx.px2mm(rect.width);
  const h = ctx.px2mm(rect.height);
  const box = { x, y, w, h };

  maybeAddDebugOverlayForTableCell(ctx, el, style, rect);
  maybeAddBackgroundColor(ctx, style, box);
  maybeAddBackgroundImage(ctx, style, rect, box, imagePromises);
  maybeAddBorder(ctx, style, box);
  maybeAddFormFieldValueText(ctx, el, style, rect);
  maybeAddCanvasSnapshot(ctx, el, style, box);
  maybeAddImg(ctx, el, style, rect, box, imagePromises);
};
