import assert from 'node:assert/strict';
import test from 'node:test';
import {
  demoTasks,
  loadEngine,
  runRollingYear,
} from '../../scripts/site/engine.mjs';

const engine = loadEngine();
const { JointModel: JM, JointModelX: X } = engine;
const { tasks, windows } = demoTasks(engine);
const params = () => ({ ...JM.defaultParams(), exclude: {}, lock: {} });

test('第 1 期包含 21 项工作与 20 架飞机 / period 1 has 21 jobs on 20 aircraft', () => {
  assert.equal(tasks.length, 21);
  assert.equal(new Set(tasks.map((t) => t.reg)).size, 20);
});

test('联合决策可行、不劣于现行做法且守住安全上限 / joint plan is feasible, no worse than baseline and within the risk cap', () => {
  const p = params();
  const baseline = JM.solveBaseline(tasks, windows, p, 7);
  const joint = JM.solveJoint(tasks, windows, p, { tau: 7 });
  assert.equal(joint.complete, true);
  assert.deepEqual(Array.from(joint.best.viol), []);
  assert.equal(Object.keys(joint.best.plan).length, tasks.length);
  assert.ok(joint.best.total <= baseline.total);
  assert.ok(joint.best.riskMax <= p.riskCap);
  assert.ok(Math.abs(baseline.total / 1e6 - 7.3) < 0.01);
  assert.ok(Math.abs(joint.best.total / 1e6 - 6.591) < 0.001);
});

test('五项成本对账闭合 / five cost components reconcile to the total saving', () => {
  const p = params();
  const r = X.reconcile(
    JM.solveBaseline(tasks, windows, p, 7),
    JM.solveJoint(tasks, windows, p, { tau: 7 }).best,
  );
  assert.equal(r.ok, true);
});

test('逐项最优违反共享资源约束 / per-job optimum violates shared-resource constraints', () => {
  const selfish = JM.solveSelfish(tasks, windows, params());
  assert.ok(selfish.viol.length > 0);
});

test('等待的代价曲线有最佳区间与风险截止 / cost-of-waiting curve has a best window and a risk cutoff', () => {
  const r1 = tasks.find((t) => t.id === 'R1');
  const curve = X.costCurve(r1, windows, params());
  assert.ok(curve.econ[0] < curve.econ[1]);
  assert.ok(Number.isFinite(curve.sRisk) && curve.sRisk > curve.econ[1]);
});

test('滚动模拟前 3 期与 Demo 内置结果一致 / first 3 rolling periods match the shipped demo data', () => {
  const live = runRollingYear(engine, 'base', { periods: 3 });
  engine.ROLL_PRE.base.slice(0, 3).forEach((pre, i) => {
    assert.equal(live[i].n, pre.n);
    assert.ok(Math.abs(live[i].b.total - pre.b.total) < 1);
    assert.ok(Math.abs(live[i].j.total - pre.j.total) < 1);
  });
});

test('公式连续编号且符号表完整 / formulas are numbered 1…25 and the symbol table is complete', () => {
  const eqs = engine.MODEL9.secs.flatMap((s) => s.eqs);
  assert.deepEqual(
    Array.from(eqs, (e) => e.n),
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
  assert.ok(eqs.every((e) => e.mml.startsWith('<svg')));
  assert.equal(engine.MODEL9.syms.length, 89);
});

test('剩余寿命模型卡与实验结果一致 / RUL model card matches the experiment results', () => {
  const card = engine.CMAPSS.model_card;
  assert.equal(card.test_rmse_cycles, 10.65);
  assert.equal(card.nasa_score, 200);
  assert.equal(card.picp_90, 88);
});
