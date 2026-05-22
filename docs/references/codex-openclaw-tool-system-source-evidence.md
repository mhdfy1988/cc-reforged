# Codex 与 OpenClaw 工具系统源码对照索引

更新时间：2026-05-21

本索引用来固定本轮阅读 `Codex Rust v0.131.0` 与 `OpenClaw 2026.5.18` 工具系统时确认过的源码证据。后续 CCR 继续推进工具注册、Provider 能力工具化、MCP、Skill、Plugin、图片生成工具和 Desktop 工具卡展示时，先读这里，不必每次重新翻完整参考仓库。

## 1. 总结论

Codex 和 OpenClaw 都不是靠系统提示让模型“自己知道有什么能力”。

它们共同遵循一条主线：

```text
工具定义
-> 当前环境 / provider / profile / 权限过滤
-> 模型可见工具 schema
-> 运行时 handler / executor
-> 工具调用派发
-> 工具结果标准化
-> UI 展示元数据
```

差异是：

| 项目 | 定位 | 工具系统特点 |
| --- | --- | --- |
| Codex | 偏底层的工具内核 | 强调 `ToolSpec`、`ToolExecutor`、`ToolRegistry`、hosted tool、MCP、dynamic tool 和 deferred discovery。 |
| OpenClaw | 偏产品化的 Agent 工具平台 | 在基础工具之上增加工具目录、profile、allow/deny、插件注册、Tool Search、Codex 动态工具桥和 UI 展示配置。 |
| CCR 应借鉴的方向 | 统一工具治理层 | 不要只写 prompt。工具要有统一注册表、能力判定、执行器、结果协议和展示协议。 |

## 2. Codex 工具系统

源码基线：`D:\learn_code\codex-rust-v0.131.0`

### 2.1 核心源码入口

| 路径 | 作用 |
| --- | --- |
| `codex-rs\tools\src\tool_definition.rs` | 通用工具定义，包含 `name`、`description`、`input_schema`、`output_schema`、`defer_loading`。 |
| `codex-rs\tools\src\tool_spec.rs` | 发给 OpenAI Responses API 的模型可见工具协议。 |
| `codex-rs\tools\src\tool_executor.rs` | 工具运行时执行契约，定义 `ToolExecutor` 和 `ToolExposure`。 |
| `codex-rs\protocol\src\tool_name.rs` | 工具名结构，支持命名空间工具。 |
| `codex-rs\core\src\tools\spec_plan.rs` | 根据配置、MCP、动态工具和扩展工具组装最终工具池。 |
| `codex-rs\core\src\tools\registry.rs` | 工具注册表和工具调用派发。 |
| `codex-rs\core\src\tools\router.rs` | 将模型返回的 tool call 转成内部 `ToolCall` 并交给 registry。 |
| `codex-rs\tools\src\mcp_tool.rs` | MCP 工具转 Codex 工具定义。 |
| `codex-rs\tools\src\dynamic_tool.rs` | App Server / client 动态工具转 Codex 工具定义。 |
| `codex-rs\tools\src\tool_discovery.rs` | `tool_search` 和插件/连接器发现能力。 |
| `codex-rs\core\src\tools\hosted_spec.rs` | hosted `image_generation` 和 `web_search` 工具定义。 |

### 2.2 模型可见协议

`ToolSpec` 是 Codex 发给模型的工具协议，当前包括：

| ToolSpec 类型 | 模型侧名称 | 含义 |
| --- | --- | --- |
| `Function` | 具体 function name | 普通函数工具。 |
| `Namespace` | namespace name | 命名空间工具集合，常用于 MCP 或延迟加载工具。 |
| `ToolSearch` | `tool_search` | 搜索 deferred 工具。 |
| `ImageGeneration` | `image_generation` | OpenAI hosted 图片生成工具。 |
| `WebSearch` | `web_search` | OpenAI hosted 网络搜索工具。 |
| `Freeform` | custom name | 自定义 freeform 工具。 |

关键结论：Codex 的图片生成不是让模型“写 SVG”或“猜 shell 命令”，而是把 `image_generation` 作为 hosted tool 暴露给模型。

### 2.3 执行契约

`ToolExecutor` 把模型可见 schema 和真实运行时绑在一起：

| 方法 / 字段 | 语义 |
| --- | --- |
| `tool_name()` | 当前 executor 处理哪个工具名。 |
| `spec()` | 返回模型可见 schema；没有 schema 的工具可以只作为运行时能力存在。 |
| `exposure()` | 工具如何暴露给模型。 |
| `supports_parallel_tool_calls()` | 是否支持并行调用。 |
| `handle()` | 真正执行工具调用并返回 `ToolOutput`。 |

`ToolExposure` 有三类：

| 曝光方式 | 含义 |
| --- | --- |
| `Direct` | 初始请求直接给模型可见。 |
| `Deferred` | 注册到运行时，但初始不暴露；需要通过 `tool_search` 发现。 |
| `DirectModelOnly` | 给模型可见，但不进入 code-mode 嵌套工具面。 |

### 2.4 注册和派发流程

Codex 的工具生命周期可以压成这条链：

```text
ToolsConfig
-> collect_tool_executors(...)
-> append_tool_search_executor(...)
-> prepend_code_mode_executors(...)
-> build_model_visible_specs_and_registry(...)
-> model_visible_specs 发给模型
-> ToolRegistry 保存所有可执行工具
-> 模型返回 tool call
-> ToolRouter 转成内部 ToolCall
-> ToolRegistry.dispatch_any(...)
-> 对应 executor.handle(...)
```

重要边界：

