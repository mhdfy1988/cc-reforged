# App Server 插队修复任务归档

来源：从 `app-server-todo.md` 拆出，保留历史细节，主入口只保留当前指针。

## 插队修复任务池

说明：

- 该任务池用于记录 Desktop 真实验收时插队发现的问题。
- 这里的任务先独立登记，不立即打乱 P22-P24 主线。
- 等用户把同一批问题补充完整后，再统一切当前指针，按 `FIX-*` 逐个处理、验证和回写。

### FIX-RT-01 Desktop turn 完成后运行快照刷新与广播时序不一致

状态：已完成，Desktop 真机复测通过。

现象：

- 第一轮真实对话已经执行完成，运行详情能显示 `completed`、耗时、停止原因和请求 ID。
- 但顶部上下文仍显示 `上下文 0K / 200K`，运行详情里 `Token` 和 `消息` 也显示为 `0`。
- 第二轮运行结束后，同一区域能正常显示 `12,522 / 200,000`、`消息 8` 和 `剩余 154,478 token`。

当前判断：

- Core 的统计能力本身不是完全失效，因为第二轮能正常显示 token 和消息数。
- `context/status` 和 `compact/status` 都是基于当前 thread messages 即时估算：
  - `context/status` 读取 `messageCount`、`estimatedTokens`、`usage`、`contextWindow`。
  - `compact/status` 读取 `estimatedTokens`、`effectiveContextWindow`、`autoCompactThreshold`、`distanceToAutoCompact`。
- `剩余 154,478 token` 表示距离自动压缩阈值的剩余量，不是总上下文窗口剩余量；第二轮中 `12,522 + 154,478 = 167,000`，说明自动压缩阈值约为 167K。
- 第一轮显示 0 的更可能原因是 Desktop 主进程在 `turn/completed` 时先把旧 `status.context/status.compact` 快照随 notification 广播给 renderer；随后 `refreshRuntimeSnapshots()` 即使完成，也没有额外广播新快照。

涉及源码位置：

- `src/core/sessionCore.ts`
  - `getContextStatus()`：当前上下文状态统计来源。
  - `getCompactStatus()`：自动压缩阈值和剩余量统计来源。
  - `runTurn()`：turn 完成前会把 runtime metadata 与 `createContextMetadata()` 合并。
- `apps/desktop/src/main/index.ts`
  - `updateTurnFinishedState()`：当前使用 `void refreshRuntimeSnapshots()`，没有等待刷新完成。
  - `broadcast()`：notification 里携带的是当时的 `getSafeStatus()`，可能仍是旧快照。
- `apps/desktop/src/renderer/src/components/layout/Topbar.tsx`
  - 顶部上下文展示直接消费 `status.context` 和 `status.compact`。
- `apps/desktop/src/renderer/src/components/pages/ChatPage.tsx`
  - 运行详情直接消费 `status.context`、`status.compact` 和 turn metadata。

修复方向：

1. 主修复：让 Desktop 主进程在 turn 结束后生成稳定运行快照。
   - `turn/completed`、`turn/failed`、`turn/cancelled` 后等待或串行执行 `refreshRuntimeSnapshots()`。
   - 刷新完成后再广播包含最新 `context / compact / memory` 的状态，或额外广播 `runtime snapshots refreshed`。
2. 前端兜底：避免把完成态里的 `0` 误展示成最终统计。
   - 如果 `lastTurn.status` 已经结束，但 `context.messageCount` 和 `context.estimatedTokens` 都是 0，可以显示 `统计刷新中`。
   - 等 runtime 快照刷新事件到达后再切换为真实数值。
3. 日志与验证：在 Desktop main log 里记录 turn 完成后的快照刷新结果摘要。
   - 包含 `threadId`、`turnId`、`context.messageCount`、`context.estimatedTokens`、`compact.distanceToAutoCompact`。

验收标准：

- 第一轮真实对话结束后，顶部上下文不再停留在 `0K / 200K`。
- 运行详情中 `Token`、`消息` 与 `压缩剩余` 在同一轮结束后能自洽。
- 如果统计快照短暂不可用，UI 显示 `统计刷新中`，不显示误导性 `0`。
- 不改变 TUI / `ccr -p` 输出语义；影响范围应限制在 Desktop main / renderer 和 App Server 状态刷新链路。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`
  - Desktop 真机第一轮对话验收

处理结果：

- Desktop main process 已在 `turn/completed`、`turn/failed`、`turn/cancelled` 后调用 `refreshRuntimeSnapshotsAfterTurn(...)`。
- 刷新成功后会额外广播 `state` 事件：`runtime snapshots refreshed`，事件携带最新 `context / compact / memory`。
- 日志新增 `runtime-snapshots-refreshed` 摘要，包含 `threadId`、`turnId`、`messageCount`、`estimatedTokens`、`distanceToAutoCompact`、`memory initialized` 等字段。
- `refreshRuntimeSnapshots()` 会捕获当前 `managedClient`，避免 App Server 重启或关闭后异步旧快照反写到新状态。
- 当前未修改 Core / App Server 协议 / TUI / CLI，只修 Desktop 状态刷新时序。
- 用户已完成 Desktop 真机复测：第一轮运行快照刷新问题已确认修复。

### FIX-TOOL-02 多次 Write 时后续写入只显示工具结果，缺失写入工具卡

状态：已完成，Desktop 真机双 Write 复测通过。

本轮处理结果：

- 已在 Desktop notification router 层拆分 `item/completed.content[]` 中的多 block 工具生命周期事件。
- 当同一个 completed item 同时包含多个 `tool_use` / `tool_result` / `progress` block 时，renderer 不再把整组 content 交给 `toolEvents.ts` 只取第一个，而是按 `contentIndex` 拆成多条 `upsert-completed-item-message` action。
- 拆分后的每个 block 都保留原始 completed item 的 contract context，并额外写入 `contentIndex` 与 block 自身，保证后续 `createDisplayEventIdentity(...)` 仍能拿到稳定 `toolUseId`。
- 拆分后的 display event 使用合成 `itemId`，避免同一 completed item 内多个工具卡互相覆盖。
- `toolEvents.ts` 读取拆分后的单 block 时优先复用 context 中的原始 `contentIndex`，避免第二个工具块被重新标成 `contentIndex=0`。
- 没有修改 Core / App Server 协议 / CLI / TUI；本轮只修 Desktop renderer 事件路由。
- 已补强 `smoke:desktop-display-events`：fixture 至少包含两个不同 `toolUseId` 的 `Write` 工具卡，防止后续退回“只保留第一个 Write”。
- 用户已完成 Desktop 真机复测：连续写入时后续 `Write` 不再退化成孤立“工具结果”。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- `git diff --check` 通过。

现象：

- 同一轮任务中连续发生两个写入动作。
- 第一个写入能显示为“写入文件 / 生成文件 / Write”工具卡，并带路径、文件快照、打开、复制路径、定位等操作。
- 第二个写入只显示为独立“工具结果”卡，例如 `File created successfully at: D:\learn_code\gomoku\todo.md`。
- 第二个写入缺少对应的 `Write` 主工具卡、文件快照和工具生命周期状态，导致用户无法从主卡看出“这是一次写入文件操作”。

当前判断：

- 这说明 `tool_result` 仍然可能找不到对应的 `tool_use` 主事件。
- P20 已经修过“工具调用与结果合并”以及 “Write tool_use 漏发”问题，但真实复测证明多次 `Write` 场景仍有缺口。
- 更可能的根因不是“完全没有发出非文本块”，而是一个 assistant item 里包含多个 `tool_use` 时，Desktop 只生成了第一张工具卡。
- 当前 `coreQueryTurnRunner.ts` 会把 `nonStreamedAssistantContent(event)` 作为一个 item 发出；这个 content 数组里可能有多个 `tool_use`。
- 当前 `toolEvents.ts` 的 `createToolSnapshot(...)` 遍历 blocks 后只返回一个 `ToolSnapshot`，如果同一个 item 里有两个 `Write tool_use`，第二个很可能没有成为独立工具卡。
- 因此第二个 `tool_result` 后续到达时找不到对应的第二张 `Write` 主卡，就退化成孤立“工具结果”卡。
- 可能原因包括：
  - 第二个 `Write` 的 `tool_use` 没有从 Core/App Server 事件流发到 Desktop。
  - 第二个 `Write` 的 `tool_use_id` / `toolUseId` 与 `tool_result` 对不上。
  - renderer 的 `sessionState` 合并逻辑对同一 turn 内多个同名工具只合并第一个或最近一个。
  - `assistantStream` 收尾后仍有某些非文本块未被完整转成 `item_completed`。
  - 文件快照派生只在 `tool_use` 存在时执行，孤立 `tool_result` 没有反向补成 `Write` 文件卡。

为什么上次没有彻底解决：

- 上次修复重点是流式 assistant 文本收尾后继续发出 `nonStreamedAssistantContent(event)`，解决的是“非文本块整坨没发出来”的问题。
- 但该修复没有保证“同一个 content 数组里的多个 `tool_use` 被拆成多个独立工具事件”。
- 当时 fixture / smoke 很可能只覆盖了单个 `Write`，没有覆盖连续两个 `Write` 或同一 assistant message 多个 `tool_use` 的场景。
- 所以后续真实复测中，第二个写入仍可能只剩 `tool_result`，没有对应主工具卡。

涉及源码位置：

- `src/core/coreQueryTurnRunner.ts`
  - 负责把 assistant message 里的 `tool_use`、`tool_result`、非文本块映射成 App Server item 事件。
- `src/app-server/coreEventMapper.ts`
  - 负责把 Core item 事件映射成 Desktop 可消费的 notification。
- `apps/desktop/src/renderer/src/app/sessionState.ts`
  - 负责按 `toolUseId` 合并工具调用、工具进度和工具结果。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`
  - 负责生成 `ToolSnapshot`、工具分类、状态、命令/文件摘要和结果详情。
