# 模型调用使用事件设计

## 目标

建立一条不可变的模型调用使用事件流，用于后续每天、每月、按 provider、按 profile、按 model、按项目统计 token 和 cost。

这条事件流记录“调用发生时”的事实，不允许后续用当前配置重新解释历史 model。

## 核心结论

1. 第一版模型调用使用事件流已经实现。
2. 事件写入模块、用户级持久化路径、统计聚合和 Desktop 使用统计页面已经落地。
3. Core / App Server 主链路已经在 turn completed 后写入 usage event。
4. CLI / 原 Claude Code cost-tracker 链路已经写入 usage event，但 streaming requestId 仍需要补传，避免 CLI 事件缺少单次请求追踪字段。
5. 当前剩余工作不是重新实现 usage events，而是补齐 requestId 精确性和集成 smoke。

## 持久化位置

默认写入用户级 CCR 目录：

```text
~/.ccr/usage-events/YYYY-MM.jsonl
```

Windows 实际路径示例：

```text
C:\Users\luoji\.ccr\usage-events\2026-05.jsonl
```

原因：

- token / cost 本质是账号维度，不应散落到每个 workspace。
- 事件里带 `cwd`、`projectPath`、`sessionId`、`threadId`、`turnId` 后，统计时仍可按项目过滤。
- 切换工作区、切换 provider、切换 model 时，仍进入同一条用户级事件流。

## 事件语义

一条 `ModelUsageEvent` 表示一次模型调用结算后的使用事实。

不表示：

- 一个 session 的累计值。
- 一个 UI 消息的展示值。
- 一个历史 transcript 的重新解析结果。
- 当前配置推导出的历史补全值。

事件只在模型调用完成并拿到最终 usage / cost 后写入。

## 当前事件字段

```ts
type ModelUsageEvent = {
  eventVersion: 1
  eventId: string
  timestamp: string

  provider: string
  providerDisplayName?: string
  profileId?: string
  profileName?: string
  model: string
  requestedModel?: string

  contextBudget: {
    providerId: string
    profileId?: string
    model: string
    totalContextWindow: number
    maxOutputTokens: number
    reservedOutputTokens: number
    effectiveInputWindow: number
    autoCompactThreshold: number
    warningThreshold: number
    errorThreshold: number
    blockingLimit: number
    source: string
  }

  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
    totalTokens: number
    webSearchRequests?: number
    webFetchRequests?: number
  }

  costUSD?: number
  costStatus: 'calculated' | 'unavailable'
  costUnavailableReason?: string

  sessionId?: string
  threadId?: string
  turnId?: string
  requestId?: string
  cwd?: string
  projectPath?: string
  source: 'cli' | 'core' | 'app-server' | 'desktop' | 'advisor' | 'unknown'
}
```

字段要求：

- `provider/profile/model/contextBudget` 必须是调用发生时固化下来的值。
- `usage` 必须来自模型响应或现有 usage 结算入口。
- `costUSD` 必须与当次 usage / model 的成本计算对应；如果当前没有可靠价格表，不写 `costUSD`，并用 `costStatus='unavailable'` 和 `costUnavailableReason` 显式说明。
- `timestamp` 使用事件写入时刻；Core turn 可优先使用 `completedAt`。
- `requestId` 有则记录，没有不能用当前配置补猜。

## 接入点

### CLI / 原 Claude Code 链路

当前成本落账入口：

```text
src/cost-tracker.ts:addToTotalSessionCost(...)
```

这里已经有：

- `cost`
- `usage`
- `model`
- `sessionId`
- 当前 LLM config
- `contextBudget`

缺口：

- `addToTotalSessionCost(...)` 当前已支持 metadata 参数。
- cost-tracker 默认写 `source: 'cli'`，advisor 子调用会写 `source: 'advisor'`。
- 原 Claude Code streaming 链路已经持有 `streamRequestId`，但调用 `addToTotalSessionCost(...)` 时尚未把该值传入 metadata，因此 CLI usage event 的 `requestId` 仍可能为空。

推荐改法：

```ts
addToTotalSessionCost(cost, usage, model, {
  requestId,
  source,
})
```

由 `cost-tracker.ts` 继续补齐：

- `provider`
- `profileId`
- `contextBudget`
- `sessionId`
- `timestamp`

当前口径：

- 不要在 `claude.ts` 直接写 usage event。`claude.ts` 只把 request / response 事实传给落账入口。
- `source` 不需要每次显式传入；默认 `cli` 已覆盖主路径，只有 advisor / 其它非默认来源需要覆盖。
- 待补项只保留为：把 `streamRequestId` / fallback requestId 传给 `addToTotalSessionCost(...)` 的 metadata。

### Desktop / App Server Core 链路

Core turn 完成入口：

```text
src/core/sessionCore.ts
```

`runQueryTurn` 返回后，`turn.metadata` 已经合并：

- `provider`
- `profileId`
- `model`
- `requestedModel`
- `contextBudget`
- `usage`
- `requestId`
- `startedAt`
- `completedAt`
- `latencyMs`

推荐在 turn completed 后写一次事件，而不是在 stream 中途写多次。

当前状态：

