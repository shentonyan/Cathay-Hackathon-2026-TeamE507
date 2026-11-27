# Demo 站点 / Demo site

纯静态站点，由 [pages.yml](../.github/workflows/pages.yml) 发布到 GitHub Pages。本地预览：`npm run site`。 / A static site deployed to GitHub Pages; preview locally with `npm run site`.

| 路径 / Path                     | 内容 / Contents                                                                    | 来源 / Origin                    |
| ------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `index.html`                    | 页面结构 / Markup                                                                  | 手写 / Hand-written              |
| `assets/css/app.css`            | 样式，按原层叠顺序 / Styles in cascade order                                       | 手写 / Hand-written              |
| `assets/js/joint-model.js`      | 等待的代价、0-1 整数规划、分支定界 / Cost curve, integer program, branch and bound | 手写 / Hand-written              |
| `assets/js/rolling-sim.js`      | 全年 26 期滚动模拟 / Rolling year                                                  | 手写 / Hand-written              |
| `assets/js/lazy-loader.js`      | 按需加载、依赖顺序、去重与失败重试 / On-demand loading, ordering, deduplication and retry | 手写 / Hand-written       |
| `assets/js/part-specimens.js`   | 参数化零件模型（正常件与问题件），仅数字孪生使用 / Parametric part models, twin only        | 手写 / Hand-written              |
| `assets/js/app.js`              | 界面、数字孪生、工作包、降本减碳 / UI, twin, work packs, cost and carbon           | 手写 / Hand-written              |
| `assets/data/cmapss-rul.js`     | 模型卡与三台发动机 / Model card and engines                                        | `experiments/rul-cmapss`         |
| `assets/data/rolling-year.js`   | 4 情景 × 26 期预计算结果 / Precomputed rolling year                                | `npm run reproduce:schedule`     |
| `assets/data/model-formulas.js` | 向量排版公式与符号表 / Typeset formulas                                            | `scripts/site/build_formulas.py` |
| `assets/data/brand-assets.js`   | 国泰翼标 / Cathay brushwing                                                        | 国泰商标 / Cathay trademark      |
| `assets/vendor/`                | Highcharts 12.1.2、three.js r158                                                   | 第三方 / Third-party             |

首屏关键路径保留登录外壳和计算所需的 C-MAPSS 数据、品牌资源、滚动年份数据、联合模型、滚动模拟、按需加载器与界面代码。Highcharts 在图表页激活时加载，公式数据只在模型页加载，three.js 与零件模型只在数字孪生激活时加载；组内逐一执行以维持依赖顺序，并发与重复激活共享同一个 Promise，失败时显示可重试提示。运行 Demo 不需要构建、CDN、外部字体或浏览器 MathJax。 / The initial critical path keeps the sign-in shell and calculation code: C-MAPSS data, brand assets, rolling-year data, the joint model, rolling simulation, the lazy loader and the UI. Highcharts loads when a chart section activates, formulas only in the model section, and three.js plus part models only in the digital twin. Each group executes in dependency order, concurrent or repeated activation shares one Promise, and failures show a retry prompt. Running the demo needs no build, CDN, external fonts or browser MathJax.

公式由 MathJax 在开发时预排版为独立 SVG；重新生成见 [复现指南](../docs/REPRODUCE.md)。首屏字节预算、Chromium 测试与本机移动端量测见 [测试与质量检查](../docs/TESTING.md)。 / MathJax pre-typesets formulas into self-contained SVGs during development; see the reproduction guide to regenerate them. The initial-JS budget, Chromium tests and local mobile measurement are documented in [testing and quality gates](../docs/TESTING.md).