- 模型可见工具列表和运行时可执行工具表不是同一个东西。
- `Deferred` 工具不进初始模型上下文，但仍在 registry 中等待后续发现。
- MCP、dynamic tool、extension tool 都会被转成 executor，最终进入同一套 registry。
- registry 会按 `ToolName` 去重，重名工具会被拒绝，避免派发歧义。

### 2.5 Codex 工具清单

以下是源码中能确认到的主要工具面。最终是否出现，仍取决于 `ToolsConfig`、模型能力、环境模式、feature gate、MCP 连接和插件状态。

#### 命令、文件和本地环境

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 统一命令执行 | `exec_command` | Codex 统一 exec 工具。 |
| 写入运行中命令输入 | `write_stdin` | 给正在运行的 exec session 写 stdin。 |
| 传统 shell 命令 | `shell_command` | 旧式 shell 工具或兼容工具。 |
| 补丁修改 | `apply_patch` | 以 patch 方式修改文件。 |
| 查看本地图像 | `view_image` | 读取并展示本地图像。 |
| code-mode 执行 | `exec` | code-mode 内部 public exec tool。 |
| code-mode 等待 | `wait` | code-mode 内部 wait tool。 |

#### 计划、用户输入和权限

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 更新计划 | `update_plan` | 更新任务计划。 |
| 请求用户输入 | `request_user_input` | 向用户提问并等待选择或文本输入。 |
| 请求权限 | `request_permissions` | 请求执行权限。 |

#### 搜索、插件和 hosted 工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 工具搜索 | `tool_search` | 搜索 deferred 工具。 |
| 请求安装插件/连接器 | `request_plugin_install` | 向用户请求安装发现到的插件或连接器。 |
| hosted 图片生成 | `image_generation` | OpenAI Responses API hosted image generation。 |
| hosted 网络搜索 | `web_search` | OpenAI Responses API hosted web search。 |

#### MCP 与动态工具

| 中文名 | 工具名形态 | 说明 |
| --- | --- | --- |
| MCP 资源列表 | `list_mcp_resources` | 列出 MCP server 暴露的资源。 |
| MCP 资源模板列表 | `list_mcp_resource_templates` | 列出 MCP resource templates。 |
| MCP 资源读取 | `read_mcp_resource` | 读取 MCP 资源内容。 |
| MCP 具体工具 | `mcp__<server>__<tool>` | 由 MCP server 动态提供，使用 namespace 保存来源。 |
| 动态工具 | 运行时注入名称 | 由 App Server / client / extension 传入 `DynamicToolSpec`。 |

#### 多 Agent、Goal 和批任务

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 创建子 Agent | `spawn_agent` | 启动子 Agent。 |
| 发送输入 | `send_input` / `send_message` | 给子 Agent 发送消息。 |
| 等待子 Agent | `wait_agent` | 等待子 Agent 完成。 |
| 关闭子 Agent | `close_agent` | 关闭子 Agent。 |
| 恢复子 Agent | `resume_agent` | 恢复已有子 Agent。 |
| 列出 Agent | `list_agents` | multi-agent v2 下列出 Agent。 |
| 后续任务 | `followup_task` | multi-agent v2 下派发后续任务。 |
| 获取 Goal | `get_goal` | Goal 工具开启时可用。 |
| 创建 Goal | `create_goal` | Goal 工具开启时可用。 |
| 更新 Goal | `update_goal` | Goal 工具开启时可用。 |
| CSV 批量启动 Agent | `spawn_agents_on_csv` | agent jobs 工具。 |
| 汇报批任务结果 | `report_agent_job_result` | agent jobs worker 工具。 |

## 3. OpenClaw 工具系统

源码基线：`D:\learn_code\openclaw-2026.5.18`

### 3.1 核心源码入口

| 路径 | 作用 |
| --- | --- |
| `docs\concepts\session-tool.md` | 会话工具说明，列出 `sessions_*`、`subagents`、`session_status`。 |
| `docs\plugins\tool-plugins.md` | Tool Plugin 机制说明。 |
| `docs\tools\tool-search.md` | OpenClaw Tool Search 设计说明。 |
| `src\agents\tool-catalog.ts` | 核心工具目录、分组、profile 和 group。 |
| `src\agents\tool-policy.ts` | allow/deny、group、插件工具权限展开。 |
| `src\agents\tool-policy-shared.ts` | 工具名 normalize 和 alias，例如 `bash -> exec`。 |
| `src\agents\pi-tools.ts` | 组装 PI / coding agent 工具池的主入口。 |
| `src\agents\openclaw-tools.ts` | 组装 OpenClaw 产品工具和插件工具。 |
| `src\agents\openclaw-plugin-tools.ts` | 将插件工具纳入 OpenClaw 工具池。 |
| `src\plugin-sdk\tool-plugin.ts` | `defineToolPlugin` 和 `api.registerTool` 的 SDK 实现。 |
| `extensions\codex\src\app-server\dynamic-tools.ts` | 把 OpenClaw 工具转成 Codex dynamic tools。 |
| `extensions\codex\src\app-server\dynamic-tool-profile.ts` | 过滤 Codex 自己拥有的工具，避免重复注册。 |
| `src\agents\tool-display.ts` | 工具显示摘要解析入口。 |
| `src\agents\tool-display-config.ts` | 工具 UI 展示配置。 |
| `apps\shared\OpenClawKit\Sources\OpenClawKit\Resources\tool-display.json` | Swift / Kit 侧共享工具展示配置。 |

### 3.2 工具目录、profile 和权限

OpenClaw 把核心工具按 section 分类，再按 profile 控制是否可用。

核心 section：

