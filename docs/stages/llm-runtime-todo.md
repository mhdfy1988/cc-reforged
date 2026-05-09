# Claude Code Reforged Builtin LLM Runtime Todo

## 当前任务列表（实时）
- [x] P0 通用 LLM Runtime 骨架（`types.ts` / `providerRegistry.ts` / `llmRuntime.ts` / 最小 smoke）
- [x] P1 AnthropicProvider 基线封装（先包住旧 Anthropic 调用链，建立不回归基线）
- [x] P2 最小接缝接入（仅把 `services/api/claude.ts` 底层调用切到 `LlmRuntime`，外部导出保持不变）
- [x] P3 Provider 配置与模型配置（`llmConfig.ts` / provider-model 校验 / 本地配置文件）
- [x] P4 Codex OAuth 会话层（登录态、凭据落盘、刷新、脱敏日志）
- [x] P5 CodexOAuthProvider 文本链路（先非工具、非流式跑通）
- [x] P6 Provider / Model 真实化展示（CLI 选项、前台显示、认证状态）
- [x] P7 流式输出、工具调用与 usage 归一化
- [x] P8 Provider 定义层与 `apiMode` 抽象（补齐 provider 元数据、协议族、能力声明）
- [x] P9 Auth Strategy 与最小 Model Catalog（补齐认证策略类型、模型元数据目录）
- [x] P10 回归验证、文档收口与后续扩展准备

## 当前指针
- 已完成：P0-P10 全部主线任务
- 当前正在做：进入“稳定可扩展原型”后的真实入口稳定化，优先修复 `codex-oauth` 的默认模型与 transport 口径
- 完成后下一项：如果继续扩展，优先做 `openai api / openai-compatible / local provider` 中的一个，并把 `/model` 从最小配置切到真实 catalog 驱动

