# 新人上手 / Getting started

## 获取权限 / Access

接受仓库邀请后克隆，确认当前 GitHub 账号与接受邀请的账号一致。 / Accept the repository invitation before cloning; use the same GitHub account.

## 安装与启动 / Install and start

使用 Git、Node.js 24 和 npm 11。 / Use Git, Node.js 24 and npm 11.

```sh
git clone https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507.git
cd Cathay-Hackathon-2026-TeamE507
npm ci
npm run dev
```

打开 <http://127.0.0.1:3000>，点击 **检查环境 / Check setup**；预期看到连接成功。根目录执行一次 `npm ci` 即可安装工具和链接 workspace 包。

Open <http://127.0.0.1:3000> and select **Check setup**; expect a successful connection. One root-level `npm ci` installs tools and links workspace packages.

## 本地配置 / Local configuration

默认无需环境文件。需要改端口时复制 `.env.example` 为 `.env`，设置 `PORT=3001` 后重启。前端文件修改后刷新浏览器；修改服务或预览代码时 watch 模式会重启。

No environment file is required by default. To change the port, copy `.env.example` to `.env`, set `PORT=3001` and restart. Refresh after frontend edits; watch mode restarts after service or preview code changes.

## 第一项贡献 / First contribution

1. 阅读 [架构 / Architecture](ARCHITECTURE.md) 和 [路线 / Roadmap](ROADMAP.md)，认领 Issue。 / Read the guides and claim an Issue.
2. 按 [贡献指南 / Contributing](../CONTRIBUTING.md) 创建任务分支。 / Create a task branch.
3. 执行 `npm run check`，打开 PR 并给出复现步骤。 / Run checks and open a PR with repeatable verification steps.

## 常见问题 / Troubleshooting

| 现象 / Symptom                         | 处理 / Action                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| PowerShell 禁止脚本 / Script blocked   | 使用 `npm.cmd`，无需修改系统策略 / Use `npm.cmd` without changing system policy                              |
| `Unsupported engine`                   | 检查并切换到 Node.js 24 / Check and switch to Node.js 24                                                     |
| `EADDRINUSE`                           | 更改 `.env` 的端口并重启 / Change the port in `.env` and restart                                             |
| workspace 包找不到 / Package not found | 在仓库根目录运行 `npm ci` / Run `npm ci` at the repository root                                              |
| 锁文件不匹配 / Lockfile mismatch       | 同步最新代码；仅修改依赖时用 `npm install` / Sync code; use `npm install` for intentional dependency changes |
| 格式失败 / Format failure              | 运行 `npm run format` 并查看差异 / Run the formatter and review the diff                                     |

新增语言或框架时，应补齐其依赖锁定、启动文档、检查与 CI。 / Add dependency locks, setup documentation, checks and CI when introducing another language or framework.