| section | 中文含义 |
| --- | --- |
| `fs` | 文件工具 |
| `runtime` | 运行时和命令工具 |
| `web` | 网络工具 |
| `memory` | 记忆工具 |
| `sessions` | 会话和子 Agent 工具 |
| `ui` | UI / 浏览器 / 画布工具 |
| `messaging` | 消息工具 |
| `automation` | 自动化和网关工具 |
| `nodes` | 节点和设备工具 |
| `agents` | Agent 管理工具 |
| `media` | 图片、音乐、视频、语音等媒体工具 |

profile：

| profile | 含义 |
| --- | --- |
| `minimal` | 最小工具面，主要保留状态类工具。 |
| `coding` | 编码场景工具面，包含文件、运行时、网络、会话、媒体等。 |
| `messaging` | 消息场景工具面，主要保留消息和会话相关工具。 |
| `full` | 全量工具面。 |

OpenClaw 还支持工具组，例如：

| 工具组 | 含义 |
| --- | --- |
| `group:openclaw` | OpenClaw 产品工具集合。 |
| `group:fs` | 文件工具集合。 |
| `group:runtime` | 运行时工具集合。 |
| `group:web` | 网络工具集合。 |
| `group:media` | 媒体工具集合。 |

### 3.3 OpenClaw 工具组装流程

OpenClaw 的工具生命周期可以压成这条链：

```text
工具目录 tool-catalog
-> profile / allow / deny / group 展开
-> createOpenClawCodingTools(...)
-> 基础编码工具 read/write/edit
-> shell 工具 exec/process
-> OpenClaw 产品工具 createOpenClawTools(...)
-> 插件工具 resolveOpenClawPluginToolsForOptions(...)
-> Tool Search 工具 createToolSearchTools(...)
-> provider/schema normalization
-> before-tool-call hooks
-> abort signal wrapper
-> 模型可见工具池
```

关键点：

- OpenClaw 会复用上游 `createCodingTools(workspaceRoot)` 提供基础 `read/write/edit`，但会跳过或替换 `bash/exec`。
- `apply_patch` 受 provider 和模型限制，不是所有模型都可用。
- `createOpenClawTools()` 负责产品工具，例如 session、cron、nodes、media、web、message。
- 插件工具会追加到产品工具后，但会经过 allow/deny、optional、owner、sender、sandbox、subagent 等过滤。
- 返回模型前会做 provider-specific schema normalization，避免某些 provider 不接受复杂 schema。

### 3.4 OpenClaw 核心工具清单

以下来自 `src\agents\tool-catalog.ts` 和 `src\agents\openclaw-tools.ts`。

#### 文件工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 读取文件 | `read` | 读取文件内容。 |
| 写入文件 | `write` | 新建或覆盖文件。 |
| 编辑文件 | `edit` | 精确修改文件。 |
| 补丁修改 | `apply_patch` | patch 形式修改文件。 |

#### 运行时工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 执行命令 | `exec` | 执行本地或沙箱命令。 |
| 管理进程 | `process` | 管理长进程或运行中会话。 |
| 沙箱代码执行 | `code_execution` | 远程或沙箱代码分析执行。 |

#### 网络工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 网络搜索 | `web_search` | 搜索网页。 |
| 网页抓取 | `web_fetch` | 抓取网页内容。 |
| X 搜索 | `x_search` | 搜索 X posts。 |

#### 记忆工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 语义搜索 | `memory_search` | 搜索记忆内容。 |
| 读取记忆 | `memory_get` | 读取记忆文件或条目。 |

#### 会话和子 Agent 工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 列出会话 | `sessions_list` | 列出可访问会话。 |
| 读取会话历史 | `sessions_history` | 读取会话历史片段。 |
| 向会话发消息 | `sessions_send` | 向目标会话发送消息。 |
| 创建子会话 | `sessions_spawn` | 启动子 Agent / 子会话。 |
| 让出当前轮次 | `sessions_yield` | 当前 Agent 结束本轮，等待子 Agent 结果。 |
| 管理子 Agent | `subagents` | 管理 sub-agent。 |
| 会话状态 | `session_status` | 查询当前会话和运行状态。 |

#### UI、消息和自动化

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 浏览器控制 | `browser` | 控制浏览器、截图、导航、上传、对话框等。 |
| 画布控制 | `canvas` | 控制 Canvas / 节点 UI 表面。 |
| 发送消息 | `message` | 向外部消息通道发送消息。 |
| 心跳响应 | `heartbeat_respond` | 记录 heartbeat 自动化结果。 |
| 定时任务 | `cron` | 创建、查询或管理定时任务。 |
| 网关控制 | `gateway` | Gateway 控制。 |
| 节点设备 | `nodes` | 节点、设备、相机、屏幕等能力。 |
| 列出 Agent | `agents_list` | 列出 Agent。 |
| 更新计划 | `update_plan` | 更新 Agent 计划。 |

#### 媒体工具

| 中文名 | 工具名 | 说明 |
| --- | --- | --- |
| 图片理解 | `image` | 图片理解工具；当模型原生 vision 可用且已有图片输入时会被过滤，避免重复。 |
| 图片生成 | `image_generate` | 图片生成工具。 |
| 音乐生成 | `music_generate` | 音乐生成工具。 |
| 视频生成 | `video_generate` | 视频生成工具。 |
| 语音合成 | `tts` | 文本转语音。 |
| PDF 处理 | `pdf` | `openclaw-tools.ts` 中实际会创建的 PDF 工具，未列入核心 catalog section。 |

### 3.5 插件工具

OpenClaw 的插件工具分两类：

| 形式 | 说明 |
| --- | --- |
| `defineToolPlugin(...)` | 工具插件声明式写法，包含插件 id、名称、配置 schema、工具定义和执行函数。 |
| `api.registerTool(...)` | 插件运行时直接注册工具。 |