- `apps/desktop/src/renderer/src/domain/fileEvents.ts`
  - 负责从 `Write` / `Edit` / `Read` 等工具快照派生文件快照。

修复方向：

Codex 对照：

- Codex App Server 把工具生命周期先规整成稳定线程项：`ExecCommandBegin`、`ExecCommandOutputDelta`、`ExecCommandEnd` 都用同一个 `call_id` 作为 `item_id` 路由。
- Codex TUI 的 `ExecCell.complete_call(call_id, ...)` 只按稳定 `call_id` 合并结果；找不到匹配项时返回失败，不用“最近一个工具”猜测。
- Codex 对 `Read / ListFiles / Search` 这类探索动作会在 UI 层合并成一个 `Exploring / Explored` 单元，但底层仍保留每个调用的 `call_id`，所以视觉合并不牺牲事件身份。
- CCR 修复这个问题时也必须先保证 `tool_use -> progress -> tool_result` 的稳定身份，再做 UI 合并；不能只靠 renderer 把孤立结果挂到上一张相似工具卡。

1. 先抓真实事件链。
   - 在 Desktop 日志或 fixture 中确认两个 `Write` 是否都存在 `tool_use` 事件。
   - 对比两个写入的 `toolUseId`、`itemId`、`turnId`、`contentIndex`、`parentToolUseId`。
2. 优先保证 Core/App Server 事件完整。
   - 如果第二个 `Write tool_use` 没发出，先修 Core `coreQueryTurnRunner` 的非文本块分发。
   - 不用 renderer 猜测补主卡来掩盖上游事件缺失。
3. 拆分 Desktop 多 block 工具事件。
   - 如果同一个 item 的 content blocks 里有多个 `tool_use`，renderer 必须拆成多个 `DisplayEvent`。
   - 每个 `tool_use` 都要按 `toolUseId + contentIndex` 或等价稳定 identity 生成独立工具卡。
   - `createToolSnapshot(...)` 不能只返回第一个工具；需要支持返回多个工具快照，或在上游 route 阶段逐 block 拆事件。
4. 保证 Desktop 合并逻辑按稳定 ID 合并。
   - 同一 turn 内多个同名 `Write` 必须分别生成独立工具卡。
   - 工具结果必须按 `toolUseId` 合并到对应卡；没有稳定 ID 时进入“孤立工具结果”诊断状态，而不是伪装成功。
5. 文件快照兜底。
   - 如果 `tool_result` 明确包含可结构化路径，且能确定来源工具为 `Write`，可以派生只读文件结果快照。
   - 但该兜底必须标记为 `source=tool_result_fallback`，避免误判为完整工具生命周期。
6. 补强防回归样例。
   - 新增“双 Write” fixture，模拟同一 assistant item 内两个 `tool_use`，以及两个对应 `tool_result`。
   - 断言必须生成两张 `Write` 工具卡，两个结果分别合并，主时间线不能出现孤立“工具结果”卡。

验收标准：

- 同一轮连续两个 `Write` 时，两个写入都显示为各自独立的 `Write / 写入文件` 工具卡。
- 每张写入卡右下角显示最终成功 / 失败状态，不额外生成孤立“工具结果”卡。
- 每张写入卡都能展示目标路径和文件快照。
- 如果上游确实缺少 `tool_use`，UI 应显示明确诊断状态，例如“孤立工具结果：缺少对应工具调用”，并在详情中保留 raw result。
- 验证至少覆盖：
  - 新增或扩展 `smoke:desktop-display-events` 中的“双 Write” fixture。
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`
  - Desktop 真机连续写入复测。

### FIX-TOOL-03 工具失败详情重复展示

状态：已完成，Desktop 真机失败工具卡复测通过。

本轮处理结果：

- 已在 Desktop 工具卡详情渲染层增加去重逻辑，不改变 Core / App Server / CLI / TUI 输出。
- `ToolCard.tsx` 不再直接固定渲染 `调用参数 / 执行结果 / 错误详情` 三块，而是先生成详情块列表，再按展示文本做规范化去重。
- 当 `errorMessage` 与 `result` 完全一致，或错误详情的每一行都已经包含在执行结果里时，只显示“执行结果”，不再重复显示“错误详情”。
- 当错误详情与执行结果确实不同，例如包含额外 stack、exit code 或结构化错误信息时，仍保留“错误详情”。
- 错误类型 `errorClass`、行动提示 `actionableHint` 和卡片失败状态不受影响。
- 用户已完成 Desktop 真机复测：失败工具卡详情不再重复展示同一段错误文本。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- `git diff --check` 通过。

现象：

- 工具执行失败时，工具卡已经显示失败摘要、错误类型和行动提示。
- 展开详情后，同一段失败文本同时出现在“执行结果”和“错误详情”两块中。
- 示例：`spawn ... rg.exe ENOENT` 同时出现在执行结果和错误详情，造成重复刷屏。

当前判断：

- 这是 Desktop 工具卡详情渲染层的去重问题，不一定是 Core/App Server 事件错误。
- 对用户来说，失败时最重要的是：
  - 卡片摘要：失败。
  - 错误类型：例如 `path_not_found`、`shell_unavailable`。
  - 行动提示：下一步怎么处理。
  - 展开详情：保留一份原始执行结果或错误输出。
- 如果 `result` 和 `errorDetail` 内容完全相同，或错误详情只是执行结果的重复包装，应只展示“执行结果”，不再重复展示“错误详情”。

涉及源码位置：

- `apps/desktop/src/renderer/src/components/chat/ToolCard.tsx`
  - 负责工具卡主视图和展开详情渲染。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`
  - 负责 `ToolSnapshot` 的 `result`、`errorClass`、`actionableHint`、失败状态摘要。
