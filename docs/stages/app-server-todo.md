# CCR App Server 实施 Todo

## 当前任务列表（实时）

- [x] P0 现状盘点与边界确认
- [x] P1 App Server 协议详细设计
- [x] P2 最小 stdio JSON-RPC 运行骨架
- [x] P3 CLI 入口接入 `ccr app-server --listen stdio`
- [x] P4 第一批只读能力 handler
- [x] P5 App Server smoke 验证链路
- [x] P6 Thread / Turn / Item 会话 API 设计
- [x] P6.5 CCR Core 统一能力接口边界补强
- [x] P7 Turn 执行与事件流最小闭环
- [x] P8 权限请求与客户端响应闭环
- [x] P9 Desktop 原型接入准备
- [x] P10 Desktop App 最小原型
- [x] P11 Desktop 打包、启动与本机验证
- [x] P12 Desktop 会话、权限与错误交互增强
- [x] P13 Desktop 设置、MCP 与日志页面
- [x] P14 Desktop 安装包与升级准备
- [x] P15 Desktop 日志落盘与错误可观测
- [x] P16 Desktop 图标、安装器与更新通道准备
- [x] P17 版本、协议兼容与回滚加固
- [x] P18 Desktop 输出能力基线、事件协议与前端模块化补齐
- [x] P19 控制信息面板与运行元数据展示
- [x] P20 工具事件卡片产品化
- [x] P21 文件、附件与引用系统
- [ ] P22 结构化输出与 JSON/Schema 视图（已撤回，后续按具体场景重新设计）
- [x] P23 多模态输入/输出、附件上传与预览
- [ ] P24 错误分类、限流与拒答状态治理
- [x] P25 原生上下文链路恢复与短期记忆治理
- [x] P26 上下文、压缩与记忆能力 App Server 桥接

## 当前指针

- 已完成：P23 多模态输入/输出、附件上传与预览第一版。
- 当前正在做：提交前收口，补 `CHANGELOG.md` 当前未发布说明、确认 diff 分组、跑最终验证，然后 commit + push。
- 完成后下一项：优先把下午标准文档里的协议/展示统一问题拆成小 goal 执行；第一批接 P24 错误分类、限流与拒答状态治理。
- 说明：P22 全局结构化展示已撤回；P23 不再和多供应商专项混在一起，附件真实随消息发送、预览、输入协议和多模态能力边界治理进入独立文档。

## 标准文档落地队列

来源：

- [CCR 模型输出归一化与展示标准](../architecture/model-output-normalization-and-display-standard.md)
- [CCR Provider 工具协议统一化标准](../architecture/provider-tool-protocol-normalization.md)

这些不是独立空文档，而是 P23 收口后继续实施的标准化队列。执行顺序如下：

1. [x] STD-PROTOCOL-01 CCR 标准 LLM 协议文档
   - 已完成：新增 `CCR 标准 LLM 协议 v0.1`，明确 CCR 不以某一家 provider 原始协议为标准，而以内部标准消息、内容块、工具、能力和错误快照为基准；已有多模态、输出展示和工具协议文档已引用该标准。
2. [x] STD-PROTOCOL-02 Provider 协议盘点与官方文档对照
   - 已完成：新增 `Provider 协议盘点与官方文档对照`，按官方文档列出 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 需要对接的协议族、协议面、必须实现项和 probe 矩阵。
3. [x] STD-TOOL-01 修复 OpenAI-compatible / DeepSeek 悬空工具结果和 TodoWrite schema 常驻
   - 已完成：`TodoWrite` 不再 deferred；OpenAI-compatible 请求前会修复缺失工具结果；中断和参数错误不会让会话卡死。
4. [x] STD-TOOL-02 Provider 工具协议第一版收口
   - 目标：补 `ProviderToolProfile` 或等价结构，明确工具 schema、strict 支持、并行工具和工具结果回填能力。
   - 已完成：新增 `LlmProviderToolProfile` 与 `toolProtocolProfile` 解析入口；DeepSeek / OpenAI Chat compatible / Anthropic / MiniMax 已有内置或默认 profile；OpenAI Chat adapter 会按 profile 判断工具支持与工具结果修复；新增 `smoke:provider-tool-profile` 覆盖 DeepSeek、OpenAI-compatible、Anthropic 和 custom 默认行为。
5. [ ] STD-DISPLAY-01 抽 `CcrContentBlock` 共享类型
   - 目标：把 Desktop / App Server / Runtime 里分散的 `text/image/file/audio/tool/json` 内容块口径收成共享类型。
   - 验收：provider adapter、历史恢复和 Desktop display event 不再各自猜字段。
6. [ ] STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke
   - 目标：补 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的输出样例，覆盖文本、工具、附件、错误和历史恢复。
   - 验收：新增 provider 时至少补一组 fixture，不允许 UI 直接消费 provider 原始结构。
7. [ ] P24-1 / P24-2 ErrorSnapshot 与错误分类展示
   - 目标：把 provider 错误、工具错误、参数校验错误、中断、限流、认证过期等统一为可行动错误卡。
   - 验收：错误不再只是大红框字符串，用户能看懂来源、影响和下一步。
8. [ ] STD-OUTPUT-03 生成型多模态输出设计
   - 目标：模型生成图片、音频、文件这类输出单独设计生命周期和安全策略。
   - 说明：这不是 P23 第一版范围，放在展示标准稳定后再做。

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

## P0 现状盘点与边界确认

状态：已完成。

已经确认：

- 当前仓库已有 CLI / TUI / MCP server / structured IO / bridge / remote / LLM runtime。
- 当前仓库还没有面向 Desktop / VS Code 的统一 `ccr app-server`。
- `src/entrypoints/mcp.ts` 是 MCP Server，不是 App Server。
- `src/cli/structuredIO.ts` 可复用 SDK 消息、权限请求和流式输出经验，但不是稳定 JSON-RPC 服务。
- `src/bridge` 和 `src/remote` 偏远程控制和云端 session，不应直接当成本地 Desktop / VS Code 协议。
- `src/server/server.ts` 目前仍是禁止启动的占位。

已沉淀参考文档：

- [CCR 多入口与 App Server 总体方案](../architecture/entrypoints-runtime-app-server-desktop-vscode.md)
- [CCR Desktop 客户端框架选型](../architecture/desktop-framework-selection.md)
- [CCR 升级管理策略](../architecture/upgrade-management-strategy.md)

## P1 App Server 协议详细设计

状态：已完成。

目标：

- 写出 `docs/architecture/app-server-protocol-design.md`。
- 明确第一版协议只做本地 stdio，不做 daemon。
- 明确 JSON-RPC 消息结构。
- 明确 initialize 前置握手。
- 明确 request / response / notification 格式。
- 明确错误码和错误体。
- 明确 schema 生成策略。

第一版必须覆盖的方法：

- `initialize`
- `shutdown`
- `config/get`
- `config/update`
- `auth/status`
- `auth/login/start`
- `model/list`
- `mcp/list`
- `workspace/open`

第一版只设计、暂缓实现的方法：

- `thread/start`
- `thread/resume`
- `thread/list`
- `turn/start`
- `turn/interrupt`
- `permission/respond`

第一版通知事件先设计占位：

- `server/log`
- `workspace/opened`
- `auth/statusChanged`
- `config/changed`

完成标准：

- 协议文档能指导 P2 开始实现。
- 每个方法都有 params / result / error 边界。
- 明确哪些字段不能泄露 token。
- 明确 Desktop / VS Code 只通过协议接入，不直接读内部文件。

交付：

- [CCR App Server 协议详细设计](../architecture/app-server-protocol-design.md)

## P2 最小 stdio JSON-RPC 运行骨架

状态：已完成。

目标：

- 新增 `src/app-server/` 基础目录。
- 实现 stdio transport。
- 实现 JSON 行读取、解析、响应写出。
- 实现 request id 回传。
- 实现 unknown method 错误。
- 实现 initialize gate：未 initialize 前只允许 `initialize` 和 `shutdown`。

建议文件：

```text
src/app-server/
  index.ts
  protocol.ts
  errors.ts
  stdioTransport.ts
  router.ts
```

完成标准：

- 已新增 `src/app-server/` 基础目录。
- 已实现 `protocol.ts`、`errors.ts`、`router.ts`、`stdioTransport.ts`、`index.ts`。
- 已覆盖 `initialize`、`shutdown`、`parse_error`、`invalid_request`、`not_initialized`、`already_initialized`、`method_not_found`。
- 已通过直接调用 `handleProtocolLine()` 验证 malformed JSON、未初始化门禁、initialize、unknown method、重复 initialize、shutdown。
- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。

## P3 CLI 入口接入 `ccr app-server --listen stdio`

状态：已完成。

目标：

- 在 `src/entrypoints/cli.tsx` 增加 fast path。
- 支持命令：

```text
ccr app-server --listen stdio
```

暂不支持：

```text
ccr app-server --listen ws://127.0.0.1:port
ccr app-server --daemon
```

完成标准：

- `node .\cli.js app-server --listen stdio` 可以启动。
- `--version` fast path 不受影响，已验证仍返回 `CCR v0.2`。
- 普通 TUI / CLI 不走 app-server fast path。
- 已验证未 initialize 调用业务方法返回 `not_initialized`。
- 已验证 initialize 返回 `coreVersion`、`protocolVersion`、`ccrHome`、`platform`、`capabilities`。
- 已验证 unknown method 返回 `method_not_found`。
- 已验证 `shutdown` 能返回 `{ "accepted": true }` 并退出。
- 已验证非 stdio listen mode 会返回明确错误并退出码为 1。

## P4 第一批只读能力 handler

状态：已完成。

目标：

先做不会触发模型调用、不会执行工具、不会改 workspace 的只读或低风险能力。

第一批 handler：

- `initialize`
- `shutdown`
- `config/get`
- `auth/status`
- `model/list`
- `mcp/list`
- `workspace/open`

`config/update` 和 `auth/login/start` 可以先设计，具体实现视风险分批。

完成标准：

- `config/get` 不返回 token / refresh token。
- `auth/status` 只返回登录状态、provider、脱敏账号信息。
- `model/list` 使用当前通用 LLM runtime 的真实 provider/model，并返回 `codex-oauth` 下的 `gpt-5.4` / `gpt-5.4-mini`。
- `mcp/list` 只读取本地 CCR MCP 配置，不主动连接 MCP server，并对 env/header/url 敏感字段脱敏。
- `workspace/open` 只完成 workspace/trust 状态初始化，不执行模型调用、不执行项目脚本。
- P4 初次 smoke 暴露了 app-server fast path 缺少 `enableConfigs()` 的问题，已按 bridge/daemon fast path 口径在 `app-server` 分支内补齐。

## P5 App Server smoke 验证链路

状态：已完成。

目标：

新增自动化 smoke，防止 app-server 后续被改坏。

建议脚本：

```text
scripts/smoke-app-server-initialize.mjs
scripts/smoke-app-server-config.mjs
scripts/smoke-app-server-auth-status.mjs
scripts/smoke-app-server-workspace.mjs
```

验证点：

- 未 initialize 前调用 `config/get` 返回 `not_initialized`。
- initialize 成功返回 `coreVersion`、`protocolVersion`、`ccrHome`、`platform`。
- malformed JSON 不崩溃。
- `auth/status` 不泄露凭据。
- shutdown 后进程退出码正确。

完成标准：

- 新增 `scripts/smoke-app-server.mjs`。
- 新增 npm 脚本 `smoke:app-server`。
- `ci:smoke` 已纳入 `smoke:app-server`。
- smoke 使用临时 `CCR_CONFIG_DIR`，不依赖真实登录态。
- smoke 覆盖 `parse_error`、`not_initialized`、`initialize`、`config/get`、`auth/status`、`model/list`、`mcp/list`、`workspace/open`、`shutdown`、`unsupported_transport`。
- smoke 检查响应体不泄露常见 secret key。
- `npm.cmd run smoke:app-server` 通过。

## P6 Thread / Turn / Item 会话 API 设计

状态：已完成。

目标：

在第一批只读能力稳定后，设计真实会话 API。

需要明确：

- `Thread` 如何对应现有 session。
- `Turn` 如何对应一次用户输入和模型/工具执行。
- `Item` 如何承载 assistant delta、tool call、tool result、permission request。
- 会话是否持久化。
- ephemeral thread 如何表示。
- Desktop / VS Code 如何恢复历史。

完成标准：

- 新增 [CCR App Server 会话 API 设计](../architecture/app-server-session-api-design.md)。
- 文档明确 `thread/start`、`thread/list`、`thread/resume`、`turn/start`、`turn/interrupt`、`permission/respond` 的边界。
- 文档明确 `turn/started`、`item/started`、`item/delta`、`item/completed`、`turn/completed`、`turn/failed`、`permission/requested` 通知。
- 明确现有 `QueryEngine` / `query.ts` / `StructuredIO` 的复用边界。
- 明确第一版只允许单 workspace、单 active thread、单 active turn。
- 明确 P7 先做纯文本 turn，P8 再做权限闭环，后续再接 QueryEngine adapter。

## P6.5 CCR Core 统一能力接口边界补强

状态：已完成。

目标：

- 明确 CCR 只能有一套 Core 能力接口。
- 明确 CLI / TUI / App Server / Desktop / VS Code 都只是入口层。
- 明确配置、认证、模型、MCP、workspace、session、permission、tool execution 都必须统一走 Core API。
- 修正 P7 的实现方向：App Server 不能把 `AppServerSessionManager` / `textOnlyTurnRunner` 做成第二套业务运行时。

完成标准：

- 已新增 [CCR Core 统一对外接口边界](../architecture/ccr-core-interface-boundary.md)。
- 已更新 App Server 协议文档，明确 App Server 只是 JSON-RPC 到 Core API 的适配层。
- 已更新 App Server 会话 API 文档，明确 P7 要先收敛 Core session / turn service 边界。
- 当前 todo 指针已切回 P7，P7 的实现必须以 Core API 为唯一业务入口。

## P7 Turn 执行与事件流最小闭环

状态：已完成。

目标：

- 实现 `thread/start`。
- 实现 `turn/start`。
- 将最小模型输出转成 `item/delta` 和 `turn/completed`。
- 先支持纯文本 prompt，不强行做复杂工具流。

完成标准：

- Desktop/测试客户端可以通过 app-server 发起一轮 prompt。
- 能收到流式输出或最终输出。
- turn 失败时返回结构化错误。
- 不破坏 CLI / TUI 原有路径。

当前进展：

- 已新增内存 session manager，支持单 workspace、单 active thread、单 active turn。
- 已实现 `thread/start`、`thread/list`、`turn/start`、`turn/interrupt`。
- 已实现 App Server notification 输出。
- 已实现 text-only turn runner。
- 已在无登录态临时 `CCR_CONFIG_DIR` 下验证 `turn/start` 会返回 turn，并异步发出 `turn/started`、`turn/failed`。
- 用户已指出当前方向的更高优先级问题：不仅模型调用，所有操作都必须统一到同一套 CCR Core 对外接口，不能 CLI/TUI/App Server 各自实现一套。
- 已新增 `src/core/` 最小 Core API 门面，把 `config / auth / model / mcp / workspace / session / turn` 第一批能力收敛到 Core service。
- 已将 App Server handler 改为通过 `context.core.*` 调用 Core 能力，App Server 只保留 JSON-RPC 参数校验、response/notification 映射。
- 已删除 App Server 私有 `sessionManager` / `textOnlyTurnRunner`，改为 `CoreSessionService` / `runTextOnlyCoreTurn`。
- `runTextOnlyCoreTurn` 已改为复用 CLI/TUI 内置分支使用的 `queryWithLlmRuntime` 适配入口，不再直接调用低层 `LlmRuntime.stream`。
- 已验证 `npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:app-server` 均通过。
- 已排查真实 Codex OAuth `turn/start` 初次失败原因：Node/Undici 默认连接超时偏短，本机访问 `chatgpt.com` TLS 建连约 11 秒，默认 10 秒会触发 `UND_ERR_CONNECT_TIMEOUT`。
- 已在统一网络工具 `src/utils/proxy.ts` 中扩展 `configureGlobalFetchDispatcher()`，默认设置 Undici `connectTimeout = 30000`，并保留 proxy/mTLS 分支；`CodexOAuthProvider` 请求前复用该统一入口。
- 已完成真实 Codex OAuth `turn/start` 验证：App Server 能收到 `turn/started`、`item/delta`、`item/completed`、`turn/completed`。
- 已用英文算术 prompt 验证用户输入映射有效，返回 `4`；说明 P7 纯文本输入、模型调用和事件流闭环成立。
- 已验证 `npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:app-server` 均通过。

## P8 权限请求与客户端响应闭环

状态：已完成。

目标：

- 把工具权限请求转成 `permission/requested` 通知。
- 客户端通过 `permission/respond` 回传 allow / deny。
- 支持 interrupt / cancel。
- 复用原有 `hasPermissionsToUseTool(...)`、`SDKControlPermissionRequestSchema`、`PermissionPromptToolResultSchema` 等权限链路，不重写权限系统。

完成标准：

- 工具调用不会因为来自 app-server 而绕过权限。
- 未收到权限响应时 turn 保持等待。
- 用户 deny 后模型收到可解释的拒绝结果。
- 重复响应、过期响应有明确错误。

当前校准结论：

- 原代码已有完整权限体系，App Server 不能重写权限大脑。
- P8 第一刀应先实现薄 adapter：把原 SDK `can_use_tool` 语义映射成 App Server 的 `permission/requested` 和 `permission/respond`。
- Core permission adapter 与 App Server `permission/respond` 第一刀已实现，已验证 pending/respond/重复响应/缺失 request/cancel。
- Core session 第二刀已改为调用 `runCoreQueryTurn`，通过现有 `query()` 主链生成工具 schema、处理模型 tool_use、调用 `StreamingToolExecutor` / `runTools` 并复用 adapter 提供的 `canUseTool`。
- 已完成真实 Codex OAuth 工具流验证：
- Allow 场景：临时 workspace 内让模型调用 `Write` 创建 `ccr_tool_permission_test.txt`，App Server 发出 `permission/requested`，客户端回 `permission/respond allow`，工具成功创建文件，最终 `turn/completed`。
- Deny 场景：临时 workspace 内让模型请求文件工具权限，客户端回 `permission/respond deny`，工具返回拒绝结果，目标文件未创建，最终 `turn/completed`，模型能解释“写入被拒绝”。
- 已发现并修复真实接入顺序 bug：`queryModel()` 在判断内置 LLM runtime 前先执行 Claude AI 订阅判断，导致 Codex OAuth App Server turn 被 Anthropic 凭据检查误拦；现在 Anthropic 专属 off-switch 检查只在非内置 runtime 下执行。
- 详细方案见 [CCR App Server 权限复用设计](../architecture/app-server-permission-reuse-design.md)。

## P9 Desktop 原型接入准备

状态：已完成。

目标：

- 为 Electron Desktop 准备 app-server client SDK。
- 明确 main process 如何 spawn app-server。
- 明确 preload 暴露哪些安全 API。
- 明确 renderer 只通过 IPC，不直接访问 Node / token / 文件系统。
- 以 [CCR 客户端产品与交互设计](../architecture/desktop-client-product-design.md) 作为页面、状态、权限弹窗和协议需求来源。

完成标准：

- 有 [CCR App Server Client SDK 设计](../architecture/app-server-client-sdk-design.md)。
- 有 `desktop -> app-server` 的最小 client 示例。
- 能显示 `initialize`、`config/get`、`auth/status`。
- 能打开 workspace。
- 能展示 server log。

当前进展：

- 已明确 P9 第一刀不直接做完整 Desktop UI，而是先做 `src/app-server/client/`。
- 已明确 `JsonRpcClient`、`StdioAppServerClient`、`AppServerProcess` 三个核心模块边界。
- 已明确 Desktop main process / preload / renderer 的安全分层。
- 已明确第一刀 smoke 范围：spawn、initialize、只读能力、workspace、thread/turn auth failure、notification、shutdown。
- 已新增 `src/app-server/client/`，包含 JSON Lines RPC client、stdio App Server client、App Server 子进程管理和统一错误类型。
- 已新增 `scripts/smoke-app-server-client.mjs` 和 `smoke:app-server-client`，并纳入 `ci:smoke`。
- 已验证 SDK 可完成 spawn、initialize、config/get、auth/status、model/list、mcp/list、workspace/open、thread/start、thread/list、turn/start auth failure、notification subscription、shutdown。

## P10 Desktop App 最小原型

状态：已完成。

目标：

- 新建 Desktop App 最小工程骨架。
- 采用当前已选定的 Electron + React + TypeScript 方向。
- Desktop main process 复用 `src/app-server/client/`，不直接调用 Core 内部模块。
- preload 只暴露安全白名单 API。
- renderer 先实现启动页、主聊天页骨架、状态入口和最小输入框。
- 第一版先跑通本地 App Server 启动、initialize、workspace/open、thread/start、turn/start 和 notification 展示。

完成标准：

- 有 `apps/desktop/` 或等价 Desktop 工程目录。
- Desktop main process 可以启动内置 App Server。
- renderer 能展示 `状态正常 / 需要登录 / 启动失败`。
- 能选择或显示当前 workspace。
- 能发起一轮文本 turn，并在无登录态下展示可解释失败。
- 能订阅并展示 App Server notification。
- 权限请求第一版可以先只展示占位卡，但不能绕过 Core 权限系统。
- 不实现 VS Code 插件，不实现 websocket / daemon，不做完整自动更新。

当前进展：

- 已新增 `apps/desktop/` 最小 Electron + React + TypeScript 工程。
- 已新增 Desktop main process，复用 `src/app-server/client/` 启动和连接本地 App Server。
- 已新增 preload 白名单 API，renderer 不直接接触 Node、token、文件系统或 Core 内部模块。
- 已新增 React renderer，展示工作区、模型、认证、App Server 状态、事件流、输入框和基础操作按钮。
- 已新增 `desktop:dev`、`desktop:build`、`typecheck:desktop`。
- 已将 Desktop typecheck 和 Desktop build 纳入 `ci:smoke`。
- 已验证 `typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`ci:smoke` 通过。
- Desktop 可见窗口启动和本机交互验证转入 P11，不在 P10 内继续展开。

## P11 Desktop 打包、启动与本机验证

状态：已完成。

目标：

- 让 Desktop App 在本机以开发模式稳定启动。
- 明确 Desktop 打包后的 Core / App Server 路径。
- 明确 Desktop 启动时如何选择 bundled runtime，而不是误用用户全局 npm `ccr`。
- 明确日志、崩溃、App Server stderr 的展示和保存位置。
- 为后续安装包和自动更新做准备。

完成标准：

- 有 Desktop 本机启动命令。
- 有 Desktop App Server 启动日志。
- 有开发模式 smoke 或手动验证清单。
- Desktop 关闭时 App Server 子进程能正常退出。
- 本机验证不影响用户当前 CLI/TUI 使用。
- 记录还未做的打包、签名、自动更新风险。

当前进展：

- 已验证 `desktop:build` 可以成功构建 main / preload / renderer。
- 已验证 `desktop:dev` 可以启动 Electron 开发模式。
- 已确认 Electron 主进程启动后会拉起 `node cli.js app-server --listen stdio` 子进程。
- 已通过窗口关闭信号验证 Electron 退出后，App Server 子进程也会退出。
- 已清理 `electron-vite dev` 后台父进程，确认没有残留 Desktop / App Server 进程。
- 当前仍未做安装包、签名、自动更新和正式发布，这些进入 P14。

## P12 Desktop 会话、权限与错误交互增强

状态：已完成。

目标：

- 把当前“事件流展示”升级成更接近真实聊天体验。
- 将 `item/delta` 转成 assistant 消息，而不是只展示原始 JSON。
- 将 `turn/failed`、`turn/completed`、`permission/requested` 显示为明确卡片。
- 权限请求卡支持 `允许一次 / 拒绝`，并调用 `permission/respond`。
- 不绕过 Core 权限判断，不在 renderer 自己推导安全风险。

完成标准：

- 用户输入一条 prompt 后，聊天区能展示 turn 状态变化。
- 文本 delta 能汇总到 assistant 消息。
- 无登录态或模型错误能显示为用户可理解错误卡。
- 权限请求能在主聊天流里展示，至少支持 allow / deny。
- renderer 仍只通过 preload 调用白名单 API。

当前进展：

- 已把 `item/delta` 汇总为 assistant 消息，不再只展示原始 JSON。
- 已把 `turn/failed` 显示为错误卡，把 `permission/requested` 显示为权限请求卡。
- 权限请求卡已支持 `允许一次 / 拒绝`，并通过 preload 调用 `permission/respond`。
- 已保留 renderer 安全边界：renderer 不直接访问 Node、token、文件系统或 Core 内部模块。

## P13 Desktop 设置、MCP 与日志页面

状态：已完成。

目标：

- 补基础设置页。
- 补 MCP 管理页第一版，至少展示 `mcp/list`。
- 补日志页，展示 Desktop main / App Server stderr / notification 摘要。
- 模型与认证设置先以只读展示为主，后续再补 `config/update`、`auth/login/start`。

完成标准：

- 侧栏 `MCP / 设置 / 日志` 至少可以切换到真实页面，不再是占位按钮。
- MCP 页能展示当前 MCP 配置和错误。
- 日志页能看到 App Server 启动日志、最近错误和 notification。
- 设置页能展示 provider、model、auth status、context window。

当前进展：

- 侧栏已支持 `聊天 / MCP / 设置 / 日志` 页面切换。
- MCP 页已通过 App Server Client SDK 调用 `mcp/list` 并展示配置 JSON。
- 设置页已展示 workspace、provider、model、auth status、context window 和 Core 状态。
- 日志页已展示 notification/event 摘要，便于观察 App Server 事件流。

## P14 Desktop 安装包与升级准备

状态：已完成。

目标：

- 明确 Desktop 安装包方案。
- 明确 Electron 打包工具、安装产物、图标、应用名和用户数据目录。
- 明确 Desktop 打包后如何选择 bundled runtime，而不是误用用户全局 npm `ccr`。
- 明确签名、自动更新、回滚和日志位置的后续方案。

完成标准：

- 有 Desktop 打包方案文档。
- 有第一版 package / build 命令设计。
- 有运行时路径选择规则。
- 有升级与回滚风险清单。
- 有打包态 App Server smoke 验证入口。

当前进展：

- 已引入 `electron-builder@26.8.1`，采用成熟 Electron 打包链路，不手写安装器。
- 已新增 `desktop:pack`、`desktop:dist` 和 `scripts/desktop-package.mjs`，脚本不依赖 PowerShell `&&`。
- 已新增 [CCR Desktop 打包与升级准备方案](../architecture/desktop-packaging-and-upgrade-plan.md)。
- 已将 Desktop main process 区分开发态 / 打包态 runtime：开发态使用仓库 `cli.js`，打包态使用 `process.execPath + ELECTRON_RUN_AS_NODE=1` 启动内置 `cli.js app-server --listen stdio`。
- 已配置 `asarUnpack` 包含 `cli.js`、`dist/`、`vendor/`、`node_modules/`，保证打包态 App Server 子进程能解析运行时依赖。
- 已新增 `smoke:desktop-packaged`，验证未安装目录里的 `CCR Desktop.exe` 能启动内置 App Server 并完成 `initialize / shutdown`。
- 已验证 `npm.cmd run desktop:pack`、`npm.cmd run smoke:desktop-packaged`、`npm.cmd run ci:smoke` 均通过。
- 当前本机未签名包临时关闭 Windows `signAndEditExecutable`，避免普通 Windows 权限下解压 `winCodeSign` 时创建符号链接失败；正式发布前需要恢复签名链路。

## P15 Desktop 日志落盘与错误可观测

状态：已完成。

目标：

- 补 Desktop main process 日志落盘。
- 补 App Server stderr / client-error 日志落盘。
- 补 renderer 日志页读取最近摘要的安全入口。
- 错误信息要能区分 App Server 启动失败、协议失败、模型失败、权限失败、打包态 runtime 缺失。
- 日志不能泄露 token / refresh token / API key。

完成标准：

- 日志写入 Electron `userData/logs/`。
- App Server stderr 能落盘并在日志页展示摘要。
- renderer 只能通过 preload 白名单读取最近日志摘要，不能直接读文件。
- 日志写入路径和脱敏规则写入文档。
- Desktop 启动失败时 UI 能给出可解释错误和日志入口。

当前进展：

- 已新增 [CCR Desktop 日志与错误可观测方案](../architecture/desktop-logging-observability.md)。
- Desktop main process 已写入 `userData/logs/main.log`。
- App Server SDK 已支持 `onStderr(...)`，Desktop main 可把 App Server stderr 写入 `app-server.stderr.log`。
- App Server Client error 已写入 `client-error.log`。
- renderer 日志页新增 `getLogs` 白名单入口，只展示最近日志摘要，不直接读文件系统。
- 写日志前已经过 `redactLogText()` 脱敏，避免记录 token / refresh token / API key / authorization。
- 已用打包后的 Desktop 验证日志目录：`C:\Users\luoji\AppData\Roaming\CCR Desktop\logs`。
- 已验证 `typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`desktop:pack`、`smoke:desktop-packaged`、`ci:smoke` 均通过。