插件工具会经过这些规则：

- `optional: true` 的工具默认不暴露，必须显式 allowlist。
- 工具名是稳定 API，要求唯一、可读、尽量小写。
- factory 工具可以根据 runtime context 决定是否返回真实工具。
- 工具结果统一包装成 text/json result。
- OpenClaw 可以先从 cold metadata 发现插件工具，不必提前 import 全部运行时代码。

源码中能看到的插件或扩展工具方向包括：

| 插件 / 扩展 | 工具方向 |
| --- | --- |
| `browser` | 浏览器控制，底层可通过 Chrome MCP 调用。 |
| `canvas` | Canvas / 节点 UI 控制。 |
| `diffs` | diff 展示或处理。 |
| `feishu` | 飞书 bitable、chat、docx、drive、perm、wiki 等工具。 |
| `firecrawl` | 搜索和网页抓取。 |
| `google-meet` | 会议监听、发言、状态、离会等动作。 |
| `memory-core` / `memory-lancedb` | memory_search、memory_get 以及向量记忆工具。 |
| `memory-wiki` | `wiki_status`、`wiki_lint`、`wiki_apply` 等 wiki 工具。 |
| `qqbot` | QQ bot channel 和提醒工具。 |
| `tavily` | `tavily_search`、`tavily_extract`。 |
| `xai` | `code_execution`、`x_search`。 |
| `zalouser` | Zalo 用户相关工具。 |
| Slack / Discord / Telegram / Mattermost / Teams / iMessage | 消息通道工具描述和发送能力。 |

这些插件是否真正进入模型工具池，取决于安装状态、profile、allow/deny、owner/sender/sandbox/subagent 等策略。

### 3.6 Tool Search

OpenClaw 的 Tool Search 不是简单字符串搜索，而是一个工具目录发现层。

文档 `docs\tools\tool-search.md` 中确认：

- Catalog 可以包含 OpenClaw 工具、插件工具、MCP 工具和 client-provided 工具。
- 模型不需要一开始看到所有 schema。
- code 模式下会暴露 `tool_search_code`，内部提供 `openclaw.tools.search/describe/call`。
- tools 模式下会暴露 `tool_search`、`tool_describe`、`tool_call`。
- 执行仍回到 Gateway policy、approval、hooks 和 logging。

这和 Codex 的 `Deferred + tool_search` 思路一致：工具面变大以后，不能把全部工具 schema 一次性塞进模型上下文。

### 3.7 OpenClaw 接入 Codex 的方式

OpenClaw 的 Codex extension 会把 OpenClaw 工具转换成 Codex dynamic tools。

关键源码：`extensions\codex\src\app-server\dynamic-tools.ts`

确认点：

- `CODEX_OPENCLAW_DYNAMIC_TOOL_NAMESPACE = "openclaw"`。
- `createCodexDynamicToolBridge(...)` 接收 `AnyAgentTool[]`。
- 每个 OpenClaw 工具会被转成 `CodexDynamicToolSpec`。
- 默认 `loading` 是 `searchable`，也就是多数工具走延迟加载。
- 如果工具需要直接暴露，会保留 base spec，不带 namespace / deferLoading。
- 工具调用会回到原 OpenClaw `tool.execute(...)`，并继续经过 middleware、legacy extension runner、telemetry 和 after-tool-call hook。

关键源码：`extensions\codex\src\app-server\dynamic-tool-profile.ts`

确认点：

- OpenClaw 会排除 Codex App Server 自己拥有的工具：
  - `read`
  - `write`
  - `edit`
  - `apply_patch`
  - `exec`
  - `process`
  - `update_plan`
  - `tool_call`
  - `tool_describe`
  - `tool_search`
  - `tool_search_code`
- 工具名 alias：
  - `bash -> exec`
  - `apply-patch -> apply_patch`

结论：OpenClaw 接 Codex 时并不是把一堆 prompt 塞进去，而是把产品能力作为 Codex dynamic tools 接到 Codex 的工具体系里。

### 3.8 UI 展示配置

OpenClaw 单独维护工具展示配置，不让 UI 直接拿裸工具名硬猜。

关键源码：

- `src\agents\tool-display.ts`
- `src\agents\tool-display-config.ts`
- `apps\shared\OpenClawKit\Sources\OpenClawKit\Resources\tool-display.json`

展示配置包含：

| 字段 | 说明 |
| --- | --- |
| `emoji` | 工具图标。 |
| `title` | 工具标题。 |
| `detailKeys` | 摘要里优先展示哪些参数字段。 |
| `actions` | 同一个工具下不同 action 的 label 和 detailKeys。 |
| `fallback.detailKeys` | 未配置工具的兜底摘要字段。 |

例如 `browser` 工具有 `open`、`focus`、`snapshot`、`screenshot`、`navigate`、`upload` 等 action，每个 action 都有自己的摘要字段。

结论：工具卡 UI 也要有注册表，不应该只展示 `ToolOutput` 或原始 JSON。

## 4. MCP 专项对照

本节专门记录 Codex 和 OpenClaw 的 MCP 做法，作为 CCR `0.5.x` 工具治理提前处理 MCP 动态工具的源码依据。

### 4.1 Codex MCP 做法

Codex 把 MCP 当成普通工具运行时的一种来源，而不是单独靠系统提示描述。

关键源码：

| 路径 | 作用 |
| --- | --- |
| `codex-rs\tools\src\mcp_tool.rs` | 把 MCP `Tool` 转成 Codex `ToolDefinition`。 |
| `codex-rs\core\src\tools\spec_plan.rs` | 把 `mcp_tools`、`deferred_mcp_tools`、resource tools 和 `tool_search` 组装进工具计划。 |
| `codex-rs\core\src\tools\registry.rs` | 保存所有工具 executor，并按工具名派发调用。 |

