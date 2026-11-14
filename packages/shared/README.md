# 共享逻辑 / Shared logic

此目录保留给已经出现实际复用的纯逻辑。尚未注册为 workspace 包；首次添加代码时补齐私有 `package.json`、公开导出和测试。 / Reserve this directory for pure logic with demonstrated reuse. It is not yet a workspace package; add a private manifest, public exports and tests when adding code.

共享包不依赖应用实现，也不读取服务私有配置；HTTP 数据结构放在 `packages/contracts/`。 / Shared packages must not depend on applications or read service-private configuration; HTTP structures belong in `packages/contracts/`.
