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
- [ ] P8 权限请求与客户端响应闭环
- [ ] P9 Desktop 原型接入准备
- [ ] P10 VS Code 插件接入准备
- [ ] P11 版本、升级、回滚与协议兼容加固

## 当前指针

- 进行中：P8 权限请求与客户端响应闭环
- 当前正在做：P8 第一刀已完成，已有 Core permission adapter 与 App Server `permission/respond` 协议桥；下一步是把真实 tool-capable runner 接进 adapter 提供的 `canUseTool`。
- 完成后下一项：P9 Desktop 原型接入准备

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
- 当前 `runTextOnlyCoreTurn` 仍是 `toolSchemas: []`，没有真实工具执行；真实 Bash/FileEdit/WebFetch 等工具权限流要在后续 tool-capable runner 接入后验证。
- 详细方案见 [CCR App Server 权限复用设计](../architecture/app-server-permission-reuse-design.md)。

## P9 Desktop 原型接入准备

目标：

- 为 Electron Desktop 准备 app-server client SDK。
- 明确 main process 如何 spawn app-server。
- 明确 preload 暴露哪些安全 API。
- 明确 renderer 只通过 IPC，不直接访问 Node / token / 文件系统。
- 以 [CCR 客户端产品与交互设计](../architecture/desktop-client-product-design.md) 作为页面、状态、权限弹窗和协议需求来源。

完成标准：

- 有 `desktop -> app-server` 的最小 client 示例。
- 能显示 `initialize`、`config/get`、`auth/status`。
- 能打开 workspace。
- 能展示 server log。

## P10 VS Code 插件接入准备

目标：

- 明确 VS Code runtime discovery。
- 明确优先连接 Desktop app-server。
- 明确找不到时启动 npm/global `ccr app-server`。
- 明确找不到 ccr 时提示用户确认 npm 安装。

完成标准：

- 有 VS Code 插件接入流程文档。
- 有 `ccr.runtime.mode/path/installStrategy/preferDesktop` 配置设计。
- 明确不静默安装，不内置完整 Core。

## P11 版本、升级、回滚与协议兼容加固

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

## 备注

- 当前状态：active
- 下一步需要：实现 P8 权限请求与客户端响应闭环，先补 Core permission service，再映射 App Server `permission/respond`。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：先补 App Server，再做 Desktop，再做 VS Code 插件。
- 第一阶段非目标：不做 websocket、daemon、多客户端共享、完整模型工具流、Desktop UI。
- 总收口标准：P1-P5 证明 app-server 最小控制面可用；P6-P8 证明真实会话可用；P9-P11 才进入 Desktop / VS Code 产品化准备。
