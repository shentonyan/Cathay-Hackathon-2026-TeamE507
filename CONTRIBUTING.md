# 贡献指南

## 开始一项工作

先创建或认领 Issue，写明负责人、验收标准和涉及的模块。较大的功能先切成能独立运行的小步骤；早开 Draft PR 方便队友了解接口变化。

```sh
git switch main
git pull --ff-only
git switch -c feat/short-description
npm ci
```

分支建议：`feat/...`、`fix/...`、`docs/...`、`chore/...`、`experiment/...`。一个分支解决一个明确的问题，不提交本地运行产物。

## 提交前

```sh
npm run format
npm run check
git status
git add <本次修改的文件>
git commit -m "feat: describe the change"
git push -u origin feat/short-description
```

提交说明使用 `feat:`、`fix:`、`docs:`、`test:`、`refactor:`、`chore:` 等前缀，正文中文或英文均可。

## Pull Request

- 说明具体变化、关联 Issue、验证步骤和已知限制；界面修改附截图或短录屏。
- 改动行为时补充有意义的测试，修复缺陷时尽量复现原问题。
- 新增依赖同时提交锁文件；更改启动方式同时更新 README 和 CI。
- CI 通过后，请至少一位队友审阅，采用 Squash merge；合并后删除任务分支。
- `main` 应保持能启动和演示。若需紧急修复，说明原因并尽快补齐审阅。

以上是团队流程；模板没有开启服务端强制分支保护。

## 开发约定

代码命名用英文，文档和讨论可用中文。共享逻辑放入 `packages/shared/`；模块间通过明确接口交互。先实现最小可演示流程，再扩大功能。

当前 `npm run lint` 做 JavaScript 语法检查。引入 TypeScript、React 或 Python 后，应添加对应的静态检查、测试和 CI 步骤，避免只检查模板本身。

## 资料与授权

使用合成或已获授权的样例数据。不要提交密钥、个人资料、签署文件或整份赛事素材包。需要新增开源许可证或对外发布时，由团队先核对赛事要求和第三方授权。
