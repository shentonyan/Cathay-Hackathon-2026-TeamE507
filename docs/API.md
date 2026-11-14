# 接口指南 / API guide

## 唯一契约来源 / Contract source

HTTP 接口定义放在 [OpenAPI 文件 / OpenAPI document](../packages/contracts/openapi.json)。当前固定使用 OpenAPI 3.1.1；不是对最新规范版本的声明。 / Keep HTTP definitions in the OpenAPI document. The starter deliberately uses OpenAPI 3.1.1; this is not a claim about the latest specification version.

| 接口 / Endpoint    | 行为 / Behavior                                                     |
| ------------------ | ------------------------------------------------------------------- |
| `GET /api/health`  | 返回开发环境状态 / Return development preview status                |
| `HEAD /api/health` | 返回状态与响应头，无正文 / Return status and headers without a body |

```json
{ "status": "ok", "service": "teame507-preview" }
```

这个端点只证明本地进程能响应，不能证明数据库、外部服务或业务流程可用。 / This endpoint demonstrates local responsiveness, not database, integration or business readiness.

## 契约变更 / Contract changes

1. 在 Issue 确认消费者和验收条件。 / Identify consumers and acceptance criteria.
2. 更新 OpenAPI 的字段、约束、状态码和示例。 / Update fields, constraints, response codes and examples.
3. 同步服务、前端与契约测试。 / Update service, frontend and contract tests together.
4. 删除字段或更改语义时，在 PR 说明兼容方式；必要时使用新的版本路径。 / Explain compatibility for removals or semantic changes; introduce a versioned path when needed.

当前契约测试以 Ajv 验证真实健康响应符合声明的 JSON Schema，尚未覆盖任意新增接口，也不是完整的 OpenAPI 文档校验器。 / Current tests use Ajv to validate the live health response against its JSON Schema. They neither cover arbitrary future endpoints nor act as a full OpenAPI document validator.

## 业务接口扩展约定 / Business API conventions

新增业务接口时明确必填字段、单位、时区、分页、权限和错误响应；按业务需要处理幂等性。涉及外部服务时设置超时，并将 mock 和真实集成明确标注在 Demo 中。 / For business APIs, specify required fields, units, time zones, pagination, authorization and error responses. Add idempotency where needed. Set integration timeouts and clearly label mocked versus live integrations.

这些是新增接口的实现要求；当前模板尚未提供统一错误对象、业务认证或数据库。 / These are implementation requirements for future endpoints; the starter does not yet provide a standard error envelope, business authentication or persistence.
