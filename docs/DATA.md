# 数据来源 / Data provenance

Demo 中每一个数字都属于以下四类之一。合成数据只用于演示流程，不代表国泰实际运营。 / Every figure in the demo belongs to one of four categories. Synthetic data demonstrates the workflow and does not represent Cathay operations.

| 类别 / Category                 | 标记 / Label | 用途 / Used for                                                                            |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| 公开且已核对 / Public, verified | `verified`   | 机队、碳强度目标、燃油与维修开支 / Fleet, targets, costs                                   |
| 由公开数据推算 / Derived        | `derived`    | 燃油量、平均油价 / Fuel burn, fuel price                                                   |
| 公开数据集 / Public dataset     | `dataset`    | 剩余寿命模型训练与评估 / RUL training and evaluation                                       |
| 文献参数 / Literature           | `literature` | 停飞成本、劣化与恢复比例 / AOG cost, deterioration, recovery                               |
| 合成数据 / Synthetic            | `synthetic`  | 飞机编号、窗口、库存、工时、全年新工作 / Registrations, windows, stock, capacity, arrivals |

## 1. 国泰公开数据 / Cathay public figures

机器可读版本：[public-facts.json](../data/samples/public-facts.json)。 / Machine-readable copy in `data/samples/public-facts.json`.

| 项目 / Item                         | 数值 / Value                                                                                          | 单位 / Unit    | 来源 / Source                                                                    | 状态 / Status   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------- | --------------- |
| Cathay Pacific fleet (company)      | 179                                                                                                   | aircraft       | Cathay Pacific 2026 Interim Results announcement (HKEX, 2026-08-05), fleet table | `verified`      |
| Fleet mix                           | A321neo 16, A330-300 43, A350-900 30, A350-1000 18, 777-300 17, 777-300ER 35, 747-400ERF 6, 747-8F 14 | aircraft       | same as above                                                                    | `verified`      |
| Aircraft utilisation                | 11.3                                                                                                  | hours/day      | Cathay Pacific Annual Report 2025, operating statistics                          | `verified`      |
| Revenue tonne-km (company)          | 20,461                                                                                                | million RTK    | Cathay Pacific Annual Report 2025                                                | `verified`      |
| GHG emissions (company)             | 15.3                                                                                                  | million t CO2e | Cathay Pacific Annual Report 2025                                                | `verified`      |
| Net carbon intensity (group)        | 2019 761, 2025 746, 2030_target 670                                                                   | g CO2e / RTK   | Cathay Pacific Annual Report 2025, sustainability section (pp. 31-32)            | `verified`      |
| SAF share of jet fuel (group)       | 2025 0.68, 2030_target 10                                                                             | %              | Cathay Pacific Annual Report 2025                                                | `verified`      |
| Aircraft maintenance cost (company) | 8,508                                                                                                 | HK\$ million   | Cathay Pacific Annual Report 2025, operating costs                               | `verified`      |
| Fuel cost incl. hedging (company)   | 28,715                                                                                                | HK\$ million   | Cathay Pacific Annual Report 2025, operating costs                               | `verified`      |
| Revenue tonne-km (group)            | 22,266                                                                                                | million RTK    | Cathay Pacific Sustainability Report 2025, p.148                                 | `team-verified` |
| Fuel burn (company)                 | 4,841,772                                                                                             | t              | GHG / 3.16 t CO2 per t fuel (ICAO)                                               | `derived`       |
| Average fuel price                  | 5,931                                                                                                 | HK\$/t         | fuel cost / derived fuel burn                                                    | `derived`       |

集团 2030 目标 670 g/RTK 以集团 RTK 22,266 百万为分母（含香港快运、华民航空）；集团燃油按集团与国泰航空 RTK 比例推算。 / The 670 g/RTK group target uses group RTK of 22,266 million; group fuel is scaled from company fuel by the RTK ratio.

## 2. NASA C-MAPSS FD001

| 文件 / File       | 字节 / Bytes | SHA-256                                                            |
| ----------------- | ------------ | ------------------------------------------------------------------ |
| `train_FD001.txt` | 3,515,356    | `963b5e22825b34d8b21c69e1aeb4af3e647050eb672ee8834ba4b5d91d2de0f8` |
| `test_FD001.txt`  | 2,228,855    | `3cda7109ce17bafb5443f2ac926cfcf88154b941b8c4cf95eb55d1ddd6f52851` |
| `RUL_FD001.txt`   | 429          | `a19c8ec94931949d0485bdc35118206e9c81c4547b422efb9cf86f4ceddbceca` |

