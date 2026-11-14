import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const site = new URL('../../site/', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, site));
const html = readFileSync(path('index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(
  (m) => m[1],
);

test('站点引用的资源全部存在 / every asset referenced by the site exists', () => {
  assert.ok(refs.length >= 12);
  for (const ref of refs) assert.ok(existsSync(path(ref)), `missing ${ref}`);
});

test('离线可用：不加载外部脚本或样式 / works offline: no external scripts or styles', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /<link[^>]+href="https?:/);
});

test('GitHub Pages 配置 / GitHub Pages setup', () => {
  assert.ok(existsSync(path('.nojekyll')));
  assert.match(html, /<html lang="zh-Hant">/);
  assert.ok(statSync(path('index.html')).size > 10_000);
});

test('脚本按依赖顺序加载 / scripts load in dependency order', () => {
  const scripts = refs.filter((r) => r.endsWith('.js'));
  const at = (name) => scripts.findIndex((s) => s.endsWith(name));
  assert.ok(at('three.min.js') < at('part-specimens.js'));
  assert.ok(at('joint-model.js') < at('rolling-sim.js'));
  assert.equal(at('app.js'), scripts.length - 1);
});
