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

## 手机视图回归 / Mobile layout regression

修改 Demo 布局后，用浏览器手机模拟模式开启触控，以 `demo2` / `demo` 登录，在 320、360、390、430 CSS px 宽度逐页检查六个管理员页面，再检查 768、1440 px。布局检查需查看实际画面，不能只依赖 `npm run check`。

After changing the demo layout, enable touch in browser device emulation, sign in as the planner, and visit all six sections at 320, 360, 390 and 430 CSS px. Also check 768 and 1440 px. Inspect rendered pages as well as running the code checks.

| 操作 / Action                                             | 验收 / Expected behavior                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 切换全部页签 / Visit every tab                            | 页签可横向滑动，当前页签可见；整页不横向溢出 / Tabs scroll locally, the active tab is visible, and the document fits the viewport                                                    |
| 总览与降本减碳 / Overview and carbon                      | 指标、单位与阶梯标签完整；窄屏卡片不裁切 / Complete values, units and tier labels; cards remain within the viewport                                                                  |
| 等待的代价 / Cost of waiting                              | 曲线有可见绘图区，阶段条对齐；放宽窗口后图表恢复 / A visible plot and aligned phase bar; the chart recovers when widened                                                             |
| 全年图表 / Rolling-year chart                             | 每期柱状与累计曲线同时显示，左右坐标轴单位正确，图例不遮挡绘图区 / Period columns and the cumulative line both appear with the correct axis units; the legend stays outside the plot |
| 排程与模型 / Schedule and model                           | 甘特图、资源表和长公式在各自区域横向滑动 / Gantt, resource tables and long formulas scroll within their own regions                                                                  |
| 数字孪生 / Digital twin                                   | 手指拖动旋转模型，缩放与重置按钮可触控，模型外仍可滚动页面 / Touch drag rotates the model; zoom and reset controls work; the page still scrolls outside the model                    |
| 工作包 / Work packs                                       | 点选后显示详情；接收、开始、逐项勾选、签署和退回可触控，长按钮可换行 / Selection reveals the detail; receive, start, checklist, sign and return controls remain usable               |
| 助手、显示菜单与弹窗 / Assistant, display menu and modals | 内容可滚动，关闭按钮可见；开启大字及高对比后重新检查六页 / Scrollable content and reachable close controls; repeat all sections with large text and high contrast                    |

浏览器模拟不能替代实体 iOS / Android 设备验收。 / Browser emulation does not replace testing on physical iOS and Android devices.

更新 `app.js` 或 `mobile.css` 时，同步 `site/index.html` 中对应的版本参数，使已访问过网站的浏览器加载更新后的资源。 / When changing these assets, update their version query parameters in the site entry page so returning browsers load the revised files.

## 检查边界 / Limits

当前导入规则针对 JavaScript/ES modules，无法替代未来 TypeScript 类型检查或 Python 检查。文档检查不访问外网，也不检查页内锚点。通过 CI 不等同于已完成业务验收、性能评估或生产验证。

Current import rules cover JavaScript/ES modules, not future TypeScript type checks or Python checks. Documentation checks do not fetch external URLs or validate heading anchors. Passing CI does not replace business acceptance, performance evaluation or production validation.
