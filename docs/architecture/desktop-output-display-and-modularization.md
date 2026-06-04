# CCR Desktop 输出展示与前端模块化方案

> 当前权威入口：本文保留 Desktop 输出展示和前端拆分的产品化设计背景；历史/实时展示协议的当前权威边界以 [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md) 和 [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md) 为准。

## 1. 文档目标

本文档用于约束 `CCR Desktop` 下一阶段的输出展示和前端代码组织方式。

当前问题不是单个样式问题，而是展示层边界还不够清晰：

- 模型正文、思考内容、工具调用、工具结果、权限请求、TodoWrite、错误状态混在同一条聊天流里。
- `main.tsx` 同时承担 App 状态、App Server 通知处理、内容块格式化、组件渲染、权限响应和样式适配，已经进入原型堆叠状态。
- TodoWrite、thinking、tool_result 等内容还没有稳定的“用户可见事件”规则，容易把 raw JSON、英文工具结果、空白思考卡片直接展示给用户。

下一步目标是参考 Codex 的展示思路，把 CCR Desktop 从“事件原样展示”改成“用户可理解事件展示”。

当前实现状态（2026-05-28）：

- App Server 已输出 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 作为 Desktop 展示权威载荷。
- 历史恢复走 `displaySnapshot.items`；实时通知走 `patch.operations`。
- Desktop main 只保存和转发展示 snapshot / patch，不再把 `thread/messages/list.result.messages` 当成 UI 历史 replay。
- Renderer 不应解析 transcript、provider raw output、`parentUuid` 或 compact 结构；缺失 projection 时展示协议错误卡。
- 本文后续的 `notification -> desktop event -> display event -> component` 可理解为前端视觉层拆分方向；展示事实的归一化已经前移到 App Server ThreadDisplay reducer / projector。

## 2. 核心原则

```text
App Server notification 不是 UI。
Core item / tool block 也不是 UI。
Desktop 必须先归一化成用户可见事件，再由组件渲染。
```

设计原则：

- 聊天区只展示用户需要阅读、判断或继续操作的信息。
- raw JSON、原始工具结果、调试字段默认不直接展示，只放到“查看原始内容”或日志页。
- 思考内容默认不展示 raw thinking；优先展示进度、摘要或折叠后的说明。
- TodoWrite 不作为普通工具结果进入聊天区，而是进入任务列表浮层。
- 工具调用、权限请求、文件变更、MCP、WebSearch、错误都应该有专用卡片。
- 前端组件只负责展示和交互，不直接实现 Core 业务逻辑。

## 3. Codex 可借鉴点

Codex 的关键不是展示更多内容，而是做了严格分层：

```text
协议事件 -> TUI 状态处理 -> HistoryCell / StatusSurface -> 用户可见 UI
```

可借鉴点：

- `AgentMessageDelta` 进入流式文本控制器，最后合并成一条 Markdown 消息。
- `ReasoningSummaryTextDelta` 可以进入思考摘要；`ReasoningTextDelta` 默认不展示，除非开启 raw reasoning 调试。
- `update_plan` 的工具输出不是 UI 主体，真正展示的是结构化任务列表。
- 命令执行、MCP、WebSearch、图片、Patch、警告、错误都有自己的展示单元。
- 很多低层通知只更新内部状态，不进入聊天历史。

CCR 不需要照抄终端 UI，但应该照抄这个边界。

## 4. 用户可见输出矩阵

