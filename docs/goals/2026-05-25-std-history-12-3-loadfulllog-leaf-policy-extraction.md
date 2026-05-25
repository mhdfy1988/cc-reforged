# Goal: STD-HISTORY-12-3 收回 loadFullLog leaf 策略

## 目标

`loadFullLog(...)` 不再承载 CCR 的 current tail 产品语义。

本 goal 解决的是“原生历史 log helper 不应该决定 CCR 当前上下文尾部”的问题。

## 为什么要做

多 main leaf、longest chain、terminal leaves 都只能作为 legacy transcript topology 诊断，不能继续参与正常恢复主路径。第 3 层已经有 `currentContextTail` 语义，应把 tail 解析限制在物化层。

## 范围

1. 审查当前 `loadFullLog(...)` 多 main leaf 行为。
2. 将 current tail 解析限制在 `conversationMaterialization.ts`。
3. 多 leaf 仅作为 materialization diagnostic。
4. 明确旧 CLI/TUI 对 `loadFullLog(...)` 的兼容影响。

## 明确不做

- 不删除 `loadFullLog(...)`。
- 不删除 leaf 诊断能力。
- 不把多个 legacy leaf 当成普通恢复兜底。
- 不让 `tool_result` 推进 current tail。

## 验收标准

- [x] `currentContextTail` 只由第 3 层解析。
- [x] `loadFullLog(...)` 不输出 CCR 恢复主线选择语义。
- [x] 多 legacy leaf smoke 仍只产生诊断，不阻断普通恢复。
- [x] 旧 CLI/TUI 影响面有明确说明。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:cli-model
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-4 conversationRecovery 边界定位](./2026-05-25-std-history-12-4-conversationrecovery-boundary.md)。

## 执行结果

状态：已完成。

### 修改内容

`src/utils/sessionStorage.ts` 的 `loadFullLog(...)` 已从“leaf chain 装配”降级为“legacy full-log hydration”：

1. 不再读取 `leafUuids`。
2. 不再枚举 main leaves。
3. 不再用 `buildConversationChain(...)` 从 leaf 回溯当前主线。
4. 不再生成新的 `leafUuid` 作为恢复尾部。
5. 改为 `loadTranscriptFile(sessionFile, { keepAllLeaves: true })`，按 transcript 物理顺序返回非 sidechain 的主会话消息。
6. `leafUuid` 仅保留 `log.leafUuid` 传入值，用于 legacy log identity，不再作为 CCR current tail。

### 当前语义

- `loadFullLog(...)`：只服务历史搜索、列表补全、metadata hydration。
- `conversationMaterialization.ts`：唯一决定 `currentContextTailUuid` / `canonicalLeafUuid` / `currentContextMessages`。
- `conversationRecovery.ts`：在恢复路径里会用物化结果覆盖 `loadFullLog(...)` 的 legacy messages。

### 旧 CLI/TUI 影响面

- 对搜索类调用方：`agenticSessionSearch.ts` 仍能拿到 transcript 文本，而且现在不会因为多 legacy leaf 直接返回空 messages。
- 对恢复类调用方：`conversationRecovery.ts` 后续会调用 materialization 覆盖 current context，所以不会使用 `loadFullLog(...)` 的物理顺序 messages 作为最终模型上下文。
- 对旧 `LogOption.leafUuid`：本函数不再计算新 leaf，只透传 lite log 原有 `leafUuid`。

### 验证记录

已执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:cli-model
npm.cmd run smoke:app-server
git diff --check
```

结果：全部通过。
