# 测试与质量检查 / Testing and quality gates

## 检查入口 / Check entry point

提交前运行 `npm run check`，CI 在 Linux 和 Windows 上执行同一命令。 / Run `npm run check` before submitting; CI runs the same command on Linux and Windows.

| 检查 / Check                   | 验证内容 / What it verifies                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Prettier                       | 格式一致性 / Formatting                                                                                     |
| ESLint                         | JavaScript 静态错误与规则 / JavaScript static rules                                                         |
| dependency-cruiser             | 导入方向、公开入口、循环与未解析依赖 / Boundaries, public entries, cycles and unresolved imports            |
| 文档检查 / Documentation check | Markdown 本地文件链接存在 / Local Markdown file targets exist                                               |
| 单元测试 / Unit                | 本地配置默认值与无效输入 / Configuration defaults and invalid inputs                                        |
| 契约测试 / Contract            | 真实健康响应与 OpenAPI Schema 一致 / Live health response conformance                                       |
| 集成测试 / Integration         | HTTP、前端资源、HEAD、错误方法和未登记路径 / HTTP, assets, HEAD, unsupported methods and unregistered paths |

```sh
npm run test:unit
npm run test:contracts
npm run test:integration
npm test
```

## 何时新增测试 / When to add tests

业务规则使用单元测试；接口和序列化变化增加契约测试；模块交互和数据访问增加集成测试。完整用户流程实现后，再增加浏览器端到端测试。当前模板没有浏览器自动化或数据库测试。

Use unit tests for business rules, contract tests for API and serialization changes, and integration tests for module interactions and persistence. Add browser end-to-end tests when a real user journey exists. The starter has no automated browser or database tests.

测试用合成或获准使用的样例，避免依赖实时外部服务。发生缺陷时优先补能复现问题的测试。 / Use synthetic or authorized fixtures and avoid live external-service dependencies. Add a regression test when a defect can be reproduced.

## 检查边界 / Limits

当前导入规则针对 JavaScript/ES modules，无法替代未来 TypeScript 类型检查或 Python 检查。文档检查不访问外网，也不检查页内锚点。通过 CI 不等同于已完成业务验收、性能评估或生产验证。

Current import rules cover JavaScript/ES modules, not future TypeScript type checks or Python checks. Documentation checks do not fetch external URLs or validate heading anchors. Passing CI does not replace business acceptance, performance evaluation or production validation.
