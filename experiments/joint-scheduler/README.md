# 联合排程与全年滚动 / Joint scheduling and rolling year

| 项目 / Item        | 内容 / Value                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 假设 / Hypothesis  | 在共享资源下一起排程，全年总成本与退化排放都低于固定门槛、先到先得的现行做法 / Joint scheduling beats current practice on cost and emissions                   |
| 输入 / Input       | [data/samples/demo](../../data/samples/demo/) 中的第 1 期工作、窗口与参数；之后各期以固定种子生成 / Period-1 inputs; later periods generated with a fixed seed |
| 引擎 / Engine      | [joint-model.js](../../site/assets/js/joint-model.js)、[rolling-sim.js](../../site/assets/js/rolling-sim.js)，与浏览器相同 / Same files as the browser         |
| 环境 / Environment | Node.js 24，无第三方依赖 / no dependencies                                                                                                                     |
| 耗时 / Runtime     | 约 1 分钟 / about 1 minute                                                                                                                                     |

## 复现 / Reproduce

```sh
npm run reproduce:schedule                                  # 4 情景并与 Demo 比对 / compare all 4
node experiments/joint-scheduler/reproduce.mjs --base       # 只跑基准 / base only
node experiments/joint-scheduler/reproduce.mjs --write-site # 重新生成 Demo 数据 / regenerate demo data
```

结果写入忽略的 `outputs/rolling-year.json`；汇总表见 [rolling-year-summary.csv](../../data/samples/demo/rolling-year-summary.csv)。 / Results go to the ignored `outputs/`; a summary CSV is committed.

## 模拟设定 / Simulation settings

| 设定 / Setting                  | 值 / Value                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------- |
| 期数 / Periods                  | 26 × 14 天，起始 2026-11-16                                                   |
| 发动机更换 / Engine changes     | 各机型发动机数 × 2 ÷（4.5 年 × 26）每期，泊松分布                             |
| 保留故障 / Deferred defects     | 每期 0.8 项                                                                   |
| 性能类问题 / Performance issues | 每期 17 项，按第 1 期模板缩放 0.6–1.4 倍                                      |
| 备用发动机 / Spare engines      | 777-300ER 在站 1 台，另 3 台送修中（第 9、38、66 天回库）；用掉后约 75 天回库 |
| 旺季 / Peak season              | 1–2 月与 8–10 月背景工时 ×1.06–1.14                                           |
| 求解上限 / Search limit         | 每期 60,000 节点                                                              |

## 结果 / Results

| 情景 / Scenario | 节省 / Saving | 降幅 / Δ | CO₂ t | 完整搜索 / Complete |
| --------------- | ------------: | -------: | ----: | ------------------: |
| base            |    HK\$20.26M |     7.4% | 8,273 |               23/26 |
| bay             |    HK\$22.24M |     7.2% | 8,293 |               23/26 |
| carbon          |    HK\$35.32M |    11.3% | 8,736 |               23/26 |
| tight           |    HK\$12.64M |     4.1% | 8,248 |               23/26 |

## 限制 / Limitations

- 停场窗口、库存与工作到达均为合成；成本包括风险期望值与影子碳价，不等于已实现的现金收益。 / Synthetic inputs; costs include expected risk and a shadow carbon price.
- 未完成完整搜索的期别取上限内最佳可行解。 / Incomplete periods return the best feasible plan within the limit.