- 来源 / Source：NASA Prognostics Center of Excellence, _Turbofan Engine Degradation Simulation Data Set_（Saxena & Goebel, 2008），公有领域模拟数据 / public-domain simulation data。
- 内容 / Contents：100 台训练发动机运行至失效；100 台测试发动机截断，附真实剩余寿命。21 个感测器，本项目使用其中 14 个有信息量的感测器。 / 100 run-to-failure training engines and 100 truncated test engines with true RUL; 14 of 21 sensors are informative.
- 位置 / Location：由 [download_data.py](../experiments/rul-cmapss/download_data.py) 下载到 `data/raw/cmapss/`（已被 Git 忽略）。 / Downloaded into the ignored `data/raw/cmapss/`.
- Demo 映射 / Demo mapping：测试发动机 #64、#49、#36 分别作为 DEMO-07、DEMO-04、DEMO-13 的发动机；每天 1.5 循环（777-300ER 长途假设）。 / Test engines #64, #49 and #36 stand in for three 777-300ER engines at 1.5 cycles per day.

## 3. 文献参数 / Literature parameters

| 参数 / Parameter                      | 取值 / Value                    | 依据 / Basis                                    |
| ------------------------------------- | ------------------------------- | ----------------------------------------------- |
| 停飞每小时成本 / AOG cost per hour    | US\$40,000                      | Boeing 估算区间 US\$10k–150k/h                  |
| 发动机性能退化 / Engine deterioration | 4,000 飞行小时后耗油 +2%        | NASA CF6 performance deterioration study        |
| 发动机清洗 / Engine wash              | 降低耗油 0.5–1.5%，可恢复约 60% | AeroCore operational data; NASA CF6             |
| 引气漏气 / Bleed leaks                | 每多 1% 引气，耗油 +1–2%        | NASA                                            |
| 机身气动劣化 / Airframe drag          | 未妥善维修时 5 年内阻力可升 2%  | Airbus _Getting to Grips with Fuel Economy_     |
| 舵面与密封漏气 / Seal and gap leaks   | 每年 9–52 t 燃油（按件）        | ASTEROID 气动劣化估算 / drag deterioration tool |
| 换发工时 / Engine change effort       | 36 h、360 工时                  | Austrian Technik GE90 案例 48 h / 450 h         |
| 碳价 / Carbon price                   | US\$30/t（减碳优先 US\$250/t）  | CORSIA 价格预测；内部影子价格 / shadow price    |
| 排放系数 / Emission factor            | 3.16 t CO₂ / t fuel             | ICAO                                            |

## 4. 合成数据 / Synthetic data

| 数据 / Data                           | 文件 / File                                                               | 说明 / Notes                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 第 1 期 21 项工作 / Period-1 jobs     | [tasks-period-1.json](../data/samples/demo/tasks-period-1.json)           | R1–R3 的 μ、σ、f₀、k 来自 C-MAPSS 模型；其余为合成 / R1–R3 from the RUL model |
| 停场窗口 / Ground-time windows        | [windows-period-1.json](../data/samples/demo/windows-period-1.json)       | 过夜、30 h 轮休、外站、A 检 / Night, rest, outstation, A-check                |
| 参数 / Parameters                     | [params-default.json](../data/samples/demo/params-default.json)           | 站点容量、背景占用、备件池、费率 / Capacity, background load, spares, rates   |
| 第 1 期计划 / Period-1 plans          | [plan-period-1.json](../data/samples/demo/plan-period-1.json)             | 现行做法、联合决策、逐项最优 / Baseline, joint, per-job optimum               |
| 全年 26 期结果 / Rolling-year results | [rolling-year-summary.csv](../data/samples/demo/rolling-year-summary.csv) | 4 情景 × 26 期 / 4 scenarios × 26 periods                                     |

全年模拟的新工作按以下频率随机产生（固定种子 20261116）：发动机平均在翼 4.5 年；保留故障每期 0.8 项；性能类问题每期 17 项。备用发动机送修周期约 75 天；旺季（1–2 月、8–10 月）背景工时上浮至 1.06–1.14 倍。 / New jobs follow fixed-seed Poisson rates: 4.5-year average time on wing, 0.8 deferred defects and 17 performance issues per period; spare-engine shop turnaround about 75 days; peak-season background labour up to 1.14×.

飞机编号 DEMO-xx 与机身上的 B-DMxx 字样均为虚构，不对应真实注册号。 / Registrations DEMO-xx and B-DMxx are fictitious.

## 5. 推广情景的计算 / Roll-out scenario arithmetic

| 级别 / Tier                     | 计算 / Calculation                                                           |
| ------------------------------- | ---------------------------------------------------------------------------- |
| ① 本期排程 / This plan          | 全年滚动模拟的 CO₂ 差额 / CO₂ difference from the rolling year               |
| ② 全集团推广 / Group roll-out   | 179 架 × 次数/架年 × 耗油增幅 × 日均燃油 × 恢复比例 × 提早天数，四项措施相加 |
| ③ 机身 1% / Airframe 1%         | 集团燃油 × 1% × 3.16                                                         |
| ④ 机身＋发动机 2% / + engine 2% | 集团燃油 × 2% × 3.16                                                         |
| 碳强度 / Intensity              | 减排吨数 × 10⁶ ÷ 集团 RTK 22,266 百万；除以差距 76 g                         |

燃油节省按 2025 年平均油价计，未扣除额外维修、设备与平台成本。 / Fuel savings use the 2025 average price and exclude extra maintenance, equipment and platform costs.
