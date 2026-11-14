# 本地运行与交付 / Local operations and delivery

## 当前运行方式 / Current operation

`npm ci` 后执行 `npm start`，默认监听 `127.0.0.1:3000`；开发时使用 `npm run dev` 自动重启服务。健康检查为 `GET /api/health`。 / Run `npm ci` then `npm start`, which listens on `127.0.0.1:3000`; use `npm run dev` for restart-on-change development. The health endpoint is `GET /api/health`.

| 配置 / Setting          | 默认 / Default | 说明 / Meaning                           |
| ----------------------- | -------------- | ---------------------------------------- |
| `PORT`                  | `3000`         | 1–65535 的整数 / Integer from 1 to 65535 |
| 监听地址 / Bind address | `127.0.0.1`    | 固定本机访问 / Fixed loopback access     |

根目录 `.env` 可覆盖未设置的环境值；更改后重启。服务报端口占用时使用空闲端口。 / The root `.env` provides values not already set in the process environment; restart after changing it. Use another port when the address is occupied.

## 当前范围 / Current scope

没有创建云资源、部署流水线、持久化存储或自动回滚。预览脚本是本地开发工具。 / No cloud resources, deployment pipeline, persistent storage or automated rollback have been created. The preview scripts are local development tools.

## 引入部署时填写 / Complete when deploying

- 环境与负责人 / Environment and owner
- 构建产物与部署命令 / Build artifact and deployment command
- 配置来源与访问权限 / Configuration sources and access control
- 日志、运行检查与故障排查 / Logs, operational health and diagnosis
- 成本估计、清理与回滚步骤 / Cost estimate, cleanup and rollback
- 发布 commit 与验证证据 / Release commit and verification evidence

在 `infra/` 增加可审阅配置，并记录相应 ADR；按 [演示手册 / Demo runbook](DEMO.md) 维护本地备用方案。 / Add reviewable configuration under `infra/`, record an ADR and retain a local fallback in the demo runbook.
