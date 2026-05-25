# Goal: STD-HISTORY-09-2 MaterializedConversation 物化协议定型

## 目标

定义 CCR 当前上下文物化结果 `MaterializedConversation`，让 Core resume、App Server replay、history list 和诊断计数都能消费同一个物化语义。

这个协议要回答：从 transcript 读出来以后，哪些消息属于当前上下文，哪个 leaf 是 canonical leaf，哪些异常需要 diagnostic，哪些 metadata 需要保留给现有调用方。

## 为什么先做这个

如果不先定协议，后续实现会继续变成多套局部约定：

- Core 关心 messages 和 `lastParentUuid`。
- App Server 关心 `ThreadDisplaySnapshot` 和 counts。
- history sidebar 关心 title、summary、messageCount。
- compact / snip 关心 message map 的裁剪和 relink。

这些都不能各自重新解释 transcript。需要先定一个共享输出，再让各入口适配。

## 第一版范围

1. 定义 `MaterializedConversation` 的语义字段：
   - 物化后的 Core messages。
   - canonical leaf uuid。
   - raw transcript event count。
   - core context message count。
   - diagnostics。
   - metadata / maps 保留策略。
2. 定义输入来源：
   - transcript file path。
   - parsed messages / maps。
   - 可选 fallback source。
3. 定义错误边界：
   - 读取失败。
   - malformed preserved segment。
   - 多个 main leaf。
   - 无可恢复 main leaf。
4. 定义非聊天元数据保留方式：
   - summary。
   - custom title / tag / mode。
   - file history snapshot。
   - attribution snapshot。
   - content replacement。
   - context collapse metadata。

## 明确不做

- 不把 Renderer 事件作为物化输入。
- 不让 `MaterializedConversation` 承担 UI 渲染职责。
- 不把 raw transcript 行数当成用户可见消息数。
- 不用最长链作为协议字段。
- 不为了旧异常 transcript 增加静默兼容分支。

## 验收标准

- [x] 有明确的 `MaterializedConversation` 类型或等价接口设计。
- [x] 能解释 Core messages、canonical leaf、display snapshot counts 的来源。
- [x] diagnostics 能区分正常信息、警告和错误。
- [x] metadata 保留边界明确，不会被物化层误删。
- [x] 后续 Core / App Server 接入不需要重新选 leaf。

## 实施结果

新增 `src/utils/conversationMaterialization.ts`，作为 CCR 自己的 transcript 物化入口：

- `materializeConversationFromTranscript(filePath)`：从 transcript 文件读取并物化。
- `materializeConversationFromLoadedTranscript(loaded)`：从已解析的 transcript maps 物化，供后续 Core / App Server 复用。
- `MaterializedConversation` 输出：
  - `messages`：物化后的 Core 可消费消息。
- `canonicalLeafUuid`：物化后唯一主线 leaf。
  - `rawTranscriptEvents`：解析后的 transcript event 数。
  - `materializedTranscriptEvents`：compact / snip / sidechain 语义应用后的 event 数。
  - `coreContextMessages`：真正进入当前上下文的消息数。
  - `diagnostics`：info / warning / error 三级诊断。
  - `metadata`：保留 `summary`、custom title、tag、mode、agent setting、file history、attribution、content replacement、context collapse 等 maps。

第一版协议明确：主线 leaf 必须在物化后计算；sidechain 不参与主线 leaf 选择；多个主线 leaf 是异常诊断，不再静默用“最长链优先”兜底。

## 验证结果

- `npm.cmd run typecheck` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-3 compact / snip / preservedSegment 语义统一](./2026-05-24-std-history-09-3-compact-snip-preserved-segment.md)。