- `apps/desktop/src/renderer/src/app/sessionState.ts`
  - 负责合并工具调用和工具结果，可能会同时保留 result 和 error detail。

修复方向：

Codex 对照：

- Codex 的紧凑视图优先展示一条执行结论，完整输出放进 transcript / 详情区域，不把同一段错误同时作为“结果”和“错误详情”重复刷屏。
- CCR 修复时应保留错误类型和行动提示，但对完全相同的 `result` / `errorDetail` 做展示层去重。

1. 在展示层做内容去重。
   - 如果 `resultText === errorDetailText`，只显示“执行结果”。
   - 如果错误详情为空、过短或只是重复错误行，也不显示“错误详情”。
2. 保留错误分类和行动提示。
   - 卡片顶部仍显示错误类型和行动建议。
   - 不因为隐藏重复错误详情而丢掉 `errorClass`。
3. 对不同内容仍保留两块。
   - 如果执行结果是 stdout/stderr 汇总，而错误详情包含 stack、结构化 error、exit code 等不同信息，可以继续显示。
4. 补 fixture 防回归。
   - 新增失败工具样例：`result` 与 `errorDetail` 相同，只渲染一份。
   - 新增失败工具样例：`result` 与 `errorDetail` 不同，保留两份。

验收标准：

- 失败工具卡详情里同一段错误文本不重复出现。
- `spawn ... rg.exe ENOENT` 这类单行失败只显示在“执行结果”里，不再重复显示“错误详情”。
- 错误类型和行动提示仍保留在卡片摘要区。
- 验证至少覆盖：
  - `smoke:desktop-display-events`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`

### FIX-UI-04 文件类工具卡信息重复且视觉过重

状态：已完成，Desktop 真机复测通过。

本轮处理结果：

- Desktop `ToolCard` 对文件类工具卡新增 compact layout：
  - 当 `ToolSnapshot.category === "file"` 且存在文件/引用/附件快照时，不再展示重复的 summary 行。
  - 主卡不再展示 `目标：path` chip，避免和文件快照路径重复。
  - 主视图保留工具名、文件路径、状态和常用操作。
- `FileSnapshotPanel` 新增 `compact` 变体：
  - `Read` 显示为 `已读取 + path`。
  - `Write` 显示为 `已写入 + path`。
  - `Edit/MultiEdit` 后续可显示为 `已编辑 + path`。
  - 操作按钮仍保留：打开、复制路径、定位，引用类额外保留复制引用。
- 绝对路径、工具 input/result、文件快照详情仍保留在 `查看详情` 中，不从主卡铺开。
- display-event fixture 新增 `Read` 文件工具样例，防止后续只覆盖 `Write`。
- 当前未修改 Core / App Server / CLI / TUI；只修 Desktop 展示层。
- 用户已完成 Desktop 真机复测：文件类工具卡 compact 展示通过。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- Desktop 真机复测通过。

现象：

- 单个文件类工具操作在 Desktop 上展示了多层重复信息，不只 `Write` 有问题，`Read` 也有同类问题。
- `Write` 写入文件示例：
  - 标题区：`写入文件`
  - 摘要行：`写入文件：D:\...\优化方案.md`
  - chip：`目标：D:\...\优化方案.md`
  - 文件快照：`生成文件 / Write / 待确认`
  - 路径正文：`D:\...\优化方案.md`
  - chip：`绝对路径：D:\...\优化方案.md`
  - 右侧按钮：打开、复制路径、定位
- `Read` 读取文件示例：
  - 标题区：`读取文件`
  - 摘要行：`读取文件：C:\Users\...\feedback_utf8_execution.md`
  - chip：`目标：C:\Users\...\feedback_utf8_execution.md`
  - 文件快照：`读取文件 / Read / 待确认`
  - 路径正文：`C:\Users\...\feedback_utf8_execution.md`
  - chip：`绝对路径：C:\Users\...\feedback_utf8_execution.md`
  - 右侧按钮：打开、复制路径、定位
- 对用户来说只是“一次读取/写入/编辑文件”，当前卡片把同一个路径重复展示了三到四遍，信息密度太高。
- 对比 Codex 的展示，用户更希望主视图简洁，详情按需展开。

当前判断：

- 这是 Desktop 工具卡产品体验问题，不是工具执行失败或事件链缺失。
- P21 文件卡能力补齐后，`ToolCard` 同时展示工具摘要、工具元数据、文件快照和路径 chip，导致信息重复。
- 对 `Read/Write/Edit/MultiEdit/Grep/Glob` 这类文件工具，主卡应该把“工具动作 + 文件路径/引用摘要 + 状态 + 常用操作”压缩为一层，不应同时展示工具摘要和文件快照里的同一路径。

设计原则：

- 主卡只展示一条核心信息：动作 + 相对路径/文件名 + 状态。
- 详细路径、绝对路径、input JSON、result JSON 放到“查看详情”里。
- 文件工具主卡优先展示工作区相对路径；没有相对路径再显示绝对路径。
- chip 只保留有增量价值的信息，例如 `Write`、`新增`、`修改`、`工作区外`、`等待权限`、`成功/失败`。
- 常用操作按钮可以保留，但布局要轻，避免把按钮区挤成主视觉。
- 不要为同一个路径同时展示“目标”和“绝对路径”两个 chip。

建议目标形态：

```text
写入文件  优化方案.md                         成功
D:\learn_code\gomoku\优化方案.md
[打开] [复制路径] [定位]      查看详情
```

或更简洁：

```text
已写入  gomoku/优化方案.md        成功
[打开] [复制路径] [定位]  详情
```

读取文件可以类似：

```text
已读取  memory/feedback_utf8_execution.md      成功
[打开] [复制路径] [定位]  详情
```

涉及源码位置：

- `apps/desktop/src/renderer/src/components/chat/ToolCard.tsx`
  - 工具卡主视图、详情区、操作按钮布局。
- `apps/desktop/src/renderer/src/components/chat/FileCard.tsx`
  - 文件快照组件，当前可能在工具卡内重复展示路径。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`
  - `Write` 工具摘要、displayName、metadata。
- `apps/desktop/src/renderer/src/domain/fileEvents.ts`
  - 文件快照里的 path / absolutePath / relativePath / safety 字段。

修复方向：

Codex 对照：

- Codex 对文件修改走 canonical `FileChange` / `TurnDiff` 视图，而不是把 `Write` 的输入、结果、目标路径、文件快照都重复堆在同一张工具卡里。
- Codex TUI 文件变更主视图是摘要优先：单文件类似 `Proposed Change README.md (+1 -1)`，多文件类似 `Edited 6 files (+9 -9)`，每个文件路径只作为一条分组标题出现。
- Codex 的 `PatchHistoryCell` 直接调用 `create_diff_summary(...)` 渲染文件级摘要和 diff；完整 diff、长输出、原始内容按需展开或滚动。
- CCR Desktop 应学习这个分层：工具生命周期卡只承担“动作 + 状态 + 入口”，文件内容变化集中到文件变更 / 差异视图，详细 JSON 放展开区。

1. 定义文件工具主卡压缩模式。
   - 当 `ToolSnapshot.category === 'file'` 且存在 `fileSnapshot` 时，主视图优先走文件工具 compact layout。
   - compact layout 不重复展示 `target chip` 和 `absolute path chip`。
