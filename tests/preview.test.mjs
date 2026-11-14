import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPreviewServer } from '../scripts/dev.mjs';

let server;
let baseUrl;

before(async () => {
  server = createPreviewServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});

test('the preview page and referenced assets are available', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Team E507/);
  for (const asset of ['/styles.css', '/app.js']) {
    assert.ok(html.includes(asset));
    const resource = await fetch(`${baseUrl}${asset}`);
    assert.equal(resource.status, 200);
    assert.ok((await resource.text()).length > 0);
  }
});

test('the development health endpoint has the documented contract', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'teame507-preview',
  });
});

test('repository files and unregistered paths cannot be served', async () => {
  for (const path of ['/.env', '/package.json', '/docs/TEAM.md', '/missing']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), 'Not found');
  }
});

test('HEAD requests return headers without a body', async () => {
  for (const path of ['/', '/styles.css', '/api/health']) {
    const response = await fetch(`${baseUrl}${path}`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  }
});

test('unsupported methods fail explicitly', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
