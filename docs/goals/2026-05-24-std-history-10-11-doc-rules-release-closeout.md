# Goal: STD-HISTORY-10-11 文档规则发布说明收口

## 目标

把并行工具结果来源绑定、历史/实时一致性、compact 双投影和旧兼容路径清理的最终口径同步到文档、项目规则和发布说明。

## 为什么最后做这个

如果只改代码不收口文档，后续开发很容易重新把 Core context 当 UI history、恢复最长链兜底、或在 Renderer 增加 raw fallback。这个 goal 用来锁住长期口径。

## 第一版范围

1. 更新 `docs/architecture/realtime-history-display-contract.md`。
2. 更新 `docs/architecture/session-context-materialization-repair.md`。
3. 更新 `docs/references/codex-openclaw-live-history-source-evidence.md`。
4. 更新 `docs/stages/realtime-history-display-contract-todo.md`。
5. 更新项目规则。
6. 更新发布说明。
7. 回写本专项 todo 的最终状态和后续记录。

## 明确不做

- 不把实现中已经废弃的旧路径继续写成可选路径。
- 不把 compact 后当前模型上下文写成完整 UI 历史。
- 不用含糊的“统一上下文”代替两个投影的明确语义。

## 验收标准

- [x] 架构文档、todo、goal 和 release note 口径一致。
- [x] 新增规则能被后续开发直接引用。
- [x] 没有文档仍把 compact context 当完整 UI history。
- [x] 文档明确说明工具结果按来源 ID 回填，不参与 leaf 竞争。

## 完成记录

- [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md) 已更新为 STD-HISTORY-10 收口后的状态：Desktop 主路径只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，并行工具结果按来源 ID 回填。
- [CCR 当前上下文物化修复方案](../architecture/session-context-materialization-repair.md) 已明确 `messages` 是兼容字段，完整 UI 历史必须消费 `displayReplayEvents` 生成 snapshot。
- [Codex / OpenClaw 实时与历史恢复源码证据索引](../references/codex-openclaw-live-history-source-evidence.md) 已补 CCR 阶段 10 实施证据索引。
- [CCR 历史恢复与实时展示统一协议实施计划](../stages/realtime-history-display-contract-todo.md) 已标记真实 Desktop UI 回归和发布说明收口完成。
- 项目规则 [AGENTS.md](../../AGENTS.md) 已更新：禁止正常路径“最长链优先”兜底，工具结果必须按来源 ID 回填，Renderer 主路径不得恢复 raw fallback。
- [CHANGELOG.md](../../CHANGELOG.md) 的 Unreleased 已记录 Desktop 展示协议收口、compact 双投影、并行工具乱序结果支持和权限拒绝实时 UI 修复。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

本次文档收口后已执行：

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

本专项完成；回到 [历史恢复与实时展示统一协议实施计划](../stages/realtime-history-display-contract-todo.md) 做总收口。