## 后续记录（追加）
- 第 18 轮：修复 TUI 首屏仍显示旧 Claude LLM 状态的问题。根因不是单纯文案，而是多处 UI 仍从旧 `mainLoopModel / billingType / apiKeyStatus` 读状态：`useMainLoopModel()` 在非 Anthropic provider 下仍可能被旧 AppState 默认 `sonnet` 覆盖；`CondensedLogo` 仍直接 `renderModelSetting(model)`；无 LLM 配置时默认 provider 仍是 `anthropic`；欢迎 feed 的 guest pass / overage credit 也属于 Claude 订阅促销。修复方式：把默认 provider 改成 `codex-oauth`，非 Anthropic provider 下 `useMainLoopModel()` 强制返回 LLM 配置模型；`LogoV2` 与 `CondensedLogo` 改为读取 runtime display status，显示 `GPT-5.4 · Codex OAuth`；`Notifications` 改为读取 runtime auth status，Codex OAuth 可用时不再显示 `Not logged in`；非 Anthropic provider 下隐藏 guest pass / overage credit / Opus 1M notice。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false` 均通过；`auth status --json` 显示当前为 `codex-oauth / gpt-5.4 / available`。
- 第 17 轮：按 TUI 登录入口主线补充 `Codex OAuth` 登录选项。新增 [LlmLoginFlow.tsx](D:/agent_project/claude-code-reforged/src/components/LlmLoginFlow.tsx)，把首次启动 OAuth 步骤从旧 Claude 三选一扩展为 `Codex OAuth / Claude subscription / Anthropic Console / 3rd-party platform` 四选一；选择 `Codex OAuth` 时会先检查本地凭据，若 `~/.ccr/data/codex-oauth.json` 可用则直接继续进入后续 onboarding，若不可用则打开浏览器执行 ChatGPT/Codex OAuth 登录；同时会把持久化 LLM provider 切到 `codex-oauth` 与默认 `gpt-5.4`，避免登录完成后仍停在 Anthropic provider。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false` 均通过；`auth status --json` 显示当前 `codex-oauth / gpt-5.4` 凭据可用。
- 第 16 轮：补充未来 App 形态下的“模型与登录”设计口径。结论是登录不应作为 CCR 的全局入口，而应作为 provider 配置的一部分：App 默认进入工作台，当前默认 provider/model 可用则直接使用，不可用时展示“配置模型后开始使用”的轻量引导；设置页提供“模型与登录”，按 provider 卡片管理 OAuth / API Key / Base URL / 本地服务；操作页只展示当前模型状态并提供快速切换。详细方案已追加到 [llm-frontend-provider-model-picker-design.md](D:/agent_project/claude-code-reforged/docs/stages/llm-frontend-provider-model-picker-design.md) 的“后期 App 界面操作方案”章节。
- 第 15 轮：修复 TUI 首屏启动时报 `resolveDispatcher(...).useEffectEvent is not a function`。根因不是 `codex-oauth` 或 TUI 入口逻辑，而是本地实际安装的 `react@19.2.4` 已暴露 `useEffectEvent`，但 `react-reconciler@0.31.0` 的 dispatcher 仍不支持该 hook；而 TUI 使用自定义 reconciler 渲染，导致 [AppState.tsx](D:/agent_project/claude-code-reforged/src/state/AppState.tsx) 首屏挂载即崩。修复方式：把 `react` 依赖口径调整到 `^19.2.0`，把 `react-reconciler` 升到 `^0.33.0`，把 `@types/react` 调整到 `^19.2.0`，并重新生成 `package-lock.json`。验证结果：`react-reconciler` 本地包已包含 `useEffectEvent` dispatcher；`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false` 均通过；真实 PowerShell TUI 窗口启动后进程保持运行，未再出现首屏 `useEffectEvent` 崩溃。
- 第 14 轮：对照 `adaptive-memory-agent` 与 `openclaw_compact_context` 中已跑通过的 Codex OAuth 实现后，确认 CCR 的 session/login 链路与既有实现一致，真正差异在请求层。最小 provider 直连在 `defaultTransport: 'sse'` 下已能通过真实 `gpt-5.4` 返回；而 `ccr -p` 默认走配置里的 `auto` transport，会先尝试 WebSocket，并在当前真实入口收到 `WebSocket closed 1011` 后失败。修复策略：不引入代理，不改 OAuth，不伪装 Anthropic；把 `codex-oauth` 默认 transport 固定为 `sse`，并把直接 `complete/stream` 调用的推理参数从 `reasoning` 改为底层 `reasoningEffort`，保持与 `pi-ai` provider 真实入参一致。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-claude-adapter` 均通过；`auth status --json` 显示 `codex-oauth / gpt-5.4` 登录可用；真实入口 `ccr -p "用中文一句话回复：CCR Codex OAuth 已连接"` 已返回 `CCR Codex OAuth 已连接。`。
- 第 13 轮：进入真实 `codex-oauth` 调用验证。`auth login` 和 `auth status` 已能识别 `~/.ccr/data/codex-oauth.json`，默认 provider/model 已切到 `codex-oauth / gpt-5.4`。本轮曾把本机网络出口现象误判成需要新增 provider 代理配置，已撤回相关代码、文档和本地配置，不把它作为产品方案。真正暴露出的代码问题是：非 Anthropic provider 仍可能继承上层默认 `claude-sonnet-*` 模型，导致真实 Codex 后端拒绝；已在 `claudeApiAdapter.ts` 收口为“非 Anthropic provider 下默认使用 LLM 配置中的真实模型”，并补 `smoke-llm-claude-adapter` 覆盖。验证结果：`auth status --json` 显示登录与模型配置正确；`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-claude-adapter` 均通过。
- 初始化：本 todo 专门承接 `feature/builtin-llm-runtime` 分支上的“内置通用 LLM Runtime”主线，避免继续复用 [current-todo.md](D:/agent_project/claude-code-reforged/docs/stages/current-todo.md) 的旧 typecheck/repair 任务口径。
- 初始化：本主线的权威设计文档为 [builtin-llm-runtime-design.md](D:/agent_project/claude-code-reforged/docs/stages/builtin-llm-runtime-design.md)。后续阶段划分、边界和验收标准默认以该设计稿为准。
- 初始化：第一阶段明确不直接改 `query.ts`、`QueryEngine.ts`、`services/api/claude.ts` 的主行为，不直接接真实 Codex OAuth，也不把 `sonnet/opus/haiku` 伪装映射当最终方案；先把独立 `LlmRuntime` 地基搭稳。
- 第 1 轮：P0 已完成。新增 [types.ts](D:/agent_project/claude-code-reforged/src/services/llm/types.ts)、[providerRegistry.ts](D:/agent_project/claude-code-reforged/src/services/llm/providerRegistry.ts)、[llmRuntime.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmRuntime.ts) 三个核心文件，并新增最小验证脚本 [smoke-llm-runtime.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-llm-runtime.mjs) 与 `npm.cmd run smoke:llm-runtime` 入口。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-runtime` 均为 `exit 0`。本轮只证明了“provider 注册 -> runtime 调用 -> fallback stream 输出”骨架成立，没有改动旧 Anthropic 主链路，当前切到 P1。
- 第 2 轮：P1 已完成。新增 [AnthropicProvider.ts](D:/agent_project/claude-code-reforged/src/services/llm/providers/AnthropicProvider.ts)，把 [client.ts](D:/agent_project/claude-code-reforged/src/services/api/client.ts) 里的 `getAnthropicClient()` 和 Anthropic SDK 的 `beta.messages.create/stream` 包进独立 provider 封装，同时新增验证脚本 [smoke-anthropic-provider.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-anthropic-provider.mjs) 与 `npm.cmd run smoke:anthropic-provider`。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:anthropic-provider`、`npm.cmd run smoke:llm-runtime` 均为 `exit 0`。本轮仍未改动 `services/api/claude.ts` 主逻辑，当前切到 P2。
- 第 3 轮：P2 已完成。新增 [defaultRuntime.ts](D:/agent_project/claude-code-reforged/src/services/llm/defaultRuntime.ts) 和 [defaultAnthropicProvider.ts](D:/agent_project/claude-code-reforged/src/services/llm/providers/defaultAnthropicProvider.ts)，把 Anthropic provider 注册进默认 `LlmRuntime` 单例，并把 [claude.ts](D:/agent_project/claude-code-reforged/src/services/api/claude.ts) 里 3 个直接 `getAnthropicClient(...)` 调用点收回到 `getDefaultAnthropicProvider().getClient(...)`。期间首轮因漏建 `defaultAnthropicProvider.ts` 导致 `TS2307`，补齐文件后已恢复通过。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:anthropic-provider`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:runtime` 均为 `exit 0`。当前外部导出和上层 query/tool 主循环未改，当前切到 P3。
- 第 4 轮：P3 已完成。新增 [llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts)，建立了通用 provider/model 配置加载层，默认读取 `~/.claude/data/llm.config.local.json`，支持 `CLAUDE_CODE_LLM_CONFIG_PATH`、`CLAUDE_CODE_LLM_PROVIDER`、`CLAUDE_CODE_LLM_MODEL` 覆盖，并提供 provider-aware 校验函数。随后把 [defaultRuntime.ts](D:/agent_project/claude-code-reforged/src/services/llm/defaultRuntime.ts) 接到该配置层，并补了 [smoke-llm-config.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-llm-config.mjs)。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:anthropic-provider`、`npm.cmd run smoke:runtime` 均为 `exit 0`。当前切到 P4。
- 第 5 轮：P4 已完成。扩展 [llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts) 增加 `codex-oauth` 的默认配置项，并新增 [CodexOAuthSession.ts](D:/agent_project/claude-code-reforged/src/services/llm/sessions/CodexOAuthSession.ts) 与 [defaultCodexOAuthSession.ts](D:/agent_project/claude-code-reforged/src/services/llm/sessions/defaultCodexOAuthSession.ts)。当前实现已覆盖凭据 JSON 持久化、可用性检查、PKCE 授权 URL 生成、authorization code 换 token、refresh token 刷新、本地浏览器回调登录，以及 Windows 下保留 OAuth 查询参数的浏览器打开命令。新增专项验证脚本 [smoke-codex-oauth-session.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-codex-oauth-session.mjs)。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-session`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:runtime` 均为 `exit 0`。当前切到 P5。
- 第 6 轮：P5 已完成。新增 [CodexOAuthProvider.ts](D:/agent_project/claude-code-reforged/src/services/llm/providers/CodexOAuthProvider.ts)，并把它注册进 [defaultRuntime.ts](D:/agent_project/claude-code-reforged/src/services/llm/defaultRuntime.ts)。当前 `codex-oauth` provider 已经能够通过 session 取得 access token，基于 `@mariozechner/pi-ai@0.58.0` 这条成熟 transport 发出最小非流式文本请求，并把返回结果归一化成项目自己的 `LlmGenerateResponse`。当前支持面刻意收在 P5 范围：只支持 `system + user` 纯文本消息，不支持 assistant 历史、tool/tool_result 或流式。新增专项验证脚本 [smoke-codex-oauth-provider.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-codex-oauth-provider.mjs)。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:codex-oauth-session`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:runtime` 均为 `exit 0`。当前切到 P6。
- 第 7 轮：P6 已完成。新增 [runtimeStatus.ts](D:/agent_project/claude-code-reforged/src/services/llm/runtimeStatus.ts) 统一 provider/model/auth 展示口径，[llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts) 增加持久化更新入口，[defaultRuntime.ts](D:/agent_project/claude-code-reforged/src/services/llm/defaultRuntime.ts) 与 [defaultCodexOAuthSession.ts](D:/agent_project/claude-code-reforged/src/services/llm/sessions/defaultCodexOAuthSession.ts) 增加 reset。`/model` 命令现已变成 provider-aware：Anthropic 继续走 Claude 菜单，非 Anthropic provider 改为展示真实 provider/model 并支持直接写回配置模型；设置面板、状态栏与 `auth status` 也已经展示真实 `LLM provider / model / auth` 信息。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-config`、`node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json` 已完成，其中前 3 项 `exit 0`，最后一项按未登录场景返回 `exit 1` 但 JSON 输出正确。当前切到 P7。
- 第 8 轮：P7 进入进行中。扩展 [types.ts](D:/agent_project/claude-code-reforged/src/services/llm/types.ts) 增加 `tools` 与 `toolName` 运行时表达；重写 [CodexOAuthProvider.ts](D:/agent_project/claude-code-reforged/src/services/llm/providers/CodexOAuthProvider.ts)，把 provider 能力从 P5 的“system+user 非流式文本”扩展到 provider 级的 assistant 历史、tool_result 回放、真实 `stream()`、tool_call 输出和 usage 归一化；同步扩展 [smoke-codex-oauth-provider.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-codex-oauth-provider.mjs) 覆盖非流式与流式两条路径。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:llm-runtime` 均为 `exit 0`。当前仍未把 `codex-oauth` 接进主 `query.ts -> queryModelWithStreaming` 链路，P7 下一步是补最小接缝与事件适配，而不是重写主循环。
- 第 9 轮：基于对 [cc-haha-main](D:/agent_project/cc-haha-main)、[codex-main](D:/agent_project/codex-main)、[hermes-agent-main](D:/agent_project/hermes-agent-main)、[openclaw-main](D:/agent_project/openclaw-main) 的源码对照，补充剩余 todo。结论是当前 `src/services/llm/` 地基已经够支撑第一版可用通用 LLM，但还缺 4 个小而关键的补强点：`provider definition`、`apiMode`、`auth strategy`、`model catalog`。因此把原来的单一 P8 拆成：P8（Provider 定义层与 `apiMode` 抽象）、P9（Auth Strategy 与最小 Model Catalog）、P10（回归验证与文档收口）。当前主线不变，仍然先完成 P7，再顺序补齐这 3 项，不走 `ANTHROPIC_*` 伪装方案，也不直接引入 OpenClaw 那种大而全 provider hook 平台。
- 第 10 轮：P7 已完成。新增 [claudeApiAdapter.ts](D:/agent_project/claude-code-reforged/src/services/llm/claudeApiAdapter.ts)，把 Claude 主消息格式和 `LlmRuntime` 之间的转换边界正式抽出来：当前已覆盖 `system / user / assistant / tool_result` 到 `LlmMessage` 的映射、tool schema 到 `LlmToolDefinition` 的映射、runtime 流式事件到 `StreamEvent` 的映射，以及 runtime 最终响应到 `AssistantMessage` 的映射。随后在 [claude.ts](D:/agent_project/claude-code-reforged/src/services/api/claude.ts) 中增加非 `anthropic` provider 的最小选路，把 `queryModel()` 接到内置 runtime 主链；并新增验证脚本 [smoke-llm-claude-adapter.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-llm-claude-adapter.mjs) 与 `npm.cmd run smoke:llm-claude-adapter`。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:llm-claude-adapter`、`npm.cmd run smoke:runtime` 均为 `exit 0`。当前主线已切到 P8。
- 第 11 轮：P8 已完成。新增 [providerDefinitions.ts](D:/agent_project/claude-code-reforged/src/services/llm/providerDefinitions.ts)，正式定义 `LlmProviderDefinition`、最小 `apiMode` 集合和 provider 能力声明；`AnthropicProvider`、`CodexOAuthProvider` 现已各自携带标准 definition，`providerRegistry.ts` / `llmRuntime.ts` 也新增 `getDefinition()`、`listDefinitions()`、`getProviderDefinition()`、`listProviderDefinitions()`。同时把 [llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts) 扩到支持 `apiMode` 与能力覆盖，并修复了 provider 配置浅合并会覆盖默认元数据的问题，改为逐 provider 深合并；[runtimeStatus.ts](D:/agent_project/claude-code-reforged/src/services/llm/runtimeStatus.ts) 现已统一从 provider definition + config override 读取 `displayName / apiMode / authStrategy / capabilities`。验证结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:llm-claude-adapter`、`npm.cmd run smoke:runtime` 均为 `exit 0`。
- 第 12 轮：P9 与 P10 已完成。新增 [modelCatalog.ts](D:/agent_project/claude-code-reforged/src/services/llm/modelCatalog.ts)，补齐最小 `LlmAuthStrategy` 和 `LlmModelCatalogEntry`：Anthropic 侧复用现有 `context.ts` / `model.ts` 获取上下文窗口、输出上限和显示名，`codex-oauth` 侧先落最小静态 catalog；[runtimeStatus.ts](D:/agent_project/claude-code-reforged/src/services/llm/runtimeStatus.ts) 与 [auth.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/auth.ts) 现已能输出 `apiMode / authStrategy / modelDisplayName / contextWindow / maxOutputTokens / inputModalities`，[status.tsx](D:/agent_project/claude-code-reforged/src/utils/status.tsx) 也补了 `LLM API mode` 与 `LLM model profile`。新增专项验证脚本 [smoke-llm-runtime-status.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-llm-runtime-status.mjs) 与 `npm.cmd run smoke:llm-runtime-status`。最终回归结果：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:llm-runtime-status`、`npm.cmd run smoke:llm-claude-adapter`、`npm.cmd run smoke:anthropic-provider`、`npm.cmd run smoke:codex-oauth-provider`、`npm.cmd run smoke:runtime` 全部通过；`node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js auth status --json` 在未登录场景下按预期返回 `exit 1`，但 JSON 已正确输出 `llmApiMode / llmAuthStrategy / llmModel*` 字段。至此 P0-P10 闭环完成，当前主线进入“稳定可扩展原型”阶段。

## 阶段明细

### P0 通用 LLM Runtime 骨架

目标：

- 在不影响现有 Claude 主链路的前提下，建立新的 `src/services/llm/` 独立基础层。
- 先证明“provider 注册 -> runtime 选择 -> 请求 -> 结果返回”这条最小链路成立。

计划交付：

- `src/services/llm/types.ts`
- `src/services/llm/providerRegistry.ts`
- `src/services/llm/llmRuntime.ts`
- 一个最小 `MockProvider` 或等价 smoke 验证入口

本阶段不做：

- 不改 `src/query.ts`
- 不改 `src/QueryEngine.ts`
- 不改 `src/services/api/claude.ts`
- 不接真实 Codex OAuth
- 不改前台 provider/model 展示

完成标准：

- 新目录和核心类型能通过 `typecheck`
- 能跑一个最小 smoke，证明 runtime 能注册并调用 provider
- 不引入现有 Anthropic 路径回归

### P1 AnthropicProvider 基线封装

目标：

- 把现有 Anthropic 调用链包进新的 provider 适配层，建立回归基线。

计划交付：

- `src/services/llm/providers/AnthropicProvider.ts`
- 对 `getAnthropicClient()`、非流式、流式入口做最小封装

关键约束：

- 行为必须尽量与当前 Anthropic 路径一致
- 不改变旧的导出函数形状
- 不在这一阶段引入 Codex OAuth 逻辑

完成标准：

- Anthropic 路径继续可 build / typecheck
- 与当前 `services/api/claude.ts` 调用语义保持一致
- 后续 P2 能直接拿来做底层切换

### P2 最小接缝接入

目标：

- 只改底层调用入口，把 `services/api/claude.ts` 接到 `LlmRuntime`，对上层维持兼容门面。

计划交付：

- `src/services/api/claude.ts` 内部从“直接调 Anthropic”改成“走 LlmRuntime + AnthropicProvider”
- 外部函数签名保持不变

关键约束：

- `QueryEngine` / `query.ts` / tool 主循环不应感知 provider 切换
- 这一阶段的成功是“旧功能不回归”，不是“多 provider 已完全可用”

完成标准：

- 原 Anthropic 路径仍能完成基础 smoke
- 回归验证能证明旧 CLI / print / ask 主路径没被打断

### P3 Provider 配置与模型配置

目标：

- 建立通用 provider / model 配置加载层，为后续 Codex OAuth provider 做入口。

计划交付：

- `src/services/llm/llmConfig.ts`
- 本地配置文件读取逻辑
- provider/model 校验逻辑

配置方向：

- provider 配置与真实 credential 分离
- 本地运行态文件不提交到仓库
- 后续允许 `anthropic`、`codex-oauth`、`openai-compatible` 等并列存在

完成标准：

- 能从配置中读出 provider/model
- provider-aware 校验成立
- 不再把模型选择硬绑在 Claude alias 上

### P4 Codex OAuth 会话层

目标：

- 独立建立 Codex OAuth 登录态与 token 生命周期管理，不污染现有 Anthropic auth 代码。

计划交付：

- `CodexOAuthSession`
- 本地 credential store
- refresh / re-login / masked diagnostics

关键约束：

- 凭据只落本地，不入仓
- 日志不能暴露 token
- 错误分类要能区分未登录、过期、网络失败

完成标准：

- 未登录能给出清晰提示
- 登录后能写入本地状态
- token 过期和 refresh 失败都有明确状态

### P5 CodexOAuthProvider 文本链路

目标：

- 先把最小文本请求跑通，证明通用 LLM Runtime 不只是骨架。

计划交付：

- `CodexOAuthProvider`
- 先支持非流式文本生成
- 最小模型调用 smoke

关键约束：

- 先不接工具调用
- 先不追求流式完整
- 先以“能稳定拿到一轮文本结果”为目标

完成标准：

- `provider=codex-oauth` 的最小请求可成功返回结果
- 模型错误、登录错误、网络错误能被区分

### P6 Provider / Model 真实化展示

目标：

- 前台不再长期显示 Claude alias，而是显示真实 provider / model / auth 状态。

计划交付：

- CLI provider/model 选择入口
- 前台 provider/model 状态展示
- 认证状态展示

关键约束：

- 不做 `sonnet -> gpt-5.4` 这类隐藏映射作为最终形态
- 保持兼容期内的向后兼容提示

完成标准：

- 用户能看到真实 `Provider / Model / Auth`
- 配置和展示口径统一

### P7 流式输出、工具调用与 usage 归一化

目标：

- 把 Codex OAuth provider 扩到可承接真实 agent 回合，而不只是单轮文本问答。

计划交付：

- 流式事件归一化
- 工具调用协议转换
- usage、错误、限额、诊断归一化

关键约束：

- 上层 `query.ts` 和 `runTools(...)` 尽量不重写，只在 provider 层做协议归一
- 事件顺序、tool_use/tool_result 对应关系必须稳定

完成标准：

- 流式输出可用
- 工具回合可跑通
- usage 和错误可稳定展示

### P8 Provider 定义层与 `apiMode` 抽象

目标：

- 在现有 `LlmProvider` 运行对象之外，补一层稳定的 provider 元数据定义，避免后续 provider 越接越散。
- 显式表达 provider 所属协议族（`apiMode` / wire family），为后续多 provider 接入提供统一判断口径。

计划交付：

- `LlmProviderDefinition` 或等价元数据结构
- `apiMode` 最小枚举，例如 `anthropic-messages`、`openai-responses`、`openai-chat`、`custom`
- provider 能力声明（如 streaming / tools / reasoning / usage）
- runtime / config / display 层对 provider 元数据的统一读取口

关键约束：

- 不重写现有 `LlmRuntime` 主调度逻辑，优先做增量抽象
- 不把 provider 元数据直接塞回 UI 特判或 provider 私有字段里
- `apiMode` 只保留最小必要集合，不追求一步到位覆盖所有怪异 transport

完成标准：

- runtime 可以从 provider 定义而不是 provider 私有实现中读出 `displayName / apiMode / authStrategy / capabilities`
- `anthropic` 与 `codex-oauth` 两个 provider 都完成元数据接入
- 后续新增 provider 不需要再在多个调用点重复声明协议族和能力

### P9 Auth Strategy 与最小 Model Catalog

目标：

- 把“认证方式”从具体 provider 实现里抽出来，避免把 `codex-oauth` 的时效问题写成 provider 特例。
- 补一个最小模型目录层，为后续多 provider 真实模型选择和能力判断提供元数据基础。

计划交付：

- `LlmAuthStrategy` 最小枚举，例如 `api_key`、`oauth_refreshable`、`oauth_external`、`external_process`
- provider config / runtime status / session 层统一使用认证策略口径
- 最小 `LlmModelCatalog` 或等价结构，至少能表达 `provider / model / contextWindow / maxOutput / reasoning / tools / input modality`
- 当前已接入 provider 的默认模型元数据落点

关键约束：

- 不在这一阶段做完整在线模型发现系统
- 不引入复杂的动态 catalog 拉取、插件扫描或 OpenClaw 级别的 discovery 机制
- model catalog 先服务于 runtime 与展示，不抢着重做整套 `/model` 交互

完成标准：

- `codex-oauth` 与 `anthropic` 至少各有一份可被 runtime 读取的最小模型元数据
- auth 状态、provider 状态、模型状态三者口径一致
- 后续接入 `openai api / gemini / openrouter / custom endpoint` 时，不需要再回头重构 auth 类型和模型元数据结构

### P10 回归验证、文档收口与后续扩展准备

目标：

- 形成一轮完整的“架构 -> 最小接入 -> 真实 provider -> 元数据补强 -> 回归收口”闭环。

计划交付：

- 回归验证记录
- 设计文档与实现文档同步
- 下一阶段扩展清单

建议覆盖：

- Anthropic provider 不回归
- Codex OAuth 文本、流式、工具路径可用
- Provider 定义、`apiMode`、Auth Strategy、Model Catalog 四层口径一致
- 配置、认证、错误、日志、展示口径一致

## 备注
- 当前状态：P0-P10 completed
- 当前分支：`feature/builtin-llm-runtime`
- 当前仓库：`D:\\agent_project\\claude-code-reforged`
- 当前主原则：先搭独立 `LlmRuntime`，再小切口接入，不一次性大改旧 Claude 主链路。
- 单项完成标准：实现最小切片 -> 定向验证 -> 回写本 todo -> 再切下一项。
- 当前补强重点：后续如继续扩展，优先补真实 provider 扩展（`openai api / openai-compatible / local`）与更细的 `/model` catalog 驱动。
- 总收口标准：已完成。`anthropic + codex-oauth` 两条链路在运行时、展示层和认证层口径已对齐，当前可视为“稳定可扩展原型”阶段。

## 追加记录：第 18 轮 TUI 独立认证闸口

问题：

- 用户删除 `codex-oauth` 认证文件后，直接启动 TUI 仍然先进入 workspace trust 页面。
- 根因不是认证仍然存在，而是原启动流程只在首次 onboarding 中展示登录选择；`hasCompletedOnboarding=true` 后会跳过登录页，继续进入 workspace trust。

修复：

- 在 `showSetupScreens()` 中新增独立 LLM 认证闸口。
- 每次交互式启动都会先读取当前 LLM runtime auth status。
- 如果当前 provider 凭据不可用，则进入 `LlmLoginFlow`，由用户选择 `Codex OAuth / Claude / Console / 3rd-party platform`。
- 该闸口放在 workspace trust 前，避免“删了 token 但先看到 workspace 配置页”的误导。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `auth status --json` 在认证文件删除后返回 `llmProvider=codex-oauth`、`llmAuthState=missing`、`loggedIn=false`，说明缺凭据状态可被 runtime 正确识别。

后续注意：

- onboarding 只表示首次引导是否完成，不代表 provider 认证可用。
- provider 认证必须作为运行前置条件单独检查，后续 App / Web / TUI 都应复用同一类 auth gate 口径。

## 追加记录：第 19 轮 workspace trust 后 effort 空模型崩溃

问题：

- 用户完成 workspace trust 后，进入主界面时报错：`Cannot read properties of null (reading 'toLowerCase')`。
- 堆栈落在 `modelSupportsEffort()`，触发点是 `PromptInput` 启动时渲染 effort notification。

根因：

- `PromptInput` 同时存在两个模型值：
  - `mainLoopModel`：通过 `useMainLoopModel()` 解析后的可用模型。
  - `mainLoopModel_`：从 AppState 读取的原始模型设置，默认可以是 `null`。
- effort notification 错误地使用了 `mainLoopModel_`，导致默认模型为空时直接传入 `modelSupportsEffort()`。

修复：

- effort notification 改为使用已解析的 `mainLoopModel`。
- `modelSupportsEffort()` 和 `modelSupportsMaxEffort()` 增加空值防御，避免后续其他 UI 或恢复状态误传空模型时直接崩溃。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `auth status --json` 通过，并确认当前 `codex-oauth / gpt-5.4` 认证状态为 available。

## 追加记录：第 20 轮 Markdown 缓存 hash 的 ESM 运行时崩溃

问题：

- 用户进入主界面后，渲染 Markdown 内容时报错：`require is not defined`。
- 堆栈落在 `dist/src/utils/hash.js` 的 `hashContent()`，由 `MarkdownBody -> cacheLexer -> hashContent` 触发。

根因：

- `src/utils/hash.ts` 是 ESM 输出链路，但函数内部仍残留 `require('crypto')`。
- 在当前 Node + ESM loader 运行方式下，`require` 不存在，导致进入主界面后第一次 Markdown 缓存就崩。

修复：

- 将 `require('crypto')` 改为顶部静态导入 `import { createHash } from 'crypto'`。
- `hashContent()` 和 `hashPair()` 统一使用 `createHash('sha256')`。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `auth status --json` 通过，并确认当前仍是 `codex-oauth / gpt-5.4`，没有切回旧 Claude provider。

后续注意：

- 这类问题不是模型 provider 回退，而是源码恢复后 ESM/CJS 边界未清理干净。
- 后续如继续出现 `require is not defined`，优先全局查函数内 `require(...)`，改为 ESM 静态 import 或已有适配层。

## 追加记录：第 21 轮 CCR v0.1 产品版本口径

问题：

- TUI 和命令行仍显示 `Claude Code v2.1.88-reforged` 或 `2.1.88`，这会把“恢复来源版本”和“CCR 产品版本”混在一起。
- 用户明确产品版本应为 `CCR v0.1`。

修复：

- `package.json` 和 `package-lock.json` 改为合法 npm 语义版本 `0.1.0`。
- `MACRO.VERSION` 默认值改为 `0.1`，用于 TUI 和运行时显示。
- `--version` 快速路径改为输出 `CCR v0.1`。
- `/version` 命令改为输出 `CCR v0.1`，保留 build time 信息。
- 未构建提示改为 `CCR has not been built yet...`，去掉旧产品名。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js --version` 输出 `CCR v0.1`。