确认点：

| 维度 | Codex 做法 | 对 CCR 的启发 |
| --- | --- | --- |
| 工具转换 | MCP `Tool` 会转换为统一 `ToolDefinition`。 | CCR 应把现有 `MCPTool` 包装结果转成 `CcrToolRegistryEntry`，不要让 MCP 工具绕开 registry。 |
| Schema 处理 | 会补齐 OpenAI 模型要求的 schema 细节，例如空 `properties`；调用结果保留 `content`、`structuredContent`、`isError`、`_meta`。 | MCP 工具进入 registry 前要有 schema 和结果协议边界，避免 provider 不接受或 UI 直接读原始碎片。 |
| 暴露策略 | `mcp_tools` 可以直接暴露；`deferred_mcp_tools` 进入 registry，但不进初始模型上下文。 | MCP 默认应优先 `deferred/searchable`，只有少数高频或明确 `alwaysLoad` 的工具直接暴露。 |
| 工具搜索 | `tool_search` 从 deferred executor 中发现工具。 | MCP 工具数量变大后不能全部塞给模型，必须纳入 `ToolSearch` 候选池。 |
| 资源工具 | MCP 存在时会挂载 `list_mcp_resources`、`list_mcp_resource_templates`、`read_mcp_resource`。 | CCR 当前 MCP 资源工具应继续保留为内部/受控工具，不要和业务 MCP 工具混成同一类 UI 展示。 |
| 派发边界 | `ToolRegistry` 保存所有 executor；模型可见 schema 只是其中一部分。 | CCR 要区分“模型当前看得到”和“运行时可执行”，避免 UI、ToolSearch、权限判断混用同一概念。 |

Codex 对 CCR 最关键的结论：

```text
MCP 工具应该进入统一工具注册表；
暴露策略决定它是否初始可见；
ToolSearch 负责发现 deferred MCP 工具；
运行时 registry 负责最终派发。
```

### 4.2 OpenClaw MCP 做法

OpenClaw 的 MCP 更偏产品平台和网关：它既可以把 OpenClaw 自己暴露成 MCP server，也可以保存用户 MCP server 定义，并在接入 Codex 时投影给 Codex runtime。

关键源码和文档：

| 路径 | 作用 |
| --- | --- |
| `docs\cli\mcp.md` | 说明 `openclaw mcp serve` 和 `list/show/set/unset`。 |
| `docs\tools\tool-search.md` | 说明 Tool Search catalog 可以包含 MCP 工具。 |
| `extensions\codex\src\app-server\thread-lifecycle.ts` | 把用户 MCP server 配置投影进 Codex `mcp_servers`，并在配置变化时刷新 thread binding。 |
| `extensions\codex\src\app-server\dynamic-tools.ts` | 把 OpenClaw 工具桥接为 Codex dynamic tools，默认 searchable。 |

确认点：

| 维度 | OpenClaw 做法 | 对 CCR 的启发 |
| --- | --- | --- |
| 对外 MCP server | `openclaw mcp serve` 通过 stdio 暴露会话、消息、事件、审批等 OpenClaw 能力。 | CCR 后续如果要对外暴露能力，应把它视为 App Server/Core 能力出口，不要让 TUI/CLI 各自拼一套。 |
| 对内 MCP registry | `openclaw mcp list/show/set/unset` 管理用户 MCP server 定义。 | CCR 已有 `~/.ccr/mcp.json` 和 `ccr mcp`，下一步要补状态、健康、修复和 UI 管理。 |
| Codex 集成 | OpenClaw 不重写 Codex MCP，而是把用户 MCP server 投影进 Codex `mcp_servers` 配置。 | CCR 应复用已有 MCP runtime，再做 registry adapter；不要另起第二套 MCP 执行链。 |
| 生命周期 | 用户 MCP 配置 fingerprint 变化时，OpenClaw 会刷新 Codex thread binding。 | CCR App Server / Desktop 后续要考虑 MCP 配置变化是否需要刷新会话工具池。 |
| 工具目录 | Tool Search catalog 可以包含 OpenClaw 工具、插件工具、MCP 工具和 client-provided 工具。 | MCP、Provider、Skill、Plugin 最终应汇入同一个 catalog，只是 source 和 availability 不同。 |
| UI 展示 | OpenClaw 有独立 `tool-display` 配置，不让 UI 猜裸工具名。 | Desktop 工具卡展示 MCP 时要显示服务名、中文名、状态和失败原因，不只显示 `mcp__...`。 |

OpenClaw 对 CCR 最关键的结论：

```text
MCP 是工具目录的一种来源，不是孤立功能；
配置、连接状态、Tool Search、权限、UI 展示都要共享一套治理口径。
```

### 4.3 CCR 0.5.x MCP 收口口径

当前 CCR 已有 MCP client、配置、CLI、TUI 连接管理、MCP 工具包装和 Playwright 预设；`0.5.x` 不需要重做底层连接链路，重点是把动态 MCP 工具接入工具治理层。

建议收口顺序：

1. `src/services/mcp/client.ts` 继续负责连接、认证、工具发现和调用。
2. `src/tools.ts` 的 `assembleToolPool()` 继续负责把内置工具和 MCP 工具合并。
3. 新增或扩展 registry adapter，把 `mcpInfo.serverName/toolName`、连接状态、认证状态、schema 和 display fallback 写入 `CcrToolRegistryEntry`。
4. `CcrToolAvailability` 按 MCP server 状态给出 `connected / failed / needs-auth / disabled / pending / discovery-failed` 等原因。
5. `ToolSearch` 只搜索 `available=true` 且 `exposure=deferred` 的 MCP 工具。
6. Desktop 工具卡和 App Server 工具 catalog 使用同一份 MCP metadata，展示“来源服务 + 工具中文名/兜底名 + 状态/失败原因”。

