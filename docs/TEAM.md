# 团队协作 / Team collaboration

## 分工 / Ownership

加入后填写实际成员，Issue 的负责人优先于角色表。 / Fill in actual members after joining; Issue ownership takes precedence over this role table.

| 角色 / Role                      | GitHub              | 范围 / Scope                                 |
| -------------------------------- | ------------------- | -------------------------------------------- |
| 仓库维护 / Maintainer            | `@shentonyan`       | 邀请与设置 / Access and settings             |
| 产品与演示 / Product and demo    | 待认领 / Unassigned | MVP 与验收 / MVP and acceptance              |
| 前端 / Frontend                  | 待认领 / Unassigned | 页面与交互 / UI and interaction              |
| API 与集成 / API and integration | 待认领 / Unassigned | 接口和外部服务 / Interfaces and integrations |
| 数据与算法 / Data and algorithms | 待认领 / Unassigned | 样例与验证 / Samples and validation          |

`CODEOWNERS` 当前仅将仓库维护者设为默认审阅联系人，成员确认后再增加模块负责人；它不会自动授予权限或强制批准。

`CODEOWNERS` currently names the maintainer as the default review contact. Add module owners after membership is confirmed; the file neither grants access nor enforces approval by itself.

## 工作节奏 / Working rhythm

用 Issue 管任务，用 PR 讨论代码，重要接口和决策写入文档。交接写清完成内容、卡点、下一步和验证步骤。共享文件同时改动前先协调；演示前约定冻结时间。

Track tasks in Issues, discuss code in PRs and document important interfaces and decisions. Handoffs should cover completed work, blockers, next steps and verification. Coordinate shared-file changes and agree on a demo freeze.

## 仓库规则 / Repository rules

优先任务分支和 Squash merge，合并后自动删除任务分支。建议在账户计划支持时为 `main` 配置 PR、队友批准、必需 CI、禁止强推和删除。当前 CI 检查显示为 `Checks (ubuntu-latest)` 与 `Checks (windows-latest)`；它们成为必需检查前需要单独配置。

Use task branches and squash merging; merged branches are deleted automatically. Where the account plan allows, protect `main` with PR review, required CI, and restrictions on force pushes and deletion. The current checks are `Checks (ubuntu-latest)` and `Checks (windows-latest)`; making them required needs separate configuration.

队友邀请由维护者在 [成员设置 / Collaborators](https://github.com/shentonyan/Cathay-Hackathon-2026-TeamE507/settings/access) 完成。 / The maintainer invites teammates in repository settings.
