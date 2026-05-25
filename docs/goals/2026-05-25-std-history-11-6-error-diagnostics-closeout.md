# Goal: STD-HISTORY-11-6 错误语义和诊断收口

## 目标

恢复失败时显示真实诊断，不把物化语义错误、工具绑定错误或 compact 语义错误包装成 `Session transcript not found`。

## 为什么要做

用户在历史会话弹窗里看到 `Session transcript not found` 时，无法判断是文件真的不存在，还是物化层恢复失败。这个错误语义会误导排查方向，也会掩盖并行工具和 compact 的真实问题。

## 范围

1. 审查 App Server / Core resume 错误映射。
2. 区分 transcript 文件不存在、JSONL malformed、物化语义异常、工具结果孤立、compact preservedSegment 异常。
3. UI 错误卡显示真实诊断摘要。
4. 日志保留 diagnostic code、session path、rawIndex 和相关 UUID。
5. 历史会话弹窗选择失败时显示会话项级别错误，不污染整个列表。

## 明确不做

- 不把所有恢复错误都吞成通用错误。
- 不把诊断错误伪装成可继续对话。
- 不在 Renderer 自己解析 transcript 来修复错误。
- 不为了旧异常数据恢复最长链兜底。

## 验收标准

- [x] `multiple_main_leaves` 不再显示成 `Session transcript not found`。
- [x] 文件确实不存在时仍显示 transcript not found。
- [x] JSONL malformed 有独立诊断。
- [x] 孤立 tool result 有独立诊断。
- [x] 用户能从错误卡判断是文件问题、物化语义问题还是工具绑定问题。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-7 有序 reducer 迁移设计](./2026-05-25-std-history-11-7-ordered-reducer-migration.md)。

## 执行结果

状态：已完成。

完成内容：

- `loadMessagesFromJsonlPath(...)` 不再在物化失败时返回空消息；现在直接抛出带 diagnostic code 的 `history_materialization_failed`。
- `materializeLogForResume(...)` 不再把物化失败转换成空 log / 空 messages，避免 Core resume 二次包装成 `Session transcript not found`。
- 错误消息包含 transcript path 和错误 diagnostic code，例如 `no_current_context_tail`。
- `multiple_main_leaves` 已从普通恢复失败路径移除，旧 parent leaf 只作为 `legacy_multiple_main_leaves_diagnostic` warning。
- `malformed_jsonl_lines_skipped`、`compact_preserved_segment_malformed`、`no_current_context_tail` 等诊断继续保留在物化结果中。
- App Server 展示路径仍会在物化失败时附加 `history_materialization_failed` 诊断，并尽量使用 display replay / fallback 展示。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `git diff --check`：通过。
