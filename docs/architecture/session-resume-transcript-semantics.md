# CCR 历史恢复与 transcript 语义

> 当前恢复与展示总入口见 [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md)。本文保留 transcript、`parentUuid`、sidechain、branch/fork 的术语背景。

本文用于固定 CCR 后续开发中关于历史会话恢复、`parentUuid`、`sidechain`、`branch/fork` 和 Desktop 展示恢复的术语口径。它来自 2026-05-23 对 CCR 与 Claude Code / OpenAI Codex 源码的核对，目标是避免把普通历史恢复误讲成分叉、短链或子任务恢复。

历史恢复和实时展示进入 Renderer 前的统一协议，见 [CCR 历史恢复与实时展示统一协议](./realtime-history-display-contract.md)。压缩后恢复当前上下文的具体修复方案，见 [CCR 当前上下文物化修复方案](./session-context-materialization-repair.md)。本文负责 transcript 主线语义；展示协议文档负责 App Server / Renderer 展示协议语义；物化修复文档负责 compact / snip / sidechain 如何重放成 Core 当前上下文。

## 核心结论

历史恢复只恢复原会话主线，并在需要时附带展示或恢复子任务记录。普通恢复不应该创建新会话，不应该从中间分叉，也不存在一个正式设计叫“短链恢复”。

`parentUuid` 不是业务父子任务关系。它是 Claude Code transcript 格式中的上一条/因果指针，用来在同一个 `sessionId` 下恢复消息顺序和工具结果关联。主线消息没有产品语义上的父子关系。

`sidechain` 才表示子任务、AgentTool、后台任务等附属执行链。它可以挂在主线某一步下面展示或恢复，但不能竞争主线尾部，也不能决定主会话从哪里继续。

显式 `branch` / `fork` 可以理解为新会话。它复制一段历史作为起点，写入新的 `sessionId`、新的 transcript 或新的 thread。之后恢复原会话只恢复原主线；恢复 branch/fork 需要选择那个新会话。

## 术语口径

| 术语 | 准确定义 | 不应该理解为 |
| --- | --- | --- |
| `sessionId` | 一条会话 / transcript 的身份标识。 | 消息顺序本身。 |
| `uuid` | 单条 transcript message 的身份标识。 | 用户可见消息编号。 |
| `parentUuid` | 当前消息接在哪条消息后面，或因果上关联哪条消息。普通主线里多数时候等价于上一条有效消息。 | 主线里的父子任务关系。 |
| `logicalParentUuid` | compact / session break 等场景里保留的逻辑父指针。 | 新会话或普通恢复分叉。 |
| `isSidechain` | 标记子任务、AgentTool、后台任务等附属链。 | 普通主线消息。 |
| `agentId` | 子任务 / agent transcript 的身份，用于恢复 agent 自己的状态。 | 主会话 ID。 |
| `branch` / `fork` | 显式复制历史并创建新会话。 | 普通历史恢复。 |
| “短链” | 这次排查中对异常 JSONL 形态的临时描述。 | 正式产品概念、架构概念或恢复策略。 |

## 为什么有 `parentUuid`

如果 CCR 只保存最简单的线性聊天记录，`sessionId + JSONL 行顺序` 看起来就够了。但 Claude Code transcript 需要覆盖更复杂的情况：

- 工具调用和 `tool_result` 需要关联到发起它的 assistant message。
- 并行 tool use 会产生多个 assistant/tool_result 片段，单纯按行走可能丢 sibling 片段。
- compact、clear、snip、rewind 等操作会改变保留消息和后续追加方式。
- 历史合法 transcript 格式需要读取，例如早期 progress 记录曾经参与链路；这不等于兼容异常断链数据。
- branch/fork 复制历史时需要重写新 transcript 内部的链路。

所以 `parentUuid` 的正确定位是 transcript 存储层的链路字段。它让读取端可以从某个 leaf 回溯到根，并在必要时恢复并行工具结果等非纯链表形态。

普通主线示意：

```text
sessionId = S1

A(uuid=A, parentUuid=null)
B(uuid=B, parentUuid=A)
C(uuid=C, parentUuid=B)
```

这表示 `B` 接在 `A` 后面，`C` 接在 `B` 后面；不是 `A` 是 `B` 的父任务。

## 三类链路边界

### 1. 普通历史恢复

普通历史恢复的语义是：

