# CCR Desktop 历史会话 Todo

## 目标

把 CCR Desktop 的历史会话做成可恢复、可搜索、按 workspace 分组的弹窗列表，并让实现复用原生 `/resume` 的 transcript 历史读取链路。

## 边界

- 本 todo 只覆盖 Desktop 历史会话列表、历史查询 API、历史恢复链路和相关验证。
- 不改远端 compact 行为。
- 不重写原生 TUI `/resume`。
- 不把 renderer 变成磁盘扫描者；历史读取必须通过本地 App Server。
- 不继续把持久化历史 fake 成运行态 `CoreThread` 塞进 `thread/list`。

## 当前任务列表（实时）

- [x] HIST-01 形成历史会话方案文档与标准 todo
- [x] HIST-02 清理旧 thread/list 临时补丁，恢复运行态列表语义
- [x] HIST-03 设计并实现 session/history/list 本地 App Server API
- [x] HIST-04 定义历史项与 workspace 分组协议类型
- [x] HIST-05 Desktop main/preload/renderer 接入新 API
- [x] HIST-06 历史弹窗实现 workspace 折叠树、范围切换和搜索
- [x] HIST-07 补强 thread/resume，支持 transcriptPath/projectPath 恢复
- [x] HIST-08 恢复后加载原历史消息，避免空 thread 或重复会话
- [x] HIST-09 测试与真机验收

## 当前指针

- 进行中：无
- 当前正在做：历史会话主线已完成。
- 当前下一项：无。后续如果发现新的历史会话问题，单独登记 `FIX-HIST-*` 修复任务。
- 完成后下一项：无。

## 任务拆分

### HIST-01 形成历史会话方案文档与标准 todo

输入：

- 当前 Desktop 历史会话问题反馈。
- 原生 `/resume` 源码链路。
- Codex App Server `thread/list` 对照。
- OpenClaw session store / resume 对照。

输出：

- `docs/architecture/desktop-session-history-design.md`
- `docs/stages/desktop-session-history-todo.md`
- `docs/README.md` 索引入口

验收：

- 方案文档明确本地 App Server、Core 运行态 thread、Transcript 历史态、Desktop UI 状态四者边界。
- todo 文档可被标准 todo 解析器识别。

### HIST-02 清理旧 thread/list 临时补丁

目标：

- 把 `thread/list` 收回“当前运行态 thread 列表”语义。

具体动作：

- 移除 `src/app-server/handlers/sessionHandlers.ts` 里 `loadMessageLogs(50)` fake `CoreThread` 的逻辑。
- 保留 `context.core.session.listThreads()` 作为 `thread/list` 的主要来源。
- 检查 renderer 是否还依赖 `metadata.source === 'session_transcript'`。
- 补一个最小 smoke，确认 `thread/list` 只返回运行态 thread，不承担历史列表。

验收：

- `thread/list` 不再扫描 transcript。
- 旧历史入口迁移到新 API 后不再依赖该临时字段。

### HIST-03 设计并实现 session/history/list 本地 App Server API

目标：

- 新增专门的历史会话查询接口。

具体动作：

- 在 `src/app-server/protocol.ts` 定义 `SessionHistoryListParamsSchema` 和 response 类型。
- 在 `src/app-server/router.ts` 注册 `session/history/list`。
- 在 `src/app-server/handlers/sessionHandlers.ts` 或独立 `historyHandlers.ts` 中实现 handler。
- 默认 `scope=sameRepo` 时调用 `loadSameRepoMessageLogsProgressive(getWorktreePaths(getOriginalCwd()))`。
- `scope=allProjects` 时调用 `loadAllProjectsMessageLogsProgressive()`。

验收：

- API 支持 `scope/query/limit/cursor/includeCurrent`。
- API 返回 groups，而不是扁平 `CoreThread[]`。

### HIST-04 定义历史项与 workspace 分组协议类型

目标：

- 固定前后端契约，避免 renderer 自己猜字段。

具体动作：

- 定义 `SessionHistoryWorkspaceGroup`。
- 定义 `SessionHistoryItem`。
- 明确 `title/titleSource/projectPath/transcriptPath/isCurrentSession/messageCount` 字段含义。
- 把 `LogOption` 到 `SessionHistoryItem` 的映射放在 App Server 层。

验收：

- Desktop renderer 只消费协议字段。
- 标题优先级与 `sessionStorage.ts` 的 `customTitle/aiTitle/lastPrompt/firstPrompt` 口径一致。

### HIST-05 Desktop main/preload/renderer 接入新 API

目标：

- 让 Desktop UI 通过本地 App Server 查询历史。

具体动作：

- Electron main 增加 `sessionHistoryList` IPC。
- preload 暴露类型安全 API。
- renderer session state 增加历史加载状态、错误状态、范围和搜索词。

