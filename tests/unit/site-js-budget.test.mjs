import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BASELINE_INITIAL_JS_BYTES,
  DEFERRED_GROUPS,
  MAX_INITIAL_JS_BYTES,
  assertInitialJavaScriptBudget,
  measureInitialJavaScript,
  parseInitialJavaScript,
} from '../../scripts/site/check-site-js.mjs';

const site = new URL('../../site/', import.meta.url);
const siteRoot = fileURLToPath(site);
const html = readFileSync(new URL('index.html', site), 'utf8');

test('初始 JS 至少減少 50%，延遲資產不在首載路徑 / initial JS budget', () => {
  assert.equal(MAX_INITIAL_JS_BYTES, Math.floor(BASELINE_INITIAL_JS_BYTES / 2));
  const report = assertInitialJavaScriptBudget(
    measureInitialJavaScript(siteRoot, html),
  );
  assert.ok(report.totalBytes <= report.limitBytes);
  assert.ok(report.reductionBytes >= BASELINE_INITIAL_JS_BYTES / 2);
  assert.deepEqual(
    report.scripts.map((script) => script.path),
    [
      'assets/data/cmapss-rul.js',
      'assets/data/brand-assets.js',
      'assets/data/rolling-year.js',
      'assets/js/joint-model.js',
      'assets/js/rolling-sim.js',
      'assets/js/lazy-loader.js',
      'assets/js/app.js',
    ],
  );
  const initialPaths = new Set(report.scripts.map((script) => script.path));
  for (const files of Object.values(DEFERRED_GROUPS)) {
    for (const path of files) assert.equal(initialPaths.has(path), false, path);
  }
});

test('預載與腳本去重，並計入內聯 JS / preloads deduplicate and inline bytes count', () => {
  const inline = 'globalThis.demo = 1;';
  const graph = parseInitialJavaScript(`
    <script src="assets/js/a.js?v=1"></script>
    <link rel="preload" as="script" href="assets/js/a.js?v=2">
    <link rel="modulepreload" href="/assets/js/b.js">
    <script>${inline}</script>
    <script type="application/ld+json">{"not":"executable"}</script>
  `);
  assert.deepEqual(
    graph.files.map((file) => file.path),
    ['assets/js/a.js', 'assets/js/b.js'],
  );
  assert.equal(graph.inlineBytes, Buffer.byteLength(inline, 'utf8'));
});

test('拒絕外部執行資產與失蹤檔案 / reject external and missing scripts', () => {
  assert.throws(
    () =>
      parseInitialJavaScript(
        '<script src="https://example.com/a.js"></script>',
      ),
    /External runtime JavaScript/,
  );
  assert.throws(
    () => parseInitialJavaScript('<script src="//example.com/a.js"></script>'),
    /External runtime JavaScript/,
  );
  assert.throws(
    () =>
      parseInitialJavaScript(
        '<link rel="preload" as="script" href="https://example.com/a.js">',
      ),
    /External runtime JavaScript/,
  );
  assert.throws(
    () =>
      measureInitialJavaScript(
        siteRoot,
        '<script src="assets/js/missing.js"></script>',
      ),
    /Missing initial script/,
  );
});

test('不讓延遲資產重新進入首載路徑 / deferred assets stay deferred', () => {
  const eager = `<script src="${DEFERRED_GROUPS.charts[0]}"></script>`;
  const report = measureInitialJavaScript(siteRoot, eager);
  assert.throws(() => assertInitialJavaScriptBudget(report), /Deferred asset/);
});