2. 工具摘要与文件快照去重。
   - 如果工具摘要已经是 `读取文件：path`、`写入文件：path` 或 `编辑文件：path`，且文件快照也展示同一路径，则主视图只保留一处路径。
   - `target`、`absolutePath`、`raw input/result` 移入详情。
3. 按文件工具类型区分主文案，但共用布局。
   - `Read`：主文案突出“已读取 / 读取失败”和路径。
   - `Write`：主文案突出“已写入 / 生成文件 / 写入失败”和路径。
   - `Edit/MultiEdit`：主文案突出“已编辑”和路径，后续可接 diff 摘要。
   - `Grep/Glob`：主文案突出“搜索/匹配结果”和数量，不重复铺 raw 参数。
4. 参考 Codex 信息层级。
   - 主视图突出“编辑/写入了什么文件”和状态。
   - 详细 diff、完整路径、复制 raw JSON 进入展开区或后续专门文件详情。
5. 补 UI fixture。
   - 新增 `Read`、`Write` 成功卡视觉快照或 display-event smoke 断言：同一路径不能在主卡重复出现超过一次。

验收标准：

- 单个 `Read` / `Write` / `Edit` 文件工具主卡不再重复展示同一路径三四次。
- 主视图能一眼看出文件、动作和成功/失败状态。
- 绝对路径、目标路径、raw input/result 仍可在详情里看到。
- 操作按钮仍可用：打开、复制路径、定位。
- 验证至少覆盖：
  - `smoke:desktop-display-events`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`
  - Desktop 真机读取文件和写入文件视觉复测。

### FIX-RT-05 compact/run 超时后迟到响应触发 unknown request 且 UI 同时显示失败与成功

状态：已完成，Desktop 真机复测通过。

本轮处理结果：

- Desktop 主进程对 `compact/run` 使用专门长超时：`5 * 60_000ms`，不再沿用普通 App Server Client 的 30 秒默认超时。
- `JsonRpcClient` 增加超时请求保留区：
  - 请求超时时仍正常 reject 原请求 promise。
  - 同一 request id 的迟到 response 回来后，只清理保留区，不再触发 `protocol_error`。
  - 真正未知 request id 仍然会触发 `protocol_error`，没有把所有 unknown response 一刀切吞掉。
- `smoke:app-server-client` 新增 fake transport 回归样例：
  - 模拟 `compact/run` 先超时。
  - 再发送同 id 的迟到成功 response。
  - 断言不出现用户可见 `unknown request` 错误。
  - 再发送真正未知 id response，断言仍然会报 `protocol_error`。
- 当前未修改 Core compact 行为、App Server handler 语义、CLI/TUI 输出；只修 App Server Client 请求生命周期和 Desktop compact 调用超时。

验证结果：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run desktop:build` 通过。
- `npm.cmd run smoke:app-server-client` 通过，包含 `late_response_after_timeout_suppressed`。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `git diff --check` 通过。
- Desktop 真机点击“压缩会话”复测通过，未再出现 `compact/run` 超时、迟到响应 `unknown request` 和成功/失败状态并存的问题。

现象：

- Desktop 点击“压缩会话”后，先出现错误卡：
  - `Error invoking remote method 'ccr:compact-run': AppServerClientError: App Server request timed out: compact/run`
- 随后又出现成功事件：
  - `已压缩上下文：当前保留 2 条消息，压缩边界 1 个。`
- 最后又出现错误卡：
  - `App Server returned a response for an unknown request.`
- 用户看到同一轮 compact 既失败又成功，且多了一条 unknown request，状态非常混乱。

当前判断：

- 这不是单纯的 Desktop 文案问题，而是请求生命周期和超时策略问题。
- `compact/run` 是长耗时操作，当前 App Server Client 默认请求超时可能太短。
- 客户端超时后很可能已经把 pending request 移除；服务端之后返回 compact 成功 response，JSON-RPC client 发现 request id 已不存在，于是报 `unknown request`。
- 同时，Core 仍然发出了 `context/compacted` 或 compact 相关状态事件，导致 UI 又显示成功。
- 因此当前出现了三种状态并存：
  - IPC request promise：失败（timeout）
  - Core/App Server 真实操作：成功
  - JSON-RPC response 匹配：失败（unknown request）

涉及源码位置：

- `apps/desktop/src/main/index.ts`
  - `ipcMain.handle('ccr:compact-run', ...)` 当前直接等待 `managedClient.client.runCompact(...)`。
- `src/app-server/client/jsonRpcClient.ts`
  - 请求超时、pending request 清理、迟到 response 处理。
- `src/app-server/client/stdioAppServerClient.ts`
  - `runCompact(...)` 的 request options 传递。
- `src/app-server/handlers/contextHandlers.ts`
  - `handleCompactRun(...)` 调用 Core compact。
- `apps/desktop/src/renderer/src/main.tsx`
  - `runCompactFromDesktop(...)` 对 IPC timeout 的错误卡展示。
- `apps/desktop/src/renderer/src/app/notificationRouter.ts`
  - `context/compacted` 或 compact 事件映射。

修复方向：

1. 给 `compact/run` 使用长超时或无短超时。
   - `compact/run` 不是普通状态查询，应该使用专门 timeout，例如 `120_000ms` 或更长。
   - Desktop main 调用 `managedClient.client.runCompact(params, { timeoutMs: ... })`，避免 30 秒内误判失败。
2. JSON-RPC Client 处理迟到响应要降噪。
   - 如果 request 已因 timeout 被移除，迟到 response 不应升级成用户可见错误卡。
   - 迟到 response 可以写入 client debug log，标记为 `late_response_after_timeout`。
   - 不能再把它作为普通 `client-error` 广播到主聊天区。
3. Desktop UI 对 compact 状态做单一事实源。
   - 如果 `context/compacted` 或 `compact completed` 已成功到达，应移除或降级之前同一 compact 请求的 timeout 错误。
   - 第一版至少不要同时展示“已压缩成功”和“unknown request”两条互相矛盾的信息。
4. 补 smoke/fixture。
   - 模拟 `compact/run` 超过默认请求超时但最终返回成功。
   - 断言不出现用户可见 `unknown request`。
   - 断言 compact 成功事件能成为最终状态。

验收标准：