## P16 Desktop 图标、安装器与更新通道准备

状态：已完成。

目标：

- 补应用图标、产品名、安装器基本品牌。
- 明确 Windows 未签名包、正式签名包和发布包的差异。
- 明确 `electron-builder` release artifact 命名。
- 为后续 `electron-updater` 预留更新通道和状态机，但不第一版静默更新。

完成标准：

- 有应用图标占位或正式图标方案。
- `desktop:dist` 的安装器配置明确。
- 签名缺失时不伪装成正式发布。
- 更新通道 `stable / beta / nightly` 的配置边界写入文档。
- 记录正式发布前必须补齐的签名、hash、release note、自动更新 metadata。

当前进展：

- 已新增占位图标源文件：`apps/desktop/assets/ccr-desktop-icon.svg`。
- 已新增 [CCR Desktop 安装器与发布准备方案](../architecture/desktop-installer-release-readiness.md)。
- 已明确当前包是未签名本机验证包，正式发布前必须补代码签名、hash、release note、更新元数据。
- 已明确更新通道 `stable / beta / nightly`，当前实际只使用 `stable`。
- 已验证 `npm.cmd run desktop:dist` 可以生成 Windows NSIS 安装器、blockmap 和 `latest.yml`。
- 已验证 `npm.cmd run smoke:desktop-packaged` 仍能通过打包态内置 App Server。

## P17 版本、协议兼容与回滚加固

状态：已完成。

目标：

- App Server 返回 `coreVersion`、`protocolVersion`、`serverVersion`。
- Desktop / VS Code 根据 protocol 做兼容判断。
- 配置带 schema version。
- 更新和回滚不破坏 session / token / mcp 配置。

完成标准：

- 协议兼容规则写入文档。
- smoke 覆盖版本字段。
- 旧客户端遇到新增字段可忽略。
- 服务端遇到未知 capability 不假装支持。

当前进展：

- 已新增 [CCR App Server 版本、协议兼容与回滚规则](../architecture/app-server-version-compatibility.md)。
- `initialize` 已返回 `serverVersion`、`protocolVersion`、`schemaVersions.config`，同时保留 `serverInfo.version` 兼容旧客户端。
- Desktop main process 已在 `initialize` 后做协议兼容判断，当前只接受 `protocolVersion = 0.1`。
- Desktop 设置页已展示 App Server version / protocol / config schema / compatibility，不让 renderer 自己推导兼容结论。
- `smoke:app-server` 已覆盖普通 App Server 版本字段。
- `smoke:desktop-packaged` 已覆盖打包态 App Server 的 `serverVersion`、`protocolVersion`、`configSchemaVersion`。
- 已验证 `npm.cmd run desktop:pack`、`npm.cmd run smoke:desktop-packaged`、`npm.cmd run ci:smoke` 均通过。

## P18 Desktop 输出能力基线、事件协议与前端模块化补齐

状态：已完成。

目标：

- 盘点当前 Core / App Server / Desktop 已经能表达和展示的输出类型。
- 把输出能力从“能跑通”整理成稳定的事件协议和展示矩阵。
- 明确哪些内容来自模型原生输出，哪些内容来自 CCR 运行时事件。
- 避免 Desktop 针对 Codex OAuth 写死特例，后续要能承接其他模型 provider。
- 不重写 LLM provider，不重复实现 Core runner，只补统一事件契约和展示边界。
- 明确 Desktop 前端组件化和模块化拆分边界，避免继续在 `main.tsx` 中堆叠事件处理、内容格式化和 UI 渲染。

当前已知能力：

- 文本输出：普通回答、解释、代码和 Markdown。
- 思考/推理输出：`thinking` / `reasoning` / `redacted_thinking` 这类内容已经进入内容块和 Desktop 渲染链路。
- 工具事件：`tool_use`、`tool_result`、`progress`、`tool_use_summary` 已有基础事件。
- 附件事件：`attachment` 已有初步内容块类型，但产品展示还不完整。
- 权限事件：权限请求、允许、拒绝、取消已经能通过 App Server notification 进入 Desktop。

需要补齐：

- 输出类型支持矩阵：模型原生输出、Core 归一化内容块、App Server notification、Desktop 展示组件四列对齐。
- 事件命名和字段不变式：每类事件至少明确 `type`、`id`、`turnId`、`itemId`、`status`、`metadata`、`raw` 的边界。
- 大内容处理规则：截断、折叠、复制、保存、日志脱敏。
- 回归样例：至少覆盖文本、思考、工具调用、工具结果、权限请求、附件占位。
- 前端模块化拆分方案：展示事件归一化层、聊天组件、工具卡片、权限卡片、TodoWrite 浮层和样式模块的落位说明。

参考文档：

- [CCR Desktop 输出展示与前端模块化方案](../architecture/desktop-output-display-and-modularization.md)

### P18-FE 前端专项拆分任务列表

本专项用于把 Desktop renderer 从“单文件功能原型”推进到“可持续产品前端”。它不替代 P19-P24，而是给后续所有展示能力提供组件和状态边界。

总体方向：

```text
Electron Main / preload 保持本机能力桥接
Renderer 只做 UI、事件展示、用户交互
App Server / Core 继续承担业务能力和运行时状态
```

目标目录形态：

```text
apps/desktop/src/renderer/src/
  app/
    App.tsx
    appState.ts
    notificationRouter.ts
  components/
    layout/
      DesktopShell.tsx
      Sidebar.tsx
      Topbar.tsx
      Composer.tsx
    chat/
      ChatTimeline.tsx
      UserMessage.tsx
      AssistantMessage.tsx
      ThinkingSummaryCard.tsx
      ToolCard.tsx
      PermissionRequestCard.tsx
      ErrorCard.tsx
    todo/
      TodoOverlay.tsx
      TodoListItem.tsx
    pages/
      ChatPage.tsx
      McpPage.tsx
      SettingsPage.tsx
      LogsPage.tsx
  domain/
    displayTypes.ts
    displayEvents.ts
    contentBlocks.tsx
    permissions.ts
    todoEvents.ts
    updateState.ts
  services/
    desktopClient.ts
    notificationSubscription.ts
  styles/
    tokens.css
    layout.css
    chat.css
    cards.css
    todo-overlay.css
```

前端拆分阶段：

- [x] FE0 现状体检和方向确认
  - 目标：确认 renderer 当前仍以 `main.tsx` + `styles.css` 为主，状态、事件处理、内容格式化和 UI 混在一起。
  - 输入：`apps/desktop/src/renderer/src/main.tsx`、`styles.css`、Desktop 产品设计文档、Codex TUI 展示方式对照。
  - 输出：确认后续走“协议驱动 + 事件归一化 + 组件化时间线 + 轻量设计系统”。
  - 验收：形成 P18-FE 拆分清单，且不改变当前业务行为。
- [x] FE1 第一刀：纯类型、内容块格式化和基础聊天组件拆分
  - 目标：降低 `main.tsx` 体积，把无副作用逻辑先抽出去。
  - 已完成文件：`domain/displayTypes.ts`、`domain/contentBlocks.tsx`、`components/chat/MessageContent.tsx`、`PermissionRequestCard.tsx`、`ThinkingIndicator.tsx`。
  - 保持不变：App Server notification 处理、权限响应、turn 状态、真实业务调用。
  - 验收：`typecheck:desktop`、`desktop:build` 通过。
- [x] FE2 壳层与页面结构拆分
  - 目标：把 `main.tsx` 中的外壳和页面拆开，让 `App` 只负责组合状态和路由。
  - 计划文件：`components/layout/DesktopShell.tsx`、`Sidebar.tsx`、`Topbar.tsx`、`Composer.tsx`。
  - 页面文件：`components/pages/ChatPage.tsx`、`McpPage.tsx`、`SettingsPage.tsx`、`LogsPage.tsx`。
  - 验收：页面切换、发送消息、选择工作区、刷新 MCP、查看日志功能保持不变；`main.tsx` 不再直接承载大段 JSX。
- [x] FE3 状态分域和 reducer 化
  - 目标：把当前 `App()` 内的多组 `useState` 拆成状态域，避免每个事件都直接散落调用多个 `setState`。
  - 状态域：运行状态、会话状态、工具状态、权限状态、UI 状态、日志状态。
  - 第一版实现：优先用 `useReducer` 和纯 reducer，不急着引入第三方状态库；本轮先完成会话 / 权限 / 当前 turn 状态域，运行状态、日志状态和 UI 页签继续保留轻量 `useState`。
  - 验收：`turn/started`、`item/delta`、`item/completed`、`permission/requested`、`turn/completed` 都通过 reducer 更新状态。
- [x] FE4 App Server notification 路由层
  - 目标：把 `notification.method` 分发从 React 组件中移出，形成 `notificationRouter.ts`。
  - 输入：`CcrDesktopEvent`、当前 `DesktopStatus`、当前会话状态。
  - 输出：状态变更动作或 `DisplayEvent`，不直接返回 JSX。
  - 验收：新增 notification 时只改路由层和展示映射，不需要在 `App.tsx` 里继续堆 `if (notification.method === ...)`。
- [x] FE5 用户可见 DisplayEvent 归一化层
  - 目标：建立 `domain/displayEvents.ts`，把 Core item、tool block、App Server notification 统一转成前端展示模型。
  - 第一版类型：`assistant_message`、`thinking_summary`、`tool_call`、`tool_result`、`permission_request`、`todo_list`、`file_change`、`error`、`system_notice`。
  - 不变式：raw notification 默认不进主聊天流；空 thinking 不建卡；同一 assistant item 合并成一条消息。
  - 验收：聊天组件只接收 `DisplayEvent` 或由它派生的 view model，不直接解析 notification 原始结构。
- [x] FE6 ChatTimeline 与消息卡片体系
  - 目标：把主聊天区从普通 `messages.map(...)` 升级成稳定时间线组件。
  - 计划组件：`ChatTimeline`、`UserMessage`、`AssistantMessage`、`ThinkingSummaryCard`、`ToolCard`、`PermissionRequestCard`、`ErrorCard`。
  - 展示规则：正文是正文，工具是工具，权限是权限，错误是错误；不同内容不再混在同一种 message card 中。
  - 验收：一轮包含正文、思考、工具、权限、错误时，每类内容都有清晰卡片和状态。
- [x] FE7 TodoWrite 任务浮层
  - 目标：参考 Codex，把 TodoWrite 从主聊天 raw JSON 中移出，做成角落可折叠任务列表浮层。
  - 计划文件：`components/todo/TodoOverlay.tsx`、`TodoListItem.tsx`、`domain/todoEvents.ts`。
  - 展示内容：工具名、完成进度、已完成/进行中/待处理任务、当前进行中说明、查看原始 JSON。
  - 验收：TodoWrite 不再把大段 JSON 和英文成功提示堆进主聊天区；任务状态可折叠、可恢复查看。
- [x] FE8 thinking 展示策略治理
  - 目标：默认隐藏 raw thinking，避免英文思考和空白思考卡破坏体验。
  - 第一版策略：只在收到非空思考摘要时创建卡片；raw thinking 进入详情或日志；空 `thinking_start -> thinking_end` 过滤。
  - 需要对照：Codex 的 `ReasoningSummaryTextDelta` 与 `ReasoningTextDelta` 分离策略。
  - 验收：中文任务中不再默认展示大段英文 raw thinking；空白“思考”卡不再出现。
- [x] FE9 工具卡片体系产品化
  - 目标：为 Bash、Read、Write、MCP、Browser 等工具建立统一工具卡片。
  - 卡片字段：工具名、状态、参数摘要、工作目录、风险等级、耗时、结果摘要、详情展开。
  - 状态：等待权限、运行中、成功、失败、已拒绝、已取消。
  - 验收：工具调用不再用 raw JSON 黑盒展示；长 stdout / result 默认折叠。第一版已覆盖 `tool_use / tool_result / progress` 的结构化快照；风险等级、工作目录、耗时等字段待 FE11 协议字段回补。
- [x] FE10 设计系统和样式模块化
  - 目标：把单个 `styles.css` 拆成轻量设计系统和页面样式模块。
  - 第一版样式文件：`tokens.css`、`layout.css`、`chat.css`、`cards.css`、`todo-overlay.css`。
  - 设计变量：颜色、间距、圆角、阴影、字体、卡片密度、状态色。
  - 验收：新增卡片不再随意写孤立样式；浅色主工作台风格保持统一。已完成样式模块拆分，`styles.css` 只保留页面补充样式和导入入口。
- [x] FE11 App Server 字段缺口回补
  - 目标：前端不猜业务字段，缺字段时回补 App Server event contract。
  - 重点字段：`turnId`、`itemId`、`contentIndex`、`toolCallId`、`status`、`risk`、`durationMs`、`usage`、`requestId`、`raw`。
  - 边界：Desktop 只做展示，不重新判断权限、不执行工具、不拼 provider 请求。
  - 验收：P19-P24 所需展示字段有明确来源；缺字段被记录为协议任务，而不是前端硬解析字符串。已补 `item/completed` 的 `threadId/turnId`，并新增 renderer `eventContract` 归一化层和字段契约文档。
- [x] FE12 前端 fixture 和 smoke 样例
  - 目标：建立固定事件样例，避免每次验证 UI 都依赖真实模型输出。
  - 样例：纯文本流、Markdown、thinking 摘要、空 thinking、TodoWrite、Bash 权限、工具成功、工具失败、长 JSON、文件卡、错误卡。
  - 可选实现：先用纯函数单测覆盖 `displayEvents` 和 `contentBlocks`，再补 renderer 级 smoke。
  - 验收：TodoWrite、thinking、工具卡、权限卡的回归可以稳定复现。已新增 fixture JSON、typed fixture 入口和 `smoke:desktop-display-events`。
- [x] FE13 体验增强和长期方向
  - 目标：在展示链路稳定后再补产品体验，不抢在基础架构前面。
  - 候选能力：侧栏折叠和宽度持久化、状态详情弹层、会话下拉、历史会话、文件区、diff 预览、上下文文件管理。
  - 验收：这些能力只作为 UI 壳增强，不引入第二套业务运行时。已新增体验增强路线文档，明确先补低风险 UI 壳，再等 P21/P22/P23 字段补齐后做文件、结构化输出和多模态。

优先级顺序：

1. 先做 FE2 / FE3 / FE4，把 `main.tsx` 从页面和事件分发里解放出来。
2. 再做 FE5 / FE6，形成 Codex 式用户可见事件和聊天时间线。
3. 然后做 FE7 / FE8 / FE9，集中解决 TodoWrite、thinking、工具卡三个当前最影响体验的问题。
4. 最后做 FE10 / FE11 / FE12 / FE13，补样式系统、协议字段、fixture 和长期体验。

当前进展：

- 已修复 Codex OAuth 文本流被拆成多个 assistant item 的问题：同一 `contentIndex` 的连续 `text_delta` 现在会归并到同一个 `content_block_start -> content_block_delta* -> content_block_stop`。
- 已给 App Server 模型调用追加中文跟随指令：当用户输入包含中文时，要求可见说明、思考摘要、工具调用说明、工具结果解释和最终回答优先使用中文。
- 已在 Desktop 展示层把工具结果标题改成中文成功/失败状态，并对 TodoWrite 的常见英文成功提示做本地化展示。
- 已在 `smoke:llm-claude-adapter` 中增加文本流聚合回归断言，防止再次出现“一个字一张卡片”。
- 已完成 Desktop 前端组件化第一刀：新增 `domain/displayTypes.ts`、`domain/contentBlocks.tsx`、`components/chat/MessageContent.tsx`、`PermissionRequestCard.tsx`、`ThinkingIndicator.tsx`，先把纯类型、内容块格式化和聊天展示组件从 `main.tsx` 拆出，不改变 App Server 事件流和权限逻辑。
- 已完成 FE2 壳层与页面结构拆分：新增 `components/layout/Sidebar.tsx`、`Topbar.tsx`、`Composer.tsx`、`WindowTitlebar.tsx`，以及 `components/pages/ChatPage.tsx`、`McpPage.tsx`、`SettingsPage.tsx`、`LogsPage.tsx`；同时新增 `domain/updateDisplay.ts` 承载更新展示文案和顶栏更新动作映射。`main.tsx` 只保留顶层状态、App Server 事件处理和业务回调，页面 JSX 已基本移出。
- 已完成 FE3 状态分域第一版：新增 `app/sessionState.ts`，把聊天消息、权限请求卡和当前 turn 状态收敛到纯 `sessionReducer`；`turn/started`、`item/delta`、`item/completed`、`permission/requested`、`turn/completed` 等事件现在通过 reducer 更新会话状态。`main.tsx` 继续保留 App Server notification 分发，下一步进入 FE4 路由层拆分。
- 已完成 FE4 notification 路由层：新增 `app/notificationRouter.ts`，把 `turn/started`、`item/started`、`item/delta`、`item/completed`、`turn/completed`、`turn/failed`、`permission/requested`、`permission/cancelled` 等分发从 `main.tsx` 移出；`main.tsx` 只保存 item metadata、事件列表和状态刷新，并按路由结果 dispatch 会话动作。
- 已完成 FE5 DisplayEvent 归一化第一版：新增 `domain/displayEvents.ts`，会话状态内部从 `ChatMessage[]` 切为 `DisplayEvent[]`，再通过 `selectChatMessages(...)` 派生当前聊天 view model；用户输入、错误、系统提示、assistant 文本、thinking 和工具结果已统一落到展示事件模型。空 thinking delta 已在 reducer 层过滤，不再创建空白思考卡。
- 已完成 FE6 ChatTimeline 与基础消息卡拆分：新增 `components/chat/ChatTimeline.tsx`、`MessageFrame.tsx`、`UserMessage.tsx`、`AssistantMessage.tsx`、`ThinkingSummaryCard.tsx`、`ToolCard.tsx`、`ErrorCard.tsx`、`SystemNoticeCard.tsx`。`ChatPage` 只组合时间线和输入框，不再直接 `messages.map(...)`。
- 已完成 FE7 TodoWrite 任务浮层第一版：新增 `domain/todoEvents.ts`、`components/todo/TodoOverlay.tsx`、`TodoListItem.tsx`。`DisplayEvent` 能识别 `TodoWrite` 的 `todos` 输入并生成 `todo_list` 事件；主聊天区过滤 `todo_list`，右下角浮层展示任务进度、当前进行中说明和原始 JSON 折叠详情。
- 已完成 FE8 thinking 展示策略治理第一版：对照 Codex 口径，确认其 `ReasoningSummaryTextDelta` 默认展示、`ReasoningTextDelta` 仅在 `show_raw_agent_reasoning` 开启时展示。CCR 现在默认不把 raw `thinking` delta 放进主聊天区，只保留 `thinking_summary / reasoning_summary / summary_text` 入口；completed item 中仅包含 raw thinking / redacted thinking 的内容也不再生成聊天卡。
- 已完成 FE9 工具卡片体系第一版：新增 `domain/toolEvents.ts`，`DisplayEvent` 能识别 `tool_use / tool_result / progress` 并生成 `toolSnapshot`；`ChatTimeline` 改为直接消费 `DisplayEvent`，`ToolCard` 展示工具名、状态、摘要和可折叠详情，避免普通工具继续以 raw JSON 黑盒铺在聊天区。
- 已完成 FE10 设计系统和样式模块化：`styles.css` 已拆出 `tokens.css`、`layout.css`、`chat.css`、`cards.css`、`todo-overlay.css`，后续新增卡片优先进入对应样式模块。
- 已完成 FE11 App Server 字段缺口回补第一版：`item/completed` notification 已补 `threadId/turnId`，renderer 新增 `eventContract.ts` 统一抽取 `itemId/threadId/turnId/contentIndex/toolUseId/raw/missingFields`，工具快照和 TodoWrite 快照都保留字段来源。
- 已完成 FE12 前端 fixture 和 smoke 样例：新增 `domain/fixtures/display-events.json`、`displayEventFixtures.ts` 和 `smoke:desktop-display-events`，覆盖用户消息、assistant、thinking、工具调用、工具结果、TodoWrite、错误和权限 fixture。
- 已完成 FE13 体验增强和长期方向：新增 [CCR Desktop 与 App Server 事件字段契约](../architecture/desktop-app-server-event-contract.md) 和 [CCR Desktop 体验增强路线](../architecture/desktop-experience-roadmap.md)，明确体验增强只走 App Server/Core 统一链路，不另写运行时。

遗留问题：

- 文本流拆卡问题待回归确认：历史上出现过“我 / 先 / 看 / 一下”这种一个片段一张卡的现象；第 26 轮已按 `contentIndex` 合并连续 `text_delta`，用户本轮复测未再复现。下一轮应继续用固定 prompt 多测几次，并对照 Codex 的真实流式渲染/聚合实现，重点检查 App Server notification 的 `itemId` 稳定性、`contentIndex` 来源、`content_block_start/stop` 生命周期，以及 Desktop 是否把同一 turn 的多个 assistant item 错当成独立消息。
- 思考内容仍然偏英文：当前只是通过中文系统指令约束模型，可见 thinking 仍可能来自模型原生英文推理流。下一轮需要评估产品策略：是否展示原始 thinking、是否只展示中文摘要、是否默认折叠或隐藏英文 thinking。
- 存在空白思考卡片：真实 Desktop 中出现只有“思考”标题但没有内容的卡片。下一轮应检查 `thinking_start -> thinking_end` 空内容、`redacted_thinking`、空白 delta 和 final completed item 的处理；建议改为收到第一段非空 thinking delta 后再创建卡片，或者完成时过滤空 thinking item。

完成标准：

- 有输出能力矩阵文档或补入现有设计文档。
- App Server event contract 对 P19-P24 有可执行依据。
- Desktop 不再靠零散字符串判断核心输出类型。
- Desktop 前端有明确的组件化拆分路径，不再继续把新增展示能力堆进单个 `main.tsx`。
- smoke 或 fixture 能稳定验证输出事件基本结构。

## P19 控制信息面板与运行元数据展示

状态：已完成。

目标：

- 在 Desktop 中补一组轻量运行元数据展示，不做大卡片，不破坏聊天主界面清爽感。
- 展示 provider、model、上下文窗口、已用上下文、token usage、stop reason、request id、耗时、错误码等控制信息。
- 控制信息优先折叠在当前 Turn 或顶部状态区域，不抢占主聊天内容。

