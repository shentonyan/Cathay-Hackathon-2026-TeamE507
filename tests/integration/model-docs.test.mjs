import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const model = readFileSync(
  new URL('../../docs/MODEL.md', import.meta.url),
  'utf8',
);
const specification = readFileSync(
  new URL('../../scripts/site/model_spec.py', import.meta.url),
  'utf8',
);
const [sectionSource, symbolSource] = specification.split(/^SYMS\s*=/m);
// Read raw TeX literals without executing the Python specification.
const rawTex = (source) =>
  Array.from(source.matchAll(/^\s*\("[^"\n]+",r"([^"\n]+)",/gm), (m) => m[1]);

function canonical(tex) {
  const argmin = '\\argmin_{';
  const start = tex.indexOf(argmin);
  if (start >= 0) {
    const content = start + argmin.length;
    let end = content;
    let depth = 1;
    for (; depth && end < tex.length; end++) {
      if (tex[end] === '\\') {
        end++;
        continue;
      }
      if (tex[end] === '{') depth++;
      if (tex[end] === '}') depth--;
    }
    assert.equal(depth, 0, 'argmin limit must have balanced braces');
    tex =
      tex.slice(0, start) +
      '\\underset{' +
      tex.slice(content, end - 1) +
      '}{\\mathrm{arg\\,min}}' +
      tex.slice(end);
  }
  // Both glyph styles denote the same indicator in the existing document.
  return tex.replaceAll('\\mathbb{1}', '\\mathbf{1}').replace(/\s+/g, '');
}

test('GitHub formulas preserve all 25 source expressions and numbered headings', () => {
  const equations = Array.from(
    model.matchAll(/^```math\n([\s\S]*?)\n```$/gm),
    (m) => m[1],
  );
  const headings = Array.from(model.matchAll(/^\*\*\((\d+)\) /gm), (m) =>
    Number(m[1]),
  );
  assert.equal(equations.length, 25);
  assert.deepEqual(
    headings,
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    equations.map(canonical),
    rawTex(sectionSource).map(canonical),
  );
  // Math fences prevent Markdown from consuming TeX escapes; heading numbers
  // avoid unsupported native MathML equation-label layout in GitHub's viewer.
  assert.doesNotMatch(model, /^\$\$$/m);
  assert.doesNotMatch(equations.join('\n'), /\\(?:tag|operatorname)\b/);
});

test('GitHub symbol table protects all 89 original TeX expressions', () => {
  const symbols = Array.from(
    model.matchAll(/^\| \$`([^`\n]+)`\$\s+\|/gm),
    (m) => m[1],
  );
  assert.equal(symbols.length, 89);
  assert.deepEqual(symbols.map(canonical), rawTex(symbolSource).map(canonical));
  assert.doesNotMatch(model, /^\| \$[^`]/m);
});