```text
原会话主线:
A -> B -> C -> D

恢复后继续:
A -> B -> C -> D -> E
```

不变式：

- 使用原 transcript 对应的 `sessionId` 和路径恢复。
- 选择主线非 sidechain 的有效尾部。
- 新消息追加到原主线尾部。
- 不创建新 `sessionId`。
- 不把异常短链当成恢复目标。

### 2. 子任务 / sidechain

子任务语义是：

```text
主线:
A -> B -> C

B 下面有附属任务:
B -> sidechain(agentId=T1): x -> y -> z
```

不变式：

- 子任务可以被记录、展示、展开、恢复自身状态。
- 子任务 transcript 应通过 `isSidechain`、`agentId` 或单独 agent transcript 与主线隔离。
- 子任务消息不能污染主线 message set。
- 子任务 leaf 不能参与主线恢复尾部选择。

### 3. 显式 branch / fork

branch/fork 语义是：

```text
原会话:
A -> B -> C -> D

显式 branch/fork 后的新会话:
A' -> B' -> C' -> E'
```

不变式：

- branch/fork 是新会话，不是原会话恢复。
- 新 transcript 使用新的 `sessionId`。
- 原 transcript 不应该被 branch/fork 后续消息改写。
- 恢复原 session 时不应该混入 branch/fork 的尾部。
- 恢复 branch/fork 时必须选择 branch/fork 的新 session/thread。

## Desktop 展示与上下文不是一回事

历史恢复同时有三种常见口径，后续开发必须明确自己在说哪一种：

| 口径 | 用途 | 典型位置 |
| --- | --- | --- |
| transcript 原始记录 | 磁盘 JSONL 里的消息、工具结果、metadata、sidechain、content-replacement 等完整记录。 | `src/utils/sessionStorage.ts` |
| Core 可继续上下文 | 模型继续运行所需的主线消息与必要工具上下文。 | `src/core/sessionCore.ts` |
| Desktop 可见时间线 | renderer reducer 合并后的用户可见卡片、文本、工具卡、文件卡、系统提示。 | `apps/desktop/src/renderer/src/main.tsx` |

因此，UI 上的“已显示 N 条历史记录”不应该直接使用 transcript 原始条数，也不应该使用 Core 内部上下文条数。它应该使用 Desktop reducer 最终得到的可见时间线事件数。

反过来，模型上下文恢复也不应该受 UI 展示增强影响。新增文件卡、工具卡、折叠展示、恢复提示文案，只应该改变 Desktop 可见层；不能改变 Core 继续对话使用的主线消息。

## 这次异常的定性

这次排查中，同一个主 transcript 里出现了两条主链：

- 一条较长主链，代表原始历史会话。
- 一条只有几条消息的异常链，包含恢复错尾部后追加的测试消息。

这个“短链”不是设计概念。它是恢复逻辑选错 leaf 以后产生的异常状态。后续实现不能把它抽象成一种正常恢复模式。

正确处理方式：

- 普通恢复必须先按 compact / snip / sidechain 等状态语义物化当前上下文，再得到主线 canonical tail。
- 如果同一个主 transcript 在物化后仍出现多个非 sidechain leaf，应记录为数据异常。
- 正常恢复路径不得用“最长链优先”静默选择。
- 旧异常 transcript 不作为新设计的兼容目标；确需修复旧数据时，应走显式诊断 / 修复工具，而不是污染普通恢复语义。

## 2026-05-24 落地状态

阶段 9 已把上述口径落到代码：

- `src/utils/conversationMaterialization.ts` 是当前上下文物化入口。
- `loadMessagesFromJsonlPath(...)` / `loadConversationForResume(...)` 已消费物化结果。
- `loadThreadResumeReplayPayload(...)` 不再独立选最长 leaf。
- `loadFullLog(...)` 不再用最长链作为正常恢复策略。
- 普通 compact 无 `preservedSegment`、malformed `preservedSegment`、snip、sidechain、多 main leaf 都已有自动 smoke 覆盖。

因此后续讨论“历史恢复”时，默认语义是：从 transcript 原始事实重放 compact / snip / sidechain 状态，得到唯一当前上下文；多个主线 leaf 是异常诊断，不是短链/长链二选一。

## 后续开发不变式

