import { Buffer } from 'node:buffer';
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BASELINE_INITIAL_JS_BYTES = 2_950_307;
export const MAX_INITIAL_JS_BYTES = Math.floor(BASELINE_INITIAL_JS_BYTES / 2);
export const DEFERRED_GROUPS = Object.freeze({
  charts: Object.freeze([
    'assets/vendor/highcharts.js',
    'assets/vendor/highcharts-more.js',
  ]),
  model: Object.freeze(['assets/data/model-formulas.js']),
  twin: Object.freeze([
    'assets/vendor/three.min.js',
    'assets/js/part-specimens.js',
  ]),
});

const executableTypes = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
  'module',
]);

function attributes(source) {
  const result = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function localPath(src) {
  const url = new URL(src, 'https://site.invalid/');
  if (url.origin !== 'https://site.invalid') {
    throw new Error(`External runtime JavaScript is not allowed: ${src}`);
  }
  const path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!path) throw new Error(`Missing local script path: ${src}`);
  return path;
}

export function parseInitialJavaScript(html) {
  const files = [];
  const seen = new Set();
  let inlineBytes = 0;
  const addFile = (src) => {
    const path = localPath(src);
    if (!seen.has(path)) {
      seen.add(path);
      files.push({ path, src });
    }
  };

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes(match[1]);
    if (!executableTypes.has((attrs.type || '').toLowerCase())) continue;
    if (attrs.src) addFile(attrs.src);
    else inlineBytes += Buffer.byteLength(match[2], 'utf8');
  }

  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = attributes(match[1]);
    const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
    const scriptPreload =
      rel.includes('modulepreload') ||
      (rel.includes('preload') && (attrs.as || '').toLowerCase() === 'script');
    if (scriptPreload && attrs.href) addFile(attrs.href);
  }

  return { files, inlineBytes };
}

export function measureInitialJavaScript(siteRoot, html) {
  const graph = parseInitialJavaScript(html);
  const root = resolve(siteRoot);
  const scripts = graph.files.map((file) => {
    const target = resolve(root, file.path);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`Script escapes the site directory: ${file.src}`);
    }
    let bytes;
    try {
      bytes = statSync(target).size;
    } catch {
      throw new Error(`Missing initial script: ${file.src}`);
    }
    return { ...file, bytes };
  });
  const scriptBytes = scripts.reduce((total, script) => total + script.bytes, 0);
  const totalBytes = scriptBytes + graph.inlineBytes;
  const reductionBytes = BASELINE_INITIAL_JS_BYTES - totalBytes;
  return {
    baselineBytes: BASELINE_INITIAL_JS_BYTES,
    limitBytes: MAX_INITIAL_JS_BYTES,
    scriptBytes,
    inlineBytes: graph.inlineBytes,
    totalBytes,
    reductionBytes,
    reductionPercent: (reductionBytes / BASELINE_INITIAL_JS_BYTES) * 100,
    scripts,
  };
}

export function assertInitialJavaScriptBudget(report) {
  if (report.totalBytes > report.limitBytes) {
    throw new Error(
      `Initial JavaScript is ${report.totalBytes} bytes; limit is ${report.limitBytes} bytes.`,
    );
  }
  const initialPaths = new Set(report.scripts.map((script) => script.path));
  for (const files of Object.values(DEFERRED_GROUPS)) {
    for (const path of files) {
      if (initialPaths.has(path)) {
        throw new Error(`Deferred asset is on the initial path: ${path}`);
      }
    }
  }
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const siteRoot = fileURLToPath(new URL('../../site/', import.meta.url));
    const html = readFileSync(resolve(siteRoot, 'index.html'), 'utf8');
    const report = assertInitialJavaScriptBudget(
      measureInitialJavaScript(siteRoot, html),
    );
    console.log(
      `Initial JavaScript: ${report.totalBytes} bytes ` +
        `(baseline ${report.baselineBytes}; limit ${report.limitBytes}; ` +
        `reduction ${report.reductionPercent.toFixed(1)}%).`,
    );
    for (const script of report.scripts) {
      console.log(`  ${script.bytes}  ${script.path}`);
    }
    if (report.inlineBytes) console.log(`  ${report.inlineBytes}  inline scripts`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