## 5. Codex 与 OpenClaw 对照

| 维度 | Codex | OpenClaw | CCR 可借鉴点 |
| --- | --- | --- | --- |
| 模型可见协议 | `ToolSpec` | PI/OpenClaw tool schema + dynamic bridge | 建立统一 `CcrToolSpec`。 |
| 运行时执行 | `ToolExecutor.handle()` | `AnyAgentTool.execute()` | 建立统一 `CcrToolRuntime`。 |
| 曝光策略 | `Direct / Deferred / DirectModelOnly` | profile + allow/deny + optional + tool search | 同时支持直接暴露、延迟搜索、禁用原因。 |
| 工具发现 | `tool_search` | `tool_search_code` / `tool_search` / `tool_describe` / `tool_call` | CCR 后续 MCP/Skill/Plugin 必须有工具发现层。 |
| Hosted tool | `image_generation`、`web_search` | 主要走产品工具 / provider 工具 | CCR 生图应作为标准工具，而不是 prompt 约定。 |
| MCP | MCP tool adapter + namespace | Catalog 可包含 MCP 工具 | MCP 工具必须带来源、连接状态和认证状态。 |
| 插件 | extension tool executor / plugin install | tool plugin SDK + runtime register | 0.6 主线可参考 OpenClaw 插件模型。 |
| UI 展示 | Codex app 内部展示，工具协议和 UI 分离 | 单独 `tool-display` 配置 | CCR 需要 `ToolDisplaySpec`，包含中文名、摘要字段和详情规则。 |
| 结果协议 | `ToolOutput` / hosted item / event mapping | text/json result + media telemetry | CCR 应继续收敛到 `CcrContentBlock` 和 `generatedArtifact`。 |

## 6. CCR 可借鉴原则

本节把 Codex 和 OpenClaw 的做法压成后续开发可执行的原则。这里不是要求 CCR 直接照搬两边源码，而是固定工具治理的结构判断。

### 6.1 工具不是 prompt，而是注册表里的能力

Codex 和 OpenClaw 都不是靠系统提示让模型“自己知道有什么能力”，而是把工具整理成结构化定义。

CCR 后续工具能力至少应落到这条链：

```text
工具定义
-> 当前环境 / provider / profile / 权限 / MCP 状态过滤
-> 模型可见工具 schema
-> 运行时 handler / executor
-> 工具调用派发
-> 工具结果标准化
-> UI 展示元数据
```

开发依据：

- 新增工具时，不能只加 prompt 文案；必须有工具定义、可用性判断、执行入口和展示口径。
- Provider 能力工具、MCP 工具、Skill 工具、Plugin 工具都应进入同一套 registry，只是 `source.kind` 不同。
- 工具是否给模型看，由 exposure 和 availability 决定，不由模型自述决定。

### 6.2 模型可见工具和运行时可执行工具必须分开

Codex 的 `ToolRegistry` 保存运行时可执行工具，模型初始可见 schema 只是其中一部分。`Deferred` 工具可以不进初始上下文，但仍可通过 `tool_search` 发现并执行。

CCR 后续建议固定四类暴露策略：

| 暴露策略 | 适用工具 | 说明 |
| --- | --- | --- |
| `direct` | 高频基础工具、明确需要常驻的 provider 工具 | 初始请求直接给模型。 |
| `deferred` | MCP、Plugin、Skill、低频扩展工具 | 进入 registry，但通过 `ToolSearch` 发现。 |
| `internal` | `ToolSearch`、MCP 资源内部工具、结构化输出等 | 运行时可用，但不作为普通业务工具展示。 |
| `provider-gated` | 生图、联网搜索、模型原生工具等 | 只有当前 provider/model 支持时才可见或可调用。 |

开发依据：

- 不要把“运行时有这个工具”等同于“模型当前应该看到这个工具”。
- `ToolSearch` 的候选池只应包含 `available=true` 且 `exposure=deferred` 的工具。
- Desktop 工具卡展示也不能只按模型可见列表推断，要读 registry/display metadata。

### 6.3 MCP 是工具来源之一，不是单独系统

Codex 把 MCP tool 转成普通 executor；OpenClaw 把 MCP 纳入 catalog 和 Tool Search。两边共同说明：MCP 不应绕开工具治理层。

CCR 的 MCP registry entry 至少应携带：

| 字段 | 说明 |
| --- | --- |
| `source.kind = "mcp"` | 标记来源是 MCP。 |
| `source.serverName` | MCP server 名称，例如 `playwright`。 |
| `source.toolName` | MCP server 内部工具名。 |
| `source.transport` | `stdio`、`http`、`sse`、`ws`、`sdk` 等。 |
| `availability.state` | `connected`、`failed`、`needs-auth`、`disabled`、`pending` 等。 |
| `availability.reason` | 不可用原因，供 ToolSearch、Doctor、Desktop 复用。 |
| `display.displayName` | 中文名或兜底展示名。 |
| `display.detailKeys` | UI 摘要字段。 |

开发依据：

- `src/services/mcp/client.ts` 继续负责连接、认证、发现和调用。
- `CcrToolRegistry` 只做 MCP 工具元数据归一化，不重写 MCP transport。
- MCP 连接失败、未认证、禁用、发现失败时，不能伪装成可用工具。

