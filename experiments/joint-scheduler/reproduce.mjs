import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  loadEngine,
  runRollingYear,
  SCENARIOS,
} from '../../scripts/site/engine.mjs';

// 复现全年滚动模拟，并与 Demo 内置结果逐期比对。
// Reproduce the rolling-year simulation and compare it period by period with the demo.
const args = new Set(process.argv.slice(2));
const scenarios = args.has('--base') ? ['base'] : Object.keys(SCENARIOS);
const check = args.has('--check');
const writeSite = args.has('--write-site');
const engine = loadEngine();
const round = (x) => Math.round(x);
const summary = (s) => ({
  total: round(s.total),
  co2: Number(s.co2.toFixed(1)),
  fuel: Number(s.fuel.toFixed(1)),
  lease: s.lease,
  aog: round(s.aog),
  risk: Number(s.risk.toFixed(4)),
  comps: Object.fromEntries(
    Object.entries(s.comps).map(([k, v]) => [k, round(v)]),
  ),
});
const fmt = (x) => (x / 1e6).toFixed(2).padStart(7);
const out = {};
let failed = false;
console.log(
  'scenario   jobs   baseline HK$M  joint HK$M  saving HK$M  CO2 t   max P(fail)  check',
);
for (const scenario of scenarios) {
  const started = Date.now();
  const periods = runRollingYear(engine, scenario).map((p) => ({
    k: p.k,
    date: p.date,
    month: p.month,
    season: p.season,
    n: p.n,
    nR: p.nR,
    complete: p.complete,
    b: summary(p.b),
    j: summary(p.j),
  }));
  out[scenario] = periods;
  const s = engine.Roll.rollSum(periods);
  let verdict = '-';
  if (check) {
    const pre = engine.Roll.rollSum(engine.ROLL_PRE[scenario]);
    const ok =
      Math.abs(s.save - pre.save) < 100 &&
      Math.abs(s.co2 - pre.co2) < 2 &&
      s.n === pre.n;
    verdict = ok ? 'OK' : 'MISMATCH';
    failed ||= !ok;
  }
  console.log(
    `${scenario.padEnd(9)} ${String(s.n).padStart(5)}   ${fmt(s.b)}       ${fmt(s.j)}     ${fmt(s.save)}   ${s.co2.toFixed(0).padStart(6)}   ${(s.risk * 100).toFixed(1).padStart(6)}%     ${verdict}   (${((Date.now() - started) / 1000).toFixed(1)}s)`,
  );
}
const outputs = new URL('./outputs/', import.meta.url);
mkdirSync(outputs, { recursive: true });
writeFileSync(
  fileURLToPath(new URL('rolling-year.json', outputs)),
  JSON.stringify(out, null, 2) + '\n',
);
if (writeSite && scenarios.length === 4) {
  const header =
    '/* Pre-computed 26-period rolling simulation for 4 scenarios — reproduce with npm run reproduce:schedule.\n * Generated file — see docs/DATA.md for provenance. Do not edit by hand. */\n';
  writeFileSync(
    fileURLToPath(
      new URL('../../site/assets/data/rolling-year.js', import.meta.url),
    ),
    `${header}const ROLL_PRE=${JSON.stringify(out)};\n`,
  );
  console.log('site/assets/data/rolling-year.js updated');
}
if (failed) {
  console.error(
    'Result differs from the demo data. / 结果与 Demo 数据不一致。',
  );
  process.exitCode = 1;
}
