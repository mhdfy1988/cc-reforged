# Goal: STD-DESKTOP-01 使用统计页面

## 目标

为 Desktop 新增独立“使用统计”菜单和页面，用来消费 `ModelUsageEvent` 事件流，展示 token / cost 的汇总和单次调用明细。

本 goal 承接 [STD-RUNTIME-02 模型调用使用事件治理](./2026-05-26-std-runtime-02-model-usage-events.md)。前者负责记录事实，本 goal 负责展示事实。

## 总约束

- 使用统计必须是独立菜单和独立页面。
- 不放入模型 / Provider 配置页。
- 不放入聊天主时间线。
- 不挂到普通消息卡、工具卡或模型回复卡。
- 不在每轮结束后插入 token / cost 提示消息。
- 默认读取用户级事件文件：`~/.ccr/usage-events/YYYY-MM.jsonl`。
- 不用当前 provider/profile/model 配置重解释历史事件。
- 不把 `costStatus='unavailable'` 显示成 0，也不伪装成已计算成本。
- stats 聚合层只能消费 `ModelUsageEvent`，不能回退到 transcript 扫描混入口径。

## 页面结构

使用统计页面分为两个主视图：

1. 汇总视图
   - 今天 token / cost。
   - 本月 token / cost。
   - 按 provider 汇总。
   - 按 profile 汇总。
   - 按 model 汇总。
   - 按 project / cwd 汇总。
   - 按日期范围查看趋势。

2. 明细视图
   - 每次模型调用一行。
   - 支持按时间、provider、profile、model、project / cwd、sessionId、threadId 过滤。
   - 点开明细后展示 `provider`、`profile`、`model`、`input/output/cache tokens`、`totalTokens`、`costStatus`、`costUSD`、`requestId`、`sessionId`、`threadId`、`turnId`、`cwd`。

## 交互边界

- Desktop 左侧导航新增“使用统计”入口。
- 页面只展示统计和明细，不承担模型配置、连接测试、凭据管理职责。
- 模型 / Provider 页面可以保持现有配置职责，不增加统计区域。
- 聊天页只展示对话、工具过程和结果，不展示累计成本或单次调用成本。

## 数据边界

- 数据源是 `~/.ccr/usage-events/YYYY-MM.jsonl`。
- 聚合时按 `eventId` 去重。
- 日期范围跨月时读取对应月份文件。
- 读取失败应展示可诊断错误，不静默回退到旧 stats。
- 无事件时展示空状态，而不是扫描 transcript 补历史。

## 总体验收标准

- Desktop 左侧菜单出现独立“使用统计”入口。
- 使用统计页面可读取 usage events 并展示汇总视图。
- 使用统计页面可展示单次调用明细。
- 支持按 provider / profile / model / project / session / thread / 日期范围过滤。
- `costStatus='unavailable'` 有明确展示，不误认为 0 成本。
- 不改动聊天页成本展示，不把使用统计塞进模型 / Provider 页。
- 增加 smoke 或可重复验证，覆盖事件读取、聚合和 Desktop 菜单入口。

## 当前执行文档

执行 TODO：[使用统计页面 Todo](../stages/desktop-usage-statistics-page-todo.md)。

事件来源设计：[模型调用使用事件设计](../stages/model-usage-events-design.md)。
