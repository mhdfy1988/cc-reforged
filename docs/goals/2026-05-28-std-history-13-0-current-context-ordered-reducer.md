# Goal: STD-HISTORY-13-0 当前上下文主链路 ordered reducer 化

## 目标

把恢复后的 `currentContextMessages` 生成链路统一到 ordered transcript event reducer。

完成后，Core 继续对话使用的当前模型上下文必须由同一个有序事件模型产出，不再在主路径里调用 `buildConversationChain(...)` 来隐式补并行工具 sibling / `tool_result`。

## 为什么要做

`currentContextMessages` 是恢复会话后真正写回 Core `threadMessages` 的模型上下文。它直接决定下一轮模型看到什么。

改造前链路已经把当前尾部解析迁到 ordered classified events，但上下文组装仍然调用 `buildConversationChain(...)`。这使主链路处在过渡状态：

- 尾部判断使用新语义。
- 上下文组装仍依赖旧 helper。
- 并行工具 sibling / `tool_result` 补回能力仍藏在旧链路里。

这不符合 No Silent Legacy Fallback 规则。既然旧 helper 已经不是最终主路径，就不能继续作为静默兜底留在核心恢复链路里。

## 范围

本 goal 只处理当前模型上下文主链路。

包含：

1. 梳理 `buildConversationChain(...)` 在当前上下文组装里承担的能力。
2. 在 `conversationMaterialization.ts` 内建立 `currentContextMessages` 的 ordered reducer 产出路径。
3. 把 compact / snip / preservedSegment 后的当前上下文裁剪语义迁入 reducer。
4. 把并行工具 sibling / `tool_result` 补回能力迁入 reducer。
5. 保证 `tool_use` / `tool_result` 按 `tool_use_id` / `toolUseId` / `toolCallId` / `sourceToolAssistantUUID` 绑定。
6. 保证输出继续满足模型 API payload 的工具配对要求。
7. 禁止主路径在 reducer 失败时静默回退到 `buildConversationChain(...)`。

## 明确不做

- 不重写原始 transcript 写入格式。
- 不把 UI 历史展示和当前模型上下文重新混成一个 `messages`。
- 不处理 Desktop `ThreadDisplaySnapshot` merge counts 的 `Math.max(...)` 语义。
- 不清理 `thread/messages/list` 兼容接口。
- 不删除 `buildConversationChain(...)` 函数本身；本 goal 只要求它退出 `currentContextMessages` 主路径。
- 不修改 unrelated provider、模型配置、使用统计或工具卡 UI。

## 不变式

1. `currentContextMessages` 给模型继续对话使用，不等同 UI 可见历史。
2. `displayReplayEvents` / `ThreadDisplaySnapshot` 给 UI 展示使用，不因 compact 裁掉压缩前可见历史。
3. `tool_result` 不推进当前上下文尾部，只能绑定来源工具。
4. `sidechain` 不进入主线当前上下文。
5. compact 只裁当前模型上下文，不裁 UI 历史。
6. `parentUuid` 只作为 source metadata 和 legacy diagnostic，不再决定正常恢复主线。
7. 任何 legacy helper 保留都必须显式命名、写清触发条件、记录诊断，不允许静默 fallback。

## 验收标准

- [x] `conversationMaterialization.ts` 生成 `currentContextMessages` 的主路径不再调用 `buildConversationChain(...)`。
- [x] 并行工具 sibling 用例仍能保留同轮多个 `tool_use` 和乱序返回的 `tool_result`。
- [x] compact + 并行工具组合用例仍能输出压缩后的当前模型上下文。
- [x] sidechain、compact boundary、孤立 `tool_result` 不会成为当前上下文尾部。
- [x] reducer 无法生成合法当前上下文时，输出明确 diagnostic 或失败，不静默回到旧 helper。
- [x] `materialized.messages` 兼容字段仍等同 `currentContextMessages`。
- [x] 现有恢复 smoke、App Server smoke 和必要 Desktop display smoke 不退化。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

完成本 goal 后，再单独处理：

1. Desktop `ThreadDisplaySnapshot` merge counts 语义修正。
2. `thread/messages/list` 兼容接口剩余误用风险清理。
3. visible history / realtime patch 是否进一步收敛到同一个 ordered display reducer。

## 执行结果

状态：已完成。

完成内容：

- `conversationMaterialization.ts` 新增 ordered current context reducer，按 transcript 物理顺序生成 `currentContextMessages`。
- `buildConversationChain(...)` 已退出当前上下文主路径；该函数仍保留在 `sessionStorage.ts` 作为 legacy/native helper，不作为本 goal 的静默 fallback。
- compact / preservedSegment 仍在物化层先行应用，reducer 消费裁剪后的消息集合。
- 并行工具 sibling / 乱序 `tool_result` 由 ordered reducer 自然保留，不再依赖 parent walk 补回。
- `tool_result` 进入 `currentContextMessages` 前必须匹配当前上下文段内已见 `tool_use`；无法匹配的结果会从当前模型上下文移除，并记录 `orphan_tool_result_dropped_from_current_context` 诊断，但仍保留在 UI 展示投影中。
- tail 后的 attachment / system 附属上下文继续保留，避免 compact 后恢复短于实时上下文。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `npm.cmd run smoke:desktop-display-events`：通过。
- `git diff --check`：通过。
