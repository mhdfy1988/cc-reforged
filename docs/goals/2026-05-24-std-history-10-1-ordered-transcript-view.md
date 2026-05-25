# Goal: STD-HISTORY-10-1 有序 transcript 视图

## 目标

为 transcript 读取链路增加只读的有序视图，让后续物化、展示和诊断都能知道每条消息来自 JSONL 的第几条原始记录。

本 goal 解决的是“顺序事实源”问题，不改变原始 Claude Code transcript 存储格式。

## 为什么先做这个

并行工具结果绑定依赖两个维度：

1. `tool_use.id` / `tool_result.tool_use_id` 负责来源绑定。
2. transcript JSONL 物理顺序负责事件先后和诊断位置。

如果没有稳定 `rawIndex`，后续内容块拆分、compact 诊断、工具乱序回填和历史/实时一致性测试都会继续靠隐式顺序猜。

## 第一版范围

1. 核对现有 transcript 读取入口。
2. 新增或改造有序 transcript 视图入口。
3. 为每条有效 JSONL entry 生成稳定 `rawIndex`。
4. malformed JSONL 行进入诊断，不破坏有效 entry 的来源位置。
5. 将有序 transcript 视图接入 `conversationMaterialization.ts` 输入。

## 明确不做

- 不写回原始 transcript。
- 不修改原始 Claude Code transcript 字段。
- 不处理工具绑定归并器。
- 不改 Renderer 展示。

## 验收标准

- [ ] 同一个 transcript 重复读取，`rawIndex` 稳定。
- [ ] compact / snip / preservedSegment 后仍能诊断原始来源位置。
- [ ] malformed JSONL 行跳过数量可诊断。
- [ ] 物化层不再从 `Map` 插入顺序反推原始行号。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-2 当前模型上下文与可见历史双投影](./2026-05-24-std-history-10-2-context-display-dual-projection.md)。

## 执行结果

状态：已完成。

完成内容：

- `loadTranscriptFile(...)` 返回只读 `orderedMessages`，为有效 transcript message 保留稳定 `rawIndex`。
- `loadTranscriptFile(...)` 返回 `malformedJsonlLines`，malformed JSONL 行不再只是静默跳过，物化层会输出诊断。
- `conversationMaterialization.ts` 改为以 ordered transcript 视图作为输入，compact boundary 诊断包含 `boundaryRawIndex`。
- `scripts/smoke-conversation-materialization.mjs` 增加 malformed JSONL 与 rawIndex 诊断用例。

验证：

- `npm.cmd run typecheck`：通过。
- `git diff --check`：通过。
