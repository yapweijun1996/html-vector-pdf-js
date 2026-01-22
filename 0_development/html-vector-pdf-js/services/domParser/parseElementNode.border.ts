import { parseColor } from '../colors';
import { DomParseContext } from './context';

export const maybeAddBorder = (
  ctx: DomParseContext,
  style: CSSStyleDeclaration,
  box: { x: number; y: number; w: number; h: number }
): void => {
  const bt = parseFloat(style.borderTopWidth);
  const br = parseFloat(style.borderRightWidth);
  const bb = parseFloat(style.borderBottomWidth);
  const bl = parseFloat(style.borderLeftWidth);
  if (!(bt > 0 || br > 0 || bb > 0 || bl > 0)) return;

  const borderColors = {
    t: parseColor(style.borderTopColor),
    r: parseColor(style.borderRightColor),
    b: parseColor(style.borderBottomColor),
    l: parseColor(style.borderLeftColor)
  };

  const borderStyles = {
    t: style.borderTopStyle || 'solid',
    r: style.borderRightStyle || 'solid',
    b: style.borderBottomStyle || 'solid',
    l: style.borderLeftStyle || 'solid'
  };

  if (ctx.cfg.debug && (borderStyles.b === 'double' || borderStyles.t === 'double')) {
    console.log('[html_to_vector_pdf] border=double', {
      borderBottomStyle: borderStyles.b,
      borderBottomWidth: bb,
      borderTopStyle: borderStyles.t,
      borderTopWidth: bt
    });
  }

  ctx.items.push({
    type: 'border',
    ...box,
    style,
    zIndex: 10,
    borderSides: { t: bt, r: br, b: bb, l: bl },
    borderColors,
    borderStyles
  });
};

