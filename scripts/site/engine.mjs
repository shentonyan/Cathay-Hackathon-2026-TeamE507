import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 在 Node 中加载与浏览器 Demo 完全相同的算法文件。
// Load the exact algorithm files that the browser demo ships, inside Node.
const assets = new URL('../../site/assets/', import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, assets)), 'utf8');

export const ENGINE_FILES = [
  'data/cmapss-rul.js',
  'data/rolling-year.js',
  'data/model-formulas.js',
  'js/joint-model.js',
  'js/rolling-sim.js',
];

/** @returns {{JointModel: any, JointModelX: any, Roll: any, CMAPSS: any, ROLL_PRE: any, MODEL9: any}} */
export function loadEngine() {
  const context = vm.createContext({ console });
  const source =
    ENGINE_FILES.map(read).join('\n;\n') +
    '\n;globalThis.__engine = { JointModel: globalThis.JointModel, JointModelX: globalThis.JointModelX, Roll: globalThis.Roll, CMAPSS, ROLL_PRE, MODEL9 };';
  vm.runInContext(source, context, { filename: 'site-engine.js' });
  return context.__engine;
}

// 与 site/assets/js/app.js 中的 SCN 与 rollParams 保持一致。
// Mirrors SCN and rollParams in site/assets/js/app.js.
export const SCENARIOS = {
  base: (q) => q,
  tight: (q) => {
    q.pools['GE90-ENG'].arrivals[0].day = 20;
    q.pools['GE90-ENG'].lease.lead = 8;
    return q;
  },
  bay: (q) => {
    q.stations.HKG.bays = 1;
    return q;
  },
  carbon: (q) => {
    q.carbonPriceUSD = 250;
    q.stations.HKG.wash = 3;
    return q;
  },
};

export function demoTasks(engine) {
  const byReg = {};
  for (const e of engine.CMAPSS.engines) byReg[e.reg] = e;
  return {
    tasks: engine.JointModel.defaultTasks(byReg),
    windows: engine.JointModel.defaultWindows(),
  };
}

export function rollParams(engine, scenario) {
  return (k, season) => {
    const q = SCENARIOS[scenario](engine.JointModel.defaultParams());
    if (season !== 1) {
      for (const day of Object.values(q.background.HKG)) {
        day.B1 = Math.round(day.B1 * season);
        day.B2 = Math.round(day.B2 * season);
      }
    }
    if (scenario === 'tight' && k > 0) {
      for (const pool of Object.values(q.pools)) {
        if (pool.lease) pool.lease.lead = 8;
      }
    }
    return q;
  };
}

export function runRollingYear(engine, scenario, { periods } = {}) {
  const { tasks, windows } = demoTasks(engine);
  const sim = engine.Roll.makeSim({
    T0: tasks,
    W0: windows,
    paramsFor: rollParams(engine, scenario),
    scen: scenario,
    seed: 20261116,
    nodeLimit: 60000,
  });
  const limit = periods ?? engine.Roll.ROLL_CFG.periods;
  while (!sim.done() && sim.results.length < limit) sim.step();
  return sim.results;
}
