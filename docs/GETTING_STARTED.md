# 新人上手

## 获取权限

接受仓库所有者发出的 GitHub 邀请，再克隆私有仓库。权限不足时先确认登录的是接受邀请的账号。

## 本地启动

使用 Node.js 24 和 npm 11。执行以下命令：

```sh
git clone https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507.git
cd Cathay-Hackathon-2026-TeamE507
npm ci
npm run dev
```

打开 <http://127.0.0.1:3000>，点击「检查开发环境」，预期显示连接成功。`/api/health` 是开发预览端点，不是业务 API。

若端口已占用，复制 `.env.example` 为 `.env`，设置 `PORT=3001` 后重启。修改环境文件后需要重新启动进程。

`npm run dev` 在服务器代码变化时重启；前端 HTML、CSS、JavaScript 修改后刷新浏览器即可。

## 第一项贡献

1. 阅读 [路线](ROADMAP.md) 和 [架构](ARCHITECTURE.md)，认领 Issue。
2. 按 [贡献指南](../CONTRIBUTING.md) 创建任务分支。
3. 完成一项小改动，执行 `npm run check`。
4. 提交 PR，写出队友可以重复执行的验证步骤。

## 常见问题

| 现象                        | 处理方式                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| PowerShell 提示禁止运行脚本 | 使用 `npm.cmd ci`、`npm.cmd run dev`，无需更改系统执行策略        |
| `Unsupported engine`        | 检查 `node --version` 和 `npm --version`，切到 Node.js 24         |
| `EADDRINUSE`                | 在 `.env` 改用空闲端口，或关闭原来的预览进程                      |
| `npm ci` 提示锁文件不匹配   | 获取最新代码；只有明确修改依赖时才运行 `npm install` 并提交锁文件 |
| 格式检查未通过              | 执行 `npm run format`，查看改动后再次运行 `npm run check`         |

Python、数据库、云服务和业务凭据均不是启动当前模板的前提。新增模块后在对应目录补齐安装和验证方式。
