import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEFERRED_GROUPS,
  parseInitialJavaScript,
} from '../../scripts/site/check-site-js.mjs';

const site = new URL('../../site/', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, site));
const html = readFileSync(path('index.html'), 'utf8');
const initial = parseInitialJavaScript(html);
const loader = readFileSync(path('assets/js/lazy-loader.js'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(
  (m) => m[1],
);

test('站点引用的资源全部存在 / every asset referenced by the site exists', () => {
  assert.ok(refs.length >= 10);
  for (const ref of refs) assert.ok(existsSync(path(ref)), `missing ${ref}`);
});

test('离线可用：不加载外部脚本或样式 / works offline: no external scripts or styles', () => {
  assert.doesNotMatch(html, /<script[^>]+src="(?:https?:)?\/\//);
  assert.doesNotMatch(html, /<link[^>]+href="(?:https?:)?\/\//);
});

test('GitHub Pages 配置 / GitHub Pages setup', () => {
  assert.ok(existsSync(path('.nojekyll')));
  assert.match(html, /<html lang="zh-Hant">/);
  assert.ok(statSync(path('index.html')).size > 10_000);
});

test('關鍵腳本與延遲群組依賴順序 / critical and lazy dependency order', () => {
  const scripts = initial.files.map((file) => file.path);
  const at = (name) => scripts.findIndex((path) => path.endsWith(name));
  assert.ok(at('cmapss-rul.js') < at('joint-model.js'));
  assert.ok(at('joint-model.js') < at('rolling-sim.js'));
  assert.ok(at('rolling-sim.js') < at('lazy-loader.js'));
  assert.equal(at('app.js'), scripts.length - 1);
  assert.equal(at('three.min.js'), -1);
  assert.equal(at('highcharts.js'), -1);
  assert.equal(at('model-formulas.js'), -1);
  assert.equal(at('part-specimens.js'), -1);
  for (const files of Object.values(DEFERRED_GROUPS)) {
    assert.ok(existsSync(path(files[0])));
    for (let index = 1; index < files.length; index++) {
      assert.ok(existsSync(path(files[index])));
      assert.ok(
        loader.indexOf(files[index - 1]) < loader.indexOf(files[index]),
        `${files[index - 1]} must execute before ${files[index]}`,
      );
    }
  }
});