#### 6.3.1 MCP 安装和管理面也属于工具治理

T18-T20 只覆盖 MCP 运行时工具面。继续往产品化走时，MCP 还必须有安装和管理面，否则用户无法回答“这个 MCP 从哪来、装在哪里、能不能关、能不能卸、为什么不可用”。

可借鉴结论：

| 来源 | 可借鉴点 | CCR 落点 |
| --- | --- | --- |
| Codex `request_plugin_install` | 安装请求不是静默动作，必须由用户确认。 | MCP 自动下载安装必须先展示来源、版本、写入位置、权限风险和回滚计划。 |
| Codex MCP namespace | MCP 工具名保留 server/tool 来源。 | 管理页和 install 记录也必须保留 server name、tool name、transport、scope。 |
| OpenClaw tool catalog/profile | 工具来源、profile、allow/deny 和 optional 共同决定可用性。 | MCP 手动配置、自动安装、企业托管、插件注入、动态来源都要进入同一 catalog。 |
| OpenClaw tool display | UI 不从裸工具名猜展示。 | Desktop MCP 管理页显示中文名、来源、状态、认证、工具列表和失败原因。 |

CCR 后续 `0.5.x` 管理面应至少固定：

- 配置位置：用户级 `~/.ccr/mcp.json`、项目级 `.mcp.json`、企业级 `managed-mcp.json`。
- 自动下载安装位置：`~/.ccr/mcp/packages/<name>/<version>/`。
- 安装清单和版本锁定：`~/.ccr/mcp/installed.json`、`~/.ccr/mcp/lock.json`。
- 管理 API：list / inspect / add / update / remove / enable / disable / restart / test。
- Desktop 管理页：查看、启停、认证、测试、安装、卸载、日志和工具清单。
- 安全边界：secret 脱敏、项目级信任、下载来源校验、checksum、失败回滚和卸载保护。

进一步落到“模型发现缺能力，需要安装 MCP”时，CCR 不能把它做成 prompt 话术，而应做成可审计的控制链：

```text
模型提出任务目标
-> Core 用 registry / availability 判断当前没有对应能力
-> MCP 搜索入口只查可信 catalog、本地 preset、已配置但不可用 server
-> 安装计划入口输出来源、版本、命令、写入位置、权限、数据边界和回滚方案
-> 用户确认
-> 管理入口执行安装、写配置、锁版本、测试连接和工具发现
-> 新 MCP server 进入 registry / availability / ToolSearch / Desktop 管理页
```

对应的 CCR 组件建议：

| 组件 | 借鉴来源 | 责任 |
| --- | --- | --- |
| `McpCapabilityResolver` | Codex deferred tools + OpenClaw catalog/profile | 判断当前任务缺少哪类工具能力，并把缺口映射到 MCP 分类或别名。 |
| `McpSearch` | Codex `tool_search` / OpenClaw Tool Search | 只搜索候选，不安装；结果带来源可信度、server 名、工具摘要和安装方式。 |
| `McpInstallPlan` | Codex `request_plugin_install` 的用户确认模式 | 生成可给用户确认的计划，列出下载源、版本、写入文件、运行命令、权限和回滚。 |
| `McpManage` | OpenClaw `mcp list/show/set/unset` 管理面 | 用户确认后执行安装、卸载、启用、禁用、重启、测试和状态刷新。 |

不变式：模型可以主动建议“缺少某能力，建议安装某 MCP”，但真实下载、配置写入、stdio server 启动、卸载删除必须由宿主侧管理入口执行，并经过用户确认、策略校验和日志记录。

### 6.4 ToolSearch 是工具数量膨胀后的核心入口

Codex 的 deferred tools 和 OpenClaw 的 catalog/tool search 都在解决同一个问题：工具越来越多时，不能把所有 schema 一次性塞进模型上下文。

CCR 后续工具增长顺序应保持一致：

```text
内置基础工具：少量 direct
Provider 能力工具：按 provider/model gated
MCP 动态工具：默认 deferred
Skill 工具：默认 deferred
Plugin 工具：默认 deferred
内部工具：internal
```

开发依据：

- MCP 先作为第一种动态工具来源接入 ToolSearch。
- Skill / Plugin 到 `0.6.0` 时复用同一个 ToolSearch，不再另建“插件搜索”或“Skill 搜索”。
- ToolSearch 结果要带来源、可用状态、展示名和简短说明，而不是只返回裸工具名。

### 6.5 UI 展示不能猜裸工具名

OpenClaw 单独维护 `tool-display` 配置，说明工具卡 UI 不应该直接从工具名和原始 JSON 猜用户能看懂的内容。

CCR Desktop 展示 MCP 工具时，应优先展示：

```text
浏览器 MCP / 点击元素
真实工具名：mcp__playwright__click
来源服务：playwright
状态：已连接 / 需要认证 / 连接失败
失败原因：...
```

开发依据：

- Desktop、App Server 工具 catalog、Doctor 应消费同一份 display/availability metadata。
- 工具卡主标题优先中文名，调试区再展示真实工具名。
- 长 JSON 输入不要直接铺到主时间线；摘要字段走 `summaryKeys/detailKeys`。

### 6.6 工具状态必须可解释

工具不可用不能只显示 `Not working` 或静默过滤。Codex 偏运行时，OpenClaw 偏产品平台；CCR 应把两边结合成统一可解释状态。

建议先固定这些原因码方向：

