import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { handleApiRequest } from '@e507/api';

const webRoot = new URL('../../apps/web/', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/src/main.js', ['src/main.js', 'text/javascript; charset=utf-8']],
  [
    '/src/features/health/check-health.js',
    ['src/features/health/check-health.js', 'text/javascript; charset=utf-8'],
  ],
]);

// Local composition: web assets + API. / 本地组合：前端资源与 API。
export function createPreviewServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );

    if (handleApiRequest(request, response)) return;

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {
        Allow: 'GET, HEAD',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end('Method not allowed');
      return;
    }

    // Serve only registered assets. / 仅提供明确登记的静态资源。
    const pathname = (request.url ?? '/').split('?')[0];

    const asset = assets.get(pathname);
    if (!asset) {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end(request.method === 'HEAD' ? undefined : 'Not found');
      return;
    }

    try {
      const body = await readFile(new URL(asset[0], webRoot));
      response.writeHead(200, { 'Content-Type': asset[1] });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error('Unable to read preview asset:', error.code ?? 'unknown');
      response.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end(
        request.method === 'HEAD' ? undefined : 'Preview unavailable',
      );
    }
  });
}