需要补齐：

- App Server 在 turn 级事件里透出 usage、stop reason、request id、latency、model、provider。已完成。
- Desktop 顶部或 Turn 详情入口展示 `上下文 20K / 200K`、模型和连接状态。已完成。
- Turn 完成后可展开查看本轮消耗、停止原因、请求 ID 和耗时。已完成。
- 控制信息不得泄露 token、refresh token、Authorization header 或完整敏感请求体。已通过字段来源表约束。

交付：

- [CCR Desktop 运行元数据字段来源表](../architecture/desktop-runtime-metadata-field-map.md)
- [CCR Desktop 与 App Server 事件字段契约](../architecture/desktop-app-server-event-contract.md)

完成标准：

- 普通用户能看到“本轮是否完成、用了多少上下文、为什么停止”。
- 排查问题时能复制 request id / turn id / provider / model。
- 元数据缺失时 UI 显示“未知”，不能崩溃。

### P19 子任务拆分

执行顺序：

1. [x] P19-1 字段来源盘点与缺口表
   - 目标：把 Desktop 想展示的控制信息逐项映射到真实来源，避免前端靠猜。
   - 字段范围：`provider`、`model`、`contextWindow`、已用上下文、`usage`、`stopReason`、`requestId`、`latencyMs`、`threadId`、`turnId`、错误码。
   - 代码关注点：`src/core/*Runner.ts`、`src/app-server/coreEventMapper.ts`、`apps/desktop/src/renderer/src/domain/eventContract.ts`。
   - 产出：字段来源表，标出已有、缺失、需要 Core 回补、只适合日志的字段。
   - 验收：每个 UI 字段都有来源、兜底值和脱敏规则。
2. [x] P19-2 App Server Turn 元数据协议补齐
   - 目标：在 `turn/started`、`turn/completed`、`turn/failed` 等事件中补稳定元数据。
   - 重点字段：`provider`、`model`、`usage`、`stopReason`、`requestId`、`latencyMs`、`contextWindow`、`errorKind`。
   - 边界：App Server 只透出展示所需摘要，不透出 token、完整请求体、Authorization header。
   - 验收：协议文档和类型能说明“哪些字段可缺失，缺失时 UI 如何显示未知”。
3. [x] P19-3 Core Runner 元数据采集
   - 目标：让真实模型调用链能产出 P19-2 所需元数据，而不是 Desktop 自己推导。
   - 关注点：模型 provider 返回的 usage / stop reason / request id，Core 内部 turn 起止时间，异常分类。
   - 第一版：先记录能稳定拿到的字段；拿不到的字段显式 `undefined`，不伪造。
   - 验收：一轮成功 turn 和一轮失败 turn 都能带出基本元数据。
4. [x] P19-4 Desktop 运行元数据状态模型
   - 目标：在 renderer 里建立轻量 `TurnMetadata` / `RunMetadata` 状态，不把控制信息混进普通聊天正文。
   - 关注点：active turn、last turn、每轮 request id、usage、stop reason、latency。
   - 边界：状态模型只展示，不执行权限、不影响 Core。
   - 验收：元数据可以随事件更新，turn 结束后仍能查看最后一轮摘要。
5. [x] P19-5 顶部轻量状态条
   - 目标：保留当前干净主界面，只在顶部展示必要摘要。
   - 展示建议：`模型`、`上下文 20K / 200K`、`provider/auth`、`App Server 状态`、当前 turn 简短状态。
   - 边界：不做大卡片，不挤占聊天内容，不把 request id 直接堆在顶部。
   - 验收：普通用户一眼能知道“现在用哪个模型、上下文大概用了多少、连接是否正常”。
6. [x] P19-6 Turn 详情入口
   - 目标：为排查提供折叠详情，不污染主聊天流。
   - 展示内容：`turnId`、`requestId`、`provider`、`model`、usage 明细、stop reason、耗时、错误码。
   - 交互：点击顶部状态或 turn 摘要展开；支持复制 request id / turn id。
   - 验收：需要排查问题时能复制关键诊断字段，但默认界面保持清爽。
7. [x] P19-7 脱敏与未知值兜底
   - 目标：控制信息展示不泄露凭据，缺字段不崩溃。
   - 脱敏范围：token、refresh token、API key、Authorization header、完整 provider 请求体。
   - 兜底文案：未知、未上报、当前 provider 不支持、仅日志可见。
   - 验收：fixture 覆盖字段缺失、错误 turn、敏感字段混入三类情况。
8. [x] P19-8 Fixture / Smoke / 文档收口
   - 目标：把 P19 元数据展示变成可回归能力。
   - 测试样例：成功 turn、失败 turn、缺 usage、缺 request id、限流错误、模型拒绝。
   - 文档：更新事件字段契约和当前 todo 记录。
   - 验收：`typecheck:desktop`、`desktop:build`、相关 smoke 通过。

## P20 工具事件卡片产品化

状态：已完成。

目标：

- 把工具调用从原始 JSON 输出升级成可折叠、可读、可操作的工具事件卡片。
- 支持命令、文件读写、MCP 工具、浏览器工具等不同类别的统一展示。
- 权限请求卡片和对应工具调用卡片要能关联起来。

需要补齐：

- 工具卡片状态：等待权限、运行中、成功、失败、已拒绝、已取消。
- 工具卡片内容：工具名、描述、参数摘要、工作目录、风险等级、耗时、结果摘要。
- 工具结果展示：短结果直接展示，长结果折叠，结构化结果走 P22。
- 工具结果合并：工具执行成功 / 失败 / 被拒绝 / 已取消不再另起一条独立“工具结果”消息，而是回写到原工具调用卡片右下角状态区域。
- 运行中动效：工具还在执行时，原工具调用卡片右下角显示轻量动态转圈或脉冲状态，同时展示已持续时间；完成后替换为成功 / 失败 / 被拒绝 / 已取消角标。
- 详情展开规则：工具 stdout、stderr、结构化 result、错误详情等都收敛到原工具卡片的“查看详情”区域；主聊天流只保留一张工具生命周期卡，避免成功结果把聊天区刷屏。
- 权限请求结束后，权限卡片必须消失或转为历史摘要，不能永久卡在聊天区。
- 中断按钮只在 active turn 存在时可用；turn 已结束后不能再触发 `turn/interrupt`。
- TodoWrite 不应作为普通 raw JSON 卡片铺在聊天区；应参考 Codex 做成角落浮层/弹窗任务列表。
- 跨平台工具选择：Windows 下优先使用 PowerShell / CMD / Node 原生文件能力 / 高层文件工具，不强求 `ls`、`bash`、`zsh` 这类 Unix 环境。
- Shell fallback：Git Bash / Bash 只能作为兼容 fallback，不能作为 Windows 主路径；App Server 快路径即使补 Windows shell init，也只能解决兼容问题，不能替代平台感知工具策略。
- 工具能力暴露：Core / App Server 应根据 `platform`、可用 shell、可用 MCP 和内置文件工具，向模型和 Desktop 暴露真实可用能力，避免模型默认生成本机不存在的命令。
- 权限语义升级：后续权限卡片不应长期只围绕 `Bash(command)`，应逐步抽象到 `ShellExecute(shell, command, cwd)` 或更高层 `ListDirectory / ReadFile / WriteFile`，让权限策略能区分命令方言和工具类型。
- 工具卡片补充字段：展示 `shell/provider`、命令方言、工作目录、fallback 原因和失败分类；例如 `No suitable shell found` 应归为平台工具能力不匹配，而不是普通模型失败。
- 系统提示与工具说明：在工具调用前向模型注入当前平台和推荐命令风格；用户在 Windows 工作区时，优先推荐 PowerShell 或高层文件工具，不要默认用 `ls` 探测目录。

TodoWrite 浮层设计方向：

- 默认折叠在主界面角落，不影响聊天输入、滚动和权限操作。
- 展开后使用竖向任务列表，顶部展示 `调用工具：TodoWrite`、当前进度如 `1/3`、折叠按钮。
- 每个任务按状态展示图标：已完成 `✓`、进行中 `●`、待处理 `○`。
- 当前进行中任务下面展示一行子状态，例如 `正在：创建五子棋项目文件夹与页面文件`。
- 提供 `查看原始 JSON` 入口，调试时可展开 raw 参数，但默认不展示大段 JSON。
- TodoWrite 工具结果成功后，浮层更新状态并自动保留为可折叠历史摘要，不再在主聊天区额外显示英文成功提示。

参考视觉：

```text
┌──────────────────────────────────────────────┐
│  i  调用工具：TodoWrite              1/3     │
│                                              │
│  ✓  确认新文件夹的创建位置并检查目录结构      │
│  ●  创建五子棋项目文件夹与页面文件            │
│     └ 正在：创建五子棋项目文件夹与页面文件    │
│  ○  实现一个美观可玩的五子棋页面              │
│                                              │
│  查看原始 JSON                               │
└──────────────────────────────────────────────┘
```

完成标准：

- 用户能清楚看到模型“正在调用什么工具、为什么需要权限、结果是什么”。
- 工具事件不会把聊天区刷成一堆 raw JSON。
- 同一个工具调用从准备、权限、执行到完成只对应一张主工具卡；状态变化通过卡片右下角角标和展开详情表达。
- 允许、拒绝、失败、中断四种路径都能回归验证。
- TodoWrite 能以可折叠任务浮层展示，不再把 todo JSON 和英文结果直接堆进主聊天流。

### P20 子任务拆分

执行顺序：

1. [x] P20-1 工具事件身份与关联字段统一
   - 目标：建立工具事件关联不变式，所有工具生命周期都能靠稳定身份合并。
   - 关键字段：`toolUseId` / `tool_use_id`、`itemId`、`turnId`、`permissionRequestId`、`contentIndex`。
   - 关注点：`tool_use`、`tool_result`、`permission/requested`、`permission/respond`、`progress` 之间如何关联。
   - 已完成：Desktop renderer 继续以 `eventContract` 抽取 `toolUseId / tool_use_id`、`itemId`、`turnId`、`contentIndex`；工具结果合并只按 `toolUseId` 走，不靠标题字符串硬匹配。
   - 验收：没有 `toolUseId` 的工具事件会被记录为协议缺口，不靠标题字符串硬匹配。
2. [x] P20-2 工具生命周期卡第一刀
   - 目标：把“准备调用”和“工具执行成功/失败”合并成同一张工具卡。
   - 已完成：Desktop renderer 已按 `toolUseId` 合并 `tool_use` 与 `tool_result`；执行中右下角转圈，完成后右下角显示成功/失败角标。
   - 已补：权限等待、拒绝、取消、超时等状态已进入工具卡；单工具持续时间等待 Core 后续透出字段。
   - 验收：主聊天流不再出现独立“工具执行成功”刷屏卡。
3. [x] P20-3 工具状态机补齐
   - 目标：明确工具卡从准备到结束的状态转换。
   - 状态：准备调用、等待权限、执行中、成功、失败、已拒绝、已取消、超时。
   - UI 规则：状态永远在原卡片右下角展示；执行中显示动效和持续时间；结束后显示角标。
   - 已完成：工具卡第一版支持 `running`、`waiting_permission`、`completed`、`failed`、`denied`、`cancelled`、`timeout`，右下角统一显示本地化状态标签。
   - 验收：allow、deny、cancel、interrupt、tool error、timeout 都能进入正确状态。
4. [x] P20-4 权限请求与工具卡关联
   - 目标：权限卡不再像孤立消息，而是和对应工具卡形成一组交互。
   - 行为：权限等待时工具卡显示“等待权限”；用户允许后切执行中；拒绝后切已拒绝。
   - 展示：权限卡可以临时浮出操作，结束后消失或折成历史摘要。
   - 已完成：`permission/requested` 会携带 `toolUseId` 进入 Desktop `PermissionCard`，并把关联工具卡切到“等待权限”；允许后回到执行中，拒绝后切到已拒绝。
   - 验收：权限请求结束后不永久卡在聊天区。
5. [x] P20-5 工具分类与摘要归一化
   - 目标：不同工具不要都用 raw JSON 露出，而是有可读摘要。
   - 分类：Shell / Bash / PowerShell、Read、Write、Edit、TodoWrite、AskUserQuestion、MCP、Browser、Search。
   - 摘要：工具名、动作、目标路径或 URL、工作目录、风险等级、参数摘要。
   - 已完成：新增 `ToolCategory`，覆盖命令、文件、MCP、浏览器、搜索、控制和未知工具；常见工具会展示动作、目标、命令、工作目录、shell/provider 和风险字段。
   - 验收：常见工具默认折叠详情，但主卡一眼能看懂正在做什么。
6. [x] P20-6 控制型工具隐藏与专用展示第一刀
   - 目标：控制型工具不进入普通工具消息流。
   - 已完成：`AskUserQuestion` 标记为主时间线隐藏；它的结果合并回隐藏事件，不再重复显示；TodoWrite 使用角落浮层，不作为普通工具卡刷屏。
   - 已补：`AskUserQuestion` 与 `TodoWrite` 已进入控制型工具口径；后续新增控制型工具时继续沿用该分类。
   - 返修：`ToolSearch(select:TodoWrite)` 这类控制型前置选择也归入隐藏口径；TodoWrite 的低信息成功结果不再落入主聊天流，只更新浮层。
   - 验收：用户只看到真正需要操作或理解的内容，不看到内部控制噪音。
7. [x] P20-7 工具结果详情视图
   - 目标：stdout、stderr、结构化 result、错误详情都进入原工具卡详情区。
   - 展示规则：短结果摘要展示，长结果默认折叠，超长结果截断并提供复制 / 保存入口。
   - 与 P22 边界：JSON / schema / 表格类结果第一版先代码块，正式结构化视图交给 P22。
   - 已完成：输入、结果和错误详情都收敛到原工具卡的“查看详情”；工具结果不再另起独立工具结果消息。
   - 验收：工具结果可读、不刷屏、可复制。
8. [x] P20-8 跨平台工具选择与 Shell 策略
   - 目标：Windows 下不强求 `ls/bash/zsh`，优先 PowerShell / CMD / Node 原生文件能力 / 高层文件工具。
   - 机制：Core / App Server 根据平台和可用能力向模型注入推荐工具语义；工具卡展示 shell/provider、命令方言、fallback 原因。
   - 权限：从 `Bash(command)` 逐步抽象到 `ShellExecute(shell, command, cwd)` 或高层文件工具。
   - 已完成：Core App Server system prompt 会在 Windows 环境注入平台工具提示，要求优先高层文件工具、PowerShell/CMD 语义和 `.cmd` 入口；Desktop 工具卡会展示 shell/provider 并识别 POSIX shell 不可用。
   - 返修：Windows App Server 默认启用已有 `PowerShellTool`，并过滤不可用的 `Bash`；目录查看使用 `Get-ChildItem`，文件搜索/读取仍优先使用 `Glob`、`Grep`、`Read`。
   - 返修：当前 App Server 没有加载内置/自定义 agent definitions 时，不再向模型暴露 `AgentTool`，避免简单目录查看被错误转成不可用子代理任务。
   - 边界：这轮不重写完整工具池，`Bash(command)` 到 `ShellExecute(shell, command, cwd)` 的抽象升级保留为后续 Core 工具体系演进。
   - 验收：Windows 本地目录探测不再默认生成不可用 `ls`。
9. [x] P20-9 工具错误分类与可行动提示
   - 目标：工具失败不是只显示原始错误，而是能解释下一步。
   - 分类：权限拒绝、命令不存在、shell 不可用、路径不存在、MCP 离线、浏览器不可用、超时、未知错误。
   - 行为：可恢复错误给出重试/切换工具/查看详情；不可恢复错误进入 P24 错误治理。
   - 已完成：Desktop 侧识别 `shell_unavailable`、`command_not_found`、`path_not_found`、`permission_denied`、`mcp_unavailable`、`browser_unavailable`、`timeout`、`unknown_failure`，并展示可行动提示。
   - 验收：`No suitable shell found` 这类问题能显示为平台工具能力不匹配。
10. [x] P20-10 Fixture / Smoke / 文档收口
    - 目标：让工具卡行为可回归。
    - 样例：工具成功、工具失败、权限 allow、权限 deny、AskUserQuestion 隐藏、TodoWrite 浮层、长 stdout、MCP 错误、Windows shell 不可用。
    - 验证：`typecheck:desktop`、`desktop:build`、display-event smoke、必要时补 app-server 工具流 smoke。
    - 已完成：新增 [CCR Desktop 工具事件卡片契约](../architecture/desktop-tool-event-card-contract.md)，更新事件字段契约、文档索引、fixture 和 `smoke:desktop-display-events`。
    - 验收：P20 的核心交互不再依赖手动真实模型复测才能发现回归。

## P21 文件、附件与引用系统

状态：已完成。

目标：

- 补文件卡片、附件卡片和引用系统，让 Desktop 能承接后续文件上传、文件生成、搜索引用和代码定位。
- 文件能力先服务本地工作区，不做云端文件同步。
- 建立“文件/附件/引用”统一展示模型，避免后续图片、截图、生成文件、代码位置各写一套 UI。

需要补齐：

- 文件卡片：文件名、相对路径、大小、类型、创建来源、打开、复制路径。
- 附件卡片：上传文件、生成文件、截图、图片、普通文本文件的预览入口。
- 引用系统：文件引用、代码行引用、搜索引用、网页引用或 MCP 引用。
- 安全边界：默认展示工作区相对路径；工作区外路径要有明确风险标识。
- 后续 App UI 文件区可以复用同一套引用和附件模型。

关键字段：

- `fileId`：Desktop 内部生成的稳定展示 ID。
- `path`：原始路径，可以是绝对路径、工作区相对路径或 URL。
- `workspaceRelativePath`：工作区内路径，用于安全展示和打开。
- `absolutePath`：本机绝对路径，只在可信路径下用于打开文件。
- `kind`：`generated_file`、`read_file`、`edited_file`、`attachment`、`reference`、`screenshot`。
- `mimeType` / `extension` / `sizeBytes`：用于判断预览方式。
- `source`：来源，例如 `Write`、`Edit`、`Read`、`Grep`、`MCP`、`Browser`、`UserUpload`。
- `range`：代码引用的行列范围。
- `safety`：`workspace`、`outside_workspace`、`remote`、`unknown`。
- `createdAt` / `updatedAt`：用于历史和排序。

完成标准：

- 模型生成文件后，Desktop 能展示文件卡片并支持打开或定位。
- 回答里引用文件位置时，可以点击或复制路径。
- 附件/引用不和普通文本消息混在一起。

### P21 子任务拆分

执行顺序：

1. [x] P21-1 文件事件与附件字段来源盘点
   - 目标：先确认 Core/App Server 当前能稳定提供哪些文件、附件、引用字段。
   - 具体动作：盘点 `Write`、`Edit`、`MultiEdit`、`Read`、`LS`、`Glob`、`Grep`、浏览器/MCP 工具结果和 assistant 文本里已有的文件字段。
   - 输出：字段来源表，区分“已有稳定字段”“只能从工具输入拿到”“只能从 stdout 猜到”“完全缺失”。
   - 验收：不从 stdout 里硬解析文件路径，缺字段先记为协议缺口。
   - 已完成：新增 [CCR Desktop 文件、附件与引用字段来源盘点](../architecture/desktop-file-attachment-reference-field-map.md)，确认当前稳定字段主要来自 `eventContract`、`ToolSnapshot`、`Read/Write/Edit/Glob/Grep` 的结构化 input/output；`PowerShell/Bash/MCP string result` 暂不作为文件卡主来源。
2. [x] P21-2 文件卡片 DisplayEvent 模型
   - 目标：定义文件卡片、附件卡片、引用卡片的展示事件模型。
   - 具体动作：新增 `FileSnapshot`、`AttachmentSnapshot`、`ReferenceSnapshot` 或同等结构，并接入 `DisplayEvent`。
   - 边界：只定义展示模型，不在 renderer 里执行文件读写，不绕过 preload 白名单。
   - 验收：模型能表达工作区相对路径、绝对路径、来源、类型和风险标识。
   - 本轮结论：已新增 `apps/desktop/src/renderer/src/domain/fileEvents.ts`，并把 `fileSnapshot`、`attachmentSnapshot`、`referenceSnapshot` 接入 `DisplayEvent`；fixture/smoke 已覆盖文件变更、文件引用和附件占位。
3. [x] P21-3 工具结果到文件事件归一化
   - 目标：把 `Write/Edit/Read/LS/Glob/Grep` 等工具输入/结果中稳定的路径信息转成文件/引用事件。
   - 具体动作：优先使用工具输入里的 `file_path/path/pattern`，其次使用 App Server 后续补的结构化字段；不从大段 stdout 正则硬猜。
   - 验收：写文件、读文件、搜索文件至少能在 fixture 中生成对应文件/引用快照。
   - 本轮结论：已新增工具快照到文件/引用快照的归一化函数，`Write/Read/Edit/MultiEdit/Glob/Grep` 会从稳定 input/result 字段生成 `fileSnapshot` 或 `referenceSnapshot`；fixture 覆盖 `Write` 文件快照和 `Grep` 引用快照。
4. [x] P21-4 Desktop 文件卡片组件
   - 目标：实现文件卡片 UI，支持打开、复制路径、定位工作区。
   - 具体动作：实现文件名、相对路径、来源、风险标签、打开按钮、复制按钮；工作区外路径显示警告，不默认打开。
   - 验收：生成文件、读取文件和引用路径不再只显示为普通文本。
   - 本轮结论：已新增 `FileCard` / `FileSnapshotPanel`，文件、引用、附件事件可独立展示，工具卡也能内嵌文件快照；打开、复制、定位按钮先做 UI 占位并禁用，真实系统调用进入 P21-7。
5. [x] P21-5 引用系统最小交互
   - 目标：支持文件引用、代码行引用、搜索引用的统一展示。
   - 具体动作：支持 `path:line[:column]` 复制、打开文件、复制引用文本；搜索引用显示命中摘要。
   - 验收：回答中的代码位置引用可以被用户定位，不再混在普通 Markdown 里。
   - 本轮结论：已在文件卡中展示 `path:line[:column]` 引用文本、搜索摘要和复制引用入口；真实复制/打开动作由 P21-7 的 preload 白名单接线。
6. [x] P21-6 附件与上传入口占位
   - 目标：支持文件上传入口占位、引用复制和图片/截图占位预览。
   - 具体动作：输入框 `+` 入口先支持选择文件的 UI 状态和附件列表模型；真实发送到模型可后续分批。
   - 验收：后续 P23 多模态预览可以复用同一套基础模型。
   - 本轮结论：输入框 `+` 已支持浏览器文件选择，展示附件名称、大小和类型；当前仍是附件占位，真实随消息发送、发送前预览、模型输入映射和输出媒体预览统一进入 P23。
7. [x] P21-7 安全边界与 preload 打开能力
   - 目标：打开文件、复制路径、定位工作区必须走 Desktop main/preload 白名单能力。
   - 具体动作：确认或新增 `openPath`、`showItemInFolder`、`copyText` 等安全入口；工作区外路径需要二次提示或禁用。
   - 验收：renderer 不直接访问 Node 文件系统，路径操作都有安全边界。
   - 本轮结论：已新增 `openPath`、`showItemInFolder`、`copyText` preload 白名单 API；路径解析和工作区外二次确认在 main process 执行，renderer 只发操作意图。
8. [x] P21-8 Fixture / Smoke / 文档收口
   - 目标：补文件卡片、引用卡片、工作区外路径风险的回归样例。
   - 样例：生成文件、读取文件、搜索引用、工作区外路径、远程 URL、上传附件占位。
   - 验收：`typecheck:desktop`、`desktop:build`、display-event smoke 通过。
   - 本轮结论：display-event fixture 已覆盖文件变更、文件引用、附件占位、工具内嵌文件快照、工具内嵌引用快照；文档已同步字段来源、模型、归一化和安全边界。

## P22 结构化输出与 JSON/Schema 视图

状态：已撤回，后续按具体场景重新设计。

撤回说明：

- 本轮 Desktop 真机反馈确认，全局结构化展示会把聊天主线、工具详情、运行详情和 MCP 页面变得过重。
- 已从 Desktop 代码中移除 `StructuredSnapshot`、`StructuredView`、`structured_output` 主展示链路和结构化 CSS。
- 以下目标、字段、来源矩阵和子任务为撤回前历史参考，不再代表当前待实现方案。
- 后续如果需要结构化展示，必须先明确：
  - 这个对象是否需要给普通用户看。
  - 应展示在主聊天、工具详情、运行详情、专门页面，还是开发者诊断入口。
  - 默认是否折叠、是否只展示摘要、是否允许复制 raw。
- 当前第一原则：主聊天保持 Codex 风格的简洁信息流；结构化能力以后按需、按卡片单独引入。

目标：

- 对 JSON、schema output、表格、状态对象、权限参数、运行状态等结构化内容提供专门视图。
- 第一版只做识别、展示、折叠、复制和安全脱敏，不做复杂编辑器，也不修改模型或工具原始输出。
- 让工具输入/结果、MCP 结果、模型结构化回答、App Server 运行对象、权限请求参数和错误详情都能用同一套结构化展示组件。
- 把“人类可读文本”和“机器可读对象”分开处理：可靠对象走结构化视图，不可靠文本只做 raw fallback，不强行猜。

需要补齐：

