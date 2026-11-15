# 演示手册 / Demo runbook

| 项目 / Item                         | 内容 / Value                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 版本 / Version                      | v14（`site/`），见 [CHANGELOG](../CHANGELOG.md)                                                                                                                                             |
| 线上地址 / URL                      | <https://shentonyan.github.io/Cathay-Hackathon-2026-TeamE507/>                                                                                                                              |
| 本地启动 / Local                    | `npm ci` → `npm run site` → `http://127.0.0.1:4173`                                                                                                                                         |
| 用户与问题 / User and problem       | 维修计划人员要在共享机库、人手、设备与备件下决定每项工作的日期 / Planners must date every job under shared resources                                                                        |
| 核心任务 / Core task                | 看懂等待的代价 → 比较三种排法 → 批准计划 → 工程师执行与回馈 / Read the curve → compare approaches → approve → execute and feed back                                                         |
| 数据来源 / Data source              | 国泰公开报告、NASA C-MAPSS、文献参数；运营数据为合成 / Cathay reports, C-MAPSS, literature; operations synthetic — see [DATA](DATA.md)                                                      |
| 实现与 mock / Implemented vs mocked | 排程、预测、滚动模拟、数字孪生为真实计算；登录、订阅、付款、AI 助手为本地模拟 / Scheduling, prediction, rolling year and twin compute live; sign-in, checkout and assistant are local mocks |
| 备用方案 / Fallback                 | 无 WebGL 时数字孪生显示提示，其余页面不受影响；可用本地 `npm run site` 离线演示 / Twin degrades gracefully; local offline run                                                               |

## 账户 / Accounts

| 身份 / Role               | 账户 / Account                                        | 密码 / Password |
| ------------------------- | ----------------------------------------------------- | --------------- |
| 管理人员 / Planner        | `demo2`                                               | `demo`          |
| 维修员工 / Engineer       | `demo1`                                               | `demo`          |
| 外部订阅公司 / Subscriber | 模拟订阅时填写的电邮 / Email entered at mock checkout | `demo`          |

## 两分钟流程 / Two-minute flow

| 时间 / Time | 操作 / Action                | 讲述要点 / Talking point                                                  |
| ----------- | ---------------------------- | ------------------------------------------------------------------------- |
| 0:00        | 登录封面 / Cover             | HK\$625M、333K t CO₂、完成 2030 差距 19.7%（推广情景）                    |
| 0:12        | `demo2` 登录 / Sign in       | 国泰内部先用，外部航空公司同一入口订阅 / Cathay first, others subscribe   |
| 0:20        | 总览四个数字 / Overview KPIs | 全年滚动 26 期、484 项：省 HK\$20.3M、减 8,273 t / Rolling year results   |
| 0:35        | 等待的代价 / Cost of waiting | 太早浪费寿命，太晚风险急升；最低点即最划算的一天 / U-shaped curve         |
| 0:50        | 为什么不能逐项排 / Why joint | 逐项最优有 6 处冲突；联合决策满足全部约束 / Per-job optimum is infeasible |
| 1:05        | 排程 → DEMO-04               | 在站备发给耗油最多的飞机 / Spare goes to the heaviest burner              |
| 1:20        | 数字孪生 → 零件对比 / Twin   | 整机 → 发动机 → 正常件与问题件 / Aircraft to part                         |
| 1:35        | 降本减碳 / Cost and carbon   | 四级推进，最多完成 2030 差距五分之一 / Up to one fifth of the gap         |
| 1:50        | 助手 → 交班摘要 / Assistant  | 草稿须持证人员签核 / Drafts require licensed sign-off                     |

完整繁体讲稿与评委问答见 [demo-script.zh-Hant.md](demo-script.zh-Hant.md)。 / The full Traditional Chinese script with judge Q&A is linked above.

## 演示顺序 / Presentation flow

1. **问题 / Problem**：维修太早浪费寿命、太晚停飞与多耗油；资源共享使各自最优不可行。 / Timing trade-off plus shared resources.
2. **操作 / Journey**：等待的代价 → 联合排程 → 数字孪生 → 工作包签核与退回。 / Curve → joint plan → twin → work-pack sign-off and return.
3. **结果 / Outcome**：全年 HK\$20.3M、8,273 t CO₂；推广后完成 2030 差距 19.7%。 / Rolling-year and roll-out figures.
4. **边界 / Limitations**：运营数据为合成；推广情景须试点验证；建议不等于适航放行。 / Synthetic operations, scenario validation, not airworthiness release.

## 排练检查 / Rehearsal checklist

- [ ] 干净克隆可按 README 启动，线上 Pages 可打开。 / A clean clone starts and Pages loads.
- [ ] `npm run check` 通过。 / Checks pass.
- [ ] Chrome 或 Edge 已开启硬件加速，数字孪生可显示。 / Hardware acceleration on; the twin renders.
- [ ] 「显示」菜单三个开关均为关。 / Display toggles are off.
- [ ] 手机按[回归清单](TESTING.md)检查页签、图表、公式滑动及工作包操作。 / On mobile, check tabs, charts, formula scrolling and work-pack actions using the regression checklist.
- [ ] 以 `demo1` 演示退回后，已回到 `demo2` 并处理回馈或清除浏览器数据。 / Feedback demo reset.
- [ ] 屏幕与录屏不含敏感信息。 / No sensitive information on screen.
- [ ] 已记录 commit，并在冻结版本上彩排。 / Commit recorded and rehearsed.
