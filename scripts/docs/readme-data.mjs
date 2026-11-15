import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadEngine } from '../site/engine.mjs';

const root = new URL('../../', import.meta.url);
const engine = loadEngine();
const initStop = new Error(
  'README collector intentionally skips browser UI setup',
);
const warnings = [];
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const document = {
  documentElement: {
    classList: { contains: () => false },
    style: { setProperty() {} },
  },
  getElementById: (id) =>
    id === 'gForm'
      ? {
          addEventListener() {
            throw initStop;
          },
        }
      : null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
// Evaluate the complete shipped app, using an empty UI and in-memory storage.
// This calls the same __app calculations as a fresh browser's base scenario.
const context = vm.createContext({
  ...engine,
  document,
  window: { matchMedia: () => ({ matches: false }) },
  localStorage: storage,
  sessionStorage: storage,
  getComputedStyle: () => ({
    getPropertyValue: () => 'sans-serif',
    position: 'static',
  }),
  Highcharts: { setOptions() {} },
  console: { error: (...args) => warnings.push(args), log() {} },
  setTimeout: () => 0,
  clearTimeout() {},
});
vm.runInContext(
  readFileSync(new URL('site/assets/js/app.js', root), 'utf8'),
  context,
  {
    filename: 'app.js',
    timeout: 20000,
  },
);
if (
  !context.__app ||
  warnings.some(([where, error]) => where !== 'init' || error !== initStop)
) {
  throw new Error(
    'The app did not initialize its canonical calculations cleanly',
  );
}
const app = context.__app;
if (
  app.S.scen !== 'base' ||
  Object.keys(app.S.over).length ||
  Object.keys(app.S.excl).length
) {
  throw new Error('README figures require the unchanged base scenario');
}
const task = app.byId('R1');
const curve = app.curveOf(task);
const joint = app.S.J.plan.R1;
const baseline = app.S.B.plan.R1;
const carbon = app.carbonTiers();
const pick = (row) => ({
  name: row.n,
  description: row.d,
  sourceLabel: row.src,
  co2: row.co2,
  fuel: row.fuel,
  save: row.save,
  g: row.g,
  pct: row.pct,
});
const hashes = Object.fromEntries(
  [
    'site/assets/js/app.js',
    'site/assets/js/joint-model.js',
    'site/assets/js/rolling-sim.js',
    'site/assets/data/rolling-year.js',
  ].map((path) => [
    path,
    createHash('sha256')
      .update(readFileSync(new URL(path, root)))
      .digest('hex'),
  ]),
);
const data = {
  source: {
    scenario: app.S.scen,
    overrides: {},
    exclusions: {},
    realization: 1,
    method:
      'Complete shipped app.js in a minimal UI VM; canonical __app functions',
    hashes,
  },
  annual: app.annual(),
  periods: app.rollFor().map((period) => ({
    k: period.k,
    date: period.date,
    jobs: period.n,
    season: period.season,
    baseline: period.b.total,
    joint: period.j.total,
    save: period.b.total - period.j.total,
    co2: period.b.co2 - period.j.co2,
  })),
  curve: {
    task: { id: task.id, reg: task.reg, name: task.name },
    points: curve.pts.map((point) => ({
      day: point.s,
      aog: point.aog,
      fuel: point.fuel,
      carbon: point.carbon,
      life: point.life,
      exec: point.exec,
      total: point.total,
      pf: point.pf,
    })),
    economicWindow: curve.econ,
    riskDay: curve.sRisk,
    riskCap: app.P.riskCap,
    referenceMinimum: curve.Cstar,
    jointDay: joint.w.d,
    jointCost: joint.base,
    baselineDay: baseline.w.d,
    baselineCost: baseline.base,
  },
  carbon: {
    gap: carbon.gap,
    groupRtk: carbon.C.groupRtk,
    fuelGroup: carbon.fuelGrp,
    tiers: carbon.L.map(pick),
  },
};
if (
  data.periods.length !== 26 ||
  data.annual.n !== 484 ||
  data.carbon.tiers.length !== 4
) {
  throw new Error(
    'Unexpected source shape; review the README figure assumptions',
  );
}
process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