- 结构化来源盘点：确认哪些事件本身就是对象，哪些只是文本里看起来像 JSON。
- `StructuredSnapshot` 模型：定义结构化内容统一快照，并挂到 `DisplayEvent`、`ToolSnapshot`、运行详情或错误详情。
- 安全归一化：对象过大、循环引用、敏感字段、二进制内容、未知 schema 都要有保护。
- JSON tree：支持折叠、复制节点、复制完整 JSON。
- 表格视图：数组对象可以切换成表格展示。
- Schema 校验结果：展示字段错误、路径、期望类型、实际值摘要。
- 工具卡接入：工具 input/result 的 JSON 详情不要只显示黑色 raw code block。
- App Server 状态接入：`context/status`、`compact/status`、`memory/session/status`、MCP 列表、runtime metadata 等状态对象可读展示。
- 模型结构化输出接入：如果模型或工具返回 `structured_output`，优先结构化展示，同时保留原文 fallback。
- 复制策略：支持复制节点、复制当前视图、复制完整 JSON、复制安全诊断片段。
- 脱敏策略：token、cookie、refresh token、本机敏感路径、过长正文不直接铺到 UI。
- 大对象处理：默认折叠，避免一次性撑爆聊天区。
- 结构化内容仍保留 raw text fallback，避免 provider 输出不规范时丢内容。

边界：

- P22 只负责结构化内容展示，不负责文件上传、多模态发送、图片预览；这些归 P21/P23。
- P22 可以服务 P24 的错误详情，但不负责错误分类和用户恢复动作；这些归 P24。
- P22 不从普通 assistant 文本或命令 stdout 里强行正则猜 JSON；只有明确标记为对象、schema、状态或可靠 JSON 字符串时才结构化。
- P22 不把结构化对象重新送给模型；它只是 Desktop 展示层和诊断层能力。

关键字段：

- `structuredId`：结构化块 ID。
- `kind`：`json`、`table`、`schema_validation`、`state_object`、`tool_input`、`tool_result`、`mcp_result`、`permission_payload`、`runtime_status`、`model_structured_output`。
- `data`：结构化原始对象。
- `dataRef`：大对象或敏感对象的安全引用，避免 renderer 长期持有完整 raw。
- `schema`：可选 schema。
- `validationErrors`：schema 校验错误列表。
- `source`：来源工具、模型、MCP、App Server、权限请求或 runtime status。
- `sourceId`：关联 `toolUseId`、`requestId`、`turnId`、`itemId` 或 `permissionRequestId`。
- `path`：当前节点路径，例如 `$.items[0].name`。
- `viewMode`：`tree`、`table`、`schema_errors`、`raw`。
- `size`：节点数、字符数或字节数，用于折叠、截断和大对象保护。
- `redaction`：脱敏状态，例如 `none`、`partial`、`full`。
- `copyPolicy`：`copy_node`、`copy_safe_json`、`copy_raw_disabled`。
- `parseState`：`parsed`、`fallback_text`、`too_large`、`redacted`、`invalid_json`。
- `fallbackText`：无法结构化解析时的原始文本 fallback。

结构化来源矩阵：

| 来源 | 当前例子 | P22 处理策略 |
| --- | --- | --- |
| 工具输入 | `Write` / `Read` / `PowerShell` 的参数对象 | 作为 `tool_input`，默认折叠，显示关键字段 |
| 工具结果 | structured result、文件操作结果、命令进度对象 | 作为 `tool_result`，优先树视图，数组可切表格 |
| MCP 结果 | `mcp/list`、MCP resource metadata | 作为 `mcp_result`，资源列表可表格化 |
| App Server 状态 | `context/status`、`compact/status`、`memory/session/status` | 作为 `runtime_status`，默认摘要 + 展开详情 |
| 权限请求 | 工具权限参数、风险等级、工作目录 | 作为 `permission_payload`，敏感字段脱敏 |
| 模型结构化输出 | `structured_output` attachment 或 JSON schema output | 作为 `model_structured_output`，保留 raw fallback |
| 错误详情 | JSON-RPC error data、provider error details | P22 只提供结构化详情视图，分类和恢复动作归 P24 |
| 普通文本 | assistant Markdown、stdout 大段文本 | 默认不解析；除非明确标记为可靠 JSON |

完成标准：

- 工具结果或模型结构化输出可读性明显提升。
- JSON 不再只能以黑盒代码块方式展示。
- schema 校验失败时用户能定位到具体字段。
- MCP 列表、运行状态、权限参数这类对象可以在 Desktop 里折叠查看。
- 大对象默认折叠或截断，不会撑爆聊天区。
- 复制出来的诊断 JSON 默认经过安全脱敏。

### P22 子任务拆分

执行顺序：

1. [x] P22-1 结构化内容来源盘点
   - 目标：确认当前哪些事件会携带 JSON、数组、对象、schema 或状态对象。
   - 具体动作：盘点工具 input/result、MCP 结果、App Server 状态、运行元数据、权限请求参数、错误详情和模型结构化输出。
   - 验收：明确哪些内容是可靠对象，哪些只是文本里的 JSON 片段；形成来源矩阵。
   - 本轮结论：已新增 CCR Desktop 结构化输出来源盘点（撤回前历史文档已移除）。结论是工具输入/结果、权限请求、运行状态、MCP 列表、JSON-RPC 错误、schema 校验错误和原生 `structured_output` 都有可靠对象来源；assistant Markdown、stdout、普通字符串结果和文件正文不能默认结构化。
2. [x] P22-2 结构化协议与边界设计
   - 目标：确认 App Server / Desktop 是否需要新增结构化事件字段，还是先在 renderer 从现有对象派生。
   - 具体动作：盘点 `item/completed`、`toolSnapshot`、runtime status、permission payload 的字段；定义最小协议补丁。
   - 验收：P22 不重复发明第二套工具结果协议，只在需要的位置补结构化快照。
   - 本轮结论：已新增 CCR Desktop 结构化输出协议边界设计（撤回前历史文档已移除）。结论是第一版不新增 App Server notification 方法，先在 Desktop renderer 从 `params/content block/runtime status/permission payload` 派生 `StructuredSnapshot`；只有大对象引用、schema 校验元数据、provider 原生 structured result、多客户端共享等需求出现时再补 App Server contract。
3. [x] P22-3 StructuredSnapshot 展示模型
   - 目标：定义结构化内容统一快照，挂到 `DisplayEvent` 或工具卡详情里。
   - 具体动作：定义 `kind/data/dataRef/schema/validationErrors/source/sourceId/viewMode/size/redaction/copyPolicy/fallbackText`，并保留 raw 调试入口。
   - 验收：普通 JSON、数组对象、schema 错误都能用同一套模型表达。
   - 本轮结论：已新增 `apps/desktop/src/renderer/src/domain/structuredEvents.ts`，定义 `StructuredSnapshot`、来源、视图模式、解析状态、脱敏状态、复制策略、大小摘要和 schema 错误模型；`DisplayEvent` 与 `ToolSnapshot` 已挂可选 `structuredSnapshots`。同步新增 CCR Desktop StructuredSnapshot 展示模型（撤回前历史文档已移除）。
4. [x] P22-4 安全解析、脱敏与大对象保护
   - 目标：结构化展示不能引入泄密、卡死或错误解析。
   - 具体动作：限制节点数、字符串长度、总字节数；识别 secret/token/cookie；无效 JSON fallback；循环引用安全处理。
   - 验收：大对象不会撑爆 Desktop，复制内容默认不含常见敏感字段。
   - 本轮结论：`structuredEvents.ts` 已新增 `createStructuredSnapshot(...)`、`sanitizeStructuredValue(...)`、`parseStructuredJsonText(...)`，覆盖深度、节点数、字段数、数组长度、字符串长度、循环引用、不可序列化值、常见 token/cookie/secret/password/key 字段脱敏和默认 copy policy。同步新增 CCR Desktop 结构化输出安全归一化设计（撤回前历史文档已移除）。
5. [x] P22-5 JSON Tree 组件
   - 目标：实现可折叠 JSON 树。
   - 具体动作：支持对象/数组/基础类型显示、节点路径、折叠、复制节点、复制安全 JSON。
   - 验收：大 JSON 默认折叠，不撑爆聊天区。
   - 本轮结论：已新增 `components/structured/StructuredView.tsx` 和 `styles/structured.css`。第一版 `StructuredView` 支持结构化标题、摘要、状态 badge、来源/节点/脱敏 meta、安全 JSON 复制、fallback 文本；`StructuredJsonTree` 支持对象、数组、基础类型、默认折叠、节点路径和节点复制。
6. [x] P22-6 表格视图组件
   - 目标：数组对象可以切换为表格。
   - 具体动作：自动识别同构对象数组，提供列名、行数、复制 CSV/JSON 的最小能力。
   - 验收：MCP 列表、搜索结果、状态列表类对象可读性提升。
   - 本轮结论：`StructuredView` 已支持同构对象数组表格化，提供树/表格切换、列名、行列数摘要、单元格摘要、复制 CSV 和复制安全 JSON；表格只消费 `StructuredSnapshot.data`，不从普通文本推断结构。
7. [x] P22-7 Schema 校验结果视图
   - 目标：展示字段路径、期望类型、实际值、错误原因。
   - 具体动作：先消费已有校验错误结构；如果没有 schema，仅显示“未校验”。
   - 验收：用户能定位哪个字段错，而不是只看到一段异常。
   - 本轮结论：`StructuredView` 已支持 schema 视图，消费 `StructuredSnapshot.validationErrors`，展示路径、错误原因、期望、实际和错误代码；没有校验结果时显示未校验 fallback，不在 UI 层自行校验业务对象。
8. [x] P22-8 工具卡 input/result 接入结构化视图
   - 目标：工具输入和工具结果详情优先识别结构化对象，再 fallback 到代码块。
   - 具体动作：对 `toolSnapshot.input`、`toolSnapshot.result` 做安全识别；保留原始详情；工具主卡仍保持简洁。
   - 验收：工具卡里的 JSON 参数和结果不再全是黑盒 pre。
   - 本轮结论：`toolEvents.ts` 已为 `tool_use.input`、`tool_result.content`、`progress.data` 生成 `StructuredSnapshot`；`sessionState` 合并工具生命周期时会合并结构化快照；`ToolCard` 详情区优先渲染 `StructuredView`，只有缺少结构化快照时才回退到旧 raw `<pre>`。
9. [x] P22-9 App Server 运行状态与权限参数接入
   - 目标：把上下文、压缩、记忆、MCP、权限请求等状态对象接入结构化视图。
   - 具体动作：运行详情页、权限卡详情、MCP 页面使用同一套结构化组件展示对象详情。
   - 验收：`context/status`、`compact/status`、`memory/session/status` 和权限请求参数可以折叠查看。
   - 本轮结论：权限详情 `InteractionDetails`、运行详情 `TurnRuntimeDetails`、MCP 页面已统一生成 `StructuredSnapshot` 并复用 `StructuredView`；这些结构化详情不进入聊天流，只作为现有页面/卡片的安全详情视图。验证通过：`typecheck:desktop`、`git diff --check`。
10. [x] P22-10 模型结构化输出与 `structured_output` 接入
   - 目标：模型或工具返回结构化输出时，优先展示为结构化视图。
   - 具体动作：识别 `structured_output` attachment、JSON schema output、明确标记的模型 JSON；不强行解析普通 Markdown。
   - 验收：模型结构化回答可以树形或表格展示，原始文本仍可查看。
   - 本轮结论：Desktop display event 层已识别原生 `structured_output` attachment，并生成 `model_structured_output` 结构化快照；新增 `StructuredOutputCard` 渲染模型结构化输出，不解析普通 Markdown，也不改变 Core/TUI/CLI 语义。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`git diff --check`。
11. [x] P22-11 复制、raw fallback 与诊断体验
   - 目标：让用户能安全复制结构化诊断信息。
   - 具体动作：复制节点、复制当前视图、复制安全 JSON；raw 详情默认折叠；敏感 raw 禁止直接复制。
   - 验收：用户可以复制可用诊断，不泄露 token/cookie/refresh token。
   - 本轮结论：`StructuredView` 已把复制按钮明确为“复制安全 JSON”，节点复制仍只复制安全视图；脱敏、截断、fallback、invalid JSON、禁用 raw 复制会在“诊断与复制策略”中折叠说明；文本 fallback/raw 详情默认折叠，不再大面积铺屏。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`git diff --check`。
12. [x] P22-12 Fixture / Smoke / 文档收口
   - 目标：补 JSON tree、表格、schema 错误、大对象折叠、工具 input/result、runtime status、权限参数、模型结构化输出的回归样例。
   - 验收：`typecheck:desktop`、`desktop:build`、display-event smoke 通过。
   - 本轮结论：新增 CCR Desktop 结构化输出实现收口（撤回前历史文档已移除），并把文档入口加入 `docs/README.md`；display-event fixture 和 smoke 已覆盖 `structured_output` 模型结构化输出卡。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`。

## P23 多模态输入/输出、附件上传与预览

状态：已完成（第一版）。

2026-05-15 方向调整：

- P23 不再从“输入框上传按钮”开始，而是先做模型能力协商。
- 能力解析必须按 `profileId + model + apiMode` 判断，不只看裸模型名。
- 没有能力声明的模型默认只支持文本输入和文本输出。
- Desktop 可以展示附件草稿，但发送前必须明确 `可发送 / 仅预览 / 需转换 / 不支持`。
- Provider adapter 只处理已经通过能力校验的内容块，不在 adapter 内临时猜模型是否支持图片或文件。

目标：

- 把 P21 已有的附件选择占位推进成真实可发送的多模态输入能力。
- 统一处理用户上传、工具结果、MCP/browser 截图、模型输出里的图片、截图、文本文件、二进制文件、音频/视频占位。
- 同一套 `AttachmentSnapshot / MediaSnapshot / FileSnapshot` 同时服务发送前预览、发送后消息展示、工具输出展示和历史恢复。
- 第一版优先支持图片、截图、小文本文件和普通文件元信息；音频/视频先做卡片占位，不承诺完整播放器和编辑能力。
- 复用 P21 的文件/附件/引用基础模型和 preload 安全边界，不另起第二套媒体系统。

第一版需要补齐的范围：

- 发送前附件队列：输入框 `+` 选中的文件必须进入 renderer 状态、main/preload 安全读取、App Server `turn/start` 参数和 Core user message。
- 附件发送协议：扩展 `turn/start.input` 或新增附件引用字段，支持 `path`、`mimeType`、`sizeBytes`、`displayName`、`mediaType`、`contentRef`、`previewPolicy`。
- 预览和发送策略分离：每个附件都必须同时明确 `previewPolicy` 和 `sendPolicy`，不能因为前端能预览就默认传给模型。
- 图片输入：本地图片可生成缩略图并按模型能力转换成 image content block；不支持多模态的 provider 必须给清晰 fallback。
- 文本文件输入：小文本文件可作为文本附件进入上下文；大文本文件只传摘要/路径引用或要求用户确认。
- 普通/二进制文件输入：默认只传元信息和路径引用，不把大二进制 base64 塞进上下文。
- 发送后消息展示：用户消息里要展示已发送附件卡片，不再只展示纯文本。
- 模型/工具输出预览：图片、截图、文件、data URI、远程 URL、MCP 资源统一归一化到媒体卡片。
- 图片/截图预览：缩略图、点击放大、复制路径、打开文件、来源说明。
- 文本/二进制文件预览：小文本文件可展开预览，二进制文件只展示元信息；大文件保护必须默认开启。
- 音频/视频：先定义附件类型和占位渲染，后续按需要接播放器。
- 历史恢复：附件进入 turn history / transcript 后，resume 不能丢失附件元信息和预览状态。

关键字段：

- `mediaId`：媒体块 ID。
- `attachmentId`：用户上传或工具输出附件的稳定 ID。
- `mediaType`：`image`、`screenshot`、`audio`、`video`、`text_file`、`binary_file`、`unknown`。
- `uri` / `path`：本地路径、data URI 或远程 URL。
- `mimeType` / `sizeBytes` / `dimensions` / `durationMs`：预览决策字段。
- `thumbnail`：缩略图路径或 data URI。
- `source`：浏览器、MCP、工具、用户上传、模型生成。
- `direction`：`input`、`output`、`tool_result`、`model_generated`。
- `contentRef`：由 main/App Server 管理的附件内容引用，renderer 不直接持有大内容。
- `sendPolicy`：`inline`、`as_text`、`as_image`、`metadata_only`、`blocked`、`requires_confirmation`。
- `previewPolicy`：`inline`、`thumbnail`、`metadata_only`、`blocked`。
- `providerCapability`：当前模型是否支持 image/text/file 输入。
- `unsupportedReason`：不能发送给模型时的原因，例如模型不支持、文件过大、类型不安全、需要解析。
- `safety`：工作区内、工作区外、远程、未知。

完成标准：

- 用户在输入框选择图片后，发送时模型能收到图片或明确收到不支持多模态的 fallback，而不是只显示“附件暂不随消息发送”。
- 发送后的用户消息能展示附件卡片，历史恢复后附件元信息不丢。
- 图片和截图不再只显示成路径或 raw attachment。
- 小文本文件可以按安全策略进入上下文；大文件不会直接撑爆上下文或卡死 Desktop。
- 多模态附件和 P21 文件卡片使用同一套基础模型。
- 不支持的媒体类型、工作区外文件、大文件、provider 不支持多模态时都有清晰 fallback。

### P23 支持矩阵与后续计划

这一节用于防止“能预览”被误解成“能传给模型”。P23 的核心是不只做 UI，还要把每类文件的发送策略、预览策略、provider 能力和上下文预算一次性定清楚。

| 类型 | 预览策略 | 发送策略 | 阶段计划 |
| --- | --- | --- | --- |
| 图片 `png/jpg/jpeg/webp` | 缩略图、放大、复制路径、打开文件 | provider 支持视觉输入时转 image block；否则 fallback 为元信息和提示 | P23 第一版必须完成 |
| 截图 / browser 输出图片 | 缩略图、来源说明、放大查看 | 可作为 image block 发送，也可作为工具输出媒体展示 | P23 第一版必须完成 |
| 小文本文件 `txt/md/json/yaml/ts/js/py/java` 等 | 文本预览、截断、复制摘要 | 可作为 text attachment 进入上下文 | P23 第一版必须完成 |
| 大文本文件 | 只预览摘要、大小、路径和风险 | 默认 `requires_confirmation`，优先片段/摘要/引用，不全文内联 | P23 第一版做保护，增强放后续 |
| PDF | 文件卡、页数/大小占位，后续可抽文本或转图片 | 第一版不直接传原文件；后续按 provider file input 或本地解析接入 | P23 后续增强 |
| Word / Excel / PPT | 文件卡、元信息和打开入口 | 第一版只传元信息；后续接解析器转文本/表格/图片 | P23 后续增强 |
| 普通二进制 / 压缩包 | 元信息、风险提示、打开/定位 | 默认 `metadata_only` 或 `blocked`，不直接进上下文 | P23 第一版必须有保护 |
| 音频 | 文件卡、时长/大小占位 | 第一版不直接传；后续接转写或 provider 原生 audio input | P23 后续增强 |
| 视频 | 文件卡、时长/大小占位 | 第一版不直接传；后续抽帧、转写、关键帧摘要或 provider 原生 video input | P23 后续增强 |
| MCP resource / 远程 URL | 来源、mime、风险和复制入口 | 只在 adapter 标出稳定资源类型后再发送；未知资源默认元信息 | P23 与 MCP 专项联动 |

分阶段计划：

1. 第一阶段：图片/截图、小文本文件、普通文件元信息可用。目标是“用户能发图片和小文本，不能发的也说清楚原因”。
2. 第二阶段：PDF/Office/音频/视频接解析或转写能力。目标是“复杂文件先转成模型可理解的文本、图片帧或结构化摘要”。
3. 第三阶段：provider 原生 file/audio/video input 能力矩阵。目标是“不同模型支持什么就走什么，不支持就走 CCR 的解析 fallback”。
4. 长期阶段：MCP/browser/插件生成的资源统一接入媒体系统。目标是“上传附件、工具产物、浏览器截图、MCP 资源都走同一套 `MediaSnapshot` 和发送策略”。

### P23 子任务拆分

执行顺序：

1. [x] P23-1 模型能力声明、能力来源与能力解析器
   - 目标：先回答“当前模型到底支持什么输入/输出”。
   - 具体动作：定义 `LlmModelCapabilities`，接入内置能力目录、Profile 覆盖和默认能力；官方 provider 通过内置目录声明能力，第三方中转通过 Profile `capabilityOverrides` 声明能力；解析结果按 `profileId + model + apiMode` 输出。
   - 验收：当前模型能给出 `inputModalities`、`outputModalities`、tools、structured output、图片 limits 和能力来源；未知模型默认只支持文本。
   - 本轮结论：已新增 `src/services/llm/modelCapabilities.ts`、Profile `capabilityOverrides` 配置、`modelCapabilities` 状态输出和 `smoke:model-capabilities`；验证覆盖官方文本模型、官方图片输入模型、第三方中转文本覆盖、同名模型不同 Profile 和未知模型默认文本。
2. [x] P23-2 多模态内容块协议与发送前校验
   - 目标：先定义“怎么送给 Core/模型”，不要只停留在 UI 选择文件。
   - 具体动作：扩展 `turn/start` 输入结构，定义 `content` blocks 和 attachment params；发送前根据能力解析结果决定允许、转换、阻止或要求确认。
   - 验收：Desktop、App Server、Core 对附件字段有同一份 schema；不支持多模态时不会创建 turn，并返回稳定可展示原因。
   - 本轮结论：已完成 App Server `turn/start` 新内容块协议和发送前能力校验；当前 Core 仍接收文本 fallback，并通过 `turn.metadata.multimodalInput` 保留多模态输入摘要。Desktop UI、文件读取和 provider 图片映射留给后续 MM-03 之后继续推进。
3. [x] P23-3 Core user message 内容块归一化
   - 目标：Core 不再把用户输入固定理解成纯字符串。
   - 具体动作：新增 Core 内容块输入类型；App Server 已校验内容块进入 Core；当前 provider 请求继续使用文本 fallback。
   - 验收：Core 能保存 `text/image/file/audio` 内容块；纯文本 turn 不回归；非文本块不会绕过 adapter 直接发给 provider。
   - 本轮结论：`CoreTurn.input` 已支持 `content`，`smoke:turn-input` 已验证 App Server turn 返回内容块且 Core fake runner 收到内容块。图片真实发送、文件读取和 Desktop 草稿队列继续后移。
4. [x] P23-4 Desktop 附件草稿队列与能力提示
   - 目标：输入框里的附件从“占位标签”升级为可管理队列。
   - 具体动作：支持追加附件、删除附件、查看大小/类型，并根据当前模型能力显示 `可发送 / 可转换 / 仅预览 / 不支持`。
   - 验收：用户能看出附件当前是否会随消息发送；纯文本发送不回归。
   - 本轮结论：Composer 已维护附件草稿队列，模型切换后会按 `modelCapabilities` 重新计算状态；本阶段仍不读取文件内容、不生成缩略图、不把附件发送给模型。
5. [x] P23-5 图片输入最小闭环与 main/preload 安全读取
   - 目标：renderer 不直接读取本地图片，大内容不长期塞在 renderer 状态里，同时把可发送图片送入 `turn/start` 内容块。
   - 具体动作：由 main/preload 管理图片 metadata、缩略图、大小限制、内容读取和 contentRef；工作区外文件需要安全标识；支持 PNG/JPEG/WEBP/GIF 的最小 image block。
   - 验收：支持图片的 Profile 覆盖能通过 App Server 校验并创建 turn；不支持图片的模型在 App Server 阶段稳定拒绝；图片 base64 不进入普通日志。
   - 本轮结论：Desktop main/preload 已完成图片准备、缩略图和安全元数据返回；Composer 发送时会把图片转成 `turn/start.input.content` 的 image block。真实 provider 图片请求映射留给 P23-7 / MM-07。
6. [x] P23-6 文本文件与二进制文件输入策略
   - 目标：小文本文件可展开预览并可作为文本附件发送；二进制文件只展示元信息。
   - 具体动作：限制预览大小；超限显示“过大，已禁用内联预览”；小文本可按 `as_text` 进入上下文；大文本默认 `requires_confirmation`；二进制默认 `metadata_only` 或 `blocked`。
   - 验收：不会因为大文件卡死 Desktop，不会把大文件误塞进上下文；用户能知道文件是否真的随消息发送。
   - 本轮结论：小文本文件 128 KB 以内由 Desktop main 读取为 UTF-8，并在发送时作为 `text` block 进入 `turn/start.input.content`；大文本、二进制、压缩包和未知文件默认只保留元信息，不随消息发送。
7. [x] P23-7 Provider adapter 多模态映射
   - 目标：把 CCR 内容块转换成 provider 请求格式。
   - 具体动作：OpenAI Chat Completions / Compatible 图片映射、Anthropic Messages 图片 block 映射、内建 LLM Runtime 图片内容部件，以及 Codex OAuth 图片支持能力继续保持保守拦截。
   - 验收：OpenAI Chat / Compatible 和 Anthropic Messages 的图片请求体离线验证通过；不支持图片的 provider 不会收到图片请求；usage、错误和 stream 事件仍能归一化；真实外部 provider 图片请求留给 MM-09 真机验收。
   - 本轮结论：新增 `LlmImagePart` 与图片读取 helper；内建 LLM Runtime 能将 CCR `image` block 转为运行时图片部件。OpenAI Chat / Compatible 生成 `image_url` part，Anthropic Messages 生成 `image` block；本地图片 base64 只在 adapter 请求体中出现，错误 diagnostics 不输出 base64 或本地路径。新增 `smoke:multimodal-provider-mapping` 离线覆盖请求体映射和诊断脱敏。
8. [x] P23-8 用户消息附件展示、输出媒体归一化与历史恢复
   - 目标：发送后用户消息、工具结果、MCP/browser 截图和历史恢复都能展示附件与媒体，不只显示纯文本或 raw path。
   - 具体动作：把已发送附件转成 `DisplayEvent.attachmentSnapshots`；识别用户内容块和工具结果中的 `image/file/audio/attachment`；当前发送、历史回放和工具卡复用同一紧凑附件条。
   - 验收：历史消息、当前消息和恢复后的消息都能展示附件 metadata；图片和截图不再只是 raw path / raw attachment；附件展示不输出 base64。
   - 本轮结论：`MessageFrame`、`UserMessage` 和 `ToolCard` 已支持多附件快照展示；历史用户 `content` block 通过 completed item replay 恢复附件条；display-event fixture/smoke 覆盖用户消息多附件和浏览器工具输出媒体。文件缺失状态不在本轮读取本地文件，留给 MM-09 真机验收后按需补返修。
9. [x] P23-9 Fixture / Smoke / 文档收口
   - 目标：补图片输入、图片输出、截图、文本文件、大文件、未知二进制、provider 不支持多模态的回归样例。
   - 验收：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、display-event smoke 通过。
   - 本轮结论：已新增 `docs/goals/2026-05-16-p23-9-smoke-real-machine-doc-closeout.md`，自动验证与真机验收均已通过。用户已确认 `codex-oauth / gpt-5.5` 真实图片请求能让模型读取图片，文本模型发送图片会被拦截，小文本文件、图片粘贴、图片点开预览和历史恢复/中断返修均已复测通过。

## P24 错误分类、限流与拒答状态治理

状态：待开始。

目标：

- 把错误从普通红框升级成可行动的分类状态。
- 覆盖认证过期、限流、额度不足、模型拒答、安全拦截、工具错误、网络错误、协议错误。
- 把 Desktop、App Server、Core、provider、工具、MCP 的错误统一收敛成面向用户的错误模型。

需要补齐：

- 错误分类：`auth_expired`、`rate_limited`、`quota_exceeded`、`model_refusal`、`safety_blocked`、`tool_error`、`network_error`、`protocol_error`。
- 用户动作：重新登录、重试、切换模型、查看日志、复制诊断信息。
- 错误卡片：面向用户展示简短原因，详情折叠；原始错误只进日志或详情。
- 限流/额度：如果 provider 给出重试时间或额度信息，优先展示。
- 安全拦截：明确是模型拒绝、工具权限拒绝，还是 CCR 本地安全策略拦截。

关键字段：

- `errorId`：展示错误 ID。
- `category`：错误分类。
- `severity`：`info`、`warning`、`error`、`fatal`。
- `title` / `message`：面向用户的短文案。
- `source`：`desktop`、`app_server`、`core`、`provider`、`tool`、`mcp`、`network`。
- `retryable`：是否可重试。
- `recommendedActions`：可操作项，例如重新登录、重试、切模型、打开日志。
- `retryAfterMs`：限流重试时间。
- `requestId` / `turnId` / `toolUseId` / `permissionRequestId`：定位字段。
- `safeDetails`：脱敏后的诊断详情。
- `rawRef`：日志引用，不直接把敏感 raw 铺到 UI。

完成标准：

- 用户能知道“为什么失败”和“下一步能做什么”。
- 错误不会被误当成普通 assistant 文本。
- 日志中保留排查所需字段，但继续执行脱敏规则。

### P24 子任务拆分

执行顺序：

1. [ ] P24-1 错误来源与现有错误码盘点
   - 目标：盘点 Desktop client-error、App Server JSON-RPC error、CoreError、provider error、tool error、MCP error。
   - 具体动作：列出已有 error kind/code/message/requestId 字段，标出脱敏风险。
   - 验收：不靠字符串猜所有错误，已有结构化错误优先使用。
2. [ ] P24-2 ErrorSnapshot 展示模型
   - 目标：定义统一错误展示快照。
   - 具体动作：包含 `category/severity/source/retryable/actions/requestId/safeDetails/rawRef`。
   - 验收：不同来源错误都能归一到同一套卡片模型。
3. [ ] P24-3 错误分类映射器
   - 目标：把已知错误映射到稳定分类。
   - 具体动作：覆盖 auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown。
   - 验收：未知错误不会崩溃，至少进入 `unknown_error` 并提示查看日志。
4. [ ] P24-4 用户动作与恢复入口
   - 目标：错误卡片提供下一步动作。
   - 具体动作：重新登录、重试 turn、切换模型、打开日志、复制诊断信息；不支持的动作先显示禁用原因。
   - 验收：用户看到错误后知道能点什么，而不是只能截图。
5. [ ] P24-5 限流、额度和重试时间展示
   - 目标：把 provider 返回的 retry-after、quota、billing、rate limit 信息展示出来。
   - 具体动作：解析已知字段，显示剩余等待时间和建议。
   - 验收：限流错误不再只是普通红框。
6. [ ] P24-6 模型拒答与安全拦截区分
   - 目标：区分模型拒答、本地权限拒绝、本地安全策略、provider safety。
   - 具体动作：分别展示来源、原因和用户可做动作。
   - 验收：用户能看出是模型不回答、工具没权限，还是 CCR 本地拦截。
7. [ ] P24-7 日志脱敏与复制诊断
   - 目标：错误详情可排查但不泄露 token、refresh token、cookie、路径敏感片段。
   - 具体动作：复用现有日志脱敏规则，提供复制安全诊断包。
   - 验收：复制诊断不包含常见 secret key。
8. [ ] P24-8 Fixture / Smoke / 文档收口
   - 目标：补 auth、rate limit、tool error、network、protocol、safety、unknown 的回归样例。
   - 验收：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、App Server/Display event smoke 通过。

## P25 原生上下文链路恢复与短期记忆治理

状态：已完成。

背景：

- 真实 Desktop 复测中发现：模型有时无法记住前面刚刚说过的内容，例如用户刚刚纠正的目标、当前任务上下文、上一轮工具结果和下一步意图。
- Claude Code 原生链路本身已经有上下文治理能力，包括 `QueryEngine` 的 `mutableMessages`、`query()` 内的 compact / context collapse、memory attachments、sessionStorage / resume、readFileState 和工具结果回灌。
- 当前优先怀疑点不是“原生没有记忆”，而是 App Server / Desktop 新入口绕开或削弱了原生链路，例如每轮只传当前 `userMessage`，没有把 thread 历史作为 `Message[]` 传回 `query()`。
- 第一版目标不是新建一套独立记忆系统，而是先恢复和验证原生上下文链路；只有原生链路边界确实不够时，才补轻量摘要或可观测诊断。

目标：

- 让 App Server / Desktop 复用 Claude Code 原生 `QueryEngine` / `query()` 消息历史机制，而不是每个入口各自拼 prompt。
- 保证同一个 thread 的用户消息、assistant 消息、tool_use、tool_result、progress、attachment、compact boundary 能按原生 `Message[]` 形态持续进入下一轮。
- 保证原生 compact、context collapse、memory attachments、tool result budget、sessionStorage / resume 和 readFileState 能继续工作。
- 只把 `SessionContextSnapshot` 作为第二阶段诊断/补强能力，不替代原生消息历史。

需要补齐：

- 原生链路盘点：`QueryEngine.ts`、`query.ts`、`cli/print.ts`、`sessionStorage.ts`、`attachments.ts`、compact / context collapse。
- App Server 差异定位：确认 `CoreSessionService`、`runCoreQueryTurn` 是否只保存 turn 元数据而没有保存原生 `Message[]`。
- 原生消息历史恢复：为 Core thread 保存并传递完整 `Message[]` 历史，确保每轮调用 `query()` 时不是 `messages: [userMessage]`。
- 工具结果归档：确保 `tool_use`、`tool_result`、`progress`、`attachment` 都进入 thread history，而不是只变成 Desktop UI 卡片。
- 原生恢复能力验证：验证 sessionStorage / resume、compact boundary、tool result budget、readFileState 不因 App Server 入口失效。
- 可观测性：Desktop 或日志里能看到本轮传给 `query()` 的消息数量、最近消息类型、是否经过 compact，不暴露 token 或大段 raw。

关键字段：

- `threadMessages`：当前 thread 的原生 `Message[]` 历史。
- `messageCount`：本轮传入 `query()` 的消息数量。
- `lastMessageTypes`：最近若干条消息类型，例如 user / assistant / tool_result / progress。
- `compactBoundaryCount`：历史中 compact boundary 数量。
- `readFileStateSize`：当前读文件缓存规模。
- `sessionStoragePath`：可恢复 transcript 的脱敏路径或状态。
- `threadId` / `turnId`：上下文归属。
- `workspace`：当前工作区。
- `sessionContextSnapshot`：第二阶段可选摘要，不作为第一阶段主数据源。

完成标准：

- 用户连续多轮沟通时，模型不会忘记刚刚确认的当前目标和纠偏。
- 工具结果不会只存在 UI 卡片里，而是以原生 `Message` 形态进入下一轮模型上下文。
- App Server / Desktop 与 CLI/TUI 在同一 thread 内的上下文语义一致，不再每轮像新会话。
- 原生 compact、memory attachments、sessionStorage / resume、readFileState 至少通过 smoke 或 fixture 验证没有被新入口绕开。
- 上下文注入内容可观测、可调试，不再黑盒。
- 不在原生链路恢复前新建一套平行短期记忆系统。

### P25 子任务拆分

执行顺序：

0. [x] P25-0 最小影响面验证与根因快照
   - 目标：在正式修上下文前，先确认当前未提交改动没有明显打坏 Desktop/App Server、`ccr -p` CLI，并抓到 App Server 忘上下文的最小证据。
   - 已验证：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:desktop-display-events` 均通过。
   - 已验证：`ccr --version`、`ccr --help`、`ccr -p "请只输出 OK"` 正常；TUI 真交互需要前台人工验收，隐藏后台非 TTY 不能代表真实 TUI。
   - 根因快照：`runCoreQueryTurn` 当前调用 `query({ messages: [userMessage], ... })`，每轮只传当前用户消息。
   - 根因快照：`CoreSessionService` 当前只保存 `CoreThread` / `CoreTurn` 元数据，没有保存原生 `Message[]` 历史。
   - 根因快照：`createCoreQueryRuntime` 每轮创建新的 `toolUseContext.messages = []` 和新的 `readFileState`，无法继承 CLI/TUI 的 mutable message / read file state 语义。
   - 结论：优先恢复原生消息历史链路；不要在该问题未确认前新建一套平行短期记忆系统。