后续注意：

- 源码恢复来源可以继续在内部文档里记录为 `Claude Code 2.1.88`。
- 用户可见产品名和版本统一使用 `CCR v0.1`，不要再把恢复来源版本作为产品版本展示。

## 追加记录：第 22 轮 HelpV2 帮助页旧产品文案

问题：

- `/help` 页标题仍显示 `Claude Code v0.1`。
- general 页简介仍显示 `Claude understands your codebase...`。
- 页脚帮助链接仍指向 `https://code.claude.com/docs/en/overview`。

修复：

- HelpV2 标题改为 `CCR v${MACRO.VERSION}`。
- general 页简介改为 `CCR understands your codebase...`。
- 帮助链接改为当前 CCR 仓库地址 `https://github.com/mhdfy1988/cc-reforged`。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `src/components/HelpV2` 和 `dist/src/components/HelpV2` 中已无 `Claude Code v`、`Claude understands`、旧 Claude 文档链接残留。

后续注意：

- 用户可见页面优先改 CCR 口径。
- `CLAUDE.md` 文件名、内部协议字段、恢复来源注释、兼容层路径暂不批量替换，避免破坏原始机制。

## 追加记录：第 23 轮 用户可见旧产品自称清理

问题：

- `/help` 之外仍有多处用户可见文案沿用旧产品自称，例如 workspace 信任页、onboarding、ResumeTask、PromptInput、ModelPicker、状态/反馈/安装/Insights 命令、Console OAuth、远程任务、MCP 重启提示、IDE 引导、安全弹窗等。
- 这些文案会让用户误以为当前 CLI 仍是原始 `Claude Code`，也会和 `ccr` 命令、CCR v0.1 产品口径冲突。

