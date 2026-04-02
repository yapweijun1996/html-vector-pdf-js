import { parseColor } from '../colors';
import { RenderItem } from '../renderItems';
import type { DomParseContext } from './context';

export interface CollapseTableInfo {
  table: HTMLTableElement;
  tableId: number;
  rect: DOMRect;
}

export interface CollapseBorderCandidate {
  tableId: number;
  orientation: 'h' | 'v';
  coordPx: number;
  startPx: number;
  endPx: number;
  widthPx: number;
  color: [number, number, number];
  style: string;
  sourceSide: 't' | 'r' | 'b' | 'l';
  isOuterBorder: boolean;
  sourceOrder: number;
  styleRef: CSSStyleDeclaration;
}

const COLLAPSE_TOLERANCE_PX = 0.5;
const COLLAPSE_BORDER_PARTICIPANT_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH']);
const BORDER_STYLE_PRIORITY: Record<string, number> = {
  none: 0,
  hidden: 0,
  dotted: 1,
  dashed: 2,
  solid: 3,
  double: 4
};

const normalizePx = (value: number): number => Math.round(value * 100) / 100;

const isVisibleBorderStyle = (style: string): boolean => {
  const normalized = (style || 'solid').toLowerCase();
  return normalized !== 'none' && normalized !== 'hidden';
};

const findNearestTable = (el: Element | null): HTMLTableElement | null => {
  if (!el) return null;
  if (el instanceof HTMLTableElement) return el;
  const table = el.closest('table');
  return table instanceof HTMLTableElement ? table : null;
};

export const createCollapseTableInfoGetter = (
  getLayoutId: (el: Element) => number
): ((el: Element | null) => CollapseTableInfo | null) => {
  const cache = new WeakMap<Element, CollapseTableInfo | null>();

  return (el: Element | null): CollapseTableInfo | null => {
    if (!el) return null;
    const cached = cache.get(el);
    if (cached !== undefined) return cached;

    const table = findNearestTable(el);
    if (!table) {
      cache.set(el, null);
      return null;
    }

    const tableStyle = window.getComputedStyle(table);
    if ((tableStyle.borderCollapse || '').toLowerCase() !== 'collapse') {
      cache.set(el, null);
      return null;
    }

    const info: CollapseTableInfo = {
      table,
      tableId: getLayoutId(table),
      rect: table.getBoundingClientRect()
    };
    cache.set(el, info);
    return info;
  };
};

export const isCollapseBorderParticipant = (el: Element, info: CollapseTableInfo | null): boolean => {
  if (!info) return false;
  if (findNearestTable(el) !== info.table) return false;
  return COLLAPSE_BORDER_PARTICIPANT_TAGS.has(el.tagName.toUpperCase());
};

const pushCandidate = (
  ctx: DomParseContext,
  info: CollapseTableInfo,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  side: 't' | 'r' | 'b' | 'l',
  widthPx: number,
  borderStyle: string,
  color: [number, number, number]
): void => {
  if (!(widthPx > 0) || !isVisibleBorderStyle(borderStyle)) return;

  const tableRect = info.rect;
  const isHorizontal = side === 't' || side === 'b';
  const coordPx = side === 't'
    ? rect.top
    : side === 'b'
      ? rect.bottom
      : side === 'l'
        ? rect.left
        : rect.right;
  const startPx = isHorizontal ? rect.left : rect.top;
  const endPx = isHorizontal ? rect.right : rect.bottom;
  const isOuterBorder = side === 't'
    ? Math.abs(coordPx - tableRect.top) <= COLLAPSE_TOLERANCE_PX
    : side === 'b'
      ? Math.abs(coordPx - tableRect.bottom) <= COLLAPSE_TOLERANCE_PX
      : side === 'l'
        ? Math.abs(coordPx - tableRect.left) <= COLLAPSE_TOLERANCE_PX
        : Math.abs(coordPx - tableRect.right) <= COLLAPSE_TOLERANCE_PX;

  ctx.collapsedBorderCandidates.push({
    tableId: info.tableId,
    orientation: isHorizontal ? 'h' : 'v',
    coordPx: normalizePx(coordPx),
    startPx: normalizePx(Math.min(startPx, endPx)),
    endPx: normalizePx(Math.max(startPx, endPx)),
    widthPx,
    color,
    style: (borderStyle || 'solid').toLowerCase(),
    sourceSide: side,
    isOuterBorder,
    sourceOrder: ++ctx.collapseBorderSourceOrder,
    styleRef: style
  });
};

