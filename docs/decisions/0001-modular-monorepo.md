# ADR 0001 · 模块化单仓库 / Modular monorepo

- 状态 / Status：已采纳 / Accepted for the starter
- 日期 / Date：2026-11-14
- 范围 / Scope：开发模板 / Development starter

## 背景 / Context

团队将在短时间内频繁修改界面、接口和 Demo。原模板有目录约定，但缺少实际工作区和可自动检查的模块边界。 / The team will frequently change UI, APIs and demos within a short event. The original starter had directory conventions but no managed workspaces or enforceable boundaries.

## 选择 / Decision

使用 npm workspaces 管理前端、API 与契约；功能代码按 feature 组织，服务以公开入口组合。用 OpenAPI 描述接口，以 ESLint、dependency-cruiser 和分层测试验证改动。 / Manage frontend, API and contracts with npm workspaces; organize code by feature and compose the service through a public entry. Describe interfaces in OpenAPI and validate changes with ESLint, dependency-cruiser and layered tests.

## 备选与取舍 / Alternatives and tradeoffs

单包平铺结构启动简单，但边界容易随协作模糊。独立服务仓库和完整分布式基础设施会增加当前的协调、部署与调试成本。当前规模下保留单仓库与单进程预览，框架选型继续由业务需求驱动。 / A flat package is easy to start but weakens ownership as collaboration grows. Separate repositories and distributed infrastructure increase coordination, deployment and debugging costs. Keep one repository and one preview process at this stage; let product needs drive framework choices.

## 后果与验证 / Consequences and validation

根目录可统一安装和检查；代价是需要维护工作区与边界规则。`npm run check` 验证格式、静态规则、导入方向、本地链接及单元、契约和 HTTP 集成测试。引入新语言后要补对应工具，不能将当前检查视为跨语言覆盖。 / Installation and checks are centralized, at the cost of maintaining workspace and boundary rules. `npm run check` verifies formatting, static rules, imports, local links, unit tests, contracts and HTTP integration. New languages require their own tooling; current checks do not provide cross-language coverage.
