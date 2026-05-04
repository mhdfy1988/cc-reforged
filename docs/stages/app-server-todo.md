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
- [ ] P21 文件、附件与引用系统
- [ ] P22 结构化输出与 JSON/Schema 视图
- [ ] P23 多模态输出预览
- [ ] P24 错误分类、限流与拒答状态治理
- [ ] P25 原生上下文链路恢复与短期记忆治理

## 当前指针

- 进行中：P25 原生上下文链路恢复与短期记忆治理
- 当前正在做：P25-1 / P25-2 原生链路正式盘点与 App Server 差异定位。
- 完成后下一项：P25-3 Core thread 原生 `Message[]` 历史接入。
- 说明：P21 文件、附件与引用系统暂缓到 P25 最小上下文链路恢复后继续，避免后续真实 Desktop 复测被“每轮像新会话”的问题干扰。

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

状态：待开始。

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

1. [ ] P21-1 文件事件与附件字段来源盘点
   - 目标：先确认 Core/App Server 当前能稳定提供哪些文件、附件、引用字段。
   - 具体动作：盘点 `Write`、`Edit`、`MultiEdit`、`Read`、`LS`、`Glob`、`Grep`、浏览器/MCP 工具结果和 assistant 文本里已有的文件字段。
   - 输出：字段来源表，区分“已有稳定字段”“只能从工具输入拿到”“只能从 stdout 猜到”“完全缺失”。
   - 验收：不从 stdout 里硬解析文件路径，缺字段先记为协议缺口。
2. [ ] P21-2 文件卡片 DisplayEvent 模型
   - 目标：定义文件卡片、附件卡片、引用卡片的展示事件模型。
   - 具体动作：新增 `FileSnapshot`、`AttachmentSnapshot`、`ReferenceSnapshot` 或同等结构，并接入 `DisplayEvent`。
   - 边界：只定义展示模型，不在 renderer 里执行文件读写，不绕过 preload 白名单。
   - 验收：模型能表达工作区相对路径、绝对路径、来源、类型和风险标识。
3. [ ] P21-3 工具结果到文件事件归一化
   - 目标：把 `Write/Edit/Read/LS/Glob/Grep` 等工具输入/结果中稳定的路径信息转成文件/引用事件。
   - 具体动作：优先使用工具输入里的 `file_path/path/pattern`，其次使用 App Server 后续补的结构化字段；不从大段 stdout 正则硬猜。
   - 验收：写文件、读文件、搜索文件至少能在 fixture 中生成对应文件/引用快照。
4. [ ] P21-4 Desktop 文件卡片组件
   - 目标：实现文件卡片 UI，支持打开、复制路径、定位工作区。
   - 具体动作：实现文件名、相对路径、来源、风险标签、打开按钮、复制按钮；工作区外路径显示警告，不默认打开。
   - 验收：生成文件、读取文件和引用路径不再只显示为普通文本。
5. [ ] P21-5 引用系统最小交互
   - 目标：支持文件引用、代码行引用、搜索引用的统一展示。
   - 具体动作：支持 `path:line[:column]` 复制、打开文件、复制引用文本；搜索引用显示命中摘要。
   - 验收：回答中的代码位置引用可以被用户定位，不再混在普通 Markdown 里。
6. [ ] P21-6 附件与上传入口占位
   - 目标：支持文件上传入口占位、引用复制和图片/截图占位预览。
   - 具体动作：输入框 `+` 入口先支持选择文件的 UI 状态和附件列表模型；真实发送到模型可后续分批。
   - 验收：后续 P23 多模态预览可以复用同一套基础模型。
7. [ ] P21-7 安全边界与 preload 打开能力
   - 目标：打开文件、复制路径、定位工作区必须走 Desktop main/preload 白名单能力。
   - 具体动作：确认或新增 `openPath`、`showItemInFolder`、`copyText` 等安全入口；工作区外路径需要二次提示或禁用。
   - 验收：renderer 不直接访问 Node 文件系统，路径操作都有安全边界。
