#!/usr/bin/env node

/**
 * Simple asset proxy for local testing.
 *
 * Why:
 * - Browser can DISPLAY cross-origin images without CORS
 * - But cannot READ them into canvas unless CORS is allowed
 * - Vector PDF embedding needs canvas/dataURL, so we proxy and add CORS headers
 *
 * Usage:
 *   node scripts/asset-proxy.js
 *   PORT=8899 node scripts/asset-proxy.js
 *
 * Then set (in browser console or your page):
 *   window.html_to_vector_pdf_asset_proxy = 'http://localhost:8899/proxy?url='
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8899);

const send = (res, code, body, extraHeaders = {}) => {
  res.writeHead(code, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...extraHeaders
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return send(res, 400, 'Missing url');
    if (req.method === 'OPTIONS') return send(res, 204, '');

    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname !== '/proxy') return send(res, 404, 'Not found');

    const target = u.searchParams.get('url');
    if (!target) return send(res, 400, 'Missing ?url=');
    if (!/^https?:\/\//i.test(target)) return send(res, 400, 'Only http(s) URLs are allowed');

    const r = await fetch(target, {
      // Avoid cookies/credentials by default.
      redirect: 'follow'
    });

    if (!r.ok) {
      return send(res, 502, `Upstream error: ${r.status} ${r.statusText}`);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = r.headers.get('cache-control') || 'public, max-age=300';

    return send(res, 200, buf, {
      'content-type': contentType,
      'cache-control': cacheControl
    });
  } catch (err) {
    return send(res, 500, `Proxy error: ${err?.message || String(err)}`);
  }
});

server.listen(PORT, () => {
  console.log(`[asset-proxy] listening on http://localhost:${PORT}/proxy?url=...`);
});

