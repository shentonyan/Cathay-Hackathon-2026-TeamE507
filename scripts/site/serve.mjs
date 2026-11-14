import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 本地预览 GitHub Pages 站点（与线上相同的静态文件）。
// Preview the GitHub Pages site locally (the same static files as production).
const root = resolve(fileURLToPath(new URL('../../site/', import.meta.url)));
const port = Number(process.env.SITE_PORT ?? 4173);
const host = process.env.SITE_HOST ?? '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  let relative;
  try {
    const url = new URL(request.url ?? '/', `http://${host}`);
    relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  let path = resolve(join(root, relative));
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(
    `Cathay AaaS demo → http://${host}:${server.address().port}/  (Ctrl+C to stop)`,
  );
});
