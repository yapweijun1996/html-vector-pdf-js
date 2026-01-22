import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseElementNode } from './parseElementNode';
import { DomParseContext } from './context';
import { PdfConfig } from '../pdfConfig';

vi.mock('../backgroundImage', () => ({
  getBackgroundImageUrlFromStyle: (style: any) => {
    const bg = String(style?.backgroundImage || '');
    const m = bg.match(/url\\(\\s*(['\"]?)(.*?)\\1\\s*\\)/i);
    return m?.[2] ? String(m[2]) : null;
  },
  rasterizeBackgroundImageToPngDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,bg-fake'),
  backgroundImageRasterizeError: (url: string, cause: unknown) => ({ code: 'ASSET_LOAD_FAILED', meta: { url }, cause })
}));

describe('parseElementNode', () => {
  let ctx: DomParseContext;
  let element: HTMLElement;
  let imagePromises: Promise<void>[];

  beforeEach(() => {
    // Mock getComputedStyle
    window.getComputedStyle = vi.fn().mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgba(0, 0, 0, 0)', // Transparent
      borderTopWidth: '0px',
      borderRightWidth: '0px',
      borderBottomWidth: '0px',
      borderLeftWidth: '0px',
      paddingLeft: '0px',
      paddingRight: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
      backgroundImage: 'none',
      backgroundRepeat: 'repeat',
      backgroundSize: 'auto',
      backgroundPosition: '0% 0%',
      textAlign: 'left',
      fontSize: '16px',
      lineHeight: 'normal',
      textTransform: 'none'
    });

    // Mock PDF Config
    const config: any = { // Cast to any to bypass strict Required<PdfConfig> check in test context if necessary, or Partial<PdfConfig>
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      render: { pxToMm: 0.2645833333, rasterScale: 1 }, // 1px approx 0.26mm
      debugOverlay: { enabled: false },
      text: { scale: 1 },
      callbacks: {},
      errors: { failOnAssetError: false },
      debug: false
    };

    // Mock Context
    ctx = {
      cfg: config as Required<PdfConfig>, // Cast assuming it satisfies what's needed for the test
      px2mm: (px: number) => px * 0.2645833333,
      rootRect: { left: 0, top: 0, width: 800, height: 600, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => {} },
      items: [],
      aggregatedTextByKey: new Map(),
      getLayoutId: vi.fn(),
      cellHasMixedTextStyles: vi.fn()
    };

    // Create a dummy element
    element = document.createElement('div');
    // Mock getBoundingClientRect
    element.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 50,
      right: 300,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => {}
    });

    imagePromises = [];
  });

  it('should ignore hidden elements', () => {
    (window.getComputedStyle as any).mockReturnValue({ display: 'none' });
    parseElementNode(ctx, element, imagePromises);
    expect(ctx.items).toHaveLength(0);

    (window.getComputedStyle as any).mockReturnValue({ display: 'block', opacity: '0' });
    parseElementNode(ctx, element, imagePromises);
    expect(ctx.items).toHaveLength(0);
  });

  it('should create background item for non-transparent elements', () => {
    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgb(255, 0, 0)',
      borderTopWidth: '0px'
    });

    parseElementNode(ctx, element, imagePromises);

    expect(ctx.items).toHaveLength(1);
    expect(ctx.items[0]).toMatchObject({
      type: 'background',
      zIndex: 0
    });
    // Check coordinates (approximate due to float precision)
    expect(ctx.items[0].x).toBeCloseTo(10 + 100 * 0.2645833333);
    expect(ctx.items[0].w).toBeCloseTo(200 * 0.2645833333);
  });

  it('should create border item if borders exist', () => {
    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,0)',
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(0,0,0)'
    });

    parseElementNode(ctx, element, imagePromises);

    expect(ctx.items).toHaveLength(1);
    expect(ctx.items[0].type).toBe('border');
    expect(ctx.items[0].zIndex).toBe(10);
    const borderItem = ctx.items[0] as any;
    expect(borderItem.borderSides.t).toBe(1);
  });

  it('should handle INPUT elements with value', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Hello World';
    // Use the same mock for getBoundingClientRect as the base element for simplicity
    input.getBoundingClientRect = element.getBoundingClientRect;

    // Need to mock getComputedStyle specifically for this input if we want specific styles
    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'white',
      borderTopWidth: '1px',
      fontSize: '12px',
      lineHeight: '14px',
      paddingLeft: '2px',
      paddingRight: '2px',
      paddingTop: '2px',
      paddingBottom: '2px',
      textAlign: 'left'
    });

    parseElementNode(ctx, input, imagePromises);

    // Expect background, border, and text items
    // (Background is created because backgroundColor is white, not transparent)
    // (Border is created because borderTopWidth is 1px)
    // (Text is created because input has value)
    
    // Actually the mock above returns 'white', so isTransparent('white') should be false.
    // parseElementNode adds background first, then border, then text.
    
    const textItems = ctx.items.filter(i => i.type === 'text');
    expect(textItems).toHaveLength(1);
    expect(textItems[0].text).toBe('Hello World');
    expect(textItems[0].zIndex).toBe(20);
  });

  it('should handle IMG elements', () => {
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,fake-data';
    img.getBoundingClientRect = element.getBoundingClientRect;

    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,0)',
      borderTopWidth: '0px'
    });

    parseElementNode(ctx, img, imagePromises);

    const imgItems = ctx.items.filter(i => i.type === 'image');
    expect(imgItems).toHaveLength(1);
    expect(imgItems[0].imageFormat).toBe('PNG');
  });

  it('should create image item for CSS background-image', async () => {
    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,0)',
      backgroundImage: "url('https://example.com/cover.jpg')",
      backgroundRepeat: 'no-repeat',
      backgroundSize: '200px 50px',
      backgroundPosition: 'center top',
      borderTopWidth: '0px',
      borderRightWidth: '0px',
      borderBottomWidth: '0px',
      borderLeftWidth: '0px'
    });

    parseElementNode(ctx, element, imagePromises);

    const imgItems = ctx.items.filter(i => i.type === 'image');
    expect(imgItems).toHaveLength(1);
    expect(imgItems[0].zIndex).toBe(1);
    expect(imagePromises).toHaveLength(1);

    await Promise.all(imagePromises);
    expect((ctx.items.find(i => i.type === 'image') as any).imageSrc).toMatch(/^data:image\/png;base64/);
  });

  it('should add debug overlay for TD/TH when enabled', () => {
    ctx.cfg.debugOverlay = { enabled: true };
    const td = document.createElement('td');
    td.getBoundingClientRect = element.getBoundingClientRect;
    
    (window.getComputedStyle as any).mockReturnValue({
      display: 'block',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,0)',
      paddingLeft: '5px'
    });

    parseElementNode(ctx, td, imagePromises);

    const debugItems = ctx.items.filter(i => i.type === 'debugRect');
    expect(debugItems).toHaveLength(1);
    expect(debugItems[0].zIndex).toBe(12);
  });
});
