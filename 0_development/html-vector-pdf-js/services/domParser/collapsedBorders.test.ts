import { describe, expect, it } from 'vitest';
import { buildCollapsedBorderItems, type CollapseBorderCandidate } from './collapsedBorders';

const styleRef = {} as CSSStyleDeclaration;
const rootRect = {
  left: 0,
  top: 0,
  right: 200,
  bottom: 200,
  width: 200,
  height: 200,
  x: 0,
  y: 0,
  toJSON: () => ({})
} as DOMRect;

describe('collapsedBorders', () => {
  it('resolves a shared border into a single collapsed segment', () => {
    const candidates: CollapseBorderCandidate[] = [
      {
        tableId: 1,
        orientation: 'h',
        coordPx: 20,
        startPx: 0,
        endPx: 100,
        widthPx: 1,
        color: [0, 0, 0],
        style: 'solid',
        sourceSide: 'b',
        isOuterBorder: false,
        sourceOrder: 1,
        styleRef
      },
      {
        tableId: 1,
        orientation: 'h',
        coordPx: 20,
        startPx: 0,
        endPx: 100,
        widthPx: 1,
        color: [0, 0, 0],
        style: 'solid',
        sourceSide: 't',
        isOuterBorder: false,
        sourceOrder: 2,
        styleRef
      }
    ];

    const items = buildCollapsedBorderItems(candidates, rootRect, (px) => px, 0);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'collapsedBorder',
      x: 0,
      y: 20,
      w: 100,
      h: 0,
      collapseBorderSourceSide: 't',
      isOuterBorder: false
    });
  });

  it('prefers wider borders over narrower ones on the same shared edge', () => {
    const candidates: CollapseBorderCandidate[] = [
      {
        tableId: 1,
        orientation: 'v',
        coordPx: 30,
        startPx: 0,
        endPx: 60,
        widthPx: 1,
        color: [0, 0, 0],
        style: 'solid',
        sourceSide: 'r',
        isOuterBorder: false,
        sourceOrder: 1,
        styleRef
      },
      {
        tableId: 1,
        orientation: 'v',
        coordPx: 30,
        startPx: 0,
        endPx: 60,
        widthPx: 2,
        color: [0, 0, 0],
        style: 'solid',
        sourceSide: 'l',
        isOuterBorder: false,
        sourceOrder: 2,
        styleRef
      }
    ];

    const items = buildCollapsedBorderItems(candidates, rootRect, (px) => px, 0);

    expect(items).toHaveLength(1);
    expect(items[0].collapseBorderWidthPx).toBe(2);
    expect(items[0].collapseBorderSourceSide).toBe('l');
  });
});