1. [x] P25-1 原生上下文链路盘点
   - 目标：确认 CLI/TUI 原生是如何维护历史、压缩、memory attachments、readFileState 和 transcript 的。
   - 具体动作：盘点 `QueryEngine.ask()`、`query()`、`cli/print.ts` 的 `mutableMessages`、`loadInitialMessages`、`sessionStorage`、compact / context collapse。
   - 验收：形成“原生链路应该传什么、保存什么、恢复什么”的对照清单。
   - 已确认：CLI/TUI 原生由 `QueryEngine` / `ask()` 持有 `mutableMessages`，每轮 `query()` 后把 assistant、user tool_result、progress、attachment、compact boundary 回写，并持有跨轮 `readFileState`。
   - 已确认：compact boundary 会裁剪旧历史，只保留边界后的压缩摘要和保留段，避免下一轮继续携带完整旧上下文。
2. [x] P25-2 App Server 差异定位
   - 目标：确认新入口到底绕开了哪些原生能力。
   - 具体动作：检查 `CoreSessionService`、`runCoreQueryTurn`、`createCoreQueryRuntime`，重点核对 `messages: [userMessage]`、`toolUseContext.messages: []`、每轮重建 `readFileState`。
   - 验收：明确“模型忘记前文”的第一原因是否为 thread history 未进入 `query()`。
   - 已确认：App Server 根因是每轮只传 `messages: [userMessage]`，Core session 只保存 thread / turn 元数据，没有保存原生 `Message[]`；`createCoreQueryRuntime` 也每轮重建空 `messages` 和 `readFileState`。
3. [x] P25-3 Core thread 原生 `Message[]` 历史接入
   - 目标：让每个 App Server thread 持有原生消息历史。
   - 具体动作：在 Core session 层保存 `Message[]`，每轮先追加当前用户消息，再把完整历史传给 `query()`。
   - 验收：第二轮模型能看到第一轮用户消息和 assistant 回复。
   - 已实现：`CoreSessionService` 为每个 thread 保存 `Message[]`，`runCoreQueryTurn` 调用 `query()` 时传入 `historyMessages + userMessage`，不再每轮空历史。
4. [x] P25-4 Assistant / tool / progress 消息归档
   - 目标：确保 `query()` 产出的关键消息不会只进入 UI。
   - 具体动作：把 assistant、tool_result、progress、attachment、compact boundary 等按原生规则追加回 thread history；避免重复归档 stream delta。
   - 验收：工具调用后一轮模型知道刚刚调用了什么、结果是什么。
   - 已实现：非 `stream_event` 的 renderable `Message` 会写回 thread history；stream delta 仍只用于 UI 增量展示，避免重复写入。
5. [x] P25-5 原生 compact / context collapse / budget 验证
   - 目标：确认恢复历史后不会破坏原生压缩和预算机制。
   - 具体动作：验证 compact boundary、tool result budget、history snip、context collapse 是否仍按 `query()` 原逻辑工作。
   - 验收：长上下文不会无限增长，压缩后下一轮仍能继续。
   - 已完成：Core thread history 已按原生 `compact_boundary` 语义裁剪边界前消息；`smoke:app-server-context` 覆盖 compact boundary 裁剪和 metadata 可观测字段。
   - 边界：真实 query 级 tool result budget / context collapse 仍由原生 `query()` 内部负责，App Server 不重新实现第二套预算算法。
6. [x] P25-6 sessionStorage / resume / readFileState 恢复
   - 目标：恢复 Desktop 重启或旧 thread 继续时的上下文能力。
   - 具体动作：对照 `loadConversationForResume`、`recordTranscript`、`extractReadFilesFromMessages`，决定 App Server 是直接复用原生 transcript，还是做最薄适配。
   - 验收：重启后同一会话能恢复关键消息和文件读写状态。
   - 已完成：App Server thread 会生成独立 `sessionId` / transcript 路径，使用原生 `recordTranscript()` 增量写入消息，不把多 thread 混进同一个全局 transcript。
   - 已完成：新增 `thread/resume`，底层复用 `loadConversationForResume()` 恢复原生消息，并复用 `extractReadFilesFromMessages()` 重建 `readFileState`。
   - 详细边界见 [CCR App Server 原生上下文链路恢复设计](../architecture/app-server-native-context-recovery.md)。
7. [x] P25-7 Desktop 上下文可观测入口
   - 目标：排查“为什么它忘了”时有证据。
   - 具体动作：在运行详情或日志中展示脱敏后的消息数量、最近消息类型、compact 状态、是否包含 tool_result，不展示 token 或大段 raw。
   - 验收：用户能看到本轮不是空历史，也能发现异常截断。
   - 已实现：`turn/completed` / `turn/failed` metadata 增加 `messageCount`、`lastMessageTypes`、`compactBoundaryCount`、`readFileStateSize`，供 Desktop/日志脱敏展示。
8. [x] P25-8 `SessionContextSnapshot` 二阶段补强评估
   - 目标：只在原生链路恢复后再判断是否需要轻量摘要。
   - 具体动作：评估用户纠偏、当前目标、最近工具摘要是否仍需要单独高优先级注入。
   - 验收：若需要，设计为诊断和补强层；若不需要，明确不实现，避免重复系统。
   - 结论：当前阶段不新增 `SessionContextSnapshot`，先以原生 `Message[]`、transcript、compact boundary、readFileState 为唯一主链路；如果后续真实 Desktop 仍出现上下文缺口，再把 snapshot 作为诊断/补强层单独设计。
9. [x] P25-9 Fixture / Smoke / 文档收口
   - 目标：用固定样例验证原生上下文不丢。
   - 样例：两轮记忆、“我刚才说什么”、用户纠偏、工具写文件、工具失败、TodoWrite 更新、compact 后继续、重启恢复。
   - 验收：`typecheck`、App Server smoke、Desktop display/context smoke 通过。
   - 已完成：`smoke:app-server-context` 覆盖同一 thread 两轮历史、`readFileState` 跨 turn 复用、compact boundary 裁剪、metadata 可观测、transcript 写入和 `thread/resume` 恢复消息/读文件状态。
   - 已验证：`ci:smoke` 全量通过，包含 `typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:app-server-context`、`smoke:app-server-client`、`smoke:runtime`、`smoke:permissions`、`smoke:deps`。

## P26 上下文、压缩与记忆能力 App Server 桥接

状态：待开始。

背景：

- P25 已解决“同一 App Server thread 每轮像新会话”的短期上下文问题，Core thread 现在有原生 `Message[]` 历史、`readFileState`、transcript 和 `thread/resume`。
- 但 P25 只完成了底座恢复，没有把 Claude Code 原生上下文治理能力完整暴露给 Desktop，例如自动 compact 状态、手动 `/compact`、SessionMemory 初始化、memory attachments、relevant memory、nested memory、compact boundary 可观测事件。
- 当前原则不是重写一套压缩或记忆系统，而是把 Claude Code 已经存在的能力通过 App Server 协议桥接出来，再让 Desktop 只做展示和控制。

目标：

- App Server 能只读暴露当前 thread 的上下文、压缩和记忆状态，便于确认原生能力是否真的生效。
- App Server runtime 能补齐 Desktop fast path 缺失的必要初始化，例如 `initSessionMemory()`、context collapse 注册、memory cache 清理和 workspace 切换后的上下文刷新。
- App Server 能复用原生 `compact.ts` 的 `call` 流程提供手动 compact，不重新写压缩逻辑。
- App Server 能把自动 compact / compact boundary / post compact message 映射成 Desktop 可识别的轻量事件。
- Desktop 在 App Server 状态稳定后，只负责展示 context usage、compact 事件、SessionMemory 状态和记忆来源，不直接重造 Core 行为。

不变式：

- 不在 Desktop renderer 直接读取或修改 Core 内部 memory / transcript / compact 文件。
- 不新增平行短期记忆系统；P26 仍以 Claude Code 原生 `query()`、compact、SessionMemory、attachments、sessionStorage 为主链路。
- 不把 `TokenWarning`、`StatusLine`、`QueryEngine` 的 TUI UI 组件直接搬到 Desktop；只能复用其状态来源、阈值算法和领域逻辑。
- 先做只读状态接口，再做行为型接口；避免一上来改 compact 行为导致上下文链路更乱。

### P26 子任务拆分

执行顺序：

1. [x] P26-1 App Server 只读状态接口
   - 目标：先不改变运行行为，只把已有上下文、压缩和记忆状态暴露出来。
   - 具体动作：新增或扩展 App Server 协议，提供 `context/status`、`compact/status`、`memory/session/status`。
   - `context/status` 字段：`messageCount`、`lastMessageTypes`、`compactBoundaryCount`、`readFileStateSize`、`sessionStorageStatus`、当前 token usage、`threadId`、`turnId`。
   - `compact/status` 字段：auto compact 是否开启、有效上下文窗口、自动压缩阈值、距离自动压缩还差多少、最近一次 compact 结果摘要、连续失败次数。
   - `memory/session/status` 字段：SessionMemory 是否启用、是否初始化、summary 文件脱敏路径、最近抽取状态、最近错误、是否等待抽取完成。
   - 验收：App Server smoke 能在不触发模型调用、不执行工具的情况下读取这些状态；敏感路径和 token 不泄露。
   - 已完成：新增 `context/status`、`compact/status`、`memory/session/status`，并在 App Server smoke 中覆盖能力协商和只读状态读取。
   - 已完成：`memoryPath`、`sessionStoragePath` 只返回 `projects/...` 相对状态路径或占位，不向 Desktop 泄露本机绝对路径。
2. [x] P26-2 App Server runtime 初始化补齐
   - 目标：修复 Desktop 启动 `app-server` fast path 没走完整 `setup()` 导致原生 hook 可能未注册的问题。
   - 具体动作：新增轻量 `appServerSetup()`，只复用 Claude Code 现有初始化，不调用完整 TUI `setup()`。
   - 必须包含：`initSessionMemory()`、必要的 context collapse 注册、memory file cache 清理、workspace 切换后的 `getUserContext` / `getSystemContext` 缓存刷新。
   - 验收：Desktop / App Server 启动后 `memory/session/status` 能明确显示 SessionMemory gate、初始化状态和 summary 路径；CLI/TUI 不受影响。
   - 已完成：新增轻量 `setupAppServerRuntime()`，在 App Server `initialize` 时幂等注册 SessionMemory/context collapse 相关初始化。
   - 已完成：workspace 切换时复用原生上下文和 memory cache 清理入口，避免读旧 workspace 状态。
3. [x] P26-3 手动 compact 接口
   - 目标：让 Desktop 能触发“压缩当前会话”，但不重写压缩逻辑。
   - 具体动作：新增 `compact/run`，Core 把当前 thread messages + ToolUseContext 映射成原生 `src/commands/compact/compact.ts` 的 `call` 所需 context。
   - 具体动作：优先复用原生流程：无自定义指令时先尝试 SessionMemory compact，再 microcompact，再 traditional `compactConversation`。
   - 验收：调用 `compact/run` 后当前 thread history 出现 compact boundary，下一轮仍能继续对话；失败时返回结构化错误。
   - 已完成：`compact/run` 复用原生 `compact.ts` 的 `call`，回写 `buildPostCompactMessages()`，并受 active turn 锁保护。
   - 已完成：Desktop 顶部/聊天页提供压缩入口，输入 `/compact` 与按钮走同一 App Server 行为接口。
4. [x] P26-4 自动 compact 可观测事件
   - 目标：自动 compact 仍由 `query.ts` 原生触发，Desktop 不主动判断或触发。
   - 具体动作：当 `query()` yield 出 `compact_boundary` / post compact messages 时，App Server 映射成 Desktop 可识别事件。
   - 展示要求：Desktop 只展示轻量系统事件，例如 `已自动压缩：120k -> 18k`，不展示原始 JSON 和大段摘要。
   - 验收：fixture / smoke 能模拟 compact boundary，并验证 Desktop 时间线出现一条压缩事件而不是多张 raw 卡。
   - 已完成：手动 compact 与原生 `query()` 产出的 `compact_boundary` 都映射为 `context/compacted` 轻量通知。
   - 已完成：`smoke:app-server-context` 覆盖自动 compact boundary 裁剪和 `context_compacted` 事件。
5. [x] P26-5 Desktop 状态展示与入口
   - 目标：等 App Server 状态稳定后，再补 Desktop UI。
   - 顶部展示：上下文用量、剩余到 auto compact 的粗略状态。
   - 状态详情：auto compact 开关、阈值、最近 compact、SessionMemory 状态、summary 文件脱敏路径、当前 memory 来源。
   - 操作入口：手动压缩当前会话按钮，后续可支持命令输入 `/compact` 转到 `compact/run`。
   - 验收：用户能看出当前是否快到压缩、是否刚压缩过、SessionMemory 是否启动，而不需要看日志。
   - 已完成：Desktop Topbar 和运行详情读取 `context / compact / memory` 快照，展示上下文窗口、粗略 token、auto compact、SessionMemory hook 和 memory attachment 计数。
   - 已完成：Desktop 收到 `context/compacted` 后只生成轻量系统提示，不展示原始 compact JSON。
6. [x] P26-6 memory attachments / relevant memory / nested memory 差异补齐
   - 目标：对齐 REPL / QueryEngine 里已经存在但 App Server ToolUseContext 还没带上的 session-scoped memory 状态。
   - 具体动作：评估并补齐 `nestedMemoryAttachmentTriggers`、`loadedNestedMemoryPaths`、`dynamicSkillDirTriggers`、`discoveredSkillNames`、`contentReplacementState` 等字段。
   - 具体动作：优先做状态透出和去重，不急着新增 UI；避免重复注入同一个 nested memory。
   - 验收：App Server 不再比 REPL/TUI 少关键 memory session 状态；相关 smoke 至少覆盖 loaded memory path 去重。
   - 已完成：`CoreQueryRuntimeState` 按 thread 持有 nested memory、dynamic skill、discovered skill 和 content replacement 状态。
   - 已完成：`context/status` 暴露这些状态的安全计数，不暴露 memory 原文和本机路径。
7. [x] P26-7 App Server `querySource` 与原生 hook gate 对齐审计
   - 目标：确认 App Server 是否因为 `querySource: "app-server"` 绕过了原生主线程能力。
   - 源码依据：`SessionMemory` 抽取当前只接受 `querySource === "repl_main_thread"`；工具结果替换持久化当前只覆盖 `agent:*` 与 `repl_main_thread*`；部分排队附件、prompt cache、MagicDocs、PromptSuggestion、microcompact 行为也按 `repl_main_thread` / `sdk` / `agent:*` 分支判断。
   - 具体动作：逐项列出所有 `querySource` gate，判断 App Server 应该复用 `repl_main_thread` 语义、扩展为 `isMainInteractiveQuerySource(...)`，还是保持禁用。
   - 不变式：不能简单把所有 `app-server` 改成 `repl_main_thread`；必须避免污染遥测、prompt cache、SDK 行为和子 agent 隔离。
   - 验收：形成 App Server query source 决策表；SessionMemory、compact、tool result replacement、queued command attachment 至少有明确结论和 smoke 覆盖。
   - 已完成：新增 `APP_SERVER_QUERY_SOURCE = "repl_main_thread:app_server"` 和 `isMainThreadQuerySource(...)`，让 App Server 复用主线程必要 hook，但不冒充完整 TUI。
   - 已完成：SessionMemory、stop hook、tool result replacement 相关主线程 gate 已改为接受 App Server 主线程语义。
