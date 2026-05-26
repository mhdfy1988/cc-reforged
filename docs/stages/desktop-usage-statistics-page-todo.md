# 使用统计页面 Todo

Goal 约束：[STD-DESKTOP-01 使用统计页面](../goals/2026-05-26-std-desktop-01-usage-statistics-page.md)

事件来源：[STD-RUNTIME-02 模型调用使用事件治理](../goals/2026-05-26-std-runtime-02-model-usage-events.md)

设计依据：[模型调用使用事件设计](./model-usage-events-design.md)

## 当前任务列表

- [x] USP-00 Goal / design / todo 对齐
- [x] USP-01 盘点 Desktop 导航和页面路由接入点
- [x] USP-02 新增 usage-events 读取和聚合服务
- [x] USP-03 新增独立“使用统计”菜单入口
- [x] USP-04 实现汇总视图
- [x] USP-05 实现单次调用明细视图
- [x] USP-06 实现过滤器和日期范围读取
- [x] USP-07 处理 `costStatus='unavailable'` 和空状态 / 错误状态
- [x] USP-08 增加 smoke / Desktop 可见性验证
- [x] USP-09 文档、CHANGELOG、验证收口

## 当前指针

进行中：无

当前正在做：本 goal 当前 todo 已完成。

完成后下一项：等待使用统计页面真实数据体验反馈。

## 执行约束

- 执行时必须遵循 goal 文档，不得把统计页实现塞回模型 / Provider 页。
- 不把 token / cost 常驻展示到聊天主时间线。
- 不把单次调用成本详情挂到普通消息卡、工具卡或模型回复卡。
- 不用当前 config 重新解释历史事件。
- 不静默 fallback 到旧 transcript stats。
- 不把 `costStatus='unavailable'` 显示成 0 成本。
- 每个任务完成后更新本 TODO 的状态和验证记录。

## USP-00 Goal / design / todo 对齐

目标：

- 明确本 todo 承接的是 Desktop 使用统计页面实现，不是事件写入。
- 确认页面实现与 `STD-RUNTIME-02` 的事件流边界一致。

验收：

- goal 文档存在并指向本 TODO。
- 本 TODO 指回 usage event goal 和 design。
- 当前边界明确：统计页独立，聊天页和模型 / Provider 页不承载统计展示。

## USP-01 盘点 Desktop 导航和页面路由接入点

目标：

- 找到 Desktop 左侧导航、页面状态、路由 / view 切换的权威实现。
- 找到现有模型页、日志页等页面的组件组织方式。

验收：

- 记录需要修改的 Desktop 文件路径。
- 明确新增菜单项和页面组件的接入方式。

## USP-02 新增 usage-events 读取和聚合服务

目标：

- 新增读取 `~/.ccr/usage-events/YYYY-MM.jsonl` 的服务。
- 支持按日期范围跨月读取。
- 按 `eventId` 去重。

验收：

- 可读取合法 JSONL。
- 坏行有诊断，不阻断其他合法事件。
- 不扫描 transcript。

## USP-03 新增独立“使用统计”菜单入口

目标：

- Desktop 左侧导航新增“使用统计”入口。
- 点击后进入独立页面。

验收：

- 菜单入口可见。
- 页面切换不影响聊天页、模型页、日志页现有状态。

## USP-04 实现汇总视图

目标：

- 展示今天 token / cost。
- 展示本月 token / cost。
- 展示 provider / profile / model / project 汇总。

验收：

- 汇总只来自 `ModelUsageEvent`。
- `costStatus='unavailable'` 的事件参与 token 汇总，但不计入已知 cost。
- UI 明确区分已知成本和未知成本。

## USP-05 实现单次调用明细视图

目标：

- 每条模型调用事件展示为一行明细。
- 明细可展开查看完整调用事实。

验收：

- 列表包含时间、provider、profile、model、token、costStatus、costUSD、project。
- 展开后可看到 requestId、sessionId、threadId、turnId、cwd。
- 明细不进入聊天页消息卡。

## USP-06 实现过滤器和日期范围读取

目标：

- 支持 provider / profile / model / project / session / thread / 日期范围过滤。
- 日期范围跨月时读取对应月份 JSONL。

验收：

- 过滤后汇总和明细一致。
- 日期范围没有事件时显示空状态。

## USP-07 处理 `costStatus='unavailable'` 和空状态 / 错误状态

目标：

- 对未知价格表事件给出明确展示。
- 对无数据、读取失败、坏行诊断提供可理解状态。

验收：

- 未知成本不显示为 0。
- 读取失败不静默 fallback。
- 空状态不引导用户去聊天页找统计。

## USP-08 增加 smoke / Desktop 可见性验证

目标：

- 增加可重复验证，覆盖事件读取、聚合和 Desktop 菜单入口。

验收：

- smoke 覆盖 usage event 聚合。
- Desktop build / typecheck 通过。
- 如有本地 dev server，可用浏览器或截图验证菜单入口。

## USP-09 文档、CHANGELOG、验证收口

目标：

- 更新 `CHANGELOG.md`。
- 更新本 TODO 状态和验证记录。
- 跑必要验证。

建议验证：

```text
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:model-usage-events
git diff --check
```

## 验证记录

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run desktop:build`
- `npm.cmd run smoke:model-usage-events`
- `git diff --check`

## 后续记录

- 本 todo 是对 `STD-RUNTIME-02` 的展示层承接：事件治理 goal 已完成事件记录，使用统计页面 goal 负责独立菜单、汇总视图和明细视图实现。
- 本轮完成 Desktop 独立“使用统计”菜单入口、usage-events 读取聚合服务、汇总视图、单次调用明细视图、过滤器、未知成本展示和 smoke 覆盖。