- 正常 compact 不再因 30 秒默认请求超时失败。
- 如果 compact 实际成功，UI 最终只显示成功，不显示同一请求的超时失败和 unknown request。
- 如果 compact 真失败，UI 显示明确失败原因，且不再随后出现成功状态。
- 迟到 response 只进日志，不进主聊天区错误卡。
- 验证至少覆盖：
  - `npm.cmd run typecheck`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run smoke:app-server-client`
  - `npm.cmd run smoke:desktop-display-events`
  - Desktop 真机点击“压缩会话”复测。

### FIX-UI-06 聊天时间线未自动滚动到最新内容

状态：已完成，Desktop 真机复测通过。

本轮处理结果：

- Desktop 聊天时间线新增“贴底跟随”自动滚动逻辑。
- 新增独立滚动容器引用，自动滚动只作用于主消息区，不影响输入框、Todo 浮窗或整个窗口。
- 新增 `autoScroll.ts` helper，统一底部距离与阈值判断：
  - 默认阈值为 `120px`。
  - 用户在底部附近时，新消息、工具事件、权限卡或运行中提示会自动滚到最新内容。
  - 用户主动上翻历史后，自动跟随暂停。
  - 有新内容到达但用户不在底部时，显示“回到底部”轻量按钮。
- 新增内容尺寸监听：工具卡、长文本、权限卡等内容高度变化时，如果当前处于贴底状态，会继续保持到底部。
- 当前未修改 Core / App Server / CLI / TUI；只修 Desktop renderer 展示层。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- `git diff --check` 通过。
- Desktop 真机长输出 / 工具执行 / 权限请求滚动复测通过，贴底自动跟随和用户上翻暂停符合预期。

现象：

- Desktop 会话区有新消息、工具调用、工具结果、权限请求或运行状态更新时，滚动条不会稳定自动滚到底部。
- 用户需要手动拖动滚动条才能看到最新内容。
- 长任务执行时尤其明显：模型在生成、工具在执行、权限请求已出现，但界面停在旧位置，用户容易误以为任务卡住或没有新输出。

当前判断：

- 这是 Desktop renderer 的聊天时间线滚动策略问题，不是 Core/App Server 事件缺失。
- 当前代码里没有稳定的主时间线自动滚动逻辑，至少没有明显的 `scrollIntoView` / `scrollTop` / `autoScroll` 处理。
- 自动滚动不能简单粗暴地“每次渲染都滚到底”，否则用户向上查看历史时会被强行拉回底部。
- 正确策略应类似 Codex / 常见聊天客户端：
  - 用户原本就在底部附近时，新内容自动跟随到底部。
  - 用户主动向上滚动查看历史时，暂时暂停自动跟随。
  - 底部出现新内容但用户不在底部时，可显示“回到底部 / 新消息”轻量提示。

涉及源码位置：

- `apps/desktop/src/renderer/src/main.tsx`
  - 当前 Desktop 原型主界面和聊天区渲染入口。
- `apps/desktop/src/renderer/src/app/sessionState.ts`
  - `selectChatMessages()` / `selectTimelineEvents()` 决定主时间线消息列表。
- `apps/desktop/src/renderer/src/styles.css`
  - 聊天面板、消息列表、滚动容器样式。
- 后续如果前端继续组件化，应优先把聊天时间线拆成 `ChatTimeline` / `AutoScrollContainer` 之类独立组件。

修复方向：

1. 明确滚动容器。
   - 找到真正承载主消息列表的 scroll container，不要对整个窗口或错误节点操作。
   - 底部输入框固定时，自动滚动只影响消息区。
2. 实现“贴底跟随”状态。
   - 当 `scrollHeight - scrollTop - clientHeight <= 阈值` 时视为用户在底部附近。
   - 只有在底部附近时，新消息到达才自动滚到底。
   - 阈值可以先设为 `80px ~ 120px`，避免微小布局变化导致误判。
3. 区分用户主动滚动和系统追加内容。
   - 用户向上滚动后，暂停自动跟随。
   - 用户手动滚回底部或点击“回到底部”后恢复自动跟随。
4. 触发时机覆盖完整。
   - 新 assistant 文本 delta。
   - 新工具卡、工具进度、工具结果合并。
   - 权限请求卡出现。
   - Todo 浮窗不应抢主滚动，但主时间线新增 Todo 相关提示时应遵守同一规则。
5. 补最小验证。
   - 增加可测试的滚动状态 helper，避免全部依赖人工目测。
   - Desktop 真机验证：连续输出长文本、工具执行中、权限请求出现时，界面能自动展示最新内容。

验收标准：

- 用户在底部附近时，收到新消息或工具状态更新会自动滚到最新内容。
- 用户主动上翻历史时，新内容不会强行抢滚动。
- 用户不在底部且有新内容时，有明确方式回到底部。
- 权限请求、工具执行中、工具结果、普通文本输出都能触发合理滚动。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`
  - Desktop 真机长输出 / 工具执行 / 权限请求滚动复测。

### FIX-UI-07 内部 `todo_reminder` 被误展示为附件

状态：已完成，自动化验证通过，待 Desktop 真机复测。

本轮处理结果：

- 已新增共享隐藏附件类型 helper：`src/utils/nullRenderingAttachmentTypes.ts`。
- 原生 TUI 的 `nullRenderingAttachments.ts` 改为复用共享类型清单，继续保留旧导出，避免影响已有 `AttachmentMessage` 调用方。
- Desktop `contentBlocks.tsx` 新增 `isNullRenderingContentBlock(...)`，遇到以下内容时直接不渲染：
  - `type` 本身是 `todo_reminder` 等内部隐藏附件类型。
  - `type === "attachment"` 且 `attachment.type` 是 `todo_reminder` 等内部隐藏附件类型。
- display-event fixture 增加 `todo_reminder` 隐藏内容块回归样例。
- `smoke:desktop-display-events` 增加断言：可见事件文本中不能出现 `todo_reminder`。
- 当前未修改 Core / App Server / CLI / TUI 的消息语义；只抽共享清单并修 Desktop fallback 渲染。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run desktop:build` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `git diff --check` 通过。

现象：

- Desktop 会话时间线中出现一张标题为“附件”的卡片。
- 卡片内容是内部 JSON，例如：

```json
{
  "type": "todo_reminder",
  "content": [],
  "itemCount": 0
}
```

- 这不是用户上传的附件，也不是模型要展示给用户的正式内容。
- `content: []`、`itemCount: 0` 表示当前内部 Todo 提醒列表为空，用户看到这张卡没有实际价值。

当前判断：

- 这是 Desktop 内容块渲染层的过滤缺口，不是附件上传功能本身的问题。
- 原生 TUI 已经有“不渲染附件类型”清单，`todo_reminder` 明确属于不应显示的内部附件。
- Desktop 当前在 fallback 渲染中把所有 `type === "attachment"` 都显示为“附件 + raw JSON”，没有复用或对齐原生 TUI 的隐藏规则。

涉及源码位置：

- `src/components/messages/nullRenderingAttachments.ts`
  - 原生 TUI 的 `NULL_RENDERING_TYPES` 已包含 `todo_reminder`、`critical_system_reminder`、`token_usage`、`compaction_reminder` 等内部控制附件。
- `apps/desktop/src/renderer/src/domain/contentBlocks.tsx`
  - 当前 `formatContentBlock(...)` 对 `type === "attachment"` 直接返回 `附件` 和 `block.attachment` 的 JSON。
- `apps/desktop/src/renderer/src/domain/displayEvents.ts`
  - 当内容块没有被识别为工具、Todo overlay 或结构化事件时，会 fallback 成普通消息进入时间线。

修复原则：

1. 不要把 `todo_reminder` 当成真实附件处理。
   - 它是给模型/运行时看的内部控制信息，不属于用户上传附件，也不属于可预览媒体。
2. Desktop 应对齐原生 TUI 的 null-rendering attachment 语义。
   - 至少过滤 `todo_reminder`。
   - 后续可扩展为统一隐藏 `critical_system_reminder`、`token_usage`、`compaction_reminder` 等同类内部附件。
3. 过滤应放在事件归一化或内容块格式化层。
   - 首选在 `displayEvents.ts` / `contentBlocks.tsx` 里增加 `isNullRenderingAttachmentBlock(...)`。
   - 如果一个 completed item 过滤后没有可见内容，就不要生成聊天消息卡。
4. 不影响真实用户附件。
   - 只能按内部 `attachment.type` 白名单过滤，不能把所有 `attachment` 都隐藏。
5. 保留调试能力。
   - 如果将来需要排查，可在开发日志或 raw debug 中保留内部块摘要，但默认 UI 不展示。

验收标准：

- Desktop 时间线不再显示 `todo_reminder` 的“附件”卡。
- 真正的用户附件、文件卡片和媒体预览不受影响。
- `TodoWrite` 浮窗 / Todo overlay 仍按 P19/P20 的规则展示，不因为隐藏 `todo_reminder` 被破坏。
- 新增或扩展 display-event fixture，覆盖 `attachment.type === "todo_reminder"` 时不生成可见消息。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run smoke:desktop-display-events`
  - `npm.cmd run desktop:build`
  - Desktop 真机复测：空 Todo reminder 不再显示为附件。

