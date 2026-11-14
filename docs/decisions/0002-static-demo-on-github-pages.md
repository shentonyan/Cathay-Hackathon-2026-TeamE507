# ADR 0002 · 以静态站点发布 Demo / Publish the demo as a static site

- 状态 / Status：已采纳 Accepted
- 日期 / Date：2026-11-15
- 参与人 / Participants：Team E507
- 关联 / Related：v14 Demo、GitHub Pages

## 背景 / Context

评委与队友需要随时打开 Demo，现场网络不可靠，且赛事阶段没有后端预算。排程、预测与模拟的计算量很小，可在浏览器内完成。 / Judges and teammates need instant access, venue networks are unreliable, and there is no backend budget during the event. Scheduling, prediction and simulation are light enough to run in the browser.

## 选择 / Decision

把 Demo 作为 `site/` 下的纯静态站点，经 GitHub Actions 发布到 GitHub Pages。算法文件（`joint-model.js`、`rolling-sim.js`）由浏览器与 Node 共用：`scripts/site/engine.mjs` 在 Node 中加载同一份文件，供测试与复现使用。全年模拟结果预先计算并随站点发布，参数改动后可在浏览器内重新模拟。 / Ship the demo as a static site under `site/` deployed by GitHub Actions to Pages. Browser and Node share the same algorithm files; Node loads them through `scripts/site/engine.mjs` for tests and reproduction. Rolling-year results are precomputed and shipped; the browser re-simulates after parameter changes.

## 备选与取舍 / Alternatives and tradeoffs

- 迁入 `apps/web` + `services/api`：结构更正式，但需要服务器与部署，赛期风险更高。 / Moving into `apps/web` and `services/api` adds a server and deployment risk during the event.
- 单个 HTML 文件：便于传送，但难以审阅与测试。最终同时保留拆分后的站点。 / A single HTML file is portable but hard to review and test.

## 后果与验证 / Consequences and validation

- `site/` 不纳入 workspaces，不影响 `package-lock.json`；Prettier 与 ESLint 忽略生成与第三方文件。 / `site/` is outside workspaces; generated and vendored files are excluded from Prettier and ESLint.
- `tests/integration/site.test.mjs` 与 `tests/unit/scheduler.test.mjs` 在 CI 与 Pages 部署前运行。 / Both tests run in CI and before each Pages deployment.
- 正式产品化时，排程引擎可迁入 `services/api` 的功能模块，保留同一组测试。 / For production, the engine can move into a `services/api` module under the same tests.
