# 安全说明 / Security

发现凭据泄露、个人资料或可利用的漏洞，请通过团队私下渠道通知仓库维护者 `@shentonyan`。提供受影响版本和可安全共享的复现步骤；不要把敏感值贴入公开 Issue 或 PR。

Report exposed credentials, personal information or exploitable vulnerabilities privately to maintainer `@shentonyan` through the team's private channel. Include the affected version and safe reproduction steps; do not paste sensitive values into public Issues or PRs.

凭据若已提交，先撤销或轮换，再清理文件与必要的历史记录。仅删除最新文件无法撤销已经泄露的值。 / Revoke or rotate committed credentials before cleaning files and, when needed, history. Deleting a current file does not invalidate an exposed credential.

预览服务只监听本机地址并仅提供登记的静态资源。对外部署前需要根据业务补齐身份验证、权限控制、输入校验、日志脱敏与运行保障。当前健康检查只证明预览进程能够响应。

The preview binds to loopback and serves only registered assets. External deployment requires appropriate authentication, authorization, input validation, safe logging and operational controls. The current health check only demonstrates preview responsiveness.
