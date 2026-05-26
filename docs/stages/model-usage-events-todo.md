# 模型调用使用事件治理 Todo

Goal 约束：[STD-RUNTIME-02 模型调用使用事件治理](../goals/2026-05-26-std-runtime-02-model-usage-events.md)

设计依据：[模型调用使用事件设计](./model-usage-events-design.md)

## 当前任务列表

- [x] MUE-00 Goal / design / todo 对齐
- [x] MUE-01 定义 `ModelUsageEvent` 类型和事件写入模块
- [x] MUE-02 实现用户级 JSONL 路径和 append-only 写入
- [x] MUE-03 接入 CLI / 原 Claude Code 成本落账链路
- [x] MUE-04 接入 Desktop / App Server Core turn 完成链路
- [x] MUE-05 补齐 eventId、去重和失败诊断
- [x] MUE-06 增加 smoke 覆盖事件 shape 和路径
- [x] MUE-07 明确 stats 迁移边界和后续入口
- [x] MUE-08 明确 Desktop 使用统计独立页面边界
- [x] MUE-09 文档、CHANGELOG、验证收口

## 当前指针

进行中：无

当前正在做：本 goal 当前 todo 已完成。

完成后下一项：等待后续“使用统计”页面实现 goal。

## 执行约束

- 执行时必须遵循 goal 文档，不得偏离用户级事件流这一主线。
- 不引入静默 legacy fallback。
- 不用当前 config 重新解释历史事件。
- 不在 provider adapter 中散落 JSONL 写入逻辑。
- 不把 stats 聚合层当作事件生成入口。
- 不把使用统计放入模型 / Provider 配置页。
- 不把 token / cost 常驻展示到聊天主时间线。
- 不把单次调用成本详情挂到聊天消息卡、工具卡或模型回复卡。
- 不用旧 cost fallback 给未知 provider/model 写入伪造 `costUSD`；价格未知时写 `costStatus='unavailable'`。
- 写入失败不阻断模型回复，但必须有诊断日志。
- 每个任务完成后更新本 TODO 的状态和验证记录。

## MUE-00 Goal / design / todo 对齐

目标：

- 把当前讨论沉淀成 goal、design、todo 三层文档。
- 确认 goal 只描述目标和不变式，todo 只描述执行清单。

验收：

- goal 文档存在并指向本 TODO。
- 本 TODO 指回 goal 和 design。
- design 文档不使用带有临时降级意味的版本表述。

## MUE-01 定义 `ModelUsageEvent` 类型和事件写入模块

目标：

- 新增统一模块：`src/services/usage/modelUsageEvents.ts`。
- 定义 `ModelUsageEvent`、`ModelUsageEventInput`、写入 helper。

关键要求：

- 类型字段与 design 文档保持一致。
- `eventVersion` 固定为 `1`，但类型名不使用 `V1`。
- 模块不依赖 UI，不发起模型调用，不做 stats 聚合。

验收：

- typecheck 通过。
- 单元或 smoke 可构造一个合法事件。

## MUE-02 实现用户级 JSONL 路径和 append-only 写入

目标：

- 默认写入 `~/.ccr/usage-events/YYYY-MM.jsonl`。
- 自动创建目录。
- 每条事件一行 JSON。

关键要求：

- 路径必须是用户级，不是 workspace `.ccr/`。
- 月份分片按事件 timestamp 决定。
- 写入使用 append-only。

验收：

- smoke 能在临时 home / 临时 CCR home 下写出月份 JSONL。
- JSONL 每行可独立 `JSON.parse`。

## MUE-03 接入 CLI / 原 Claude Code 成本落账链路

目标：

- 在 `src/cost-tracker.ts:addToTotalSessionCost(...)` 增加可选 metadata 参数。
- 由成本落账入口写入 `ModelUsageEvent`。
- `claude.ts` 只传 requestId/source 等事实，不直接写 JSONL。

已确认可获得字段：

- `cost`
- `usage`
- `model`
- `sessionId`
- 当前 LLM config
- `contextBudget`
- 上游可传入 `requestId`

验收：

