# Goal: STD-RUNTIME-02 模型调用使用事件治理

## 目标

为 CCR 建立一条用户级、不可变、可聚合的模型调用使用事件流，用于后续统计每天、每月、按 provider、按 profile、按 model、按项目的 token 和 cost。

本 goal 要解决的核心问题是：

- 当前统计主要从 transcript 或当前内存累计里推导，缺少“调用发生时”的固化事实。
- 历史 model 不能再用当前 config 重新解析 provider/profile/contextBudget。
- 切换 provider、profile、model 后，统计必须跟随当次调用事实，而不是跟随后来的配置状态。
- 后续 cost tracker / stats 页面需要按 model、provider、项目、时间维度聚合，但不能混用旧 transcript 推导口径。

完成后，每次模型调用在 usage 结算完成时都必须生成一条 `ModelUsageEvent`，事件中固化当时的 `provider/profile/model/contextBudget/usage/cost/timestamp`，后续统计只聚合事件，不反查当前配置。若当次模型没有可靠价格表，事件必须显式标记 `costStatus='unavailable'`，不能写入伪造成本。

## 总约束

- 默认持久化位置是用户级 CCR 目录：`~/.ccr/usage-events/YYYY-MM.jsonl`。
- 不允许把事件写到每个 workspace 的 `.ccr/` 作为默认路径。
- 不允许用当前 config 修复、补猜或重解释历史事件。
- 不允许让 stats 聚合层重新扫描 transcript 并混入新事件统计口径。
- 不允许把使用统计塞进模型 / Provider 配置页；该页面保持配置、连接和能力诊断职责。
- 不允许把 token / cost 常驻展示到聊天主时间线。
- 不允许把单次调用成本详情挂到聊天消息卡、工具卡或模型回复卡；单次明细也归属独立“使用统计”页面。
- 不允许用 Claude 默认价格或其他旧 cost fallback 给未知 provider/model 伪造 `costUSD`；价格未知时必须显式标记 unavailable。
- 不允许在 provider adapter 里散落 JSONL 写入逻辑。
- 不允许在旧逻辑失败时静默 fallback 到 transcript 推导或旧 cost 聚合。
- 写入失败不能阻断模型回复，但必须有诊断日志和明确触发条件。
- 所有兼容旧统计的展示都必须显式标记为 legacy / historical，不得伪装成新事件口径。

## 统一概念

- `ModelUsageEvent`：一次模型调用结算后的使用事实。
- `eventId`：事件去重键，写入时生成，聚合时按它去重。
- `contextBudget`：调用发生时的上下文预算快照，来源于统一预算 resolver 的结果。
- `usage`：模型响应或现有 usage 结算入口提供的 token 使用量。
- `costUSD`：与当次 usage / model 对应的成本；仅在价格表可靠时写入。
- `costStatus`：成本状态，`calculated` 表示已计算，`unavailable` 表示当前没有可靠价格表。
- `source`：事件来源链路，例如 `cli`、`core`、`app-server`、`desktop`、`advisor`。

## 不变式

- 使用事件是统计事实源，stats 是消费者，不是事实生成者。
- 事件必须在模型调用完成并拿到最终 usage / cost 后写入。
- 事件里固化的 provider/profile/model/contextBudget 优先级高于任何当前配置。
- 同一次模型调用只能产生一条主要使用事件；advisor 等派生调用必须通过明确 source 区分。
- Core stream 中途只收集 metadata，不直接写使用事件。
- CLI / 原链路通过统一成本落账入口写事件，不在 `claude.ts` 里直接落 JSONL。

## 总体验收标准

- CLI / 原 Claude Code 链路能在成本结算时写入 `ModelUsageEvent`。
- Desktop / App Server Core 链路能在 turn completed 后写入 `ModelUsageEvent`。
- 事件文件按月份写入用户级 `~/.ccr/usage-events/YYYY-MM.jsonl`。
- 事件包含 provider、profile、model、contextBudget、usage、costStatus、timestamp、sessionId，以及可得的 costUSD、requestId/threadId/turnId/cwd/projectPath。
- 事件写入失败会记录诊断，不会静默吞掉，也不会 fallback 到旧统计逻辑。
- smoke 能覆盖 CLI/Core 两类事件 shape 和用户级路径。
- stats 迁移设计明确：新统计只读 usage events，旧 transcript 统计不混入新口径。
- Desktop 后续展示必须使用独立“使用统计”菜单和页面，不占用模型 / Provider 配置页，也不占用聊天消息卡。

## 当前执行文档

执行 TODO：[模型调用使用事件治理 Todo](../stages/model-usage-events-todo.md)。

设计依据：[模型调用使用事件设计](../stages/model-usage-events-design.md)。

具体任务拆解、当前指针、验证记录只维护在 TODO 文档中；本 goal 只维护目标、边界、不变式和总体验收标准。

## 完成后下一步

完成本 goal 后，继续推进 stats / cost tracker 聚合层迁移，让每天、每月、provider、profile、model、project 维度的 token / cost 展示只读取 `ModelUsageEvent`。
