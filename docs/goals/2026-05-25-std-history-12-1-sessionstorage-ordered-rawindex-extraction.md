# Goal: STD-HISTORY-12-1 收回 sessionStorage ordered/rawIndex

## 目标

不再让 `loadTranscriptFile(...)` 暴露 CCR 会话物化层专用的 ordered/rawIndex 视图。

本 goal 解决的是“第 3 层需要的读取顺序不应该污染第 2 层原生 transcript reader”的问题。

## 为什么要做

`orderedMessages`、`malformedJsonlLines`、`parseJSONLWithRawIndex(...)` 都是 `conversationMaterialization.ts` 的输入视图需求，不是 Claude Code 原生 `loadTranscriptFile(...)` 的公共协议。继续放在 `sessionStorage.ts` 会让后续调用方误以为原生读侧已经承担 CCR 物化职责。

## 范围

1. 移出 `OrderedTranscriptMessage`。
2. 移出 `TranscriptMalformedJsonlLine`。
3. 移出 `parseJSONLWithRawIndex(...)`。
4. 移出 `countJsonlLinesBeforeOffset(...)`。
5. 移出 `createOrderedTranscriptMessages(...)`。
6. 移出 `loadTranscriptFile(...)` 返回值里的 `orderedMessages` / `malformedJsonlLines`。
7. 在第 3 层补等价读取能力。

## 明确不做

- 不改写 JSONL 存储格式。
- 不删除 transcript 原生 metadata、summary、title、tag 等读取能力。
- 不重写全部 `buildConversationChain(...)`。
- 不改变 UI projection。

## 验收标准

- [x] `sessionStorage.ts` 不再为 CCR materialization 返回 ordered/rawIndex。
- [x] `conversationMaterialization.ts` 仍能获得 ordered transcript events。
- [x] 坏行诊断仍由第 3 层输出。
- [x] 现有恢复 smoke 不退化。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-2 收回 compact 当前上下文裁剪](./2026-05-25-std-history-12-2-sessionstorage-compact-prune-extraction.md)。

## 执行结果

状态：已完成。

### 修改内容

1. `src/utils/sessionStorage.ts`
   - 移除了 `OrderedTranscriptMessage`、`TranscriptMalformedJsonlLine`、`ParsedJsonlLine`。
   - 移除了 `parseJSONLWithRawIndex(...)`、`countJsonlLinesBeforeOffset(...)`、`createOrderedTranscriptMessages(...)`。
   - 移除了 `loadTranscriptFile(...)` 返回值里的 `orderedMessages` / `malformedJsonlLines`。
   - `loadTranscriptFile(...)` 回到普通 `parseJSONL<Entry>(buf)` 路径，只产出 transcript map、metadata map、leaf set 等原生读侧结果。

2. `src/utils/conversationMaterialization.ts`
   - 新增第 3 层本地 JSONL 顺序读取：`loadTranscriptMaterializationView(...)`。
   - 新增第 3 层本地 `parseTranscriptJsonlWithRawIndex(...)`，用于生成 `rawIndex` 和坏行诊断。
   - 新增第 3 层本地 `createOrderedTranscriptMessages(...)`，用原始 JSONL 顺序给 `loaded.messages` 排序。
   - `materializeConversationFromTranscript(...)` 现在先读取原生 `loadTranscriptFile(...)`，再由物化层自己生成 ordered view / display replay / malformed diagnostics。
   - `materializeConversationFromLoadedTranscript(...)` 保留可选 `orderedMessages` / `malformedJsonlLines` 参数，便于 smoke 构造物化输入，但不再依赖 `sessionStorage.ts` 返回这些字段。

### 边界说明

- 这次只迁出了 ordered/rawIndex 和坏行诊断视图。
- compact 当前上下文裁剪仍待 Goal 2 迁出。
- `loadFullLog(...)` leaf 策略仍待 Goal 3 迁出。
- `conversationMaterialization.ts` 目前仍复用 `buildConversationChain(...)`，这个 helper 边界留到 Goal 8。

### 验证记录

已执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
git diff --check
```

结果：全部通过。