| 来源 | 例子 | 默认展示位置 | 展示方式 | raw 内容 |
| --- | --- | --- | --- | --- |
| 用户输入 | prompt | 聊天流 | 用户消息气泡 | 不需要 |
| 助手正文 | text / markdown / code | 聊天流 | Markdown 消息，流式合并 | 不默认展示 |
| 思考摘要 | reasoning summary / progress | 聊天流或轻量状态 | 可折叠“思考/进展”卡 | 默认隐藏 |
| raw thinking | thinking / redacted_thinking | 调试详情 | 默认不展示，必要时折叠 | 可查看 |
| TodoWrite | todos JSON | 角落浮层 | 竖向任务列表，显示进度 | 可查看原始 JSON |
| 工具调用 | Bash / Read / Write / MCP | 聊天流 | 工具调用卡，显示名称、摘要、状态 | 可展开 |
| 工具结果 | stdout / result block | 工具卡内部 | 短结果直接显示，长结果折叠 | 可展开 |
| 权限请求 | permission/requested | 聊天流 | 权限请求卡，允许/拒绝 | 可展开参数 |
| 文件变更 | write / patch / diff | 文件事件卡 | 文件名、动作、路径、风险 | 可查看 diff |
| MCP 调用 | mcp tool call | MCP 工具卡 | server、tool、状态、摘要 | 可展开 |
| Web / Browser | search / browser action | 工具卡 | 查询、页面、状态、结果摘要 | 可展开 |
| 错误 | provider / app server / tool error | 错误卡 | 面向用户的短原因和下一步 | 详情折叠 |
| 控制信息 | token / stop reason / request id | 状态详情 | 顶栏状态或 turn 详情 | 日志页 |

## 5. 事件归一化层

Desktop renderer 需要新增一个轻量归一化层，把 App Server 通知和 completed item 转成稳定的展示模型。

建议命名：

```text
notification -> desktop event -> display event -> component
```

第一版类型可以按用途拆：

```ts
type DisplayEvent =
  | AssistantMessageEvent
  | ThinkingSummaryEvent
  | ToolCallEvent
  | ToolResultEvent
  | PermissionRequestEvent
  | TodoListEvent
  | FileChangeEvent
  | ErrorEvent
  | SystemNoticeEvent
```

不变式：

- `item/delta` 不直接创建 UI 卡片，必须先合并到对应 `itemId + contentIndex`。
- 空 thinking 不创建卡片。
- TodoWrite 的 `tool_use` 和 `tool_result` 不进入普通工具消息，而是更新任务浮层。
- 权限请求完成、取消或 turn 完成后，权限卡必须关闭或变成简短历史摘要。
- 同一个 item 的流式正文最终只能合并成一个 assistant message。

## 6. 前端模块化目标结构

当前 renderer 只有 `main.tsx` 和 `styles.css`，下一步需要拆成清晰目录。

建议结构：

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
      ChatMessage.tsx
      AssistantMessage.tsx
      UserMessage.tsx
      ThinkingSummaryCard.tsx
      ToolCard.tsx
      PermissionCard.tsx
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
    displayEvents.ts
    contentBlocks.ts
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

拆分边界：

- `app/`：组合应用、管理顶层状态、接收 App Server 通知。
- `domain/`：纯函数和类型，把协议数据归一化为 UI 可用模型。
- `components/`：只接收 props 渲染，不直接处理 App Server 原始通知。
- `services/`：封装 `window.ccr` preload 白名单调用。
- `styles/`：按布局、聊天、卡片、浮层拆分，避免一个 CSS 文件无限膨胀。

## 7. 第一阶段拆分顺序

不要一次性大重构，按风险从低到高拆。

第 1 轮：纯展示组件拆分

- 从 `main.tsx` 拆出 `WindowTitlebar`、`TopbarUpdateNotice`、`ThinkingIndicator`。
- 拆出 `MessageContent`、`ChatTimeline`、`PermissionCard`。
- 不改变事件逻辑，只降低文件体积。

第 2 轮：内容格式化归一化

- 把 `formatContentBlock`、`formatToolResultContent`、`renderMessageBlocks`、`normalizeMessageText` 移到 `domain/contentBlocks.tsx`。
- 给 thinking、tool_use、tool_result、TodoWrite 建立明确分流函数。

第 3 轮：通知路由拆分

- 把 `notification.method` 分发从 `App` 组件移到 `app/notificationRouter.ts`。
- 路由只输出状态变更意图，不直接操作 JSX。

第 4 轮：TodoWrite 浮层

- 新增 `TodoOverlay`。
- TodoWrite 更新只进入浮层状态，不再进入普通聊天卡。
- 提供 `查看原始 JSON` 折叠入口。

第 5 轮：思考展示策略

- 收到第一段非空 thinking summary 后再创建思考卡。
- raw thinking 默认不展示。
- 空白 thinking item 在 completed 阶段过滤。
- 后续如果要展示推理，优先展示“模型正在检查文件/准备工具/整理结果”这类摘要。