### FIX-UI-08 `AskUserQuestion` 结束轮次没有用户可见反馈

状态：已完成（自动验证通过，待 Desktop 真机复测）。

现象：

- Desktop 真机测试中，一轮任务已经结束，但界面最后只剩读取文件、工具成功/失败等过程卡片。
- 用户曾看到 `AskUserQuestion` 相关过程，但 turn 结束后没有出现一条明确的最终反馈。
- 对用户来说，这一轮既没有“我已经完成了什么”的最终回答，也没有“我现在需要你补充什么”的问题卡，像是静默结束。
- 同一轮附近还出现文件读取卡片状态矛盾：卡片底部显示失败，但主文案仍出现“已读取 xxx”，说明工具卡状态与可读摘要也需要在该任务里一起核对。
- renderer 日志存在 React duplicate key 警告，可能导致部分时间线事件重复或被省略；这不是唯一根因，但需要作为防回归风险一并排查。

当前判断：

- `AskUserQuestion` 在原生 Claude Code 中不是普通工具，而是需要用户交互的控制工具。
- 原生 TUI 有专门的 `AskUserQuestionPermissionRequest` 组件，会把 `questions / options / preview / answers` 渲染成多选问题，并把用户答案作为 `updatedInput.answers` 回传。
- Desktop 当前只有通用 `PermissionRequestCard`，基本只能 `allow / deny`，并且只展示 raw JSON。
- Desktop 目前还会把 `AskUserQuestion` 归为 `control` 工具并隐藏 tool call，成功类 control result 又可能被过滤；如果模型没有后续普通 assistant 文本，就会出现“turn 完成但主聊天区没有最终反馈”。
- 这不是模型没有返回，而是 Desktop 没有把“需要用户回答的问题”作为一等事件渲染出来，也没有把它作为当前轮次的收口反馈。

本轮处理结果：

- `AskUserQuestion` 专用卡已经在 `desktop-interaction-cards-todo.md` 的 IC-03 主线完成，本轮补的是生命周期缺口。
- `permission/requested` 中的 `AskUserQuestion` / 计划类强交互权限，在 `turn/completed` 后不再被 `clear-permissions` 直接清掉。
- `turn/completed` 只清理非交互类 pending 权限；`AskUserQuestion`、`ExitPlanMode`、`EnterPlanMode` 这类仍需用户操作的交互卡会留在主界面，作为本轮“等待你回答 / 等待确认”的最终可见反馈。
- `turn/cancelled` 和 `turn/failed` 仍会清空权限，避免取消或失败后残留一张假 pending 交互卡。
- 本轮没有修改 CLI/TUI，也没有改变 Core 原生 permission 语义；只调整 Desktop renderer 对 turn 完成后的权限卡保留策略。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- `npm.cmd run typecheck -- --pretty false` 通过。
- `git diff --check` 通过。

修复原则：

1. `AskUserQuestion` 必须有专用 Desktop 展示。
   - 不再只依赖通用权限卡。
   - 从 permission request 的 `input.questions` 中提取问题、选项、说明、preview。
   - 在主聊天区或悬浮交互区展示成“需要你选择”的问题卡。
2. `AskUserQuestion` 是一种终止型用户交互状态。
   - 如果 turn 以它结束，Desktop 也要显示“等待你回答以下问题”，不能静默结束。
   - 如果用户选择答案，应通过 `permission/respond` 传回 `behavior: "allow"` 和带 `answers` 的 `updatedInput`。
   - 如果用户拒绝或要求补充说明，应按原生语义传回 deny / feedback，而不是普通 allow。
3. 不要把 `AskUserQuestion` 的普通成功结果刷成“工具执行成功”。
   - 用户选择后可以显示一条轻量状态，例如“已提交回答”。
   - 真正的后续回答应来自模型继续执行后的 assistant 消息。
4. 同步修状态矛盾问题。
   - 文件工具失败时，主摘要不能继续写“已读取 / 已写入”这种成功语义。
   - 展示层要以 `toolSnapshot.status` 为主，成功/失败文案不得混用。
5. 修复或规避重复 key 风险。
   - `ChatTimeline` / `DisplayEvent` key 必须稳定且唯一。
   - 同一时间戳 notification、拆分 content block、tool lifecycle merge 后不能产生重复 React key。

子任务执行位置：

- 详细子任务已归入 [CCR Desktop 交互卡片补齐专项](./desktop-interaction-cards-todo.md) 的 `IC-03 AskUserQuestion 专用卡`。
- 本任务池只保留问题现象、源码入口和验收总口径，避免 `app-server-todo.md` 继续膨胀。
- 后续实际执行时，从 `IC-03-1` 开始推进，并在本任务状态里同步最终完成/真机验收结果。

涉及源码位置：

- `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx`
  - 原生输入输出 schema、`answers` 回传语义和 tool result 文案。
- `src/components/permissions/AskUserQuestionPermissionRequest/`
  - 原生 TUI 多选问题组件，可参考字段和交互流程。
- `apps/desktop/src/renderer/src/components/chat/PermissionRequestCard.tsx`
  - 当前 Desktop 通用权限卡，缺少 `AskUserQuestion` 专用渲染。
- `apps/desktop/src/renderer/src/main.tsx`
  - 当前 `respondPermission(...)` 只支持 allow / deny 和固定 message，需要支持 `updatedInput`。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`
  - 当前将 `AskUserQuestion` 归为 control 并隐藏 tool call，需要保留问题事件或转为专用事件。
- `apps/desktop/src/renderer/src/app/sessionState.ts`
  - 工具生命周期、权限状态、最终反馈与 key 稳定性合并逻辑。
- `apps/desktop/src/renderer/src/components/chat/ChatTimeline.tsx`
  - 当前时间线渲染与 key 生成位置，需要排查 duplicate key。

验收标准：

- 当模型触发 `AskUserQuestion` 时，Desktop 必须显示用户可读的问题和选项，而不是只显示 raw JSON 或工具卡。
- 如果一轮以 `AskUserQuestion` 暂停，界面必须明确显示“等待用户回答”，并且输入/按钮状态合理。
- 用户选择选项后，`permission/respond` 能回传 `updatedInput.answers`，后续模型能继续执行并给出正常回答。
- `AskUserQuestion` 成功结果不再单独刷成无意义的“工具执行成功”。
- 文件读取失败卡不再同时显示“已读取”和“失败”。
- renderer 不再出现同类 duplicate key 警告。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run smoke:desktop-display-events`
  - `npm.cmd run desktop:build`
  - Desktop 真机复测：触发 `AskUserQuestion` 后能看到问题、选择答案，并继续拿到后续 assistant 反馈。

### FIX-UI-09 新建会话不清空当前聊天且缺少历史会话重新加载入口

状态：已完成（自动验证通过，待 Desktop 真机复测）。

现象：

- Desktop 点击“新建会话”后，当前聊天区仍然保留旧会话消息、工具卡和状态。
- 用户无法判断：
  - 后端是否真的创建了新 thread。
  - 还是后端创建成功了，但 renderer 没有清空当前 `session`。
- 用户还追问“历史会话在哪儿可以重新加载”，说明当前 Desktop 没有清晰暴露历史会话列表和 resume 入口。
- 新建会话后，“压缩会话”按钮仍然可点击；点击后会报 `AppServerClientError: No messages to compact`，并且可能连续生成重复错误卡。

当前判断：

