import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  serializeModel,
  splitClauses,
  typesetModel,
} from '../../scripts/site/typeset-formulas.mjs';

const shipped = readFileSync(
  new URL('../../site/assets/data/model-formulas.js', import.meta.url),
  'utf8',
);
const context = vm.createContext({});
vm.runInContext(`${shipped};globalThis.model = MODEL9;`, context);
const model = JSON.parse(JSON.stringify(context.model));

test('original math is retained, including blackboard indicators and set difference', () => {
  const equations = model.secs.flatMap((section) => section.eqs);
  assert.equal(equations.length, 25);
  assert.equal(model.syms.length, 89);
  assert.match(equations[5].tex, /\\mathbb\{1\}/);
  assert.match(equations[20].tex, /\\setminus/);
  assert.match(equations[20].tex, /\\argmin/);
  assert.deepEqual(splitClauses('a={b\\qquad c},\\qquad d=e'), [
    'a={b\\qquad c},',
    'd=e',
  ]);
});

test('every display clause and symbol is a self-contained offline SVG', () => {
  const equations = model.secs.flatMap((section) => section.eqs);
  const svgs = [
    ...equations.flatMap((equation) => [equation.mml, ...equation.parts]),
    ...model.syms.map((symbol) => symbol.s),
  ];
  for (const svg of svgs) {
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /viewBox="[^"]+"/);
    assert.match(svg, /<path\b/);
    assert.match(svg, /aria-label="[^"]+"/);
    assert.doesNotMatch(svg, /\bid="|\bhref=|<script|<foreignObject/);
    assert.doesNotMatch(svg, /data-mml-node="merror"|data-mjx-error=/);
  }
  assert.ok(equations[8].parts.length > 1, 'split long execution-cost sum');
  assert.ok(equations[10].parts.length > 1, 'split long objective sum');
});

test('generation is reproducible and rejects invalid TeX', async () => {
  assert.equal(serializeModel(await typesetModel(model)), shipped);
  assert.equal(serializeModel(await typesetModel(model)), shipped);
  await assert.rejects(
    typesetModel({
      secs: [
        {
          c: 'X',
          t: 'Invalid',
          eqs: [{ n: 1, h: 'Invalid', tex: '\\undefinedMathCommand', p: '' }],
        },
      ],
      syms: [],
    }),
    /Undefined control sequence/,
  );
});
