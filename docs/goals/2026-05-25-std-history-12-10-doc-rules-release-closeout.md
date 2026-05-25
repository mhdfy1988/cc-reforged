# Goal: STD-HISTORY-12-10 文档规则和发布说明收口

## 目标

让后续开发不再混淆第 2 层和第 3 层。

本 goal 解决的是“会话恢复边界口径没有沉淀，后续又回到临时补丁”的问题。

## 为什么要做

只有代码改完不够。需要把第 2 层 legacy helper、第 3 层恢复主路径、共享层可改但必须证明共享正确性这些规则写入项目文档，后续才不会继续把展示语义塞进原始层。

## 范围

1. 更新会话层级文档。
2. 更新 `session-semantics-codex-migration.md` 的实施状态。
3. 更新项目 `AGENTS.md`。
4. 更新 `CHANGELOG.md`。
5. 在 todo 文档追加最终收口记录。

## 明确不做

- 不把未完成的 ordered reducer 写成已完成。
- 不掩盖仍保留的 legacy helper。
- 不把第 2 层描述为恢复主路径。
- 不在发布说明中夸大影响面。

## 验收标准

- [x] 文档明确第 2 层是 legacy helper，不是恢复主路径。
- [x] 文档明确第 3 层是恢复主路径。
- [x] 文档明确共享层可改但必须证明是共享正确性。
- [x] TODO 当前指针、完成记录和后续状态一致。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
python C:\Users\luoji\.codex\skills\standard-todo-runner\scripts\read_standard_todo.py --gate D:\agent_project\claude-code-reforged\docs\stages\session-materialization-boundary-cleanup-todo.md
```

## 完成后下一步

本专项完成后，进入手动验证或 ordered reducer 后续迁移。

## 执行结果

状态：已完成。

### 更新文件

| 文件 | 收口内容 |
| --- | --- |
| `docs/architecture/session-context-materialization-repair.md` | 新增 STD-HISTORY-12 边界收口状态；修正第 2 层和第 3 层职责，明确普通 compact 裁剪属于物化层。 |
| `docs/architecture/session-semantics-codex-migration.md` | 更新 2026-05-25 实施状态，明确第 3 层直读 JSONL、`buildConversationChain(...)` 只作短期 helper。 |
| `docs/architecture/realtime-history-display-contract.md` | 补充 STD-HISTORY-12 对实时/历史展示协议的影响边界。 |
| `AGENTS.md` | 在历史恢复护栏中强制写入：第 2 层 helper 不得新增 ordered/rawIndex/display replay/current tail 职责；共享层修改必须证明共享正确性。 |
| `CHANGELOG.md` | Unreleased 增加会话物化边界收口和 smoke 覆盖说明。 |
| `docs/stages/session-materialization-boundary-cleanup-todo.md` | 当前 goal 完成记录和最终状态。 |

### 最终口径

1. 第 2 层是原生读侧 helper，不是 CCR 恢复主路径。
2. 第 3 层 `conversationMaterialization.ts` 是恢复物化主入口。
3. Core 当前模型上下文与 Desktop/App Server 可见历史是同源双投影，不是同一份 `messages`。
4. `buildConversationChain(...)` 只能重建 parent 链并补回并行工具 sibling / tool_result；不能决定 current tail，不能生成 UI replay。
5. 共享层可以改，但必须证明属于 provider/API/SDK/UUID/tool pairing/compact metadata/transcript 持久化一致性。

### 验证记录

本 goal 是文档与规则收口。待最终 gate 前执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
python C:\Users\luoji\.codex\skills\standard-todo-runner\scripts\read_standard_todo.py --gate D:\agent_project\claude-code-reforged\docs\stages\session-materialization-boundary-cleanup-todo.md
```