- CLI / 原链路调用 `addToTotalSessionCost(...)` 后能生成事件。
- advisor 派生 usage 使用明确 `source='advisor'` 或等价字段区分。
- 不重复写事件。

## MUE-04 接入 Desktop / App Server Core turn 完成链路

目标：

- 在 `src/core/sessionCore.ts` turn completed 后写入 `ModelUsageEvent`。
- 使用合并后的 `turn.metadata`，不在 stream 中途写事件。

已确认可获得字段：

- `provider`
- `profileId`
- `model`
- `requestedModel`
- `contextBudget`
- `usage`
- `requestId`
- `threadId`
- `turnId`
- `startedAt/completedAt`
- `cwd/projectPath`

验收：

- Core 普通文本 turn 完成后写入事件。
- 缺 usage 的 turn 不写事件，并记录可诊断原因。
- 中断 / 失败 turn 不写成功使用事件，除非已有明确 usage/cost 且状态语义清楚。

## MUE-05 补齐 eventId、去重和失败诊断

目标：

- 生成稳定 `eventId`。
- 写入失败记录诊断。
- 聚合侧预留按 eventId 去重。

eventId 规则：

- 有 requestId：使用 `requestId + provider + profileId + model + token + cost`。
- 无 requestId：使用 `sessionId + threadId + turnId + timestamp + provider + model + token + cost`。

验收：

- 同一输入生成稳定 eventId。
- 写入失败能看到目标路径、错误消息和事件关键字段。
- 不 fallback 到旧统计逻辑。

## MUE-06 增加 smoke 覆盖事件 shape 和路径

目标：

- 新增 smoke 脚本覆盖事件模块。
- 覆盖用户级路径、事件 shape、eventId、写入失败诊断边界。

建议脚本：

```text
scripts/smoke-model-usage-events.mjs
```

验收：

- `npm.cmd run smoke:model-usage-events` 通过。
- smoke 不写真实用户目录，使用临时目录或显式测试环境变量。

## MUE-07 明确 stats 迁移边界和后续入口

目标：

- 明确新统计只读 usage events。
- 旧 transcript 扫描统计保留为 legacy / historical view，不混入口径。

验收：

- design / TODO 更新 stats 后续入口。
- 不在本阶段把旧 stats 强行改成半迁移状态。

## MUE-08 明确 Desktop 使用统计独立页面边界

目标：

- 明确 Desktop 使用统计后续使用独立菜单和独立页面。
- 不把统计区域塞入模型 / Provider 配置页。
- 单次调用明细也放入独立“使用统计”页面，不挂到聊天页消息卡。
- 当前事件治理只提供可聚合数据源和后续页面边界，不在本阶段实现完整统计 UI。

验收：

- design / goal / TODO 都明确独立“使用统计”页面边界。
- 后续页面读取 `~/.ccr/usage-events/YYYY-MM.jsonl` 聚合。
- 支持汇总视图和单次调用明细视图的设计入口被记录。
- 单次调用明细支持按 provider / profile / model / project / session / thread / 日期范围过滤。

## MUE-09 文档、CHANGELOG、验证收口

目标：

- 更新 `CHANGELOG.md`。
- 更新本 TODO 状态和验证记录。
- 跑必要验证。

建议验证：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:model-usage-events
git diff --check
```

## 验证记录

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run smoke:model-usage-events`
- `git diff --check`

## 后续记录

- 本轮完成 `ModelUsageEvent` 写入模块、用户级 `~/.ccr/usage-events/YYYY-MM.jsonl` 路径、CLI / Core 两条写入链路、eventId、写入失败诊断和 smoke。
- Desktop 展示边界已收敛为独立“使用统计”菜单页；汇总和单次调用明细都归该页面，不进入模型 / Provider 配置页或聊天消息卡。
- Core / CLI usage event 不再为未知 provider/model 继承旧成本 fallback；价格表缺失时只记录 token 和 `costStatus='unavailable'`，避免历史统计写入错误金额。
- 使用统计页面的具体实现已拆到新 goal / todo：[STD-DESKTOP-01 使用统计页面](../goals/2026-05-26-std-desktop-01-usage-statistics-page.md) / [使用统计页面 Todo](./desktop-usage-statistics-page-todo.md)。
