# 复现 / Reproduce

所有结果都可以在干净克隆上复现。数字与 Demo 不一致时，以本流程的输出为准并提交 Issue。 / Every result reproduces from a clean clone. If numbers differ from the demo, trust this procedure and open an Issue.

## 环境 / Environment

| 工具 / Tool                    | 版本 / Version                                    | 用途 / Used for                                |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| Node.js                        | 24（见 `.nvmrc`）                                 | Demo、排程复现、测试 / Demo, scheduling, tests |
| npm                            | 11                                                | 依赖安装 / Install                             |
| Python                         | 3.11+                                             | 剩余寿命模型 / RUL model                       |
| NumPy, pandas                  | 见 `experiments/rul-cmapss/requirements.txt`      | 训练 / Training                                |
| MathJax（构建时 / build only） | 4.1.3（由 `npm ci` 安装 / installed by `npm ci`） | 重新排版公式 / Re-typeset formulas             |

不需要 GPU、深度学习框架或网络服务；Demo 完全离线运行。 / No GPU, deep-learning framework or network service is needed; the demo runs fully offline.

## 1. Demo

```sh
npm ci
npm run site          # http://127.0.0.1:4173 ，可用 SITE_PORT 修改端口 / change with SITE_PORT
```

线上版本 / Online：<https://shentonyan.github.io/Cathay-Hackathon-2026-TeamE507/>。账户见 [演示手册 / Demo runbook](DEMO.md)。

## 2. 剩余寿命模型 / RUL model（约 1–3 分钟 / about 1–3 min）

```sh
python -m pip install -r experiments/rul-cmapss/requirements.txt
python experiments/rul-cmapss/download_data.py      # 下载并校验 SHA-256 / download + verify
python experiments/rul-cmapss/train_rul.py
```

预期输出 / Expected output（固定随机种子，结果确定 / fixed seeds, deterministic）：

| 指标 / Metric             | 值 / Value                    |
| ------------------------- | ----------------------------- |
| 测试 RMSE / Test RMSE     | 10.65 cycles                  |
| NASA 评分 / Score         | 200                           |
| 90% 区间覆盖 / Coverage   | 88.0%（剩余 <30 循环：92.0%） |
| 平均区间宽度 / Mean width | 27.8 cycles                   |
| 交叉验证 RMSE / CV RMSE   | 9.39 cycles                   |

结果写入 `experiments/rul-cmapss/results/`（提交到仓库）与 `outputs/`（忽略）。`results/` 中的数字即 [cmapss-rul.js](../site/assets/data/cmapss-rul.js) 的模型卡。 / Results go to `results/` (committed) and `outputs/` (ignored); they match the model card shipped in the demo.

如无法连网，可从 NASA 官方仓库手动下载 FD001 三个文件放入 `data/raw/cmapss/`，再运行 `download_data.py --verify` 校验。 / Offline: place the official FD001 files in `data/raw/cmapss/` and run `download_data.py --verify`.

## 3. 全年滚动排程 / Rolling-year scheduling（约 1 分钟 / about 1 min）

```sh
npm run reproduce:schedule
```

脚本在 Node 中加载与浏览器完全相同的 [joint-model.js](../site/assets/js/joint-model.js) 和 [rolling-sim.js](../site/assets/js/rolling-sim.js)，跑完 4 个情景 × 26 期，并与 [rolling-year.js](../site/assets/data/rolling-year.js) 比对。 / The script loads the exact browser engine in Node, runs 4 scenarios × 26 periods and compares with the shipped results.

| 情景 / Scenario | 工作 / Jobs | 现行做法 / Baseline | 联合决策 / Joint | 节省 / Saving | CO₂ t | 最高失效概率 / Max P(fail) |
| --------------- | ----------: | ------------------: | ---------------: | ------------: | ----: | -------------------------: |
| base            |         484 |         HK\$274.57M |      HK\$254.31M |    HK\$20.26M | 8,273 |                       3.0% |
| tight           |         484 |         HK\$311.44M |      HK\$298.80M |    HK\$12.64M | 8,248 |                       7.9% |
| bay             |         484 |         HK\$308.07M |      HK\$285.82M |    HK\$22.24M | 8,293 |                       3.0% |
| carbon          |         484 |         HK\$313.14M |      HK\$277.81M |    HK\$35.32M | 8,736 |                       3.0% |

修改引擎后，用 `node experiments/joint-scheduler/reproduce.mjs --write-site` 重新生成 Demo 数据。 / After changing the engine, regenerate the demo data with `--write-site`.

## 4. 公式排版 / Formula typesetting（可选 / optional）

```sh
npm ci
python scripts/site/build_formulas.py
```

由 [model_spec.py](../scripts/site/model_spec.py) 的原始 LaTeX 生成 [model-formulas.js](../site/assets/data/model-formulas.js)：25 条公式、89 个符号。构建时使用锁定版本的 MathJax，将数学字形写入独立 SVG；浏览器无需加载数学库、网络字体或外部服务。多子句公式按原有间隔分行，长公式保持可读字号并在公式框内横向滚动。 / Generates 25 formulas and 89 symbols from the original LaTeX using the locked MathJax build dependency. Each SVG contains its own glyph paths; viewing requires no math runtime, web fonts or external service. Multi-clause formulas use separate lines, while long lines retain a readable size inside a scrollable frame.

[MODEL.md](MODEL.md) 使用 GitHub 支持的 `math` 围栏和受保护的行内公式。编号放在公式标题中，避免原生 MathML 对带标签表格的布局兼容问题。 / The model document uses GitHub math fences and protected inline expressions. Equation numbers remain in the headings to avoid native MathML layout issues with labeled tables.

## 5. 质量检查 / Quality checks

```sh
npm run format        # 先统一格式 / format first
npm run check         # 格式、lint、依赖边界、文档链接、全部测试 / everything
```

`tests/unit/scheduler.test.mjs` 检查：第 1 期 21 项工作、联合决策可行且不劣于现行做法、五项成本对账、逐项最优违反约束、曲线形状、滚动模拟前 3 期与 Demo 一致、公式编号与模型卡。`tests/integration/site.test.mjs` 检查站点资源完整、离线可用与加载顺序。 / The unit test covers feasibility, optimality versus baseline, reconciliation, constraint violations of the per-job optimum, curve shape, rolling-year consistency, formula numbering and the model card; the integration test covers site assets, offline use and script order.