- 当前 renderer 的“新建会话”按钮调用的是 `window.ccr.startThread('CCR Desktop 会话')`。
- Desktop main 已有 `startThread(...)`，App Server Client 也已有 `startThread`、`listThreads`、`resumeThread` 能力。
- 但 renderer 调用 `startThread` 后没有同步重置本地 `sessionReducer` 里的：
  - `displayEvents`
  - `permissions`
  - `activeTurnId`
  - `todoOverlay`
  - `turnMetadata`
- 因此更可能是“新建后端 thread 成功，但前端仍显示旧 timeline”，而不是新建一定失败。
- 历史会话方面，App Server/Client 已经有 `thread/list` 与 `thread/resume` 路径，但 Desktop UI 目前没有清晰入口，也没有把 resume 后的历史消息重新灌回 timeline 的可见流程。
- “压缩会话”按钮现在只按 `busy || activeTurnId` 禁用，没有结合当前会话是否有可压缩消息、当前 timeline 是否为空、compact/status 是否可运行来判断。
- 新建会话后如果前端 timeline 没清空，用户会误以为当前还有旧消息；但后端新 thread 可能确实为空，所以 compact/run 返回 `No messages to compact`。

本轮处理结果：

- Desktop renderer 新增 `reset-session` action，新建会话和恢复历史会话后会清空旧 `displayEvents`、`permissions`、`activeTurnId`、`turnMetadata`，并清理旧工具元数据缓存和输入框。
- Desktop main process 在 `startThread()` / `resumeThread()` 成功后会重置 `status.lastTurn` 和 `status.lastError`，避免顶部运行详情继续引用旧 turn。
- Desktop main/preload 补齐 `thread/list` 与 `thread/resume` IPC：renderer 现在可以通过“历史”入口列出 App Server 当前已知会话，并按 `metadata.sessionId` 恢复。
- 历史会话第一版先恢复 Core 内部上下文；如果协议没有返回可见历史消息，UI 会明确提示“历史上下文已加载；当前版本先不回放旧消息”，避免假装完整回放。
- “压缩会话”按钮新增空会话禁用判断：优先使用 `context/status.messageCount`，没有快照时回退到当前可见 user/assistant 消息。
- 即使后端仍返回 `No messages to compact`，Desktop 也降级成轻量系统提示“当前会话暂无可压缩内容”，不再刷红色错误卡。
- 追加修复：历史列表不再展示当前会话和空会话；Core `thread/list` 返回时会把 `messageCount/sessionId/sessionStorageStatus` 等上下文元数据补到 thread metadata，renderer 再按真实 `sessionId` 去重，避免点击历史/恢复后出现“会话越点越多”的可见增殖。
- 追加兜底：如果用户选择的历史会话其实就是当前 `sessionId`，renderer 会关闭历史面板并提示“该历史会话已经是当前会话”，不会再次调用 `thread/resume`。
- 追加修复：历史会话新增简单标题兜底。Core 会从第一条有效用户消息派生 `derivedTitle/firstUserMessagePreview`，新会话首轮发送后会把默认 `CCR Desktop 会话` 替换成短标题；Desktop 历史面板遇到默认标题时优先展示派生标题，空会话再退回短 threadId。
- 追加修复：历史会话列表从聊天区内嵌面板改为独立弹窗。点击“历史”后显示居中 modal 和遮罩，点击遮罩或关闭按钮收起，不再占用聊天区布局。
- 追加修复：`thread/list` 不再只列 App Server 进程内存中的 thread，会复用现有 `loadMessageLogs` 历史读取链路扫描当前项目 transcript，并把最近历史会话转成可恢复 thread；新建会话后历史弹窗应能看到之前已经落盘的会话。

验证结果：

- `npm.cmd run typecheck:desktop -- --pretty false` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `npm.cmd run desktop:build` 通过。
- `npm.cmd run typecheck -- --pretty false` 通过。
- `git diff --check` 通过。
- 追加验证：`npm.cmd run typecheck:desktop -- --pretty false` 通过。
- 追加验证：`npm.cmd run typecheck -- --pretty false` 通过。
- 追加验证：`npm.cmd run smoke:app-server-context` 通过。
- 追加验证：`npm.cmd run smoke:desktop-display-events` 通过。
- 追加标题修复验证：`npm.cmd run desktop:build` 通过。
- 追加标题修复验证：`git diff --check -- src/core/types.ts src/core/sessionCore.ts apps/desktop/src/renderer/src/components/pages/ChatPage.tsx apps/desktop/src/renderer/src/domain/displayTypes.ts` 通过。
- 追加弹窗修复验证：`npm.cmd run typecheck:desktop -- --pretty false`、`npm.cmd run desktop:build`、`npm.cmd run smoke:desktop-display-events` 均通过。
- 追加持久化历史修复验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run typecheck:desktop -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:app-server-context`、`npm.cmd run smoke:desktop-display-events` 均通过；已重启 `npm.cmd run desktop:dev`，确保 App Server 使用更新后的 `dist`。

修复原则：

1. 先确认新建会话是否成功。
   - 点击新建后记录或读取最新 `status.thread.threadId`。
   - 新建前后 threadId 必须变化。
   - 如果后端失败，应显示明确错误卡，不应只保留旧聊天让用户误判。
2. 新建成功后清空当前聊天状态。
   - renderer 必须 dispatch 一个明确的 `reset-session` / `replace-session` action。
   - 清理旧消息、工具卡、权限请求、Todo overlay、active turn 和 turn metadata。
   - 输入框可以保留为空；不要带着旧 prompt。
3. 新建成功后展示轻量系统提示。
   - 例如：“已创建新会话：CCR Desktop 会话”。
   - 可选展示 threadId 的短 ID 方便排查。
4. 空会话禁用压缩入口。
   - 新建会话后，如果当前 thread 没有可压缩消息，`压缩会话` 按钮应禁用。
   - 按钮 tooltip 应说明“当前会话暂无可压缩内容”。
   - 如果后端仍返回 `No messages to compact`，UI 应降级为轻量提示，不能连续刷重复错误卡。
5. 历史会话入口需要单独补。
   - 第一版可以放在“新建会话”旁边的“历史”按钮，或放到会话标题下拉。
   - 调用 `thread/list` 展示最近会话：标题、threadId、更新时间、消息数或状态。
   - 点击某个历史会话后调用 `thread/resume`。
6. resume 后要恢复可见时间线。
   - 如果 App Server `thread/resume` 已返回历史 messages，则映射成 Desktop `DisplayEvent`。
   - 如果当前协议只恢复 Core 内部 transcript，没有返回可展示 events，则需要补 `thread/history` 或扩展 `thread/resume` 返回可见 item。
   - 不能出现“后端恢复了上下文，但 Desktop 还是空白”的假恢复。

涉及源码位置：

- `apps/desktop/src/renderer/src/main.tsx`
  - 当前 `onStartThread` 只调用 `window.ccr.startThread(...)`，没有清空 renderer session。
- `apps/desktop/src/renderer/src/app/sessionState.ts`
  - 需要新增或复用重置 session action。
- `apps/desktop/src/main/index.ts`
  - `startThread(...)` 已存在；需要确认是否广播 `thread/started` 后刷新状态。
- `src/app-server/client/stdioAppServerClient.ts`
  - 已存在 `startThread`、`listThreads`、`resumeThread`。
- `src/app-server/handlers/sessionHandlers.ts`
  - 已存在 `thread/start`、`thread/list`、`thread/resume` handler。
- `apps/desktop/src/renderer/src/components/pages/ChatPage.tsx`
  - 需要考虑历史会话入口放置位置，以及空会话时 `压缩会话` 的禁用状态。
- `apps/desktop/src/renderer/src/components/layout/Topbar.tsx`
  - 顶部上下文展示可作为判断“当前消息数/Token 是否为 0”的辅助来源，但不应成为唯一事实源。

验收标准：

- 点击“新建会话”后，顶部当前 thread 信息变化，聊天区旧消息被清空。
- 新建失败时显示错误，不静默保留旧会话造成误判。
- 新建成功后可以发送新任务，且不会带入旧会话的工具卡、权限请求、Todo overlay。
- 新建空会话后，“压缩会话”按钮应禁用或提示无可压缩内容，不再生成 `No messages to compact` 错误卡。
- 如果用户在非空会话点击压缩，仍应正常执行 compact。
- Desktop 有可发现的历史会话入口，至少能列出最近会话。
- 点击历史会话能重新加载或恢复该会话。
- 如果第一版暂时不能恢复完整历史消息，必须在 UI 和文档里明确显示“已恢复上下文，但历史消息展示待补齐”，不能让用户误以为历史加载完整。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run desktop:build`
  - Desktop 真机复测：新建会话清空旧聊天、历史入口可见、历史会话 resume 行为明确。

