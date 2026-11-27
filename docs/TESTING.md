# 测试与质量检查 / Testing and quality gates

## 检查入口 / Check entry point

提交前运行 `npm run check`，CI 在 Linux 和 Windows 上执行同一命令；Chromium 端到端测试由独立的 Ubuntu browser job 执行。 / Run `npm run check` before submitting; CI runs the same command on Linux and Windows. A separate Ubuntu browser job runs the Chromium end-to-end tests.

| 检查 / Check                     | 验证内容 / What it verifies                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Prettier                         | 格式一致性 / Formatting                                                                                           |
| ESLint                           | JavaScript 静态错误与规则 / JavaScript static rules                                                               |
| dependency-cruiser               | 导入方向、公开入口、循环与未解析依赖 / Boundaries, public entries, cycles and unresolved imports                  |
| 文档检查 / Documentation check   | Markdown 本地文件链接存在 / Local Markdown file targets exist                                                     |
| 单元测试 / Unit                  | 本地配置默认值、无效输入与首屏 JS 预算 / Configuration defaults, invalid inputs and initial-JS budget             |
| 首屏 JS 预算 / Initial-JS budget | 原始脚本与行内字节；延迟资源不得回到首屏 / Raw script and inline bytes; deferred assets stay off the initial path |
| 契约测试 / Contract              | 真实健康响应与 OpenAPI Schema 一致 / Live health response conformance                                             |
| 集成测试 / Integration           | HTTP、前端资源、HEAD、错误方法和未登记路径 / HTTP, assets, HEAD, unsupported methods and unregistered paths       |

```sh
npm run test:unit
npm run test:contracts
npm run test:integration
npm run check:site-js
npm test                            # Node tests; Playwright is separate
npx playwright install chromium     # first local Chromium run
npm run test:e2e                    # starts the static server on port 4174
```

## 首屏性能与按需加载 / Initial-load performance and lazy loading

`check:site-js` 读取 `site/index.html` 的可执行脚本、行内 JavaScript、脚本 preload 与 modulepreload，按本地文件原始字节计算，不依赖服务器压缩。基线为 **2,950,307 bytes**，50% 目标对应的上限为 **1,475,153 bytes**；当前为 **305,220 bytes**，减少 **2,645,087 bytes（89.7%）**。Highcharts、公式数据、three.js 与零件模型不得重新出现在首屏路径。 / `check:site-js` reads executable scripts, inline JavaScript, script preloads and modulepreloads from `site/index.html` and counts raw local file bytes, independent of server compression. The baseline is **2,950,307 bytes**, the 50% target caps the initial path at **1,475,153 bytes**, and the current path is **305,220 bytes**, a reduction of **2,645,087 bytes (89.7%)**. Highcharts, formulas, three.js and part models must stay off the initial path.

本机移动端量测在一个终端运行 `npm run site`，在另一个终端运行 `npm run measure:site`。脚本使用 390×844、DSF 2.625、触控模拟、150 ms RTT、1.6 Mbps 下行、750 Kbps 上行与 4× CPU 降速，记录未登录首屏的 LCP、导航时间和脚本资源字节。 / For the local mobile measurement, run `npm run site` in one terminal and `npm run measure:site` in another. The script uses a 390×844 viewport, DSF 2.625, touch emulation, 150 ms RTT, 1.6 Mbps down, 750 Kbps up and 4× CPU throttling, and records signed-out LCP, navigation timings and script resource bytes.

| 量测 / Measurement                    | 原始 / Baseline | 本次 / Current |
| ------------------------------------- | --------------: | -------------: |
| 初始脚本 bytes / Initial script bytes |       2,950,307 |        305,220 |
| LCP                                   |       17,272 ms |       4,132 ms |
| DOMContentLoaded                      |     16,918.2 ms |     3,786.9 ms |

前后两次量测均使用 headless Chromium 159.0.8154.6 与相同设置，基线由 `4058f2b` 的干净 `site/` 文件提供。两项时间各只有一个样本，不是统计中位数，也不能代表实体设备或生产网络。CI 只执行确定性的字节预算，不设置 LCP 时间门槛。 / Both runs used headless Chromium 159.0.8154.6 with the same profile; the baseline was served from a clean `site/` archive at `4058f2b`. Each timing is a single sample, not a statistical median or a physical-device/production-network result. CI enforces only the deterministic byte budget, not an LCP timing threshold.

