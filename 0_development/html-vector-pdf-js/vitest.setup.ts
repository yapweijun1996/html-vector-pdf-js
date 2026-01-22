// Keep Vitest output clean under jsdom.
// jsdom prints "Not implemented: HTMLCanvasElement.getContext" to stderr unless the optional `canvas` package is installed.
// For unit tests in this repo, we don't need a real canvas implementation; returning null preserves current behavior.

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext(..._args: unknown[]) {
      return null;
    },
  });
}