### FIX-UI-10 结构化输出缺少展示位置与可见性策略

状态：已撤回；不再保留全局结构化展示。

现象：

- P22 已经把工具输入/结果、权限参数、运行状态、MCP 状态和原生 `structured_output` 统一转成 `StructuredSnapshot`。
- 但“能结构化解析”不等于“应该在主聊天时间线展示”。
- 尤其是原生 `structured_output` attachment，本身在原生 TUI 的 null-rendering 语义里属于不直接渲染的结构化结果载体；Desktop 把它升级成独立主聊天卡，会把内部/SDK 风格结果和用户可读对话混在一起。

当前判断：

- 工具、权限、运行状态、MCP 等来源的结构化视图保留是合理的，但应该停留在对应详情区或专属页面。
- 主聊天流只应该展示用户叙事：用户消息、assistant 文本、必要的工具生命周期摘要、权限决策卡、错误摘要。
- 模型原生 `structured_output` 后续如果要展示，应作为“结构化数据结果 / Artifact / 导出结果”单独设计入口，而不是默认塞进聊天流。

本轮处理结果：

- Desktop 已移除原生 `structured_output` 的主展示链路，不再生成单独的模型结构化输出卡。
- 结构化快照、结构化视图、结构化 CSS 和相关 fixture/smoke 断言已从 Desktop 展示层撤回。
- 后续如果要展示结构化结果，必须先重新设计展示位置、默认折叠策略和用户可见范围，再按具体卡片接入。

修复原则：

1. 主聊天流优先保持简洁，只展示用户需要直接阅读或操作的内容。
2. 不再全局自动把对象、状态、工具结果转换成结构化树。
3. 后续结构化展示必须按场景单独评估，不能默认塞进聊天卡、运行详情或 MCP 页面。
4. 如果产品上确实需要，可设计独立 Artifact / 开发者诊断 / 数据结果面板。

验收标准：

- 主聊天区不再出现“模型结构化输出”大卡。
- 运行详情、MCP 页面、工具卡详情不再默认出现 JSON 树和结构化诊断按钮。
- smoke 不再要求 `structured_output` 事件或结构化快照存在。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop -- --pretty false`
  - `npm.cmd run smoke:desktop-display-events`
  - `npm.cmd run desktop:build`
  - `git diff --check`

### FIX-UI-11 聊天工具卡详情过度结构化展示

状态：已撤回；聊天工具卡回到摘要 + 折叠代码块。

现象：

- 工具卡详情里把 `tool_input`、`tool_result`、`tool_progress` 的 `StructuredSnapshot` 全部渲染成 `StructuredView`。
- 用户展开一个普通 Shell / 文件工具卡时，会看到树视图、复制按钮、诊断策略、节点信息等大量开发者信息。
- 这和 Codex 风格的“摘要 + 可折叠命令/结果代码块”差距太大，也破坏聊天主线阅读。

当前判断：

- 聊天工具卡的第一职责是让用户知道“做了什么、成功/失败、必要时看原始命令/结果”。
- 结构化快照仍然有价值，但不应该默认进入聊天卡详情。
- 如果后续需要完整 JSON 树，应做单独“开发者诊断 / 原始事件”入口，而不是塞进每一张工具卡。

本轮处理结果：

- `ToolCard` 不再直接渲染 `StructuredView`。
- 工具详情恢复为紧凑代码块：`调用参数`、`执行结果`、`错误详情`、文件/引用信息等仍在折叠详情中。
- `ToolSnapshot` 不再携带 `structuredSnapshots`；后续如果要做专门诊断入口，需要重新设计轻量、按需的结构化数据源。

验收标准：

- 普通工具卡主视图只展示工具名、摘要、必要 meta 和右下角状态。
- 展开详情时看到的是紧凑代码块，不是完整 JSON 树视图。
- 成功/失败状态、权限卡、文件快照、错误去重不受影响。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop -- --pretty false`
  - `npm.cmd run desktop:build`
  - `git diff --check`

### FIX-UI-12 CCR Desktop 默认全屏 / 窗口状态恢复

状态：已完成，自动验证和 Desktop 真机复测均已通过。

现象：

- 当前 Desktop 打开后窗口尺寸偏保守，聊天区、工具卡、历史弹窗和后续“模型与供应商”页面都需要更大的工作区空间。
- 用户希望 CCR 默认以全屏或近似全屏方式启动，减少每次手动调整窗口的动作。

当前判断：

- 第一版更适合做“默认最大化启动”，而不是强制进入 OS fullscreen。强制 fullscreen 可能隐藏任务栏和窗口控制，反而不利于普通桌面应用操作。
- 如果用户已经手动调整过窗口大小或退出最大化，后续启动应优先尊重用户窗口偏好，不能每次都强行覆盖。
- 这属于 Desktop 本地窗口生命周期能力，不应影响 Core、App Server、CLI 或 TUI。

建议改动：

1. Desktop main process 增加窗口状态策略。
   - 首次启动或没有保存窗口偏好时默认最大化。
   - 如果已有保存的窗口状态，按用户上次状态恢复。
2. 记录用户窗口偏好。
   - 至少记录是否最大化。
   - 后续可扩展记录宽高和位置。
3. 增加设置项或后续入口。
   - 可选项：“启动时默认最大化”。
   - 第一版可以先默认开启，设置项后补。
4. 明确术语。
   - 文档和 UI 中优先写“最大化”，如果后续要做真正 OS fullscreen，再单独设计。

实现记录：

- `apps/desktop/src/main/index.ts` 已增加 Desktop 窗口状态文件 `window-state.json`。
- 首次启动或没有有效窗口状态时，Desktop 默认最大化启动。
- 用户手动退出最大化、调整尺寸或移动窗口后，会保存宽高、位置和是否最大化。
- 下次启动优先恢复用户保存的状态；如果保存位置已经不在当前屏幕可见区域，则只恢复尺寸并交给系统居中，避免窗口跑到不可见屏幕。
- `scripts/smoke-desktop-auto-update.mjs` 已补充窗口状态恢复相关静态检查。

验收标准：

- 首次启动 CCR Desktop 时窗口默认最大化。
- 用户手动退出最大化并关闭后，再次启动不应强行最大化，除非明确打开“启动时默认最大化”偏好。
- 窗口状态恢复不影响 App Server 子进程启动和退出清理。
- 打包态和开发态行为一致。
- 验证至少覆盖：
  - `npm.cmd run typecheck:desktop -- --pretty false`：已通过。
  - `npm.cmd run desktop:build`：已通过。
  - `npm.cmd run smoke:desktop-auto-update`：已通过。
  - Desktop 真机复测：首次启动默认最大化、手动调整后能恢复偏好，已通过。

