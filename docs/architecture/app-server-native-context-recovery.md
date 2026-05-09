# CCR App Server 原生上下文链路恢复设计

## 目标

让 Desktop / App Server 入口重新复用 Claude Code 原生上下文语义，而不是每轮只把当前用户输入拼成一次性 prompt。当前阶段恢复同一 App Server thread 内的短期上下文、工具结果回灌、compact boundary 裁剪、readFileState 复用，以及按 thread 独立 transcript 的 resume 能力；避免把多 thread 错误写进同一个全局 transcript。

## 原生 CLI/TUI 链路

原生链路的关键状态在 `QueryEngine` / `ask()` 周围：

- `mutableMessages`：同一会话内持续增长的原生 `Message[]`，包含用户消息、assistant 消息、工具结果、progress、attachment、compact boundary。
- `query()`：每轮接收历史消息，内部继续执行 tool use、tool result budget、microcompact、context collapse、autocompact。
- `readFileState`：跨 turn 复用的文件读取缓存，Edit / Write 能据此判断文件是否被读过、是否被外部修改。
- `recordTranscript()`：把消息写入项目 transcript，用于 `--resume` / `--continue`。
- `compact_boundary`：原生 compact 成功后会把边界前旧历史裁剪掉，只保留边界、摘要和保留段，避免上下文无限增长。

## App Server 差异

修复前 App Server 的最小问题是：

- `runCoreQueryTurn` 每轮调用 `query({ messages: [userMessage], ... })`。
- `CoreSessionService` 只保存 `CoreThread` / `CoreTurn` 元数据，没有保存原生 `Message[]`。
- `createCoreQueryRuntime` 每轮创建空 `toolUseContext.messages` 和新的 `readFileState`。
- Desktop UI 虽然能看到工具卡片和输出，但这些内容没有稳定进入下一轮模型上下文。

这会导致模型“每轮像新会话”，刚刚确认的目标、用户纠偏、工具结果和文件状态都可能丢失。

## 第一阶段实现

当前采用“薄接回原生消息历史”的方式：

- `CoreSessionService` 为每个 thread 持有独立 `Message[]`。
- `CoreSessionService` 为每个 thread 持有独立 `FileStateCache`。
- 每轮 `runCoreQueryTurn` 先构造当前 `userMessage`，再用 `historyMessages + userMessage` 调用 `query()`。
- `query()` 产出的 renderable `Message` 会回写 thread history，包括 assistant、user tool_result、progress、attachment、tool_use_summary、compact boundary。
- `stream_event` 只用于 UI 增量展示，不写入 history，避免重复归档。
- 遇到 `system:compact_boundary` 时，按原生语义裁剪边界前历史。
- `CoreSessionService` 为每个 thread 建立独立 `sessionId` 和 transcript 路径。
- `recordThreadMessage()` 会在裁剪 compact boundary 前先调用 `recordTranscript()`，避免压缩边界或工具结果还没落盘就被本地 history 裁掉。
- `thread/resume` 复用 `loadConversationForResume()` 加载原生消息，并复用 `extractReadFilesFromMessages()` 重建 `readFileState`。
- `turn/completed` / `turn/failed` metadata 输出脱敏观测字段：`messageCount`、`lastMessageTypes`、`compactBoundaryCount`、`readFileStateSize`、`sessionId`、`sessionStoragePath`、`sessionStorageStatus`。

## P26 App Server 桥接

P25 解决“消息历史是否真的进入下一轮”的底座问题；P26 继续把原生上下文治理的可观测状态和控制入口桥接给 App Server / Desktop。这里仍然不新建平行记忆系统，而是复用已有原生能力：

