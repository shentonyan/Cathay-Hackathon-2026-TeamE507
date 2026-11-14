# Demo 站点 / Demo site

纯静态站点，由 [pages.yml](../.github/workflows/pages.yml) 发布到 GitHub Pages。本地预览：`npm run site`。 / A static site deployed to GitHub Pages; preview locally with `npm run site`.

| 路径 / Path                     | 内容 / Contents                                                                    | 来源 / Origin                    |
| ------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `index.html`                    | 页面结构 / Markup                                                                  | 手写 / Hand-written              |
| `assets/css/app.css`            | 样式，按原层叠顺序 / Styles in cascade order                                       | 手写 / Hand-written              |
| `assets/js/joint-model.js`      | 等待的代价、0-1 整数规划、分支定界 / Cost curve, integer program, branch and bound | 手写 / Hand-written              |
| `assets/js/rolling-sim.js`      | 全年 26 期滚动模拟 / Rolling year                                                  | 手写 / Hand-written              |
| `assets/js/part-specimens.js`   | 参数化零件模型（正常件与问题件）/ Parametric part models                           | 手写 / Hand-written              |
| `assets/js/app.js`              | 界面、数字孪生、工作包、降本减碳 / UI, twin, work packs, cost and carbon           | 手写 / Hand-written              |
| `assets/data/cmapss-rul.js`     | 模型卡与三台发动机 / Model card and engines                                        | `experiments/rul-cmapss`         |
| `assets/data/rolling-year.js`   | 4 情景 × 26 期预计算结果 / Precomputed rolling year                                | `npm run reproduce:schedule`     |
| `assets/data/model-formulas.js` | 向量排版公式与符号表 / Typeset formulas                                            | `scripts/site/build_formulas.py` |
| `assets/data/brand-assets.js`   | 国泰翼标 / Cathay brushwing                                                        | 国泰商标 / Cathay trademark      |
| `assets/vendor/`                | Highcharts 12.1.2、three.js r158                                                   | 第三方 / Third-party             |

脚本按依赖顺序以普通 `<script>` 加载，不需要构建步骤。 / Scripts load as classic `<script>` tags in dependency order; no build step.