验收：

- 打开历史弹窗时调用新 API。
- 不再通过 `thread/list` 加载历史弹窗。

### HIST-06 历史弹窗实现 workspace 折叠树、范围切换和搜索

目标：

- 形成接近 Codex 项目列表的历史体验。

具体动作：

- 弹窗顶部增加搜索框。
- 增加 `当前项目 / 全部项目` 范围切换。
- workspace 分组默认展开当前项目，其他项目可折叠。
- 搜索命中自动展开。
- 列表项显示标题、更新时间、消息数和 sessionId 短号。

验收：

- 历史列表不再出现在聊天时间线。
- 新建会话后历史能在当前 workspace 分组看到。
- 不同 workspace 的会话可以区分。

### HIST-07 补强 thread/resume，支持 transcriptPath/projectPath 恢复

目标：

- 恢复时不只靠 sessionId 猜测 transcript 位置。

具体动作：

- 扩展 `ThreadResumeParams`，支持 `transcriptPath/projectPath`。
- App Server 把历史项转成 `LogOption` 后调用 `loadConversationForResume(log, undefined)`。
- 跨 workspace 恢复时加确认分支。

验收：

- 当前 workspace 内恢复成功。
- 全部项目里跨 workspace 恢复有明确确认。
- 恢复后不会生成重复空 thread。

### HIST-08 恢复后加载原历史消息

目标：

- 恢复历史后，聊天区能看到原会话消息。

具体动作：

- 确认 `CoreSession.resumeThread(...)` 写入 `#threadMessages` 的消息完整。
- renderer 切换 active thread 后拉取或接收已有消息。
- 必要时新增 `thread/read` 或复用已有消息读取 API。

验收：

- 选择历史会话后能看到历史时间线。
- 继续发送消息时沿原 session transcript 追加。

### HIST-09 测试与真机验收

目标：

- 用自动化和真机操作验证历史链路。

具体动作：

- 补 `session/history/list` handler smoke。
- 补 renderer 历史弹窗基本交互 smoke。
- 跑 `npm.cmd run typecheck:desktop -- --pretty false`。
- 跑 `npm.cmd run typecheck -- --pretty false`。
- 构建后重启 CCR Desktop 让用户真机验收。

验收：

- 当前项目历史可见。
- 全部项目历史可见。
- 搜索可用。
- 恢复不重复、不空白。
- TUI/CLI `/resume` 行为不回退。

## 验收清单

- [x] 历史入口是弹窗，不污染聊天时间线。
- [x] 默认当前项目历史可见。
- [x] 全部项目按 workspace 分组。
- [x] 每个会话都有可读标题。
- [x] 搜索覆盖标题、prompt、sessionId、workspace。
- [x] 点击同一历史不会让会话越点越多。
- [x] 新建会话能进入历史。
- [x] 恢复会话能看到原消息。
- [x] 跨 workspace 恢复有确认。
- [x] CLI/TUI 链路不受影响。

## 备注

- 当前状态：completed
- 决策点：历史会话代码实现、自动化验证和 Desktop 真机验收均已完成。
- 下一步需要：无。后续新问题单独登记 `FIX-HIST-*`。

## 后续记录（追加）

### 第 1 轮：方案与 todo 落地

- 已完成历史会话设计文档。
- 已生成可继续执行的标准 todo。
- 当前停在决策点，不在本轮直接改运行代码。

### 第 2 轮：历史会话实现与自动验证

- 已清理 `thread/list` 的 transcript 扫描临时补丁，恢复为只返回当前运行态 thread。
- 已新增 `session/history/list` App Server API，支持 `sameRepo/allProjects`、搜索、分页游标、当前会话过滤和 workspace 分组。
- 已接入 Desktop main/preload/renderer，历史入口改为弹窗列表，支持当前项目/全部项目切换、搜索和 workspace 折叠展示。
- 已补强 `thread/resume`，支持 `transcriptPath/projectPath`，跨 workspace 恢复时 Desktop main 会先切换到原项目，再恢复 transcript。
- 已让 `thread/resume` 返回可显示的历史消息快照，renderer 恢复后会回放旧消息，不再只显示空 thread。
- 已完成自动验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run typecheck:desktop -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run desktop:build`、`git diff --check` 均通过。
- 用户已在 CCR Desktop 中完成历史、搜索、恢复和新建会话真机验证；历史会话主线收口。

### 第 3 轮：真机验收完成

- 用户已确认历史会话链路完成真机验收。
- 验收范围包括：历史弹窗、搜索、新建会话进入历史、恢复原消息、避免重复会话、跨 workspace 恢复确认，以及 CLI/TUI `/resume` 不受影响。
- 历史会话主线状态改为 completed；后续新问题不再扩大本 todo，改按 `FIX-HIST-*` 单独登记。