export const collectCollapsedBorderCandidates = (
  ctx: DomParseContext,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  rect: DOMRect
): boolean => {
  const info = ctx.getCollapseTableInfo(el);
  if (!isCollapseBorderParticipant(el, info)) return false;

  pushCandidate(ctx, info!, style, rect, 't', parseFloat(style.borderTopWidth), style.borderTopStyle, parseColor(style.borderTopColor));
  pushCandidate(ctx, info!, style, rect, 'r', parseFloat(style.borderRightWidth), style.borderRightStyle, parseColor(style.borderRightColor));
  pushCandidate(ctx, info!, style, rect, 'b', parseFloat(style.borderBottomWidth), style.borderBottomStyle, parseColor(style.borderBottomColor));
  pushCandidate(ctx, info!, style, rect, 'l', parseFloat(style.borderLeftWidth), style.borderLeftStyle, parseColor(style.borderLeftColor));

  return true;
};

const compareCandidates = (a: CollapseBorderCandidate, b: CollapseBorderCandidate): number => {
  if (a.widthPx !== b.widthPx) return a.widthPx - b.widthPx;
  const aPriority = BORDER_STYLE_PRIORITY[a.style] ?? 0;
  const bPriority = BORDER_STYLE_PRIORITY[b.style] ?? 0;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.sourceOrder - b.sourceOrder;
};

const sameWinningStroke = (a: CollapseBorderCandidate, b: CollapseBorderCandidate): boolean => {
  return a.tableId === b.tableId &&
    a.widthPx === b.widthPx &&
    a.style === b.style &&
    a.sourceSide === b.sourceSide &&
    a.isOuterBorder === b.isOuterBorder &&
    a.color[0] === b.color[0] &&
    a.color[1] === b.color[1] &&
    a.color[2] === b.color[2];
};

