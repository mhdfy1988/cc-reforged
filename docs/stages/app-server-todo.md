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

## 当前指针

- 进行中：P17 版本、协议兼容与回滚加固
- 当前正在做：P17 已完成，当前 Desktop 第一版主线 P0-P17 已完成；等待确认下一条主线，VS Code 已从当前主线移出，作为延后事项保留。
- 完成后下一项：待确认，可以继续 Desktop 安装器人工验收、正式图标/签名、自动更新，或后续再开 VS Code。

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

## 延后事项：P18 VS Code 插件接入准备

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

## 备注

- 当前状态：active
- 下一步需要：确认下一条主线；建议优先继续 Desktop 安装器人工验收、正式图标/签名、自动更新或发布验收清单，VS Code 插件暂不进入当前主线。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：先补 App Server，再把 Desktop App 做完整，VS Code 插件延后。
- 第一阶段非目标：不做 websocket、daemon、多客户端共享、VS Code 插件、完整自动更新。
- 总收口标准：P1-P5 证明 app-server 最小控制面可用；P6-P8 证明真实会话可用；P9 证明 Desktop 接入 SDK 可用；P10-P17 证明 Desktop App 可用；VS Code 已延后到单独后续主线。