| 原因码方向 | 典型含义 |
| --- | --- |
| `platform_unsupported` | 当前平台不支持，例如 Windows 下 POSIX `Bash`。 |
| `provider_unsupported` | 当前 provider/model 不支持该工具能力。 |
| `mcp_not_connected` | MCP server 未连接。 |
| `mcp_needs_auth` | MCP server 需要认证。 |
| `mcp_connection_failed` | MCP server 连接失败。 |
| `mcp_discovery_failed` | MCP 连接成功但工具发现失败。 |
| `mcp_disabled` | MCP server 被用户或策略禁用。 |
| `plugin_not_installed` | 插件未安装。 |
| `skill_not_enabled` | Skill 未启用或未加载。 |
| `agent_definitions_missing` | Agent 定义缺失。 |

开发依据：

- `CcrToolAvailability` 是统一出口，ToolSearch、Doctor、Desktop 不应各自重新判断。
- 对用户展示时用中文解释；对代码和测试保留稳定 reason code。
- 不可用工具可以出现在诊断和管理页，但不能进入可调用候选池。

一句话收敛：

```text
Codex 值得学工具运行时内核；
OpenClaw 值得学产品级工具目录和展示治理；
CCR 先把 MCP 变成统一工具治理里的第一种动态工具来源。
```

## 7. 对 CCR 的实现落点

CCR 后续工具治理建议分成四层：

```text
模型可见层：CcrToolSpec
  name / description / parametersSchema / resultSchema / exposure

运行时层：CcrToolRuntime
  execute / permission / provider routing / error snapshot

能力层：CcrToolAvailability
  provider / model / profile / mcp / plugin / feature gate / unavailable reason

展示层：CcrToolDisplaySpec
  中文名 / 图标 / 摘要字段 / 详情字段 / artifact renderer
```

### 7.1 工具定义建议

```ts
type CcrToolDefinition = {
  name: string
  displayName: string
  description: string
  category: 'file' | 'runtime' | 'web' | 'agent' | 'media' | 'mcp' | 'plugin' | 'internal'
  parametersSchema: unknown
  resultSchema?: unknown
  exposure: 'direct' | 'deferred' | 'modelOnly'
  source: {
    kind: 'builtin' | 'provider' | 'mcp' | 'skill' | 'plugin' | 'dynamic'
    providerId?: string
    serverId?: string
    pluginId?: string
  }
  availability: {
    available: boolean
    reason?: string
  }
  display: {
    icon?: string
    summaryKeys?: string[]
    detailKeys?: string[]
    artifactRenderer?: 'image' | 'file' | 'json' | 'text'
  }
}
```

### 7.2 当前 CCR 最该先收敛的点

| 优先级 | 事项 | 原因 |
| --- | --- | --- |
| P0 | `GenerateImage` 保持模型可见工具，不回退成 prompt 约定 | 解决模型不知道怎么准确生图的问题。 |
| P0 | 工具不可用要返回友好错误 | 当前 provider 不支持时，应明确提示切换到 GLM / OpenAI / Codex OAuth / MiniMax 等支持方。 |
| P0 | 图片结果统一走 `generatedArtifact` 和本地持久化路径 | 解决 URL 不能预览、缩略图破图和历史恢复问题。 |
| P1 | 建立工具展示注册表 | 解决工具卡片只显示英文名、重复摘要、长 JSON 顶出界面的问题。 |
| P1 | 区分模型可见工具和 UI 展示工具 | `TodoWrite`、内部计划草稿、ToolSearch 等不应刷成普通业务卡。 |
| P1 | 延迟工具发现 | MCP / Skill / Plugin 进入后工具会爆炸，不能全部塞进模型上下文。 |
| P2 | 插件工具元数据 | 为 0.6 的 MCP、Skill、Plugin 做统一入口。 |

### 7.3 生图工具的特殊结论

从 Codex 和 OpenClaw 都能看到同一个方向：

- 生图是工具，不是普通文本输出。
- 图片 URL、base64、本地文件都要先标准化成生成物。
- UI 不应该读 provider 原始响应，而应该读统一 artifact。
- 模型是否能生图，应该由工具可用性决定，而不是让模型自述“我能不能生图”。

CCR 当前已经有 `GenerateImage` 和 `generatedArtifact`，下一步应补齐的是：

1. 工具注册表中的生图能力声明。
2. provider 不支持时的友好失败。
3. 工具卡和图片卡去重展示。
4. 远程 URL 下载落盘后的持久化状态展示。

## 8. 后续阅读建议

如果后续要继续深挖，可以按下面顺序读：

1. Codex `spec_plan.rs`：完整工具池如何从配置组装出来。
2. Codex `registry.rs`：工具调用如何派发、记录 telemetry、处理失败。
3. OpenClaw `tool-catalog.ts`：工具目录、profile 和 group 如何建模。
4. OpenClaw `pi-tools.ts`：基础工具、OpenClaw 工具、插件工具、Tool Search 如何合并。
5. OpenClaw `dynamic-tools.ts`：OpenClaw 工具如何桥到 Codex dynamic tool。
6. OpenClaw `tool-display-config.ts` / `tool-display.json`：UI 工具卡如何用配置生成摘要。

## 9. 给 CCR 文档体系的挂接点

相关 CCR 文档：

- `docs\architecture\tool-registry-catalog.md`
- `docs\architecture\provider-tool-protocol-normalization.md`
- `docs\architecture\provider-capability-tools-future.md`
- `docs\architecture\model-output-normalization-and-display-standard.md`
- `docs\architecture\desktop-tool-event-card-contract.md`
- `docs\references\image-generation-source-evidence.md`
- `docs\references\openai-codex-generated-artifacts.md`

这份索引的角色是“外部源码证据”。具体 CCR 实现方案仍应落到 `docs\architecture\` 下对应设计文档，阶段拆分和验收记录落到 `docs\goals\` 或 `docs\stages\`。
