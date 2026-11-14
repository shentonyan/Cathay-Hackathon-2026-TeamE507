# API 服务 / API service

`@e507/api` 的公开入口是 `src/index.mjs`，当前只组合 `modules/health/`。根目录本地预览通过这个入口提供 HTTP 服务。 / The public entry of `@e507/api` is `src/index.mjs`, which currently composes only `modules/health/`. The root preview serves it over HTTP.

业务功能放在 `src/modules/<feature>/`，必要时再分为领域、用例与适配器。前端和外部组合代码不能导入模块内部文件。 / Place business features under `src/modules/<feature>/`, introducing domain, use-case and adapter layers when needed. Frontend and external composition code must not import module internals.

接口变更同步 [契约 / Contract](../../packages/contracts/openapi.json)、[API 指南 / API guide](../../docs/API.md) 与测试。当前没有业务认证、数据库或云服务。 / Keep the contract, API guide and tests aligned. Business authentication, persistence and cloud services are not implemented.