修复：

- 通用界面和命令描述统一改为 `CCR` 自称。
- 远程任务相关提示统一改为 `CCR on the web`，不再直接显示 `Claude Code on the web`。
- 安装和帮助提示统一使用 `ccr --help` / `ccr marketplace ...`。
- `CLAUDE.md` 文件名、Anthropic/Claude provider 专用语义、模型名 `Sonnet` / `Opus`、generated event 类型和内部兼容字段不做批量替换。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- 使用本轮目标短语扫描时，`/help`、启动页、登录页、workspace 信任页、远程任务提示、安全弹窗、状态/安装/反馈等第一批已清理完成。
- 进一步全局扫描 `Claude Code` 时仍发现更大范围残留，主要分布在 Insights、GitHub App、MCP/IDE/Chrome/Desktop 外部集成、配置 schema、prompt/system prompt、权限/路径报错、attribution、teleport/remote 等模块；这不属于本轮截图同类文案的简单替换范围，需要按“通用 CCR 自称 / 外部专有名 / 兼容协议名 / 注释与 generated”分批审查。

后续注意：

- `Grove.tsx` 中的 `Help improve Claude` 属于 Anthropic provider 的隐私授权语义，本轮暂不改成 CCR，避免把第三方模型/服务条款改错。
- 如果后续决定彻底移除 Anthropic 登录流，再单独做一轮 provider 专用文案和隐私授权流程清理。
- 下一轮建议开一个“产品命名分层清理”专项：先改通用用户界面与错误提示，再处理 prompt/system prompt，最后再评估外部集成专名是否需要保留或替换。