- `context/status`：从 `CoreSessionService` 当前 thread 读取消息数、最近消息类型、`readFileState` 大小、compact boundary 数量、sessionStorage 状态、content replacement 计数和 memory attachment 计数。
- `context/analyze`：复用 `context-noninteractive.ts` / `analyzeContext.ts`，但只返回聚合 token、分类、计数和 usage；不返回 memory 文件路径、系统提示正文、memory 正文或 grid 原始结构。
- `compact/status`：复用 `autoCompact.ts`、`contextCollapse` 状态和当前 thread messages，给出自动压缩阈值、上下文窗口、距离自动压缩的 token 差值和最近 boundary。
- `compact/run`：复用原生 `commands/compact/compact.ts` 的 `call` 流程，再用 `buildPostCompactMessages()` 回写当前 thread history；Desktop 按钮和 `/compact` 命令都走这一条。
- `memory/session/status`：复用 `SessionMemory` 原生状态和 summary 文件路径，但只返回脱敏路径、内容长度、初始化状态、gate 状态和抽取状态。
- `context/compacted`：手动 compact 和原生 `query()` 自动产出的 `compact_boundary` 都会映射成轻量事件，Desktop 只展示摘要，不展示原始 compact JSON。

P26 还补了 App Server 的轻量初始化：`setupAppServerRuntime()` 只注册必要的 SessionMemory / context collapse / cache 清理，不调用完整 TUI `setup()`，避免 Desktop fast path 少走原生 hook。

`querySource` 采用 `repl_main_thread:app_server`，再通过 `isMainThreadQuerySource(...)` 扩展原生 gate。这样 App Server 能进入主线程 SessionMemory、tool result replacement 等语义，但不会把所有分支粗暴改成真正的 TUI query source。

## 不变式

- 同一个 thread 的第二轮必须能看到第一轮用户消息和 assistant 回复。
- 工具结果不能只存在 Desktop UI 卡片里，必须以原生 `user` / `tool_result` 形态进入 thread history。
- `readFileState` 必须跨 turn 保持，不能每轮重建。
- compact boundary 出现后，边界前历史必须被裁剪，避免恢复历史后反而导致上下文无限增长。
- App Server 的修复不能改 CLI/TUI 渲染链路；CLI/TUI 仍走原来的 `QueryEngine` / `ask()` 主链。
- transcript 持久化失败不能直接打断当前 turn；只把 `sessionStorageStatus` 标记为 `failed`，供日志和 Desktop 诊断。

## sessionStorage / resume 边界

`sessionStorage` 不能按“全局最近会话”隐式硬接，原因是原生 transcript 基于 session id 和项目目录，而 App Server 是多 thread 入口。如果不做 thread 显式映射就直接调用 `recordTranscript()`，可能出现：

- 多个 App Server thread 写入同一个 transcript。
- Desktop 重启后无法判断哪个 transcript 对应哪个 thread。
- 权限、文件状态、compact boundary 的恢复链路和原生 `--resume` 语义混用。

当前实现按这个顺序处理：

1. 为 App Server thread 建立 `threadId -> sessionId / transcriptPath` 映射。
2. `thread/start` 默认创建新 session，不隐式恢复最近会话。
3. `thread/resume` 显式接收 `sessionId`，而不是猜测最近会话。
4. 复用 `recordTranscript()` 写入消息，但按 thread 独立 session 写入。
5. 复用 `loadConversationForResume()` 加载旧消息，再种入 thread `Message[]`。
6. 复用 `extractReadFilesFromMessages()` 从恢复消息里重建 `readFileState`。
7. smoke 覆盖 transcript 写入、resume 后消息恢复、resume 后 readFileState 恢复。

## 验证

当前已覆盖：

- `smoke:app-server-context`：验证同一 thread 两轮历史保持。
- `smoke:app-server-context`：验证 `readFileState` 跨 turn 复用。
- `smoke:app-server-context`：验证 compact boundary 裁剪边界前历史。
- `smoke:app-server-context`：验证 transcript 按 thread session 写入。
- `smoke:app-server-context`：验证 `thread/resume` 恢复消息和 `readFileState`。
- `smoke:app-server-context`：验证 `context/status`、`compact/status`、`memory/session/status`、`context/analyze` 聚合输出和 `context_compacted` 事件。
- `ci:smoke`：验证 `typecheck`、`build`、`typecheck:desktop`、`desktop:build`、`smoke:app-server`、`smoke:app-server-context`、`smoke:app-server-client`、`smoke:runtime`、`smoke:permissions`、`smoke:deps`。

待补验证：

- 真实 query 级 context collapse / budget 仍依赖原生 `query()` 内部机制，后续如出现真实长上下文问题再补专项 fixture。
- 工具调用后一轮能复述刚刚工具结果的真实模型验证。
- Desktop 重启后的 `thread/resume` 端到端人工验收入口。
