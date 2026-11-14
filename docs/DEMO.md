# 演示手册 / Demo runbook

当前仅有开发模板。下面的待填字段应在业务流程实现后替换。 / This is currently a development starter; fill in the following fields when the business flow is implemented.

| 项目 / Item                         | 内容 / Value                                                           |
| ----------------------------------- | ---------------------------------------------------------------------- |
| 版本 / Version or commit            | 待填 / To be filled                                                    |
| 演示负责人 / Presenter              | 待填 / To be filled                                                    |
| 用户与问题 / User and problem       | 待填 / To be filled                                                    |
| 核心任务 / Core task                | 待填 / To be filled                                                    |
| 当前启动 / Current startup          | `npm ci` → `npm run dev` → `http://127.0.0.1:3000`                     |
| 数据来源 / Data source              | 待填，注明合成或实际授权来源 / Specify synthetic or authorized source  |
| 实现与 mock / Implemented vs mocked | 当前只有占位页与健康检查 / Currently only the preview and health check |
| 备用方案 / Fallback                 | 待填，例如本地样例与录屏 / e.g. local samples and recording            |

## 演示顺序 / Presentation flow

1. **问题 / Problem**：谁遇到什么困难？ / Who faces which problem?
2. **操作 / Journey**：展示一个完整任务。 / Show one complete task.
3. **结果 / Outcome**：展示实际输出和可核验价值。 / Show the actual result and verifiable value.
4. **边界 / Limitations**：指出 mock、数据来源与未实现部分。 / Identify mocks, data provenance and incomplete capabilities.

## 排练检查 / Rehearsal checklist

- [ ] 干净克隆可按 README 启动。 / A clean clone starts using the README.
- [ ] 根检查与模块检查通过。 / Root and module checks pass.
- [ ] 加载、空结果和错误状态可演示。 / Loading, empty and failure states are demonstrable.
- [ ] 样例输入、重置步骤与备用方案已准备。 / Samples, reset steps and fallback are ready.
- [ ] 屏幕与录屏不含敏感信息。 / Screen and recordings contain no sensitive information.
- [ ] 已记录 commit，并在冻结版本上彩排。 / The commit is recorded and rehearsed after the freeze.