第 6 轮：工具卡片产品化

- Bash / Read / Write / MCP / Browser 等工具按同一基础卡片展示。
- 短结果直接显示，长结果折叠。
- 失败结果用错误卡，不和成功输出混排。

## 8. 与 Core / App Server 的边界

Desktop 只能做展示归一化，不做业务执行。

允许 Desktop 做：

- 合并流式文本。
- 过滤空白展示事件。
- 把 TodoWrite 参数转成任务列表 UI。
- 把工具结果摘要化。
- 把错误转成人能读懂的提示。

不允许 Desktop 做：

- 重新判断权限是否允许。
- 自己执行命令。
- 自己连接 provider。
- 自己读取 OAuth token。
- 自己管理 MCP 生命周期。
- 自己发明第二套 thread / turn / item 状态机。

如果展示需要缺少字段，应先补 App Server event contract，而不是在 Desktop 猜。

## 9. 聊天时间线视觉口径

聊天页的顶部信息和时间线内容要分层处理。工作区路径、模型、连接状态和上下文容量属于页面级控制区；会话标题、会话工具按钮和消息时间线属于聊天区。聊天区顶部应有自己的分隔栏，时间线从分隔栏下方开始，避免用一条悬浮提示去充当标题区和消息区之间的边界。

消息行采用“头像列 + 内容面板”两段式结构：

- 外层消息行只负责网格布局、间距和宽度，不承担背景、边框或 padding。
- 头像列独立占位，头像靠近内容第一行；不要对整条消息做垂直居中，否则长回复时头像会落到正文中段。
- 内容面板负责普通消息的边框、背景、圆角和 padding。
- 工具事件的内容面板由工具卡主体承载，保持工具调用、工具结果和状态标签在同一个工作流方向上阅读。
- 系统提示、工具调用、错误、压缩提示仍保持左侧工作流，不参与左右跳动式对话布局。

用户消息需要比普通助手消息更容易扫到，但不应破坏主时间线密度。第一版使用同一内容列宽度铺满，靠轻色相、边框和阴影区分用户输入；不要把用户消息缩成短气泡或强行右对齐。短气泡在少量消息时像聊天软件，但在工具密集、长报告和表格输出混排时会造成时间线左右断裂。

颜色原则：

- 用户消息可以使用与工具卡相近但不相同的浅色系，表达“这是用户输入”，但不要和工具卡使用同一底色。
- 工具卡保持工作流卡片语义，优先突出工具名、状态、耗时和展开入口。
- 助手正文保持低干扰阅读背景，长 Markdown、表格和代码块优先保证可读性。
- 不通过加大字号或重复标题来制造层级；布局、留白、分隔线和内容面板承担主要层级。

## 10. 验收标准

完成这一阶段后，Desktop 应满足：

- 主聊天流不再出现 TodoWrite raw JSON 大块内容。
- 主聊天流不再出现空白思考卡。
- 默认不展示英文 raw thinking；需要时只能从详情或日志查看。
- 同一个助手回答不会被拆成一个字或一句一张卡。
- 权限请求响应后不会长期滞留在当前 turn 中。
- 工具调用有统一卡片样式，长内容可折叠。
- `main.tsx` 不再承载所有逻辑，新增功能能按模块落位。
- 聊天页顶部控制区和消息时间线有清晰分隔，不依赖临时提示条充当结构边界。
- 用户、助手、工具、系统提示在同一时间线里保持稳定阅读方向，只有用户输入通过轻量视觉差异突出。

## 11. 当前优先级

建议先做：

1. 拆 `MessageContent` / `PermissionCard` / `ThinkingIndicator`，降低 `main.tsx` 复杂度。
2. 建 `domain/contentBlocks.tsx`，把 thinking / tool / TodoWrite 分流规则写清楚。
3. 做 TodoWrite 浮层，解决最刺眼的 raw JSON 展示问题。
4. 修空白思考卡和 raw thinking 默认展示问题。

这些完成后，再继续 P19-P24 的控制信息、文件附件、结构化输出、多模态和错误治理。