8. [x] P26-8 上下文组成分析接口
   - 目标：把原生 `/context` 背后的分析能力接到 App Server，只暴露聚合状态，不泄露大段 prompt / memory 原文。
   - 具体动作：复用 `src/utils/analyzeContext.ts` / `context-noninteractive.ts`，提供 `context/analyze` 或扩展 `context/status`。
   - 字段建议：系统提示、用户上下文、工具定义、MCP 工具、消息历史、tool_result、compact boundary、memory attachments 的 token / byte / count 汇总。
   - 验收：Desktop 能回答“上下文被什么占满了”，但默认看不到敏感正文。
   - 已完成：新增 `context/analyze`，复用原生 `/context` 数据收集链路。
   - 已完成：输出已脱敏成聚合 token、分类、计数和 usage，不返回 memory 文件路径、系统提示正文、memory 正文或 grid 原始结构。
9. [x] P26-9 memory 文件来源、缓存与 workspace 切换生命周期
   - 目标：确认 Desktop workspace 切换、resume、clear 后，`CLAUDE.md` / nested memory / 项目 memory 不会读旧缓存。
   - 具体动作：复用 `clearMemoryFileCaches()`、`resetGetMemoryFilesCache(...)`、`clearSessionCaches()`、`getUserContext.cache.clear?.()`、`getSystemContext.cache.clear?.()` 等原生清理入口。
   - 状态接口：暴露 memory 文件来源摘要，例如全局、项目、nested、session memory、是否来自缓存、最近刷新原因；路径默认脱敏或相对化。
   - 验收：workspace A 切到 workspace B 后，memory/status 与 context/status 不再显示 A 的 memory 来源。
   - 已完成：`WorkspaceCore.openWorkspace()` 清理用户/系统上下文缓存和 memory file cache。
   - 已完成：`memory/session/status` 返回脱敏 summary 路径、内容长度、初始化和抽取状态，不返回正文。
10. [x] P26-10 relevant memory / nested memory 可观测与去重
   - 目标：让 Desktop 能知道“这轮是否命中了长期记忆/嵌套记忆”，但不直接展示原文。
   - 源码依据：`startRelevantMemoryPrefetch(...)`、`getNestedMemoryAttachments(...)`、`loadedNestedMemoryPaths`、`nestedMemoryAttachmentTriggers` 已经存在。
   - 具体动作：App Server 记录并上报 safe metadata：命中数量、来源类型、总 bytes、是否超过 session budget、是否因已 surfaced 而去重、是否因 abort 被取消。
   - 验收：同一 nested memory 不会重复注入；Desktop 日志能看到 memory 命中/跳过原因。
   - 已完成：当前第一版暴露 `nestedTriggerCount`、`loadedNestedMemoryPathCount`、`dynamicSkillTriggerCount`、`discoveredSkillCount`，用于确认去重状态。
   - 说明：更细的 relevant memory 命中原因、bytes 和 abort 原因仍保留为后续增强，P26 不展示原文、不另建记忆系统。
11. [x] P26-11 工具结果替换与大结果持久化补齐
   - 目标：修复 App Server 长会话里大 tool_result 替换记录可能不持久的问题。
   - 源码依据：`query.ts` 里 `applyToolResultBudget(...)` 的 `persistReplacements` 当前只覆盖 `agent:*` 和 `repl_main_thread*`。
   - 具体动作：判断 App Server thread 是否应该持久化 `contentReplacementState`；如果需要，复用 `recordContentReplacement(...)`、`reconstructContentReplacementState(...)`、sessionStorage 的原生记录格式。
   - 验收：大工具结果被替换后，`thread/resume` 和下一轮 query 仍能正确引用替换记录，不把完整大结果重新塞回上下文。
   - 已完成：App Server thread runtime 持有 `contentReplacementState`，query source 对齐主线程 replacement 持久化 gate。
   - 已完成：`context/status` 暴露 `seenCount` / `replacementCount`，方便诊断大结果替换是否生效。
12. [x] P26-12 slash command / context command 桥接
   - 目标：让 Desktop 对 `/compact`、`/context`、后续 `/memory` 这类原生命令有一致入口，而不是私写按钮逻辑。
   - 具体动作：优先桥接安全且确定的命令：`/compact` -> `compact/run`，`/context` -> `context/analyze`；其他 slash command 先做能力矩阵，不急着开放。
   - 不变式：不把 TUI 的 React 命令组件搬到 Desktop；只复用 command 背后的领域函数和状态输出。
   - 验收：Desktop 输入 `/compact` 与点击“压缩当前会话”走同一 App Server 行为接口。
   - 已完成：Desktop 输入 `/compact` 走 `compact/run`，与按钮共用同一 App Server 行为接口。
   - 说明：`/context` UI 展示暂以状态和运行详情承接，后续若做完整命令面板再接 `context/analyze` 展示。
13. [x] P26-13 session memory / transcript 文件访问安全与可见性
   - 目标：确认 SessionMemory、session transcript、自动 memory 文件既能被原生工具安全处理，也不会在 Desktop 里泄露。
   - 源码依据：`sessionFileAccessHooks.ts`、`memoryFileDetection.ts`、`FileReadTool` 里已有 session file / memory file 类型识别。
   - 具体动作：App Server 状态只返回文件类型、存在性、大小、脱敏路径和最近访问状态；读取正文必须走原生权限/工具链路。
   - 验收：Desktop 能说明“有 session memory / transcript”，但不能绕过权限直接读敏感内容。
   - 已完成：session memory 和 transcript 状态只返回脱敏路径、存在性/长度/状态，不提供正文读取接口。
   - 已完成：Desktop renderer 仍只能通过 main/preload/App Server 协议获取状态，不直接访问 Node 文件系统或 Core 内部文件。