Playwright 在 **390 px 与 1440 px** 各运行 3 个 Chromium 场景：未登录首载与六页、并发及重复激活去重、加载失败提示与重试。测试核对延迟请求的时机、每个资源只请求一次、依赖顺序、控制台错误、外部请求、HTTP 错误响应与文档横向溢出。测试会自行启动本地静态服务器。 / Playwright runs three Chromium scenarios at each of **390 px and 1440 px**: signed-out first load plus all six sections, concurrent/repeated activation deduplication, and visible load failure plus retry. It checks lazy-request timing, one request per asset, dependency order, console errors, external requests, HTTP error responses and document overflow. The tests start their own local static server.

## 何时新增测试 / When to add tests

业务规则使用单元测试；接口和序列化变化增加契约测试；模块交互和数据访问增加集成测试。完整用户流程与静态资源加载变化增加 Playwright 端到端测试。当前仓库有 Chromium 自动化，但没有 Firefox、WebKit 自动化或数据库测试。

Use unit tests for business rules, contract tests for API and serialization changes, and integration tests for module interactions and persistence. Add Playwright end-to-end tests for complete user journeys and static-asset loading changes. This repository has Chromium automation, but no Firefox, WebKit or database automation.

测试用合成或获准使用的样例，避免依赖实时外部服务。发生缺陷时优先补能复现问题的测试。 / Use synthetic or authorized fixtures and avoid live external-service dependencies. Add a regression test when a defect can be reproduced.

## 手机视图回归 / Mobile layout regression

修改 Demo 布局后，用浏览器手机模拟模式开启触控，以 `demo2` / `demo` 登录，在 320、360、390、430 CSS px 宽度逐页检查六个管理员页面，再检查 768、1440 px。布局检查需查看实际画面，不能只依赖 `npm run check`。

After changing the demo layout, enable touch in browser device emulation, sign in as the planner, and visit all six sections at 320, 360, 390 and 430 CSS px. Also check 768 and 1440 px. Inspect rendered pages as well as running the code checks. The automated 390 px and 1440 px Chromium projects complement these checks but do not replace them.

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

更新 `app.js`、`lazy-loader.js`、`app.css` 或 `mobile.css` 时，同步 `site/index.html` 中对应的版本参数，使已访问过网站的浏览器加载更新后的资源。 / When changing these assets, update their version query parameters in the site entry page so returning browsers load the revised files.

## iPad 扫码打开 / Opening the demo on iPad

以未登录的浏览器会话打开扫码目标的[公开地址](https://shentonyan.github.io/Cathay-Hackathon-2026-TeamE507/)。先检查登录页，再以管理员账户访问六页；覆盖 768×1024、810×1080、820×1180、834×1194、1024×1366 及对应横屏，以及 507、694 CSS px 分屏宽度。切换方向后复查图表、公式、导航、助手及弹窗，并实际操作工作包和数字孪生。

Open the public QR destination in a signed-out browser session. Check sign-in and all six planner sections at the portrait sizes above, their landscape counterparts, and the two split-view widths. Repeat after rotation and exercise work packs, twin controls and overlays.

2026-11-15 复验：Chromium 触控模拟覆盖 72 个视图及 6 次方向切换；Windows WebKit 覆盖 36 个视图，并验证工作包签署、甘特图选取、弹窗和 3D 操作，未发现布局或功能缺陷。此记录是浏览器内核与尺寸模拟结果，实体 iPad 相机扫码、iPadOS Safari 和软键盘仍需真机验收。

Verified on 2026-11-15: Chromium touch emulation passed 72 views and six rotation checks; Windows WebKit passed 36 views plus work-pack, schedule, modal and 3D interactions. These are engine and viewport checks; physical camera scanning, iPadOS Safari and the software keyboard require device testing.

## 检查边界 / Limits

当前导入规则针对 JavaScript/ES modules，无法替代未来 TypeScript 类型检查或 Python 检查。文档检查不访问外网，也不检查页内锚点。通过 CI 不等同于已完成业务验收、实体设备性能评估或生产验证；本机 LCP 样本尤其不能作为真实用户体验的保证。

Current import rules cover JavaScript/ES modules, not future TypeScript type checks or Python checks. Documentation checks do not fetch external URLs or validate heading anchors. Passing CI does not replace business acceptance, physical-device performance evaluation or production validation; a local LCP sample is not a guarantee of real-user experience.