- 已实现。Core turn completed 后会读取 `turn.metadata.usage`、`turn.metadata.contextBudget`、provider/profile/model/requestId 等事实并写入 usage event。
- 后续只需要补一条集成 smoke，固定 turn completed 会真实生成 `source: 'core'` 的 usage event。

### usage 收集来源

Core usage 收集位置：

```text
src/core/coreQueryTurnRunner.ts
```

它从以下事件收集 usage / model / requestId：

- `message_start`
- `message_delta`
- final assistant message

这些位置只负责把事实写入 `CoreTurnMetadata`，不直接写 usage event。

## 统一写入模块

建议新增：

```text
src/services/usage/modelUsageEvents.ts
```

职责：

- 定义 `ModelUsageEvent`。
- 生成 `eventId`。
- 写入 `~/.ccr/usage-events/YYYY-MM.jsonl`。
- 处理写入失败诊断。
- 提供 stats 聚合读取入口。

当前状态：

- 已实现 `src/services/usage/modelUsageEvents.ts`。
- 已实现 `src/services/usage/modelUsageStats.ts`，统计聚合按 usage event 读取，不重新解释 transcript。

不负责：

- 发起模型调用。
- 计算当前上下文预算以外的业务逻辑。
- 用当前 config 修复历史事件。
- UI 展示。

## Desktop 展示边界

使用统计应作为 Desktop 独立菜单和独立页面呈现，不放进模型 / Provider 配置页。

原因：

- 模型 / Provider 页面已经承载 provider 类型、连接配置、模型列表、凭据、测试连接、能力诊断等职责。
- token / cost 是使用统计，不是 provider 配置。
- 独立页面更适合承载日期范围、provider、model、project 等过滤条件。

独立“使用统计”页面适合展示：

- 今天 token / cost。
- 本月 token / cost。
- 按 provider 汇总。
- 按 model 汇总。
- 按 project / cwd 过滤。
- 按日期范围查看趋势。
- 单次模型调用明细列表。

单次调用明细归属于“使用统计”页面，而不是聊天消息卡：

- 每次模型调用一行。
- 可按时间、provider、profile、model、project / cwd、sessionId、threadId 过滤。
- 点开明细后展示 `provider`、`profile`、`model`、`input/output/cache tokens`、`cost`、`requestId`、`sessionId`、`threadId`、`cwd`。
- 用于排查和核对单次调用，不进入聊天主时间线。

展示数据来源：

```text
~/.ccr/usage-events/YYYY-MM.jsonl
```

聊天页只负责对话、工具过程和结果展示。聊天主时间线不常驻展示 token / cost，也不在每一轮结束后额外插入“本轮消耗”提示消息。普通消息卡、工具卡、模型回复卡都不承载单次调用成本详情。

当前状态：

- Desktop 独立“使用统计”页面已落地，读取 usage event 聚合结果。
- 使用统计不放在模型 / Provider 配置页，也不插入聊天主时间线。

## eventId 与去重

优先使用 request 维度字段：

```text
sha256(requestId + provider + profileId + model + inputTokens + outputTokens + cacheReadInputTokens + cacheCreationInputTokens + costUSD)
```

如果没有 `requestId`：

```text
sha256(sessionId + threadId + turnId + timestamp + provider + model + inputTokens + outputTokens + costUSD)
```

当前交付范围采用 append-only 写入，不做写前全局查重；但 eventId 必须写入，统计聚合时按 eventId 去重。

## 失败策略

写入失败不能影响模型回复和主流程完成。

但不能静默吞掉：

- 必须写诊断日志。
- 必须包含目标路径、错误消息和事件关键字段。
- 不允许 fallback 到旧统计逻辑重新推导历史。

遵守全局规则：No Silent Legacy Fallback。

## 统计迁移边界

现有统计入口：

```text
src/utils/stats.ts
src/utils/statsCache.ts
src/components/Stats.tsx
```

后续迁移原则：

- 新统计只聚合 `ModelUsageEvent`。
- 旧 transcript 扫描统计保留为 legacy / historical view，不和新事件统计混为同一口径。
- 如果 UI 展示新统计，应说明数据起点来自 usage event 写入启用之后。

## 当前交付 TODO

- [x] 新增 `src/services/usage/modelUsageEvents.ts`。
- [x] 定义 `ModelUsageEvent` 和写入 helper。
- [x] 实现用户级路径 `~/.ccr/usage-events/YYYY-MM.jsonl`。
- [x] `addToTotalSessionCost(...)` 增加可选 metadata 参数。
- [x] Core turn completed 后写入 usage event。
- [x] 更新 stats 设计，明确新统计只读 usage events。
- [x] 单独落地 Desktop “使用统计”菜单和页面，不放入模型 / Provider 配置页。
- [ ] CLI / 原 Claude Code 链路补传 `requestId` 到 `addToTotalSessionCost(...)` metadata；`source` 默认 `cli` 已足够，只有非默认来源需要覆盖。
- [ ] 扩展 `smoke:model-usage-events` 为集成 smoke，覆盖 cost-tracker 写入 `source: 'cli'` + requestId，以及 Core turn completed 写入 `source: 'core'` + threadId / turnId / requestId / contextBudget。