14. [x] P26-14 Fixture / Smoke / 文档收口
   - 目标：固化上下文、压缩和记忆能力的回归样例。
   - 样例：只读状态、SessionMemory 初始化、手动 compact、自动 compact boundary、resume 后 compact 状态、workspace 切换后 memory cache 刷新、`querySource` gate 行为、relevant memory 命中与去重、tool result replacement resume、thread/workspace 隔离。
   - 文档：更新 App Server 协议文档、原生上下文恢复设计、Desktop 事件契约和本 todo。
   - 验收：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server-context`、新增 compact/memory smoke 通过。
   - 已完成：新增/扩展 `smoke:app-server-context`、`smoke:app-server`、`smoke:app-server-client`、Desktop 状态刷新和 display-event smoke，覆盖 P26 的状态、事件和脱敏边界。
   - 已完成：更新 App Server 协议文档、原生上下文恢复设计、Desktop 事件契约和本 todo。

## 延后事项：VS Code 插件接入准备（不占当前 P 编号）

目标：

- 暂时不实现 VS Code 插件。
- 等 Desktop App 主链路、日志、安装包和更新准备稳定后，再设计 VS Code runtime discovery。
- 明确后续优先连接 Desktop app-server。
- 明确找不到 Desktop 时是否启动 npm/global `ccr app-server`。
- 明确找不到 ccr 时提示用户确认 npm 安装。

完成标准：

- 有 VS Code 插件接入流程文档。
- 有 `ccr.runtime.mode/path/installStrategy/preferDesktop` 配置设计。
- 明确不静默安装，不内置完整 Core。
- 明确 VS Code 只作为后续入口，不阻塞 Desktop 第一版。

## 后续记录（追加）

- 初始化：根据多入口总体方案、Desktop 框架选型和升级策略，建立 App Server 专项 todo。当前先从协议详细设计开始，避免 Desktop / VS Code 直接依赖内部模块。
- 第 1 轮：P1 App Server 协议详细设计已完成，新增 [CCR App Server 协议详细设计](../architecture/app-server-protocol-design.md)。文档明确第一版只支持 stdio JSON-RPC、initialize gate、错误码、schema 策略、`initialize / shutdown / config/get / config/update / auth/status / auth/login/start / model/list / mcp/list / workspace/open` 的入参出参、通知占位和安全不变式。当前指针切到 P2，下一步开始实现最小 stdio JSON-RPC 骨架。
- 第 2 轮：P2 最小 stdio JSON-RPC 骨架已完成，新增 `src/app-server/`。当前已能直接调用协议行处理函数完成 malformed JSON、未初始化门禁、initialize、unknown method、重复 initialize、shutdown 的最小闭环；typecheck/build 均通过。当前指针切到 P3，下一步把该骨架挂到 `ccr app-server --listen stdio` CLI 入口。
- 第 3 轮：P3 CLI 入口已完成，`src/entrypoints/cli.tsx` 新增 `app-server` fast path，支持 `app-server --listen stdio` 和默认 stdio，非 stdio 明确拒绝。已用 `node .\cli.js --version` 验证版本 fast path 未受影响，并用真实 `node .\cli.js app-server --listen stdio` 管道验证 not_initialized、initialize、unknown method、shutdown。当前指针切到 P4，下一步补第一批只读 handler。
- 第 4 轮：P4 第一批只读 handler 已完成，新增 LLM/MCP/workspace handler 并接入 router。已验证 `config/get`、`auth/status`、`model/list`、`mcp/list`、`workspace/open` 均可通过真实 `node .\cli.js app-server --listen stdio` 返回结构化结果；其中 `auth/status` 只返回脱敏账号 ID，不返回 token/refresh token。当前指针切到 P5，下一步将这些验证固化为 smoke 脚本。
- 第 5 轮：P5 smoke 验证链路已完成，新增 `scripts/smoke-app-server.mjs`、`smoke:app-server`，并接入 `ci:smoke`。脚本使用临时 `CCR_CONFIG_DIR`，不依赖本机真实登录态，覆盖 initialize gate、parse error、只读 handler、workspace/open、shutdown、非 stdio 拒绝和 secret key 泄露检查。当前指针切到 P6，下一步设计 Thread / Turn / Item 会话 API。
- 第 6 轮：P6 Thread / Turn / Item 会话 API 设计已完成，新增 [CCR App Server 会话 API 设计](../architecture/app-server-session-api-design.md)，并更新文档索引。文档明确 App Server 对外只暴露 Thread/Turn/Item 产品协议，内部通过 TurnRunner 逐步复用 QueryEngine/query.ts/StructuredIO；第一版只做单 workspace、单 active thread、单 active turn。当前指针切到 P7，下一步实现最小 turn 事件流闭环。
- 第 7 轮：P7 已完成代码主体和无登录态自动化验证，新增内存 session manager、text-only turn runner、`thread/start`、`thread/list`、`turn/start`、`turn/interrupt`、notification 输出；`smoke:app-server` 已扩展覆盖 thread 和 turn 的 `auth_required` 失败路径。剩余决策点是是否允许使用当前真实 Codex OAuth 登录态跑一次真实模型 turn 输出验证；未确认前 P7 不标完成。
- 第 8 轮：根据架构纠偏，新增并完成 P6.5。结论是 App Server 不能继续长出私有业务运行时；配置、认证、模型、MCP、workspace、session、permission、tool execution 都必须统一到 CCR Core API。已新增 [CCR Core 统一对外接口边界](../architecture/ccr-core-interface-boundary.md)，并更新 App Server 协议和会话 API 文档。下一步返工 P7，让 `turn/start` 通过 Core session / turn service 执行。
- 第 9 轮：P7 已完成 Core API 门面返工，新增 `src/core/` 并把 App Server 的配置、认证、模型、MCP、workspace、session、turn 能力都改为通过 `context.core.*` 调用；App Server 私有 `sessionManager` / `textOnlyTurnRunner` 已删除，事件通过 `coreEventToJsonRpcNotification()` 统一映射成 JSON-RPC notification。随后继续收敛模型调用路径，`runTextOnlyCoreTurn` 改为复用 CLI/TUI 内置分支使用的 `queryWithLlmRuntime`，不再直连低层 `LlmRuntime.stream`。`typecheck`、`build`、`smoke:app-server` 均通过。下一步仍需处理真实 Codex OAuth `turn/start` 输出验证。
- 第 10 轮：P7 真实 Codex OAuth `turn/start` 已跑通。根因是 Node/Undici 默认连接超时不适合当前 `chatgpt.com` 链路，TLS 建连约 11 秒而默认 10 秒超时；已在统一 `proxy.ts` 网络工具里设置默认 `connectTimeout = 30000`，并让 `CodexOAuthProvider` 请求前复用该入口。真实 App Server 会话已收到 `turn/started -> item/delta -> item/completed -> turn/completed`，英文算术 prompt 返回 `4`。当前指针切到 P8，下一步补权限请求与客户端响应闭环。
- 第 11 轮：P8 先完成方向校准，确认原代码已有权限体系，不能另写一套。已新增 [CCR App Server 权限复用设计](../architecture/app-server-permission-reuse-design.md)，明确 App Server 应复用 `hasPermissionsToUseTool(...)`、SDK `control_request: can_use_tool` 字段语义和 `PermissionPromptToolResultSchema`，只补 `permission/requested -> permission/respond` 薄 adapter。当前 `runTextOnlyCoreTurn` 仍无工具流，下一步先实现 adapter 与 smoke，再接真实 tool-capable runner。
- 第 12 轮：P8 第一刀已实现并验证通过。新增 `CorePermissionService`，它提供 `createCanUseTool(...)`、pending permission request、`respondPermission(...)`、`cancelForTurn(...)`，底层复用 `hasPermissionsToUseTool(...)` 和 `PermissionPromptToolResultSchema`；App Server 新增 `permission/respond` handler、`permission/requested` / `permission/cancelled` notification 映射，并把 `permissions` capability 打开。新增 `scripts/smoke-app-server-permissions.mjs` 并接入 `smoke:app-server`，已覆盖 permission/requested、allow、重复响应、缺失 request、cancel。`typecheck`、`build`、`smoke:app-server` 均通过。下一步接真实 tool-capable runner，让 Bash/FileEdit/WebFetch 等工具流实际使用该 adapter。
- 第 13 轮：P8 第二刀已完成，新增 `runCoreQueryTurn` 并让 `CoreSessionService` 从 text-only runner 切到现有 `query()` 主执行链。该 runner 会构造 Core 专用 `ToolUseContext`，复用 `getSystemPrompt()`、`assembleToolPool()`、`query()`、`StreamingToolExecutor` / `runTools` 以及 `CorePermissionService.createCanUseTool(...)`，把 App Server turn 接回真实模型/工具链路；同时保留 Core item 事件映射和 session interrupt 到 query abort 的传递。`typecheck`、`build`、`smoke:app-server` 均通过。剩余风险是自动化 smoke 还没有用 fake model 或真实小工具调用完整验证 `tool_use -> permission/requested -> permission/respond -> tool_result -> follow-up` 全路径。
- 第 14 轮：P8 真实 Codex OAuth 工具权限流已验证完成。第一轮直接用 `TestingPermission` 暴露出测试方式错误：设置 `NODE_ENV=test` 会触发旧 Claude auth 的 Anthropic/Claude token 强校验，不适合作为真实链路测试；随后改用真实工具。Bash 工具测试证明 Codex OAuth 能产出 `tool_use` 并进入工具执行，但 Windows 下缺 POSIX shell，Bash tool result 为错误且未触发权限请求。最终使用临时 workspace + `Write` 工具完成 allow 测试：收到 1 次 `permission/requested`，`permission/respond allow` 返回 `{ accepted: true }`，文件内容为 `CCR_WRITE_TOOL_OK`，turn 正常完成。又补 deny 测试：`permission/respond deny` 后工具结果为拒绝错误，目标文件未创建，turn 正常完成。过程中修复 `queryModel()` 的 provider 顺序 bug，避免 Codex OAuth 被 Anthropic 凭据检查误拦。`typecheck`、`build`、`smoke:app-server` 均通过。P8 标记完成，下一步进入 P9 Desktop 原型接入准备。
- 第 15 轮：P9 已完成设计收口，新增 [CCR App Server Client SDK 设计](../architecture/app-server-client-sdk-design.md)。结论是 P9 第一刀不直接做完整 Desktop UI，而是先把 `src/app-server/client/` 打牢：`JsonRpcClient` 负责 JSON-RPC 请求/通知，`StdioAppServerClient` 负责类型化协议 API，`AppServerProcess` 负责本地子进程生命周期；Desktop renderer 仍只能通过 preload IPC 间接访问 App Server。下一步进入 P9 第一刀实现和 `smoke:app-server-client`。
- 第 16 轮：P9 第一刀实现已完成。新增 `src/app-server/client/`：`JsonRpcClient` 负责 JSON Lines request / response / notification 匹配，`StdioAppServerClient` 提供类型化 App Server API，`AppServerProcess` 使用 `execa` 管理本地 `ccr app-server --listen stdio` 子进程；协议层补齐 response / notification schema 和第一批 result 类型。新增 `scripts/smoke-app-server-client.mjs` 与 `smoke:app-server-client`，并接入 `ci:smoke`。验证过程中发现并修复 SDK shutdown 生命周期 bug：`shutdown` 成功后不能立即 SIGTERM，应先等待 App Server 自然退出再释放客户端。`ci:smoke` 已通过，P9 标记完成。
- 第 17 轮：根据当前产品主线调整后续顺序：暂时不进入 VS Code 插件接入，优先把 Desktop App 做起来。P10 改为 Desktop App 最小原型，P11 改为 Desktop 打包、启动与本机验证，VS Code 延后为 P12，版本升级兼容延后为 P13。这样 App Server Client SDK 会先服务 Desktop 第一版，避免多入口并行分散主线。
- 第 18 轮：P10 Desktop App 最小原型代码已完成。新增 `apps/desktop/`，采用 Electron + React + TypeScript + electron-vite；main process 复用 App Server Client SDK 启动 `ccr app-server --listen stdio`，preload 暴露白名单 API，renderer 提供工作区、状态、事件流和输入框。依赖安装时先遇到 Vite 8 与 `electron-vite@5` peer dependency 不兼容，已回到版本对照并固定为 `vite@7.3.2` + `@vitejs/plugin-react@5.2.0` + `electron-vite@5.0.0`，没有使用 `--force`。`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`ci:smoke` 均通过。P10 标记完成，Desktop 可见窗口和本机交互验证进入 P11。
- 第 19 轮：P11 Desktop 本机验证已完成。第一次运行 `desktop:dev` 暴露 electron-vite 需要根 `package.json` 的 `main` 字段，已补为 `out/main/index.js`；第二次运行成功启动 Electron 开发模式，日志显示 renderer dev server 运行在 `localhost:5173`，进程树确认 Electron 主进程、renderer 和 `node cli.js app-server --listen stdio` 子进程存在。随后向 Electron 主窗口发送关闭信号，验证 Electron 子进程和 App Server 子进程全部退出，后台无残留 Desktop/App Server 进程。根据“先把 Desktop App 做好”的主线，后续继续 Desktop 会话、权限、设置、MCP、日志和安装包，不再提前跳 VS Code。
- 第 20 轮：P12/P13 Desktop 交互增强已完成。renderer 已把 App Server notification 从原始事件流整理为聊天消息、错误卡和权限请求卡；权限卡通过 preload 白名单调用 `permission/respond`，不绕过 Core 权限系统。侧栏已补齐 MCP、设置和日志页面，MCP 页调用 `mcp/list`，设置页展示 provider/model/auth/core/workspace，日志页展示事件摘要。已重新运行 `npm.cmd run ci:smoke`，覆盖 build、typecheck、Desktop typecheck/build、App Server smoke、Client SDK smoke、runtime、permissions、deps，全部通过。下一步进入 P14 Desktop 安装包与升级准备。
- 第 21 轮：P14 Desktop 安装包与升级准备已完成。已引入 `electron-builder@26.8.1`，新增 `desktop:pack`、`desktop:dist`、`scripts/desktop-package.mjs` 和 [CCR Desktop 打包与升级准备方案](../architecture/desktop-packaging-and-upgrade-plan.md)。验证过程中先遇到 Windows `.cmd` spawn 和 npm 二级脚本入口问题，最终改为复用 `npm_execpath` 与 `electron-builder` JS CLI；随后又发现打包态 App Server 缺 `semver`，根因是子进程不能从 `app.asar` 中解析普通 Node 依赖，已把 runtime 所需 `node_modules` 放入 `asarUnpack`。当前 `desktop:pack`、`smoke:desktop-packaged` 和 `ci:smoke` 均通过。根据“先把 Desktop App 做好”的主线，下一步进入 P15 Desktop 日志落盘与错误可观测，VS Code 继续延后。
- 第 22 轮：P15 Desktop 日志落盘与错误可观测已完成。App Server SDK 新增 `onStderr(...)`，Desktop main process 已把状态摘要写入 `main.log`、App Server stderr 写入 `app-server.stderr.log`、JSON-RPC client error 写入 `client-error.log`；renderer 通过 preload `getLogs()` 读取最近日志摘要，不直接读文件系统。已新增 [CCR Desktop 日志与错误可观测方案](../architecture/desktop-logging-observability.md)。打包后启动 Desktop 已验证生成 `C:\Users\luoji\AppData\Roaming\CCR Desktop\logs\main.log`，内容只包含 `starting app server -> app server ready` 摘要。`smoke:desktop-packaged` 和 `ci:smoke` 均通过。下一步进入 P16 Desktop 图标、安装器与更新通道准备。
- 第 23 轮：P16 Desktop 图标、安装器与更新通道准备已完成。已新增 `apps/desktop/assets/ccr-desktop-icon.svg` 作为占位图标源文件，并新增 [CCR Desktop 安装器与发布准备方案](../architecture/desktop-installer-release-readiness.md)。已验证 `npm.cmd run desktop:dist` 能生成 `CCR Desktop-0.2.0-win-x64.exe`、`.blockmap` 和 `latest.yml`，并再次通过 `smoke:desktop-packaged` 验证打包态内置 App Server 可用。正式图标、代码签名和自动更新仍是正式发布前事项，不阻塞当前 Desktop 第一版。下一步进入 P17 版本、协议兼容与回滚加固，VS Code 继续延后。
- 第 24 轮：P17 版本、协议兼容与回滚加固已完成。App Server `initialize` 已补 `serverVersion`、`schemaVersions.config`，Desktop main process 已加入协议兼容判断，设置页可见 App Server 版本、协议版本、配置 schema 和兼容状态。已新增 [CCR App Server 版本、协议兼容与回滚规则](../architecture/app-server-version-compatibility.md)。验证顺序采用“先 build，再 smoke”，避免并行读取 stale dist；`desktop:pack`、`smoke:desktop-packaged`、`ci:smoke` 均通过。当前 P0-P17 Desktop 第一版主线完成，VS Code 从当前任务列表移到延后事项，下一步需要用户确认新的 Desktop 深化主线或再开 VS Code。
- 第 25 轮：在 P0-P17 Desktop 第一版完成后，新增 P18-P24 作为“模型输出与运行事件展示能力产品化”后续主线。范围来自当前支持矩阵：文本、思考、工具事件、权限事件已打通；后续补控制信息、工具卡片、文件/附件/引用、结构化输出、多模态预览和错误分类。VS Code 仍保持延后，不占当前 P 编号。
- 第 26 轮：修复 Desktop 输出展示第一批问题。根因是 Codex OAuth `text_delta` 被适配成多个独立 `content_part` 后，`queryWithLlmRuntime` 又为每个片段都生成 `content_block_start/stop`，导致 Desktop 收到多个 item 并显示成“一个字一张卡”。已改为同一 `contentIndex` 的文本流只打开一个文本块；同时给中文输入追加语言跟随指令，并对工具结果标题与 TodoWrite 常见成功提示做中文展示。已验证 `typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:llm-claude-adapter`、`smoke:codex-oauth-provider`、`ci:smoke` 均通过。
- 第 27 轮：真实 Desktop 复测中，文本流拆卡没有再次出现，暂记为“待回归确认”，不能再写成已知仍未解决；同时发现空白“思考”卡片，已记录为 P18 遗留问题。用户提出 TodoWrite 希望参考 Codex 做成角落可折叠竖向任务列表浮层，而不是把 raw JSON 和英文工具结果铺进主聊天区；已记录到 P20 工具事件卡片产品化。
- 第 28 轮：P18-FE3 第一版已完成。新增 `apps/desktop/src/renderer/src/app/sessionState.ts`，用纯 reducer 管理聊天消息、权限请求和当前 turn；`main.tsx` 的会话状态从多组 `useState` 切到 `useReducer`，页面组件继续通过 props 接收状态，不直接接触 App Server。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE4，把 `notification.method` 分发从 `main.tsx` 移出。
- 第 29 轮：P18-FE4 已完成。新增 `apps/desktop/src/renderer/src/app/notificationRouter.ts`，把 App Server notification 到会话动作的分发独立出来；`main.tsx` 不再堆 `notification.method` 条件分支，只负责调用路由、缓存 item metadata、dispatch reducer。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE5，开始建立用户可见 `DisplayEvent` 归一化层。
- 第 30 轮：P18-FE5 第一版已完成。新增 `apps/desktop/src/renderer/src/domain/displayEvents.ts`，定义 `DisplayEvent` 类型、用户消息、错误、系统提示、completed item 到展示事件的转换，以及 `DisplayEvent -> ChatMessage` view model 派生。`SessionState` 内部已改为保存 `displayEvents`，聊天页面继续接收派生消息，避免直接解析原始 notification。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE6，拆 `ChatTimeline` 和基础消息卡片。
- 第 31 轮：P18-FE6 已完成。新增 `ChatTimeline` 和基础消息卡片组件，把用户消息、assistant 消息、thinking 摘要、工具事件、错误、系统提示拆成独立组件；`ChatPage` 不再直接 map 消息列表，只负责组合主工作区和输入框。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE7，实现 TodoWrite 角落可折叠任务浮层。
- 第 32 轮：P18-FE7 第一版已完成。新增 TodoWrite 解析和角落浮层：`domain/todoEvents.ts` 提取 `TodoWrite` 的 `todos`，`DisplayEvent` 新增 `todoSnapshot`，`selectChatMessages(...)` 从主聊天区过滤 `todo_list`，`TodoOverlay` 在工作台右下角以可折叠卡片展示任务进度和原始 JSON。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE8，治理 raw thinking 和空白思考卡。
- 第 33 轮：P18-FE8 第一版已完成。先对照 `D:\agent_project\codex-main`，Codex TUI 对 `ReasoningSummaryTextDelta` 直接展示，对 `ReasoningTextDelta` 只有 `show_raw_agent_reasoning` 开启才展示。CCR 已按这个策略调整：`notificationRouter` 不再把 raw `thinking` delta 送进主聊天区，只接受 summary 类 delta；`displayEvents` 会过滤纯 raw thinking completed item。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE9，继续把普通工具 JSON 卡片产品化。
- 第 34 轮：P18-FE9 第一版已完成。新增 `domain/toolEvents.ts`，把普通工具事件提取成 `ToolSnapshot`；`DisplayEvent` 新增 `toolSnapshot`，`ChatTimeline` 改为直接消费 `DisplayEvent` 而不是只消费 `ChatMessage` view model，`ToolCard` 能展示工具名、状态、摘要和折叠详情。已验证 `npm.cmd run typecheck:desktop` 和 `npm.cmd run desktop:build` 通过。下一步切到 FE10，拆样式系统和样式文件。
- 第 35 轮：P18-FE10~FE13 已完成。样式拆为 `tokens/layout/chat/cards/todo-overlay` 五个模块；Core/App Server `item_completed` 事件补 `threadId/turnId`，Desktop renderer 新增 `eventContract.ts` 保留展示字段来源和缺口；新增 Desktop display event fixture 与 `smoke:desktop-display-events`；新增事件字段契约和体验增强路线文档。已验证 `typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:desktop-display-events` 和 `git diff --check` 通过。当前指针切到 P19，下一步补控制信息面板与运行元数据展示。
- 第 36 轮：真实 Desktop 复测中暴露 Windows 工具执行边界：App Server fast path 未走完整 Windows shell 初始化时会触发 `No suitable shell found`，但更根本的问题是 CCR 不能默认强求 `ls` / `bash` / `zsh` 这类 Unix 环境。已把“Windows 优先 PowerShell / CMD / Node 原生文件能力 / 高层文件工具，Bash 仅作为兼容 fallback，并在工具卡片中展示 shell/provider、命令方言、fallback 原因和失败分类”补入 P20 子任务。后续进入 P20 时，需要把平台感知工具策略和工具卡片产品化一起处理。
- 第 37 轮：根据工具卡片产品体验确认，P20 追加“工具结果合并展示”不变式：一次工具调用只对应一张主工具卡，执行中在原卡片右下角显示动态转圈或脉冲状态并展示持续时间，完成后同一区域切换为成功 / 失败 / 被拒绝 / 已取消角标；stdout、stderr、结构化 result 和错误详情都进入原卡片展开详情，不再另起独立工具结果消息刷屏。
- 第 38 轮：P20 工具生命周期卡第一刀已实现。Desktop renderer 现在会读取 `tool_use_id` 并按 `toolUseId` 合并 `tool_use` 与 `tool_result`，避免“准备调用”和“工具执行成功”拆成两张卡；`tool_use` 初始状态改为 `running`，右下角显示执行中转圈，收到结果后同一区域切换为成功 / 失败角标。工具输入和工具结果统一放进原卡片“查看详情”区域。已更新 display-event fixture 和 smoke，要求工具结果默认并入原工具卡。
- 第 39 轮：继续收敛控制型工具展示。`AskUserQuestion` 这类工具调用和后续 assistant 正文问题重复，已标记为主时间线隐藏型控制工具；它的 `tool_result` 会按 `toolUseId` 合并回隐藏事件，不再显示“AskUserQuestion / 工具执行成功”两张卡。TodoWrite 浮层事件也可作为工具结果合并目标，避免控制类工具结果回流到主聊天区。已更新 display-event fixture 和 smoke，要求 `AskUserQuestion` 不出现在可见主时间线。
- 第 40 轮：细化 P19 / P20 子任务。P19 已拆成字段来源盘点、App Server Turn 元数据协议、Core Runner 元数据采集、Desktop 状态模型、顶部状态条、Turn 详情入口、脱敏兜底、fixture/smoke 八项；P20 已拆成工具身份关联、生命周期卡、状态机、权限关联、工具分类、控制型工具隐藏、结果详情、跨平台 Shell 策略、工具错误分类、fixture/smoke 十项。当前指针细化到 P19-1，完成后进入 P19-2。
- 第 41 轮：P19 控制信息面板与运行元数据展示已完成。Core `CoreTurn.metadata` 现在会记录 provider、model、contextWindow、usage、stopReason、requestId、latencyMs、TTFT 和 errorKind；App Server `turn/started`、`turn/completed`、`turn/failed`、`turn/cancelled` notification 会透出 metadata；Desktop renderer 新增 `TurnRuntimeMetadata` 状态，顶部状态条显示上下文用量，聊天页提供折叠的运行详情入口。已新增 [CCR Desktop 运行元数据字段来源表](../architecture/desktop-runtime-metadata-field-map.md)，并更新事件字段契约。验证通过：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:desktop-display-events`。当前指针切到 P20-1。
- 第 42 轮：P20 工具事件卡片产品化已完成第一版。Desktop 工具快照新增工具分类、状态标签、命令/目标/工作目录/shell/provider/风险、权限关联、错误分类和可行动提示；`permission/requested` 现在通过 `toolUseId` 关联原工具卡，等待权限、允许、拒绝、取消、失败、超时都回写到同一张卡。Core App Server 在 Windows 环境注入平台工具提示，避免模型默认依赖 POSIX shell；Desktop fixture 新增成功工具、Windows shell 不可用、AskUserQuestion 隐藏和权限关联样例。新增 [CCR Desktop 工具事件卡片契约](../architecture/desktop-tool-event-card-contract.md)，并更新事件字段契约和文档索引。验证通过：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:desktop-display-events`、`git diff --check`。当前指针切到 P21-1。
- 第 43 轮：按后续主线重新细化 P21-P24。P21 扩展为文件/附件/引用字段盘点、展示模型、工具结果归一化、文件卡片、引用交互、上传入口、安全 preload 能力、fixture/smoke 八项；P22 扩展为结构化来源盘点、StructuredSnapshot、JSON Tree、表格视图、Schema 错误视图、工具卡详情接入、fixture/smoke 七项；P23 扩展为多模态来源盘点、MediaSnapshot、图片/截图、文本/二进制、音频/视频占位、fixture/smoke 六项；P24 扩展为错误来源盘点、ErrorSnapshot、错误分类映射、恢复动作、限流额度、拒答/安全区分、日志脱敏、fixture/smoke 八项。当前指针不变，继续进入 P21-1。
- 第 44 轮：P20 体验返修完成。TodoWrite 相关的控制链路不再只按直接工具名过滤，`ToolSearch(select:TodoWrite)` 等控制前置动作也会从主聊天流隐藏；孤立的 TodoWrite 成功结果不再生成“工具结果”卡片。Windows App Server 暂时从工具池过滤 `Bash`，避免模型继续把 PowerShell 命令交给不可用 POSIX shell；后续若要命令执行，应补真实 PowerShell/CMD 或 `ShellExecute` 工具。
- 第 45 轮：P20 Windows 工具池返修。确认当前 App Server 真实可见工具缺少 `LS`，且 `PowerShellTool` 在 external 模式默认关闭，导致过滤 `Bash` 后模型绕去调用不可用 `AgentTool`。已改为 Windows App Server 默认启用 `PowerShellTool`、继续过滤 `Bash`，并在没有 active agent definitions 时隐藏 `AgentTool`。验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:app-server`、`smoke:desktop-display-events`。
- 第 46 轮：新增 [CCR 工具能力治理修复清单](./tool-capability-repair-list.md)，把 Windows shell、AgentTool 暴露、缺失高层目录工具、ToolSearch 控制噪声、MCP 健康检查、Playwright MCP 生产接入、权限语义升级和工具池回归测试整理成后续专项。该清单暂不改变当前 P21 指针，作为后续横切修复入口。
- 第 47 轮：真实复测发现 `progress` / `tool_use_summary` 仍可能单独生成“工具进度 / 工具正在执行”卡。已补入工具能力治理清单 TC11：工具进度是原工具调用的生命周期更新，应按 `toolUseId` 合并回原工具卡，并复用右下角执行中转圈 / 脉冲动效，完成后同一区域显示最终状态。
- 第 48 轮：对照 `D:\agent_project\codex-main` 的工具生命周期实现，确认 Codex 使用稳定 `call_id` 把 `ExecCommandBegin`、输出增量和 `ExecCommandEnd` 关联到同一个 `ExecCell` / `ThreadItem`，找不到匹配 ID 时不做“最近运行工具”猜测。CCR 已按该原则返修 Desktop：`eventContract` 识别 `parentToolUseId`，`sessionState` 用 `parentToolUseId -> toolUseId` 合并 `progress`，孤立 `progress` 不再进入主聊天流，`toolEvents` 将 PowerShell/Bash progress 规范为运行中状态。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`。
- 第 49 轮：真实复测继续发现 `Write` / `写入文件` 场景可能只显示 `File created successfully...` 工具结果，看不到写入操作卡。排查结论是 Core 的 `runCoreQueryTurn` 在 `assistantStream` 收尾分支里只完成流式文本后直接 `continue`，导致同一 assistant 消息内的非文本块（尤其 `tool_use`）可能被漏发。已修复为流式文本收尾后继续发出 `nonStreamedAssistantContent(event)`，让 `tool_use` 进入 Desktop 后再按 `toolUseId` 合并 `tool_result`。
- 第 50 轮：真实复测发现当前上下文治理不足，模型有时记不住前面刚刚确认的内容、用户纠偏和当前任务意图。进一步排查后确认优先方向不是新建平行记忆系统，而是先恢复 Claude Code 原生上下文链路：`QueryEngine` 原本通过 `mutableMessages`、sessionStorage、compact / context collapse、memory attachments、readFileState 维护会话，而当前 App Server `runCoreQueryTurn` 存在每轮只传当前 `userMessage` 的高风险。P25 已调整为“原生上下文链路恢复与短期记忆治理”。
- 第 51 轮：先完成当前快照影响面验证和 P25 最小根因排查。验证通过：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:desktop-display-events`、`ccr --version`、`ccr --help`、`ccr -p "请只输出 OK"`。TUI 真交互未用隐藏后台进程冒充通过：非 TTY 环境会走 print 边界并要求 stdin/prompt，后续需要前台人工验收。P25 根因快照确认：`runCoreQueryTurn` 当前只向 `query()` 传 `messages: [userMessage]`，`CoreSessionService` 只保存 thread/turn 元数据，`toolUseContext.messages` 和 `readFileState` 每轮新建。当前指针临时从 P21 切到 P25-1/P25-2，先恢复原生上下文链路，再回到 P21。
- 第 52 轮：完成 P25-1 ~ P25-4 第一刀，并补入 P25-5 的 compact boundary fixture。`CoreSessionService` 已为每个 thread 持有原生 `Message[]` 和 thread 级 `readFileState`；`runCoreQueryTurn` 调用 `query()` 时传入 `historyMessages + userMessage`，并把 assistant、user tool_result、progress、attachment、tool_use_summary、compact boundary 等 renderable message 回写到 thread history。compact boundary 会裁剪边界前历史。新增 `smoke:app-server-context` 并纳入 `ci:smoke`，验证两轮上下文、readFileState 跨 turn 保持，以及 compact boundary 裁剪。新增 [CCR App Server 原生上下文链路恢复设计](../architecture/app-server-native-context-recovery.md)，明确 `sessionStorage` / resume 不能直接混用全局 transcript，后续要做 thread 到 session 的显式映射。顺手修正 `smoke:desktop-auto-update` 的组件化扫描范围：Desktop renderer 已拆到 `Topbar` / `SettingsPage` / `notificationRouter` / `sessionState`，smoke 不应只扫 `main.tsx`。完整 `ci:smoke` 已通过。
- 第 53 轮：完成 P25-5 ~ P25-9 收口。`CoreSessionService` 现在会为 App Server thread 建立独立原生 transcript session，按 thread 增量调用 `recordTranscript()`，并新增 `thread/resume` 复用 `loadConversationForResume()` 与 `extractReadFilesFromMessages()` 恢复消息和 `readFileState`。`smoke:app-server-context` 已扩展覆盖 transcript 写入、resume 恢复、compact boundary 裁剪和上下文 metadata；完整 `ci:smoke` 与 `git diff --check` 通过。结论是第一阶段不新增 `SessionContextSnapshot` 平行记忆系统，先以原生消息历史、sessionStorage、compact 和 readFileState 为主链路。当前指针切回 P21-1，继续文件、附件与引用系统。
- 第 54 轮：完成 P21-1 字段来源盘点。新增 [CCR Desktop 文件、附件与引用字段来源盘点](../architecture/desktop-file-attachment-reference-field-map.md)，明确当前已有稳定字段、只能从工具输入拿到的字段、只能从工具结果拿到的字段，以及不得从 stdout 硬猜的边界。结论是 P21 后续应优先从 `Read`、`Write`、`Edit`、`Glob`、`Grep` 的结构化 input/output 生成文件和引用事件；`PowerShell/Bash/MCP string result` 等待结构化 adapter 后再接入。当前指针切到 P21-2。
- 第 55 轮：完成 P21-2 文件卡片 DisplayEvent 模型。新增 `FileSnapshot`、`AttachmentSnapshot`、`ReferenceSnapshot`，并在 `DisplayEvent` 中正式挂载 `fileSnapshot`、`attachmentSnapshot`、`referenceSnapshot`；display-event fixture 新增 `file_change`、`file_reference`、`attachment` 三类样例，smoke 校验路径、来源、类型、风险标识等必要字段。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`。当前指针切到 P21-3。
- 第 56 轮：完成 P21-3 工具结果到文件事件归一化。新增 `extractFileDisplaySnapshotsFromToolSnapshot()`，从 `Read`、`Write`、`Edit`、`MultiEdit`、`Glob`、`Grep` 的稳定输入和结构化结果中生成文件/引用快照；`sessionState` 在工具调用与结果合并后会重新派生快照，保留 P20 的“一次工具调用一张主卡”规则。fixture 新增 `Write` 工具文件快照和 `Grep` 工具引用快照，smoke 校验工具事件必须携带归一化快照。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`。
- 第 57 轮：完成 P21-4 Desktop 文件卡片组件。新增 `FileCard` 和 `FileSnapshotPanel`，独立 `file_change` / `file_reference` / `attachment` 事件会以文件卡展示；带文件/引用/附件快照的工具卡会内嵌同一套面板，展示路径、工作区相对路径、绝对路径、来源、安全分级、mime type 和行号范围。打开、复制路径、定位按钮当前为禁用占位，真实 preload 白名单能力留到 P21-7。验证通过：`typecheck:desktop`、`desktop:build`、`git diff --check`。
- 第 58 轮：完成 P21-5 ~ P21-8 收口。文件卡现在展示 `path:line[:column]` 引用文本、搜索摘要和复制引用入口；输入框 `+` 支持附件选择占位并展示文件名、大小、mime type；Desktop main/preload 新增 `openPath`、`showItemInFolder`、`copyText` 白名单能力，路径解析、工作区外确认和系统调用都留在 main process，renderer 不直接访问 Node 文件系统。P21 fixture/smoke/doc 已收口，当前指针切到 P22-1。
- 第 59 轮：根据上下文治理源码复查和用户确认，新增 P26 “上下文、压缩与记忆能力 App Server 桥接”，专门承接 `context/status`、`compact/status`、`memory/session/status`、轻量 `appServerSetup()`、`compact/run`、自动 compact 可观测事件、Desktop 状态展示，以及 memory attachments / relevant memory / nested memory 差异补齐。P26 原则是不重写 Claude Code 原生 compact / SessionMemory / memory 系统，只把已有能力桥接到 App Server 并由 Desktop 消费。当前指针临时从 P22 切到 P26-1；P22-P24 暂缓，待 P26 收口后继续。
- 第 60 轮：根据上下文与记忆专题复核，细化 P26。新增 `querySource` gate 审计、上下文组成分析接口、memory 文件来源与缓存生命周期、relevant/nested memory 可观测、工具结果替换持久化、slash command 桥接、session memory/transcript 访问安全、跨 thread/workspace 隔离等子项。关键发现是 App Server 当前使用 `querySource: "app-server"`，而部分 Claude Code 原生能力只在 `repl_main_thread` / `sdk` / `agent:*` 下启用；后续不能只补 UI，必须先确认原生 hook 是否真正生效。
- 第 61 轮：P26 已完成。App Server 新增 `context/status`、`context/analyze`、`compact/status`、`compact/run`、`memory/session/status`，并在 `initialize` 能力中声明 `context / compact / memory`；Core thread runtime 复用原生 messages、readFileState、SessionMemory、context collapse、content replacement 和 memory attachment 状态，不新增平行记忆系统。Desktop 顶部状态、运行详情和 `/compact` 已接入这些接口；手动 compact 与原生 `compact_boundary` 都映射成 `context/compacted` 轻量事件。`context/analyze` 和 `memory/session/status` 已做脱敏，只返回聚合 token、计数和 `projects/...` 状态路径。验证通过：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server`、`smoke:app-server-context`、`smoke:app-server-client`、`smoke:desktop-display-events`、`git diff --check`。当前指针回到 P22；本轮按用户要求停在 P26 完成后的决策点。
- 第 62 轮：根据 Desktop 真实体验中“附件暂不随消息发送”的反馈，P23 已从“多模态输出预览”扩展为“多模态输入/输出、附件上传与预览”专项。P23 现在统一承接附件真实随消息发送、发送前预览、App Server 输入协议、Core user message 多模态映射、用户消息附件展示、模型/工具/MCP/browser 输出媒体归一化、历史/resume 与上下文预算边界；P21 保持为文件/附件基础模型和上传入口占位，不再承担真实多模态发送。
- 第 63 轮：继续细化 P23 的“预览不等于发送”边界。新增 P23 支持矩阵与后续计划：图片/截图和小文本文件作为第一版可发送目标，普通二进制和压缩包默认只传元信息或阻断，PDF/Office/音频/视频进入后续解析、转写、抽帧或 provider 原生 file/audio/video input 能力矩阵。P23-7 到 P23-10 已改为同时覆盖 `previewPolicy` 和 `sendPolicy`，避免只做前端预览而模型实际收不到附件。
- 第 64 轮：细化 P22 结构化输出与 JSON/Schema 视图。修正 P22 段落状态为“待开始（已细化）”，并补充 P22 边界、关键字段、结构化来源矩阵和 12 个子任务。P22 明确只负责 JSON/object/table/schema/status/permission payload/model structured output 等结构化展示，不负责文件上传、多模态发送和错误恢复动作；同时要求安全解析、脱敏、大对象保护、复制策略和 raw fallback，避免把工具结果或状态对象继续铺成黑盒代码块。
- 第 65 轮：开始登记 Desktop 人工验收插队修复任务。新增 `FIX-RT-01 Desktop turn 完成后运行快照刷新与广播时序不一致`，记录第一轮对话完成后 `context/status` 与 `compact/status` 仍显示 0、第二轮恢复正常的现象、源码判断、修复方向和验收标准。该任务先进入插队修复任务池，不立即改变 P22 当前指针；待同批问题补充完整后，再统一切指针逐个处理。
- 第 66 轮：继续登记 Desktop 人工验收插队修复任务。新增 `FIX-TOOL-02 多次 Write 时后续写入只显示工具结果，缺失写入工具卡`，记录连续两个写入时第二个写入只显示独立“工具结果”、缺少 `Write` 主工具卡和文件快照的问题。修复原则是先抓真实 `tool_use/tool_result` 事件链，优先保证 Core/App Server 事件完整，再按稳定 `toolUseId` 合并；不得用“最近工具”猜测掩盖上游事件缺失。
- 第 67 轮：补充 `FIX-TOOL-02` 的彻底修复思路。当前判断上次只修了“非文本块整坨没发出”的分支，没有覆盖“同一个 assistant item 里多个 `tool_use` 只生成第一张工具卡”的分支；后续必须按 Core 事件发出、App Server 映射、Desktop block 拆分、`toolUseId` 合并、双 Write fixture 防回归整条链路修，不能只补 UI。
- 第 68 轮：继续登记 Desktop 人工验收插队修复任务。新增 `FIX-TOOL-03 工具失败详情重复展示`，记录失败工具卡中同一段错误文本同时出现在“执行结果”和“错误详情”的问题。修复原则是保留错误分类和行动提示，但详情区域对重复 `result/errorDetail` 做去重；相同错误只显示一份，不同信息才分块展示。
- 第 69 轮：继续登记 Desktop 人工验收插队修复任务。新增 `FIX-UI-04 写入文件工具卡信息重复且视觉过重`，记录单个 `Write` 主卡同时展示标题、摘要、目标 chip、文件快照、路径正文、绝对路径 chip 和操作按钮导致信息重复的问题。修复原则是文件工具主卡采用 compact layout：主视图只保留动作、文件路径、状态和常用操作，绝对路径、raw input/result 等进入详情。
- 第 70 轮：补做 Codex 工具与文件展示源码对照。确认 Codex App Server / TUI 的核心做法是：用稳定 `call_id` 贯穿工具 started / progress / completed，找不到匹配 ID 不用“最近工具”猜测；探索类 Read/List/Search 只在 UI 层合并成 `Exploring / Explored`；文件修改走 canonical `FileChange` / `TurnDiff` 与 `create_diff_summary(...)`，主视图摘要优先，详细 diff 按需展开。已把这些对照补进 `FIX-TOOL-02`、`FIX-TOOL-03`、`FIX-UI-04`，作为后续修复约束。
- 第 71 轮：处理 `FIX-RT-01`。Desktop main process 在 turn 结束后不再只做无广播的后台 `refreshRuntimeSnapshots()`，而是通过 `refreshRuntimeSnapshotsAfterTurn(...)` 刷新 `context / compact / memory` 后额外广播 `runtime snapshots refreshed` 状态事件，并写入脱敏运行快照摘要日志。验证通过：`npm.cmd run typecheck:desktop`、`npm.cmd run desktop:build`。剩余需要 Desktop 真机第一轮对话复测，确认顶部上下文与运行详情不再停留在旧的 `0K / 200K` 快照。
- 第 72 轮：登记 Desktop compact 真机复测问题。新增 `FIX-RT-05 compact/run 超时后迟到响应触发 unknown request 且 UI 同时显示失败与成功`，记录点击“压缩会话”后同一轮出现 `compact/run timeout`、`已压缩上下文`、`unknown request` 三种互相冲突状态。初步判断是 `compact/run` 作为长耗时请求仍使用普通 App Server Client 超时，超时后 pending request 被清理，服务端迟到成功响应无法匹配，最终又被广播为用户可见错误；后续需从请求超时、迟到响应降噪和 Desktop compact 状态单一事实源三处修。
- 第 73 轮：处理 `FIX-TOOL-02`。确认根因落在 Desktop renderer：同一 `item/completed.content[]` 内多个 `tool_use` 会被路由成一条 completed item，随后 `toolEvents.ts` 只取第一个工具快照，导致后续 `Write` 只有 `tool_result` 孤立展示。本轮在 `notificationRouter.ts` 按 content block 拆分工具生命周期事件，并保留原始 contract context + `contentIndex` + 稳定 `toolUseId`；补强双 `Write` fixture 与 smoke 断言。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`。剩余需要 Desktop 真机连续双写入复测。
- 第 74 轮：记录用户真机验收结果。`FIX-RT-01 Desktop turn 完成后运行快照刷新与广播时序不一致` 与 `FIX-TOOL-02 多次 Write 时后续写入只显示工具结果，缺失写入工具卡` 均已由用户在 Desktop 侧测试确认修复完成；两项状态更新为“已完成，真机复测通过”。下一步继续处理插队修复任务池中剩余的 `FIX-TOOL-03`、`FIX-UI-04`、`FIX-RT-05`。
- 第 75 轮：继续登记 Desktop 人工验收插队修复任务。新增 `FIX-UI-06 聊天时间线未自动滚动到最新内容`，记录新消息、工具执行、权限请求等更新后滚动条不自动跟随到底部的问题。修复原则是实现“贴底跟随”而不是无脑强制滚动：用户在底部附近时自动展示最新内容，用户主动上翻历史时暂停跟随，并提供回到底部入口。下一步剩余插队任务更新为 `FIX-TOOL-03`、`FIX-UI-04`、`FIX-RT-05`、`FIX-UI-06`。
- 第 76 轮：处理 `FIX-TOOL-03`。Desktop `ToolCard` 详情区现在先生成详情块再做展示文本去重：当失败工具的 `errorMessage` 与 `result` 完全一致，或错误详情每一行都已包含在执行结果中时，只保留“执行结果”，不再重复显示“错误详情”；不同错误详情仍保留。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`。用户已完成 Desktop 真机失败工具卡复测，确认不再重复展示。
- 第 77 轮：继续登记 Desktop 人工验收插队修复任务。新增 `FIX-UI-07 内部 todo_reminder 被误展示为附件`，记录内部 `todo_reminder` 控制附件被 Desktop fallback 渲染成“附件 + raw JSON”的问题。源码对照确认原生 TUI 的 `nullRenderingAttachments.ts` 已把 `todo_reminder` 列为不渲染附件，Desktop 后续应复用同类过滤语义，只隐藏内部控制附件，不影响真实用户附件和媒体预览。
- 第 78 轮：细化 `FIX-UI-04` 范围。用户真机截图确认信息重复并不只发生在 `Write`，`Read` 读取文件卡也会重复展示读取摘要、目标 chip、文件快照、路径正文、绝对路径 chip 和操作按钮。`FIX-UI-04` 已从“写入文件工具卡”扩展为“文件类工具卡”，后续应统一处理 `Read / Write / Edit / MultiEdit / Grep / Glob` 的 compact layout，而不是只针对写入做特例。
- 第 79 轮：处理 `FIX-UI-07`。新增共享隐藏附件类型 helper，并让 Desktop 内容块 fallback 对齐原生 TUI 的 null-rendering attachment 语义；`todo_reminder`、`critical_system_reminder`、`token_usage`、`compaction_reminder` 等内部控制附件不会再被渲染成“附件 + raw JSON”。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`typecheck`、`desktop:build`、`build`、`git diff --check`。剩余需要 Desktop 真机复测确认空 Todo reminder 卡片不再出现。
- 第 80 轮：处理 `FIX-UI-04`。Desktop 文件类工具卡新增 compact layout：`Read / Write` 等文件工具主视图不再同时展示 summary、目标 chip、文件快照路径、路径正文和绝对路径 chip；主卡只保留工具名、动作化路径、状态和常用操作，详细 input/result/文件信息仍在 `查看详情`。新增 Read 文件工具 fixture，验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`。剩余需要 Desktop 真机复测读取/写入文件卡视觉效果。
- 第 81 轮：记录用户真机验收结果。`FIX-UI-04 文件类工具卡信息重复且视觉过重` 已由用户在 Desktop 侧测试确认修复完成；状态更新为“已完成，Desktop 真机复测通过”。下一步继续处理插队修复任务池中剩余的自动滚动、compact 迟到响应等问题，之后回到 P22 主线。
- 第 82 轮：处理 `FIX-RT-05`。Desktop `compact/run` 改为专门 5 分钟长超时，避免普通 30 秒默认超时误判；`JsonRpcClient` 增加超时请求保留区，已超时请求的同 id 迟到 response 会被静默清理，不再广播成 `App Server returned a response for an unknown request`，真正未知 id 仍保持 `protocol_error`。新增 `smoke:app-server-client` fake transport 回归样例，验证通过：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、`smoke:app-server-client`、`smoke:desktop-display-events`、`git diff --check`。剩余需要 Desktop 真机点击“压缩会话”复测。
- 第 83 轮：根据 Desktop 真机反馈登记 `FIX-UI-08 AskUserQuestion 结束轮次没有用户可见反馈`。本轮源码核对确认 `AskUserQuestion` 是原生需要用户交互的控制工具，TUI 有专用多选问题组件和 `updatedInput.answers` 回传语义；Desktop 当前只有通用 allow/deny 权限卡，且 control tool call/result 可能被隐藏或过滤，导致 turn 结束时只剩工具过程卡、没有“等待你回答”的最终反馈。该任务还一并记录文件读卡“失败但显示已读取”的状态矛盾和 renderer duplicate key 风险，后续应按专用 AskUserQuestion UI、答案回传、状态一致性、key 唯一性四条线修。
- 第 84 轮：记录用户真机验收结果。`FIX-RT-05 compact/run 超时后迟到响应触发 unknown request 且 UI 同时显示失败与成功` 已由用户在 Desktop 侧点击压缩上下文复测确认修复完成；状态更新为“已完成，Desktop 真机复测通过”。下一步继续处理插队修复任务池中剩余的 `FIX-UI-06`、`FIX-UI-07` 真机确认和 `FIX-UI-08` AskUserQuestion 专用交互卡问题。
- 第 85 轮：处理 `FIX-UI-06`。Desktop `ChatTimeline` 新增贴底自动滚动状态机：用户在底部附近时会随新消息、工具卡、权限请求和运行中提示自动滚到最新内容；用户主动上翻历史后暂停自动跟随，并在有新内容到达时显示“回到底部”按钮。新增 `autoScroll.ts` helper 固化 120px 底部阈值判断，内容尺寸变化时如果仍处于贴底状态会继续保持到底。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`。剩余需要 Desktop 真机长输出 / 工具执行 / 权限请求滚动复测。
- 第 86 轮：记录用户真机验收结果。`FIX-UI-06 聊天时间线未自动滚动到最新内容` 已由用户在 Desktop 侧测试确认修复完成；状态更新为“已完成，Desktop 真机复测通过”。下一步继续处理 `FIX-UI-07` 真机确认和 `FIX-UI-08` AskUserQuestion 专用交互卡问题。
- 第 87 轮：登记 Desktop 会话生命周期插队问题。新增 `FIX-UI-09 新建会话不清空当前聊天且缺少历史会话重新加载入口`。源码初步判断：renderer 点击“新建会话”只调用 `window.ccr.startThread(...)`，但没有重置本地 `sessionReducer` 状态，所以更可能是后端 thread 已创建而前端旧 timeline 未清空；同时 App Server Client 已有 `listThreads` / `resumeThread`，但 Desktop UI 还没有历史会话入口和 resume 后可见历史消息加载流程。后续应先验证 threadId 是否变化，再补 session reset、历史列表和 resume 展示边界。
- 第 88 轮：补充 `FIX-UI-09` 范围。用户真机反馈新建会话后“压缩会话”仍可点击，并报 `AppServerClientError: No messages to compact`，且可能重复刷错误卡。该问题并入会话生命周期专项：新建成功后必须清空前端 timeline，同时根据当前 thread 是否有可压缩消息禁用 compact 按钮或降级成轻量提示，避免空会话执行 compact/run。
- 第 89 轮：细化 `FIX-UI-08 AskUserQuestion` 修复任务。先在本文件内拆出 10 个子任务，后按用户纠偏迁回更合适的 `desktop-interaction-cards-todo.md` 专项文档；本文件只保留摘要和指针。后续从 `IC-03-1` 开始，先确认真实事件链和 `permission/respond` 是否已经具备透传 `updatedInput` 的能力。
- 第 90 轮：回到 P22 主线并完成 P22-1。新增 CCR Desktop 结构化输出来源盘点（撤回前历史文档已移除），确认可靠对象来源包括 Core/App Server 运行事件、工具 input/result/progress、权限请求、运行状态、MCP 列表、JSON-RPC 错误、Zod/schema 错误和原生 `structured_output`；同时明确普通 Markdown、stdout、普通字符串工具结果、日志和文件正文不在第一版里强行解析。当前指针切到 P22-2，下一步设计最小 `StructuredSnapshot` 协议边界。
- 第 91 轮：完成 P22-2。新增 CCR Desktop 结构化输出协议边界设计（撤回前历史文档已移除），明确第一版采用 Desktop renderer 从现有对象派生 `StructuredSnapshot`，不新增 App Server notification 方法，不改 Core/工具/权限/MCP 执行链路；后续只有大对象引用、schema 校验元数据、provider 原生 structured result、多客户端共享时才补 App Server contract。当前指针切到 P22-3，下一步定义 `StructuredSnapshot` 展示模型。
- 第 92 轮：完成 P22-3。新增 `apps/desktop/src/renderer/src/domain/structuredEvents.ts`，定义结构化快照、来源、视图模式、解析状态、脱敏状态、复制策略、大小摘要和 schema 校验错误类型；`DisplayEvent` 与 `ToolSnapshot` 已挂可选 `structuredSnapshots`，为后续工具卡、权限卡、运行详情和模型结构化输出接入同一套视图做准备。同步新增 CCR Desktop StructuredSnapshot 展示模型（撤回前历史文档已移除）。当前指针切到 P22-4，下一步实现安全解析、脱敏与大对象保护。
- 第 93 轮：完成 P22-4。`structuredEvents.ts` 新增结构化安全归一化函数，默认限制深度、节点数、字段数、数组长度和字符串长度，支持循环引用保护、不可序列化值字符串化、常见 `token/cookie/secret/password/key` 字段脱敏、文本 fallback、无效 JSON 状态和保守复制策略。同步新增 CCR Desktop 结构化输出安全归一化设计（撤回前历史文档已移除）。验证通过：`typecheck:desktop`、`git diff --check`。当前指针切到 P22-5，下一步实现 JSON Tree 组件。
- 第 94 轮：完成 P22-5。新增 `components/structured/StructuredView.tsx` 与 `styles/structured.css`，提供第一版结构化视图和可折叠 JSON Tree：支持对象、数组、基础类型、节点路径、默认折叠、节点复制、安全 JSON 复制、解析状态 badge、来源/节点/脱敏 meta 和 fallback 文本。验证通过：`typecheck:desktop`。当前指针切到 P22-6，下一步实现表格视图组件。
- 第 95 轮：完成 P22-6。`StructuredView` 已支持同构对象数组自动表格化，提供树/表格切换、最多 12 列/100 行的安全展示、行列数摘要、单元格摘要、复制 CSV 和复制安全 JSON。表格只消费已归一化的 `StructuredSnapshot.data`，不从普通文本、stdout 或文件正文猜结构。验证通过：`typecheck:desktop`。当前指针切到 P22-7，下一步实现 Schema 校验结果视图。
- 第 96 轮：完成 P22-7。`StructuredView` 已支持 schema 校验结果视图，消费 `StructuredSnapshot.validationErrors` 并展示字段路径、错误原因、期望、实际和错误代码；没有校验结果时显示“未校验” fallback，不在 UI 层自行校验业务对象。验证通过：`typecheck:desktop`。当前指针切到 P22-8，下一步把工具 input/result 详情接入结构化视图。
- 第 97 轮：完成 P22-8。`toolEvents.ts` 会为 `tool_use.input`、`tool_result.content`、`progress.data` 生成结构化快照；`sessionState` 合并工具调用与结果时同步合并 `structuredSnapshots`；`ToolCard` 详情区优先使用 `StructuredView` 展示工具输入/结果/进度，只有缺少结构化快照时才退回旧 raw `<pre>`。验证通过：`typecheck:desktop`。当前指针切到 P22-9，下一步把运行状态、权限参数和 MCP 页面接入结构化视图。
- 第 98 轮：完成 P22-9。权限详情 `InteractionDetails`、运行详情 `TurnRuntimeDetails`、MCP 页面已统一接入结构化快照和 `StructuredView`；运行快照会展示 metadata、context、compact、memory 的当前对象，权限/MCP 详情保留安全归一化与 raw fallback，不新增长聊天事件。验证通过：`typecheck:desktop`、`git diff --check`。当前指针切到 P22-10，下一步定位并接入模型原生 `structured_output`。
- 第 99 轮：完成 P22-10。源码确认原生结构化输出来自 `StructuredOutput` 工具结果生成的 `structured_output` attachment，并最终进入 `QueryEngine` result 的 `structured_output` 字段；Desktop 现在只识别该原生 attachment，派生 `model_structured_output` 快照并用 `StructuredOutputCard` 展示，不从普通 Markdown、stdout 或文件正文猜 JSON。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`git diff --check`。当前指针切到 P22-11，下一步收口复制、raw fallback 和诊断体验。
- 第 100 轮：完成 P22-11。`StructuredView` 的复制入口已改为“复制安全 JSON”，表格视图保留 CSV 复制，节点复制遵循同一安全 copyPolicy；诊断与复制策略默认折叠展示，说明脱敏、截断、fallback、invalid JSON 和 raw 复制禁用原因；文本 fallback/raw 详情默认折叠，避免结构化失败时重新铺成大黑盒。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`git diff --check`。当前指针切到 P22-12，下一步做 P22 最终 fixture/smoke/build/doc 收口。
- 第 101 轮：完成 P22-12 并收口 P22。新增 CCR Desktop 结构化输出实现收口（撤回前历史文档已移除），记录 P22 已接入来源、安全策略、UI 形态和验证口径；`docs/README.md` 已补入口；display-event fixture / smoke 覆盖模型 `structured_output` 结构化卡。验证通过：`typecheck:desktop`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`。P22 整体标记完成，当前指针切到 P23-1。
- 第 102 轮：根据多模态模型能力调研调整 P23 方向。P23 不再从 UI 上传按钮开始，而是先做 `ModelCapabilities`、能力来源优先级、发送前校验和 provider adapter 边界；第一版能力来源收敛为内置能力目录与 Profile 覆盖两层，官网/官方文档作为内置目录的第一来源，运行时最终能力按当前 Profile、模型和协议模式解析；未知模型默认只支持文本，OpenAI Compatible / 第三方中转必须通过 Profile 覆盖明确声明后才启用图片/文件输入。
- 第 103 轮：完成 P23-1。新增 `docs/goals/2026-05-15-p23-1-model-capabilities.md`，以后阶段性 goal 统一放入 `docs/goals/`；新增 `LlmModelCapabilities`、Profile `capabilityOverrides`、能力解析器和 `modelCapabilities` 状态输出。`config/get`、`model/availability`、`model/list` 已能返回解析后能力；未知模型默认纯文本。验证通过：`build`、`typecheck`、`smoke:model-capabilities`、`smoke:llm-config`、`smoke:llm-runtime-status`、`desktop:build`、`git diff --check`。`typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型问题。
- 第 104 轮：完成 P23-2 / MM-02。新增 `docs/goals/2026-05-15-p23-2-turn-input-validation.md`；App Server `turn/start` 支持 `input.type = "content"` 内容块协议，并在创建 turn 前根据当前 `modelCapabilities` 校验图片、文件、音频和图片限制。不支持的多模态输入返回稳定 `invalid_params` 且不会创建 turn；当前阶段 Core 仍接收文本 fallback，并通过 `turn.metadata.multimodalInput` 暂存多模态输入摘要。新增 `smoke:turn-input` 覆盖旧文本、新 content 文本、默认文本模型阻止图片、Profile 覆盖允许图片、未知模型默认阻止图片。验证通过：`build`、`typecheck`、`smoke:turn-input`、`smoke:model-capabilities`、`smoke:llm-config`、`smoke:llm-runtime-status`、`smoke:app-server`、`desktop:build`、`git diff --check`。`typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型问题。
- 第 105 轮：完成 P23-3 / MM-03。新增 `docs/goals/2026-05-16-p23-3-core-content-blocks.md`；Core 新增 `CoreTurnInput` 和 `CoreUserContentBlock`，`CoreTurn.input` 支持 `content` 并保留 `text` fallback。App Server 已校验内容块现在进入 Core；Core 用户消息事件可暴露内容块，真实 provider 请求仍使用 `input.text`，避免图片/文件/音频绕过 adapter 直接发送。`smoke:turn-input` 新增 Core fake runner 验证内容块保存与传递。验证通过：`build`、`typecheck`、`smoke:turn-input`、`smoke:app-server`、`smoke:model-capabilities`、`desktop:build`、`git diff --check`。`typecheck:desktop` 仍失败在既有 `MACRO`、Bun 和可选原生依赖类型问题。
- 第 106 轮：完成 P23-4 / MM-04。新增 `docs/goals/2026-05-16-p23-4-desktop-attachment-drafts.md`；Desktop Composer 附件从单个占位标签升级为草稿队列，支持追加、去重、删除，并按当前 `modelCapabilities` 计算 `可发送 / 可转换 / 仅预览 / 不支持`。本阶段仍不读取文件内容、不生成缩略图、不把附件发送给模型；验证通过：`desktop:build`、`build`、`typecheck`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。
- 第 107 轮：完成 P23-5 / MM-05。新增 `docs/goals/2026-05-16-p23-5-image-input-loop.md`；Desktop main/preload 新增图片附件准备入口，负责图片读取验证、10 MB 本地上限、mime type 归一化和缩略图生成。Composer 发送时会把已准备且模型可发送的图片转成 `turn/start.input.content` image block；`smoke:turn-input` 覆盖 `source.kind = "file"` 的 image block。验证通过：`desktop:build`、`typecheck`、`build`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。
- 第 108 轮：完成 P23-6 / MM-06。新增 `docs/goals/2026-05-16-p23-6-text-file-input-guardrails.md`；Desktop main/preload 附件准备入口已支持小文本文件和普通文件元信息。小文本文件 128 KB 以内会按 UTF-8 读取，并在发送时作为 `text` block 进入 `turn/start.input.content`；大文本、二进制、压缩包和未知文件默认只保留元信息。`smoke:turn-input` 新增文本文件转 text block 样例。验证通过：`typecheck`、`desktop:build`、`build`、`smoke:turn-input`。
- 第 109 轮：完成 P23-7 / MM-07。新增 `docs/goals/2026-05-16-p23-7-provider-adapter-mapping.md`；内建 LLM Runtime 新增图片内容部件，OpenAI Chat / Compatible adapter 已生成 `image_url` part，Anthropic Messages adapter 已生成 `image` block。本地图片只在 provider adapter 请求前读取并编码，OpenAI 错误 diagnostics 不输出图片 base64 或本地路径。新增 `smoke:multimodal-provider-mapping`，验证通过：`typecheck`、`build`、`smoke:multimodal-provider-mapping`、`smoke:llm-claude-adapter`、`smoke:openai-chat-protocol`、`smoke:turn-input`、`smoke:app-server`、`desktop:build`。
- 第 110 轮：完成 P23-8 / MM-08。新增 `docs/goals/2026-05-16-p23-8-attachment-display-history.md`；Desktop display event 新增多附件快照，当前发送的图片/小文本附件、历史用户内容块和工具输出媒体都能复用紧凑附件条展示；附件展示只暴露元信息和复制路径，不输出 base64。验证通过：`typecheck`、`smoke:desktop-display-events`、`desktop:build`、`smoke:turn-input`。
- 第 111 轮：开始 P23-9 / MM-09。新增 `docs/goals/2026-05-16-p23-9-smoke-real-machine-doc-closeout.md`；自动收口验证通过：`typecheck`、`build`、`desktop:build`、`smoke:model-capabilities`、`smoke:turn-input`、`smoke:multimodal-provider-mapping`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check`。剩余真机 Desktop 和真实 provider 图片请求需要先确认是否启动开发版并允许真实模型调用。
- 第 112 轮：开发版真机复查发现 `codex-oauth / gpt-5.5` 下图片附件仍显示“不支持”。已定位为能力目录和 provider 发送层双重缺口：`gpt-5.5` 仍标为 text-only，且 `CodexOAuthProvider` 用户消息仍只接受文本。本轮已补 `gpt-5.5` 的 `text + image` 内置能力、图片 limits、pi-ai image content 映射和离线 smoke；`gpt-5.4` / `gpt-5.4-mini` 保持文本策略。验证通过：`typecheck`、`build`、`smoke:model-capabilities`、`smoke:codex-oauth-provider`、`smoke:multimodal-provider-mapping`、`smoke:turn-input`、`desktop:build`、`smoke:app-server`、`git diff --check`。开发版 CCR 已重启到最新代码。
- 第 113 轮：补 P23 / MM-09 粘贴附件体验。Composer 输入框新增 `onPaste`，剪贴板里的文件和图片会进入现有附件草稿队列；资源管理器复制的有路径文件复用当前 main 读取逻辑，截图/微信/浏览器复制的无路径图片通过 IPC 把二进制交给 main，main 写入 `userData/attachments/clipboard` 受控临时文件后返回 `file` source 和缩略图。该实现不把 base64 写入 renderer 状态或普通日志。验证通过：`typecheck`、`desktop:build`。
- 第 114 轮：补 P23 / MM-09 图片附件展示。发送后的用户消息不再只显示图片文件卡，`previewDataUrl` 会从 Composer 传到 `AttachmentSnapshot` 并渲染为缩略图；历史或工具事件只有本地图片路径时，renderer 通过 `ccr:image-preview` 让 main 生成缩略图，避免直接加载 `file://`。验证通过：`typecheck`、`desktop:build`、`smoke:desktop-display-events`、`git diff --check`。
- 第 115 轮：补 P23 / MM-09 图片点开查看。消息附件条里的图片缩略图可在当前窗口打开大图预览，支持背景、关闭按钮和 Esc 关闭；点开时按需向 main 请求最大边 1600px 的较大预览，聊天流常驻状态仍保持小缩略图；复制路径按钮样式和缩略图按钮样式已拆开，避免后续附件交互互相影响。
- 第 116 轮：完成 P23-FIX 自绘窗口标题栏与窗口控制按钮第一版。真机发现 Windows 右上角 Electron `titleBarOverlay` 与自绘标题栏线条不一致，且图片预览遮罩无法覆盖原生 overlay。本轮新增 `docs/goals/2026-05-16-p23-fix-custom-window-controls.md`，已去掉 `titleBarOverlay`、保留 `titleBarStyle: 'hidden'`，并补 main/preload 窗口控制 IPC 与 renderer 自绘最小化 / 最大化还原 / 关闭按钮。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`、`git diff --check`。额外 `typecheck:desktop` 不再出现本轮命名冲突，剩余失败仍为既有 `MACRO` / `Bun` / 可选原生依赖噪声。开发版真机目视确认待用户复看。
- 第 117 轮：补 P23 / MM-09 聊天时间线自动贴底返修。真机反馈从底部向上滚动时会被新消息或内容尺寸变化拉回底部；根因是 120px 底部阈值同时承担“是否保持跟随”和“是否恢复跟随”，用户刚向上滚动但还没离开阈值时仍被判定为贴底。本轮已拆分自动跟随语义：用户向上滚动会立即暂停贴底，只在重新接近真实底部或点击“回到底部”后恢复；非贴底状态下 ResizeObserver 只更新新内容提示，不再强制滚动。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`、`git diff --check`；额外 `typecheck:desktop` 仍失败在既有 `MACRO` / `Bun` / 可选依赖类型噪声。
- 第 118 轮：补聊天 Markdown 代码块复制入口。真机截图确认普通消息中的三反引号代码块由 `renderMessageBlocks()` 直接渲染 `.message-code`，不是 `RawDataBlock`，因此缺少右上角复制按钮。本轮已把 Markdown 代码块改成带复制按钮的小组件，复用 `window.ccr.copyText` 和现有 raw-data 复制按钮视觉，复制内容只包含代码本体，不包含三反引号。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 119 轮：修复历史会话必须重启客户端才出现的问题。真机反馈新生成历史会话、或当前会话切到新会话后成为历史，都必须重启 Desktop 才能在历史列表看到。根因是 App Server 的 `session/history/list` 用内存中所有 thread 的 `sessionId/resumedFromSessionId` 作为“当前 session”集合，导致旧 thread 只要还在内存里就被 `includeCurrent: false` 误过滤；重启后内存清空才显示。已改为 Core 维护单一当前 thread：新建、恢复和开始 turn 时把目标 thread 标为 `active`，其他 thread 标为 `closed`；历史列表只过滤 `active` thread 的 sessionId。验证通过：`typecheck`、`build`、`smoke:app-server-client`、`smoke:app-server`、`git diff --check`。
- 第 120 轮：修复恢复历史会话后工具卡误显示“正在读取 / 执行中”。真机反馈重新读取会话时，历史里的 Read / PowerShell 等工具卡仍显示 running。根因是 transcript 中工具结果通常落在 `role=user` 的 `tool_result` block，历史回放此前按 role=user 直接渲染成 `user_message`，导致 `tool_result` 没有进入工具生命周期合并；前面的 `tool_use` 就一直停在执行中。已改为历史回放优先识别 `tool_use/tool_result/progress` 生命周期块，即使来自 user role 也进入工具合并；同时历史来源的孤立 `tool_use` 兜底不再显示 running，避免把已结束历史误当成当前执行。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 121 轮：修复 DeepSeek 场景下内部附件 raw JSON 泄露。真机反馈 DeepSeek 对话里出现“附件”卡片并铺出大段黑色 JSON，内容实际是 `todo.md` 文件读取附件结构（包含 `content`、`file.filePath`、`displayPath` 等字段）。根因是 Desktop 对 `attachment` content block 的 Markdown fallback 直接 `JSON.stringify(block.attachment)`，且附件快照未识别 `file.filePath/displayPath`。本轮已改为附件文本只显示简短摘要，不再展开 `content`；附件快照补充识别嵌套 `file.filePath` 与 `displayPath`，后续可按文件/附件条展示。验证通过：`desktop:build`、`typecheck`、`smoke:desktop-display-events`。
- 第 122 轮：完成 P23 / MM-09 真机验收和提交前文档收口。用户已确认 `codex-oauth / gpt-5.5` 真实图片请求能让模型读取图片，文本模型发送图片会被拦截，小文本文件、图片粘贴、图片点开预览和历史恢复/中断返修均已复测通过。`multimodal-input-output-todo.md` 已标记 MM-09 完成，`CHANGELOG.md` 补当前未发布说明；本阶段只 commit + push，不打包发布。

## 备注

- 当前状态：P23 第一版已完成，提交前收口中。
- 下一步需要：跑最终验证，commit + push；之后进入 P24 或新的 Desktop 真机返修项。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：先补 App Server，再把 Desktop App 做完整；当前进入模型输出与运行事件展示能力产品化，VS Code 插件延后。
- 第一阶段非目标：不做 websocket、daemon、多客户端共享、VS Code 插件、完整自动更新。
- 总收口标准：P1-P5 证明 app-server 最小控制面可用；P6-P8 证明真实会话可用；P9 证明 Desktop 接入 SDK 可用；P10-P17 证明 Desktop App 可用；P18-P24 证明 Desktop 能稳定展示模型输出、运行事件和错误状态；P25 证明 App Server / Desktop 已恢复原生上下文历史、工具结果回灌和恢复语义，不再每轮像新会话；P26 证明 Claude Code 原生 compact、SessionMemory 和 memory 状态已桥接到 App Server / Desktop；VS Code 已延后到单独后续主线。
- 横切修复入口：[CCR 工具能力治理修复清单](./tool-capability-repair-list.md)。
