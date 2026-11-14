import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'raw',
  'private',
  'processed',
  'outputs',
  'artifacts',
  'tmp',
  'temp',
  '.venv',
]);
let failed = false;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !excluded.has(entry.name)) await visit(path);
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const markdown = (await readFile(path, 'utf8')).replace(/```[^]*?```/g, '');
    for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '');
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      try {
        await access(
          resolve(dirname(path), decodeURIComponent(link.split('#')[0])),
        );
      } catch {
        console.error(`Broken local link / 本地链接失效: ${path} -> ${link}`);
        failed = true;
      }
    }
  }
}
await visit(root);
if (failed) process.exitCode = 1;
else console.log('Local documentation links passed / 本地文档链接检查通过。');