8. [ ] P21-8 Fixture / Smoke / 文档收口
   - 目标：补文件卡片、引用卡片、工作区外路径风险的回归样例。
   - 样例：生成文件、读取文件、搜索引用、工作区外路径、远程 URL、上传附件占位。
   - 验收：`typecheck:desktop`、`desktop:build`、display-event smoke 通过。

## P22 结构化输出与 JSON/Schema 视图

状态：待开始。

目标：

- 对 JSON、schema output、表格、状态对象等结构化内容提供专门视图。
- 第一版只做展示和复制，不做复杂编辑器。
- 让工具结果、MCP 结果、模型结构化回答和 App Server 运行对象都能用同一套结构化展示组件。

需要补齐：

- JSON tree：支持折叠、复制节点、复制完整 JSON。
- 表格视图：数组对象可以切换成表格展示。
- Schema 校验结果：展示字段错误、路径、期望类型、实际值摘要。
- 大对象处理：默认折叠，避免一次性撑爆聊天区。
- 结构化内容仍保留 raw text fallback，避免 provider 输出不规范时丢内容。

关键字段：

- `structuredId`：结构化块 ID。
- `kind`：`json`、`table`、`schema_validation`、`state_object`、`tool_result`。
- `data`：结构化原始对象。
- `schema`：可选 schema。
- `validationErrors`：schema 校验错误列表。
- `source`：来源工具、模型、MCP 或 App Server。
- `size`：节点数、字符数或字节数，用于折叠/截断。
- `fallbackText`：无法结构化解析时的原始文本 fallback。

完成标准：

- 工具结果或模型结构化输出可读性明显提升。
- JSON 不再只能以黑盒代码块方式展示。
- schema 校验失败时用户能定位到具体字段。

### P22 子任务拆分

执行顺序：

1. [ ] P22-1 结构化内容来源盘点
   - 目标：确认当前哪些事件会携带 JSON、数组、对象、schema 或状态对象。
   - 具体动作：盘点工具结果、MCP 结果、App Server 状态、运行元数据、权限请求参数和模型结构化输出。
   - 验收：明确哪些内容是可靠对象，哪些只是文本里的 JSON 片段。
2. [ ] P22-2 StructuredSnapshot 展示模型
   - 目标：定义结构化内容统一快照，挂到 `DisplayEvent` 或工具卡详情里。
   - 具体动作：定义 `kind/data/schema/errors/source/size/fallbackText`，并保留 raw 调试入口。
   - 验收：普通 JSON、数组对象、schema 错误都能用同一套模型表达。
3. [ ] P22-3 JSON Tree 组件
   - 目标：实现可折叠 JSON 树。
   - 具体动作：支持对象/数组/基础类型显示、节点折叠、复制节点、复制完整 JSON。
   - 验收：大 JSON 默认折叠，不撑爆聊天区。
4. [ ] P22-4 表格视图组件
   - 目标：数组对象可以切换为表格。
   - 具体动作：自动识别同构对象数组，提供列名、行数、复制 CSV/JSON 的最小能力。
   - 验收：MCP 列表、搜索结果、状态列表类对象可读性提升。
5. [ ] P22-5 Schema 校验结果视图
   - 目标：展示字段路径、期望类型、实际值、错误原因。
   - 具体动作：先消费已有校验错误结构；如果没有 schema，仅显示“未校验”。
   - 验收：用户能定位哪个字段错，而不是只看到一段异常。
6. [ ] P22-6 工具卡详情接入结构化视图
   - 目标：工具结果详情优先识别结构化对象，再 fallback 到代码块。
   - 具体动作：对 `toolSnapshot.result` 做安全识别，保留原始详情。
   - 验收：工具卡里的 JSON 结果不再全是黑盒 pre。
7. [ ] P22-7 Fixture / Smoke / 文档收口
   - 目标：补 JSON tree、表格、schema 错误、大对象折叠的回归样例。
   - 验收：`typecheck:desktop`、`desktop:build`、display-event smoke 通过。

## P23 多模态输出预览

状态：待开始。

目标：

