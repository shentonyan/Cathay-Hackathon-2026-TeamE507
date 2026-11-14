# Cathay Hackathon 2026 · Team E507

[![CI](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/actions/workflows/ci.yml/badge.svg)](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/actions/workflows/ci.yml)

**一起把想法变成可运行的 Demo。 / Turn an idea into a working demo, together.**

面向 Team E507 的协作式单仓库，采用功能模块组织、共享 API 契约和自动质量检查。目前提供开发环境与健康检查；Cathay AaaS（航空即服务）业务范围由团队进一步确认。

A collaborative monorepo for Team E507 with feature modules, shared API contracts and automated quality checks. The starter implements a local preview and health check; the Cathay AaaS business scope remains a team decision.

## 快速开始 / Quick start

安装 Git、Node.js 24 和 npm 11，然后运行以下命令。 / Install Git, Node.js 24 and npm 11, then run:

```sh
git clone https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507.git
cd Cathay-Hackathon-2026-TeamE507
npm ci
npm run dev
```

打开 <http://127.0.0.1:3000>，点击「检查环境 / Check setup」。按 `Ctrl+C` 停止。可选：复制 `.env.example` 为 `.env` 修改端口。

Open <http://127.0.0.1:3000> and select **Check setup**. Stop with `Ctrl+C`. Optionally copy `.env.example` to `.env` to change the port.

Windows PowerShell 如果阻止 `npm.ps1`，使用 `npm.cmd` 代替 `npm`。 / If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`.

## 仓库结构 / Repository structure

```text
.
├── apps/web/                浏览器应用 / Browser application
│   └── src/features/        按功能组织 / Feature modules
├── services/api/            API 服务边界 / API service boundary
│   └── src/modules/         服务功能模块 / Service feature modules
├── packages/
│   ├── contracts/           OpenAPI 契约 / OpenAPI contracts
│   └── shared/              按需提取的共享代码 / Shared code when needed
├── tests/
│   ├── unit/                纯逻辑与配置 / Pure logic and configuration
│   ├── contracts/           真实响应与契约一致性 / Live response conformance
│   └── integration/         HTTP 与静态资源 / HTTP and static assets
├── docs/                    双语开发手册 / Bilingual handbook
│   └── decisions/           架构决策记录 / Architecture decisions
├── scripts/preview/         本地组合与启动 / Local composition and startup
├── data/samples/            获准共享的样例 / Shareable sample data
├── experiments/             可复现实验 / Reproducible experiments
├── infra/                   部署配置预留 / Future deployment configuration
└── .github/                 CI 与协作模板 / CI and collaboration templates
```

当前用 npm workspaces 管理实际包；浏览器通过 HTTP 调用 API。前端不能导入服务内部实现，共享包不能反向依赖应用，CI 检查循环依赖与越界导入。

npm workspaces manages the implemented packages. The browser calls the API over HTTP. Applications and packages have enforced import boundaries; CI detects circular and forbidden dependencies.

## 常用命令 / Commands

| 命令 / Command              | 用途 / Purpose                            |
| --------------------------- | ----------------------------------------- |
| `npm run dev`               | 启动本地预览 / Start local preview        |
| `npm run check`             | 执行全部质量检查 / Run all quality checks |
| `npm run format`            | 统一文件格式 / Format files               |
| `npm run lint`              | ESLint 静态检查 / ESLint analysis         |
| `npm run lint:architecture` | 模块依赖约束 / Dependency boundaries      |
| `npm run docs:check`        | 本地文档链接 / Local documentation links  |
| `npm test`                  | 全部自动测试 / All automated tests        |
| `npm run test:contracts`    | HTTP 响应契约 / HTTP response conformance |

## 团队工作流 / Team workflow

1. 在 [成员设置 / Collaborators](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/settings/access) 邀请队友，接受邀请后克隆仓库。 / Invite teammates; accept the invitation before cloning.
2. 用 Issue 明确目标、负责人和验收标准。 / Define the goal, owner and acceptance criteria in an Issue.
3. 从最新 `main` 创建任务分支，完成改动与必要测试。 / Branch from current `main` and implement the change with relevant tests.
4. 打开 PR，CI 通过并经队友审阅后 Squash merge。 / Open a PR, pass CI, obtain team review and squash merge.
5. 按演示手册排练并记录 commit。 / Rehearse with the demo runbook and record the commit.

已配置 Squash 合并及合并后删除任务分支；强制分支保护需另行启用。 / Squash merging and branch cleanup are configured; enforced branch protection requires separate setup.

## 开发手册 / Handbook

| 阅读入口 / Guide                                      | 内容 / Contents                                             |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| [文档导航 / Documentation](docs/README.md)            | 按角色找到说明 / Find guidance by role                      |
| [新人上手 / Getting started](docs/GETTING_STARTED.md) | 安装、启动与排错 / Setup and troubleshooting                |
| [架构 / Architecture](docs/ARCHITECTURE.md)           | 模块边界、依赖图与演进 / Boundaries, diagrams and evolution |
| [接口 / API guide](docs/API.md)                       | 契约、错误与兼容性 / Contracts, errors and compatibility    |
| [测试 / Testing](docs/TESTING.md)                     | 分层验证与质量门槛 / Test layers and quality gates          |
| [贡献 / Contributing](CONTRIBUTING.md)                | 分支、PR 与双语写作 / Branches, PRs and bilingual writing   |
| [路线 / Roadmap](docs/ROADMAP.md)                     | MVP 与里程碑 / MVP and milestones                           |
| [演示 / Demo](docs/DEMO.md)                           | 排练与交付 / Rehearsal and delivery                         |

## 数据与许可证 / Data and licensing

仅提交获准共享的代码和素材，样例注明合成或实际授权来源。尚未选择开源许可证；由团队结合赛事条款确认后添加 `LICENSE`。参见 [安全说明 / Security](SECURITY.md)。

Commit only authorized code and assets; label samples as synthetic or identify their authorized source. No open-source license has been selected. The team should add `LICENSE` after checking the event terms. See [Security](SECURITY.md).
