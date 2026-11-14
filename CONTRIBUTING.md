# 贡献指南 / Contributing

## 开始工作 / Start work

创建或认领 Issue，写清负责人、范围和可验证的完成条件；较大的功能先切成可独立审阅的小任务。 / Create or claim an Issue with an owner, scope and verifiable completion criteria. Split larger features into reviewable tasks.

```sh
git switch main
git pull --ff-only
git switch -c feat/short-description
npm ci
```

分支使用 `feat/...`、`fix/...`、`docs/...`、`chore/...` 或 `experiment/...`，一个分支处理一个目标。 / Use these branch prefixes and keep each branch focused on one goal.

## 提交与 PR / Commit and PR

```sh
npm run format
npm run check
git status
git add <changed-files>
git commit -m "feat: describe the change"
git push -u origin feat/short-description
```

使用 Conventional Commits 风格前缀，例如 `feat:`、`fix:`、`docs:`、`test:`、`refactor:` 和 `chore:`。PR 写出问题、变化、验证和限制，界面修改附截图。CI 通过后请队友审阅，再 Squash merge。

Use Conventional Commits-style prefixes. Explain the problem, behavior, validation and limitations in each PR; include screenshots for UI changes. Request team review after CI passes, then squash merge.

团队约定不等同于服务端强制规则；分支保护需要另行配置。 / Team conventions are separate from enforced branch protection, which needs explicit setup.

## 接口与模块 / Interfaces and modules

- 业务功能按 `features/` 与 `modules/` 组织；共享逻辑有实际复用后再提取。 / Organize by feature; extract shared logic after reuse appears.
- API 变化先更新契约，再修改实现、消费者和测试。 / Update the contract before changing implementation, consumers and tests.
- 新依赖提交根锁文件；新 workspace 添加自己的私有包声明。 / Commit the root lockfile and a private manifest for each new workspace.
- 新语言或框架必须补相应 CI，当前工具仅分析 JavaScript 导入。 / Add CI for new languages and frameworks; current dependency analysis covers JavaScript imports.

## 双语写作 / Bilingual writing

说明标题用「中文 / English」，正文先中文再英文，简短条目可同一行并列。两种语言必须表达同一范围、状态和限制。标识符、文件名和 API 字段保持英文；代码示例无需重复两份。

Use “中文 / English” headings and pair Chinese text with an equivalent English explanation. Both languages must describe the same scope, status and limitations. Keep identifiers, filenames and API fields in English; do not duplicate identical code examples.

修改说明时同步两种语言，避免仅翻译标题。 / Update both languages together, including substantive instructions.

## 完成标准 / Definition of done

- [ ] 功能满足 Issue 验收条件。 / Acceptance criteria are met.
- [ ] 相关测试和 `npm run check` 通过。 / Relevant tests and all checks pass.
- [ ] 契约、配置、启动与演示文档已更新。 / Contracts, configuration, startup and demo docs are current.
- [ ] 未包含凭据、个人资料或未经授权的素材。 / No credentials, personal data or unauthorized assets are included.
- [ ] PR 有明确审阅与交接信息。 / The PR supports review and handoff.