1. `thread/resume` / Desktop 历史恢复必须恢复原会话主线。
2. 普通恢复不得创建新 `sessionId`，不得写成 branch/fork。
3. `parentUuid` 只作为 transcript 链路字段解释，不作为主线业务父子关系解释。
4. 子任务记录必须通过 `isSidechain` / `agentId` / agent transcript 与主线隔离。
5. 主线恢复选择 leaf 时必须排除 sidechain。
6. branch/fork 必须产生新会话，原会话恢复不得混入新会话内容。
7. Desktop 展示增强不得改变 Core 恢复上下文。
8. UI 计数必须使用最终可见时间线口径，不能直接拿 replay action 或 transcript 原始条数。
9. 同一主 transcript 出现多个 main leaf 时必须视为异常并可观测。
10. 任何历史恢复修复都应同时验证：磁盘 transcript 选择、Core 可继续上下文、Desktop 可见时间线。

## 源码证据索引

### CCR 当前源码

- `src/types/logs.ts`
  - `TranscriptMessage` 包含 `parentUuid`、`logicalParentUuid`、`isSidechain`、`agentId`。
- `src/utils/sessionStorage.ts`
  - `insertMessageChain(...)` 写入 `parentUuid`、`logicalParentUuid`、`isSidechain`、`agentId`。
- `buildConversationChain(...)` 从 leaf 沿 `parentUuid` 回溯 transcript。
  - sidechain 写入和 agent transcript 隔离逻辑用于避免污染主线恢复。
- `src/core/sessionCore.ts`
  - resume 后维护 `lastParentUuid`，后续 persist 使用该指针继续追加。
- `src/commands/branch/branch.ts`
  - `/branch` 过滤非 sidechain 主消息，重写新 `sessionId` 和 `parentUuid`，并写入 `forkedFrom`。
- `src/tools/AgentTool/runAgent.ts`
  - AgentTool 通过 sidechain transcript 保持子任务恢复与 prompt cache 稳定。
- `src/tasks/LocalMainSessionTask.ts`
  - 后台 / 子任务用 `recordSidechainTranscript(...)` 持久化附属链。

### Claude Code 原始源码基线

本机基线 `D:/C_Project/claude-code-source-main` 中也存在同样字段和语义：

- `src/types/logs.ts`
  - `TranscriptMessage` 原始类型包含 `parentUuid`、`logicalParentUuid`、`isSidechain`、`agentId`。
- `src/utils/sessionStorage.ts`
  - 原始 `insertMessageChain(...)` 写入 parent 链。
- 原始 `buildConversationChain(...)` 沿 `parentUuid` 从 leaf 恢复。
  - 注释说明并行工具结果会让拓扑接近 DAG，读取端需要恢复 sibling assistant/tool_result。
- `src/hooks/useLogMessages.ts`
  - UI/TUI 写 transcript 时用 `lastParentUuidRef` 记录上次写入尾部，增量追加时传入 parent hint。
- `src/commands/branch/branch.ts`
  - branch 明确过滤主会话消息、排除 sidechain，并重写新 session。

结论：`parentUuid`、`sidechain` 不是 CCR 后续临时加出来的字段，而是 Claude Code transcript 设计的一部分；CCR 需要兼容它，但不能误用它解释普通历史恢复。

### OpenAI Codex 对照

OpenAI Codex 的 `thread/resume` 与 `thread/fork` 是两套语义：

- `thread/resume` 读取历史 rollout 并恢复原 thread 的历史。
- `thread/fork` 创建新 thread，原 rollout 不变。
- subagent / spawn agent 会以 forked parent history 作为子 agent 背景，但它是 agent 子任务语义，不是普通历史恢复语义。

对 CCR 的启发：

- 普通 resume 不应被解释成 fork。
- fork/branch 必须新会话化。
- 子任务可以带父上下文，但不应抢主会话恢复尾部。

## 开发检查清单

修改历史恢复、Desktop replay、sessionStorage、branch、AgentTool、compact 相关逻辑前，先检查：

- 这次改动是在改普通恢复、子任务恢复，还是 branch/fork？
- 是否误把 `parentUuid` 当成业务父子任务关系？
- 是否把 sidechain 消息放进了主线 leaf 选择？
- 是否把 UI 展示条数当成 transcript 条数？
- 是否只靠 `sessionId` 猜路径，而没有使用 transcript path / project path？
- 是否把多个 main leaf 当成异常诊断，而不是当成普通恢复 fallback？
- 是否验证了 Core 继续对话上下文和 Desktop 可见时间线都正确？