const resolveIntervalsForCoordGroup = (
  group: CollapseBorderCandidate[],
  rootRect: DOMRect,
  px2mm: (px: number) => number,
  marginLeftMm: number
): RenderItem[] => {
  const breakpoints = new Set<number>();
  for (const candidate of group) {
    breakpoints.add(candidate.startPx);
    breakpoints.add(candidate.endPx);
  }

  const points = Array.from(breakpoints).sort((a, b) => a - b);
  const resolved: Array<{ startPx: number; endPx: number; winner: CollapseBorderCandidate }> = [];

  for (let i = 0; i < points.length - 1; i++) {
    const startPx = points[i];
    const endPx = points[i + 1];
    if (endPx - startPx <= COLLAPSE_TOLERANCE_PX) continue;

    const covering = group.filter((candidate) => candidate.startPx <= startPx + COLLAPSE_TOLERANCE_PX && candidate.endPx >= endPx - COLLAPSE_TOLERANCE_PX);
    if (covering.length === 0) continue;

    const winner = covering.reduce((best, candidate) => compareCandidates(best, candidate) >= 0 ? best : candidate);
    const previous = resolved[resolved.length - 1];

    if (previous && Math.abs(previous.endPx - startPx) <= COLLAPSE_TOLERANCE_PX && sameWinningStroke(previous.winner, winner)) {
      previous.endPx = endPx;
    } else {
      resolved.push({ startPx, endPx, winner });
    }
  }

  return resolved.map(({ startPx, endPx, winner }) => {
    const coordMm = px2mm(winner.coordPx - rootRect.top);
    const startMm = marginLeftMm + px2mm(startPx - rootRect.left);
    const endMm = marginLeftMm + px2mm(endPx - rootRect.left);
    const startYmm = px2mm(startPx - rootRect.top);
    const endYmm = px2mm(endPx - rootRect.top);

    if (winner.orientation === 'h') {
      return {
        type: 'collapsedBorder',
        x: startMm,
        y: coordMm,
        w: Math.max(0, endMm - startMm),
        h: 0,
        style: winner.styleRef,
        zIndex: 10,
        collapseTableId: winner.tableId,
        collapseBorderOrientation: 'h',
        collapseBorderWidthPx: winner.widthPx,
        collapseBorderColor: winner.color,
        collapseBorderStyle: winner.style,
        collapseBorderSourceSide: winner.sourceSide,
        isOuterBorder: winner.isOuterBorder,
        borderSourceOrder: winner.sourceOrder
      };
    }

    return {
      type: 'collapsedBorder',
      x: marginLeftMm + px2mm(winner.coordPx - rootRect.left),
      y: startYmm,
      w: 0,
      h: Math.max(0, endYmm - startYmm),
      style: winner.styleRef,
      zIndex: 10,
      collapseTableId: winner.tableId,
      collapseBorderOrientation: 'v',
      collapseBorderWidthPx: winner.widthPx,
      collapseBorderColor: winner.color,
      collapseBorderStyle: winner.style,
      collapseBorderSourceSide: winner.sourceSide,
      isOuterBorder: winner.isOuterBorder,
      borderSourceOrder: winner.sourceOrder
    };
  });
};

export const buildCollapsedBorderItems = (
  candidates: CollapseBorderCandidate[],
  rootRect: DOMRect,
  px2mm: (px: number) => number,
  marginLeftMm: number
): RenderItem[] => {
  if (candidates.length === 0) return [];

  const byTableAndOrientation = new Map<string, CollapseBorderCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.tableId}|${candidate.orientation}`;
    const existing = byTableAndOrientation.get(key);
    if (existing) existing.push(candidate);
    else byTableAndOrientation.set(key, [candidate]);
  }

  const out: RenderItem[] = [];

  for (const group of byTableAndOrientation.values()) {
    group.sort((a, b) => {
      if (Math.abs(a.coordPx - b.coordPx) > COLLAPSE_TOLERANCE_PX) return a.coordPx - b.coordPx;
      if (Math.abs(a.startPx - b.startPx) > COLLAPSE_TOLERANCE_PX) return a.startPx - b.startPx;
      if (Math.abs(a.endPx - b.endPx) > COLLAPSE_TOLERANCE_PX) return a.endPx - b.endPx;
      return a.sourceOrder - b.sourceOrder;
    });

    let currentCoordGroup: CollapseBorderCandidate[] = [];
    let currentCoordPx: number | null = null;

    const flushCoordGroup = () => {
      if (currentCoordGroup.length === 0) return;
      out.push(...resolveIntervalsForCoordGroup(currentCoordGroup, rootRect, px2mm, marginLeftMm));
      currentCoordGroup = [];
      currentCoordPx = null;
    };

    for (const candidate of group) {
      if (currentCoordPx === null || Math.abs(candidate.coordPx - currentCoordPx) <= COLLAPSE_TOLERANCE_PX) {
        currentCoordGroup.push(candidate);
        currentCoordPx = currentCoordPx ?? candidate.coordPx;
        continue;
      }

      flushCoordGroup();
      currentCoordGroup.push(candidate);
      currentCoordPx = candidate.coordPx;
    }

    flushCoordGroup();
  }

  return out.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return (a.borderSourceOrder ?? 0) - (b.borderSourceOrder ?? 0);
  });
};
