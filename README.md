# Cathay Hackathon 2026 · Team E507

[![CI](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/actions/workflows/ci.yml/badge.svg)](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/actions/workflows/ci.yml)

Team E507 的代码与 Demo 协作仓库。当前是项目起步模板，包含一个可运行的本地预览页、自动检查和团队协作规范。

项目方向参考团队已有的 **Cathay AaaS（航空即服务）** 构想；具体 MVP 范围、业务接口和技术选型由团队确认，见 [开发路线](docs/ROADMAP.md)。当前页面和健康检查仅用于验证开发环境，业务能力尚待实现。

## 五分钟开始

安装 **Node.js 24 LTS**（自带 npm）和 Git，然后运行：

```sh
git clone https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507.git
cd Cathay-Hackathon-2026-TeamE507
npm ci
npm run dev
```

打开 <http://127.0.0.1:3000>。点击「检查开发环境」可验证 `/api/health`。按 `Ctrl+C` 停止。

Windows PowerShell 如果阻止执行 `npm.ps1`，将命令中的 `npm` 换成 `npm.cmd` 即可。

可选：复制 `.env.example` 为 `.env` 并调整预览端口。默认配置无需环境文件即可启动。

```sh
npm run check          # 格式、JavaScript 语法和自动测试
npm run format        # 统一格式
npm test              # 本地预览服务器测试
```

## 目录说明

```text
apps/web/             前端入口，当前为静态 Demo 占位页
services/api/         业务 API 预留位置
packages/shared/      跨模块共享的类型、校验和工具
experiments/          可复现实验、算法验证和原型
data/samples/         可提交的合成样例数据
docs/                 上手、架构、路线和演示文档
infra/                部署配置预留位置
scripts/              本地开发与检查脚本
tests/                自动化测试
.github/              CI、Issue 和 Pull Request 模板
```

预览服务使用 Node.js 内置模块，格式工具由锁文件固定版本。此模板不预设业务前后端框架；引入框架时同步更新启动命令、架构记录和 CI。

## 团队协作

1. 仓库所有者在 [Settings → Collaborators](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/settings/access) 邀请队友。
2. 队友接受邀请并克隆仓库，按 [新人上手](docs/GETTING_STARTED.md) 启动。
3. 用 Issue 描述目标、负责人和验收标准；从最新 `main` 创建 `feat/...`、`fix/...` 或 `docs/...` 分支。
4. 提交 Pull Request，写清验证方式与界面变化；检查通过后请队友审阅并 Squash merge。
5. 演示前按 [Demo 检查表](docs/DEMO.md) 排练，记录可用版本。

详见 [贡献指南](CONTRIBUTING.md)、[架构说明](docs/ARCHITECTURE.md) 和 [团队协作约定](docs/TEAM.md)。`main` 的分支审查要求是团队约定；是否启用 GitHub 强制保护，需在仓库设置中单独配置。

## 数据与许可证

只提交代码和获准共享的素材。密钥、本地环境文件、个人资料、签署文件和大型原始资料不进入版本控制；样例数据应明确标注为合成数据。发现敏感信息问题时按 [安全说明](SECURITY.md) 处理。

尚未选择开源许可证。由团队结合赛事条款和第三方素材授权确认后添加 `LICENSE`；当前模板不代表已获得 Cathay 的商标、数据或素材授权。
