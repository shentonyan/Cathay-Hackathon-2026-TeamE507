import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const webRoot = new URL('../apps/web/', import.meta.url);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

// This server is a local preview harness, not the business API.
export function createPreviewServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {
        Allow: 'GET, HEAD',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end('Method not allowed');
      return;
    }

    // Exact routes keep environment files and other repository contents private.
    const pathname = (request.url ?? '/').split('?')[0];
    if (pathname === '/api/health') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(
        request.method === 'HEAD'
          ? undefined
          : JSON.stringify({ status: 'ok', service: 'teame507-preview' }),
      );
      return;
    }

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

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const rawPort = process.env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createPreviewServer();
    server.on('error', (error) => {
      console.error(`Preview failed (${error.code}). Check the local port.`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Team E507 preview: http://127.0.0.1:${port}`);
      console.log('Press Ctrl+C to stop.');
    });
  }
}
