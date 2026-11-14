# 接口契约 / API contracts

`@e507/contracts/openapi` 导出 OpenAPI JSON 文件，是 HTTP 结构的说明来源。修改前确认消费者，修改后同步服务、前端、示例和契约测试。 / `@e507/contracts/openapi` exports the OpenAPI JSON document as the HTTP structure reference. Identify consumers before changing it and update service, UI, examples and contract tests together.

契约保持跨语言，不导入业务实现。当前只描述开发健康检查；新增业务接口需要自己的测试。 / Keep contracts language-neutral and independent of implementation. Only development health is described today; future APIs require their own tests.