- 为图片、截图、音频、普通文件等多模态输出预留统一预览组件。
- 第一版先支持本地图片/截图/文件卡片预览，不承诺完整音视频编辑能力。
- 复用 P21 的附件/文件基础模型，不另起第二套媒体系统。

需要补齐：

- 图片预览：缩略图、点击放大、复制路径、打开文件。
- 截图预览：来自浏览器工具或 MCP 工具的截图要有来源说明。
- 文件预览：文本文件可展开预览，二进制文件只展示元信息。
- 音频/视频：先定义附件类型和占位渲染，后续按需要接播放器。
- 大文件保护：限制内联预览大小，避免 Desktop 卡死。

关键字段：

- `mediaId`：媒体块 ID。
- `mediaType`：`image`、`screenshot`、`audio`、`video`、`text_file`、`binary_file`、`unknown`。
- `uri` / `path`：本地路径、data URI 或远程 URL。
- `mimeType` / `sizeBytes` / `dimensions` / `durationMs`：预览决策字段。
- `thumbnail`：缩略图路径或 data URI。
- `source`：浏览器、MCP、工具、用户上传、模型生成。
- `previewPolicy`：`inline`、`thumbnail`、`metadata_only`、`blocked`。
- `safety`：工作区内、工作区外、远程、未知。

完成标准：

- 图片和截图不再只显示成路径或 raw attachment。
- 多模态附件和 P21 文件卡片使用同一套基础模型。
- 不支持的媒体类型有清晰 fallback。

### P23 子任务拆分

执行顺序：

1. [ ] P23-1 多模态来源与格式盘点
   - 目标：确认浏览器/MCP/工具/上传入口可能产生哪些媒体字段。
   - 具体动作：盘点截图、图片文件、文本文件、二进制附件、data URI、URL。
   - 验收：明确第一版支持本地路径和 URL，data URI 是否仅做安全占位。
2. [ ] P23-2 MediaSnapshot 模型
   - 目标：定义媒体展示快照，复用 P21 的附件基础字段。
   - 具体动作：定义 `mediaType/uri/mimeType/size/dimensions/thumbnail/source/previewPolicy`。
   - 验收：图片、截图、文本文件、未知二进制都有统一 fallback。
3. [ ] P23-3 图片与截图预览组件
   - 目标：实现缩略图、放大查看、复制路径、打开文件。
   - 具体动作：工作区内图片可缩略预览；远程图片和工作区外图片先显示来源和风险。
   - 验收：截图不再只是 raw 路径。
4. [ ] P23-4 文本文件与二进制文件预览
   - 目标：小文本文件可展开预览，二进制文件只展示元信息。
   - 具体动作：限制预览大小；超限显示“过大，已禁用内联预览”。
   - 验收：不会因为大文件卡死 Desktop。
5. [ ] P23-5 音频/视频占位渲染
   - 目标：先定义音频/视频卡片形态，不急着接播放器。
   - 具体动作：展示文件名、时长、大小、来源和打开入口；播放器留后续增强。
   - 验收：不支持媒体类型也有清晰 fallback。
6. [ ] P23-6 Fixture / Smoke / 文档收口
   - 目标：补图片、截图、文本文件、大文件、未知二进制的回归样例。
   - 验收：`typecheck:desktop`、`desktop:build`、display-event smoke 通过。

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

状态：待开始。

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
1. [ ] P25-1 原生上下文链路盘点
   - 目标：确认 CLI/TUI 原生是如何维护历史、压缩、memory attachments、readFileState 和 transcript 的。
   - 具体动作：盘点 `QueryEngine.ask()`、`query()`、`cli/print.ts` 的 `mutableMessages`、`loadInitialMessages`、`sessionStorage`、compact / context collapse。
   - 验收：形成“原生链路应该传什么、保存什么、恢复什么”的对照清单。
