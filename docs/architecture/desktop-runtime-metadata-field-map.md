# CCR Desktop 运行元数据字段来源表

## 1. 文档目标

本文档约束 P19 的运行元数据展示：Desktop 可以展示控制信息，但不能从聊天正文、工具结果字符串或 provider 原始请求体里硬猜字段。

核心链路：

```text
LLM runtime / query 事件
-> Core Turn metadata
-> App Server turn/* notification
-> Desktop session turnMetadata
-> 顶部状态条 / Turn 详情入口
```

## 2. 字段来源表

| UI 字段 | 协议字段 | 当前来源 | 缺失兜底 | 脱敏规则 |
| --- | --- | --- | --- | --- |
| provider | `metadata.provider` / `provider` | `loadLlmConfig()` | `provider 待加载` / `未知` | 只展示 provider id，不展示凭据 |
| model | `metadata.model` / `model` | `loadLlmConfig()`，运行中可由 assistant message 覆盖实际模型 | `模型待加载` / `未知` | 只展示模型名 |
| contextWindow | `metadata.contextWindow` | `modelCatalog` 根据 provider/model 解析 | 顶栏默认显示 `200K` 或详情显示 `未知` | 无敏感信息 |
| 已用上下文 | `metadata.usage.totalTokens` | provider `message_delta.usage` 或 assistant message `usage` | `0K` / `未知` | 不展示 prompt 原文 |
| usage 明细 | `metadata.usage.*` | provider usage 映射为 `inputTokens/outputTokens/cache*` | `未知` | `raw` 仅保留内部结构，不在顶部直接展示 |
| stop reason | `metadata.stopReason` | provider `message_delta.delta.stop_reason` 或 assistant message `stop_reason` | `未知` | 只展示枚举或短字符串 |
| request id | `metadata.requestId` | assistant `requestId`、message id 或 provider raw id | `未返回` | 只展示 request id，不展示 header/body |
| latencyMs | `metadata.latencyMs` | Core 用 `startedAt/completedAt` 计算 | `未知` | 无敏感信息 |
| timeToFirstTokenMs | `metadata.timeToFirstTokenMs` | stream event `ttftMs` | `未知` | 无敏感信息 |
| threadId | `threadId` | Core turn/thread 事件 | 不展示或 `未知` | 仅详情/日志使用 |
| turnId | `turnId` | Core turn 事件 | 不展示或 `未知` | 仅详情/日志使用 |
| errorKind | `metadata.errorKind` | `CoreError.kind` | `未知` | 不展示完整错误请求体 |

## 3. 当前实现边界

已实现：

- `CoreTurn.metadata` 保存 provider、model、contextWindow、usage、stopReason、requestId、latencyMs、TTFT、错误类型等摘要。
- `turn/started`、`turn/completed`、`turn/failed`、`turn/cancelled` 都可以携带 `metadata`。
- App Server `turn/start` 返回的 `turn` 也带初始 `metadata`。
- Desktop renderer 建立 `TurnRuntimeMetadata` 状态，不把运行控制信息混入普通聊天正文。
- 顶部状态条显示当前模型和 `上下文 已用 / 总量`。
- 聊天页顶部提供折叠的 `运行详情`，用于查看状态、模型、Token、耗时、停止原因和 request id。

仍属后续增强：

- 真实工具耗时、工具错误分类属于 P20。
- 文件引用、附件、多模态预览属于 P21/P23。
- 限流、额度、模型拒答、安全拦截的分类展示属于 P24。
- request id 能否稳定返回取决于 provider 和 runtime 适配层，UI 必须允许缺失。

## 4. 不变式

- Desktop 只消费 App Server 透出的摘要字段，不读取 token 文件、不拼 provider 请求、不解析 Authorization header。
- `metadata.raw` 如存在，只能用于日志或调试详情，不进入顶部摘要。
- 缺字段必须显示 `未知`、`未返回` 或 `0K`，不能抛异常。
- 如果 provider 不支持 usage 或 request id，不伪造；只保留空值并在详情中展示兜底文案。
- 后续新增运行字段必须先补这里的来源表，再进入 UI。

## 5. 验证入口

P19 相关回归至少运行：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop -- --pretty false
npm.cmd run build -- --pretty false
npm.cmd run desktop:build
npm.cmd run smoke:app-server
```
