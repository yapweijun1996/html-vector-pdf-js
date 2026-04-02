import jsPDF from 'jspdf';
import { RenderItem } from '../renderItems';
import { drawBorderSide } from './borderRenderer';

const adjustOuterBorderPosition = (
  item: RenderItem,
  renderY: number,
  px2mm: (px: number) => number
): { x1: number; y1: number; x2: number; y2: number } => {
  const widthMm = px2mm(item.collapseBorderWidthPx || 0);
  const halfWidthMm = widthMm / 2;
  let x1 = item.x;
  let y1 = renderY;
  let x2 = item.x + item.w;
  let y2 = renderY + item.h;

  if (item.isOuterBorder) {
    if (item.collapseBorderSourceSide === 't') {
      y1 += halfWidthMm;
      y2 += halfWidthMm;
    } else if (item.collapseBorderSourceSide === 'b') {
      y1 -= halfWidthMm;
      y2 -= halfWidthMm;
    } else if (item.collapseBorderSourceSide === 'l') {
      x1 += halfWidthMm;
      x2 += halfWidthMm;
    } else if (item.collapseBorderSourceSide === 'r') {
      x1 -= halfWidthMm;
      x2 -= halfWidthMm;
    }
  }

  return { x1, y1, x2, y2 };
};

export const renderCollapsedBorder = (
  doc: jsPDF,
  item: RenderItem,
  renderY: number,
  px2mm: (px: number) => number
): void => {
  if (item.type !== 'collapsedBorder' || !item.collapseBorderColor || !item.collapseBorderStyle || !item.collapseBorderSourceSide) {
    return;
  }

  const { x1, y1, x2, y2 } = adjustOuterBorderPosition(item, renderY, px2mm);

  drawBorderSide(
    doc,
    x1,
    y1,
    x2,
    y2,
    item.collapseBorderWidthPx || 0,
    item.collapseBorderColor,
    item.collapseBorderStyle,
    item.collapseBorderSourceSide,
    px2mm
  );
};