2. [ ] P25-2 App Server 差异定位
   - 目标：确认新入口到底绕开了哪些原生能力。
   - 具体动作：检查 `CoreSessionService`、`runCoreQueryTurn`、`createCoreQueryRuntime`，重点核对 `messages: [userMessage]`、`toolUseContext.messages: []`、每轮重建 `readFileState`。
   - 验收：明确“模型忘记前文”的第一原因是否为 thread history 未进入 `query()`。
3. [ ] P25-3 Core thread 原生 `Message[]` 历史接入
   - 目标：让每个 App Server thread 持有原生消息历史。
   - 具体动作：在 Core session 层保存 `Message[]`，每轮先追加当前用户消息，再把完整历史传给 `query()`。
   - 验收：第二轮模型能看到第一轮用户消息和 assistant 回复。
4. [ ] P25-4 Assistant / tool / progress 消息归档
   - 目标：确保 `query()` 产出的关键消息不会只进入 UI。
   - 具体动作：把 assistant、tool_result、progress、attachment、compact boundary 等按原生规则追加回 thread history；避免重复归档 stream delta。
   - 验收：工具调用后一轮模型知道刚刚调用了什么、结果是什么。
5. [ ] P25-5 原生 compact / context collapse / budget 验证
   - 目标：确认恢复历史后不会破坏原生压缩和预算机制。
   - 具体动作：验证 compact boundary、tool result budget、history snip、context collapse 是否仍按 `query()` 原逻辑工作。
   - 验收：长上下文不会无限增长，压缩后下一轮仍能继续。
6. [ ] P25-6 sessionStorage / resume / readFileState 恢复
   - 目标：恢复 Desktop 重启或旧 thread 继续时的上下文能力。
   - 具体动作：对照 `loadConversationForResume`、`recordTranscript`、`extractReadFilesFromMessages`，决定 App Server 是直接复用原生 transcript，还是做最薄适配。
   - 验收：重启后同一会话能恢复关键消息和文件读写状态。
7. [ ] P25-7 Desktop 上下文可观测入口
   - 目标：排查“为什么它忘了”时有证据。
   - 具体动作：在运行详情或日志中展示脱敏后的消息数量、最近消息类型、compact 状态、是否包含 tool_result，不展示 token 或大段 raw。
   - 验收：用户能看到本轮不是空历史，也能发现异常截断。
8. [ ] P25-8 `SessionContextSnapshot` 二阶段补强评估
   - 目标：只在原生链路恢复后再判断是否需要轻量摘要。
   - 具体动作：评估用户纠偏、当前目标、最近工具摘要是否仍需要单独高优先级注入。
   - 验收：若需要，设计为诊断和补强层；若不需要，明确不实现，避免重复系统。
9. [ ] P25-9 Fixture / Smoke / 文档收口
   - 目标：用固定样例验证原生上下文不丢。
   - 样例：两轮记忆、“我刚才说什么”、用户纠偏、工具写文件、工具失败、TodoWrite 更新、compact 后继续、重启恢复。
   - 验收：`typecheck`、App Server smoke、Desktop display/context smoke 通过。

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

## 备注

- 当前状态：active
- 下一步需要：先进入 P25-1/P25-2，完成原生上下文链路正式盘点与 App Server 差异定位；随后做 P25-3，把 Core thread 接回原生 `Message[]` 历史。P21-1 暂缓到 P25 最小链路恢复后继续。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：先补 App Server，再把 Desktop App 做完整；当前进入模型输出与运行事件展示能力产品化，VS Code 插件延后。
- 第一阶段非目标：不做 websocket、daemon、多客户端共享、VS Code 插件、完整自动更新。
- 总收口标准：P1-P5 证明 app-server 最小控制面可用；P6-P8 证明真实会话可用；P9 证明 Desktop 接入 SDK 可用；P10-P17 证明 Desktop App 可用；P18-P24 证明 Desktop 能稳定展示模型输出、运行事件和错误状态；P25 证明 App Server / Desktop 已恢复原生上下文历史、压缩、工具结果回灌和恢复语义，不再每轮像新会话；VS Code 已延后到单独后续主线。
- 横切修复入口：[CCR 工具能力治理修复清单](./tool-capability-repair-list.md)。
