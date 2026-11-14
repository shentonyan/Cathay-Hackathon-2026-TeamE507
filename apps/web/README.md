# 浏览器应用 / Web application

当前为原生 ES modules 占位页，根目录执行 `npm run dev` 后访问 <http://127.0.0.1:3000>。 / The current starter uses native ES modules; run `npm run dev` at the repository root and open the local preview.

| 文件 / Path            | 职责 / Responsibility                   |
| ---------------------- | --------------------------------------- |
| `index.html`           | 中英双语页面 / Bilingual page           |
| `styles.css`           | 响应式样式 / Responsive styles          |
| `src/main.js`          | 页面事件组合 / Page event composition   |
| `src/features/health/` | 健康检查交互 / Health-check interaction |

新增功能放在 `src/features/<feature>/`；通过 HTTP 调用 API，不导入服务内部实现。新增静态模块需要登记到预览资源允许列表。引入前端框架或 npm 浏览器依赖后，增加构建工具并更新 CI、启动方式和 ADR。 / Add features under `src/features/<feature>/`; call APIs over HTTP instead of importing server internals. Register new static modules in the preview allowlist. Introducing a frontend framework or browser package dependencies requires build tooling and updates to CI, startup instructions and the ADR.
