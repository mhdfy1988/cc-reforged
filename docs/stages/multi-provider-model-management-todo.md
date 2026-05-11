# CCR 多供应商模型与协议接入 Todo

## 目标

把 CCR 的 LLM Runtime 从当前 `anthropic` / `codex-oauth` 可扩展原型，推进到可管理多个模型配置档案、多个供应商、多个协议和第三方中转的正式能力。

参考设计：[CCR 多供应商模型与协议接入设计](../architecture/multi-provider-model-management-design.md)。

多模态输入/输出、附件上传和图片预览不在本文推进，单独见 [CCR 多模态输入输出 Todo](./multimodal-input-output-todo.md)。本文只提供模型能力声明和 provider/profile 选择能力。

## 当前任务列表（实时）

- [ ] MP-00 设计口径复核与现有代码盘点
- [ ] MP-01 模型配置档案 Profile 数据模型
- [ ] MP-02 Provider / Protocol / Auth / Capability 类型扩展
- [ ] MP-03 配置读写、迁移和敏感信息隔离
- [ ] MP-04 协议适配层抽象
- [x] MP-04a OpenAI Chat Completions 公共协议适配器
- [ ] MP-05 官方 OpenAI provider
- [ ] MP-06 OpenAI Compatible / 第三方中转 provider
- [x] MP-06a DeepSeek 官方 API provider 第一版
- [ ] MP-07 可用性状态与测试连接
- [x] MP-07a Core / App Server / SDK 可用性状态与手动测试连接第一版
- [ ] MP-07b Desktop 模型页展示、测试按钮和失败状态回写
- [ ] MP-08 Desktop 一级“模型”页面
- [x] MP-09a 顶部当前供应商内模型快速切换
- [ ] MP-09b 顶部 Profile / 供应商完整快速切换
- [ ] MP-10 每轮 provider/model/protocol 元数据记录
- [ ] MP-11 CLI / TUI 配置与切换入口补齐
- [ ] MP-12 smoke、真实 e2e 和文档收口

## 当前指针

- 进行中：MP-07 可用性状态与测试连接
- 当前进展：Core、App Server、SDK 和 Desktop IPC 已有 `model/availability` 与 `model/test` 第一版；缺少 API Key 时会返回 `auth_required`，不会发真实网络请求。
- 下一步：MP-07b / MP-08，在 Desktop 一级“模型”页面补 DeepSeek API Key 配置入口、状态展示和“测试连接”按钮。

## 接下来安排

整体顺序：先做 Core 配置与协议模型，再做 provider 接入，最后做 Desktop / CLI / TUI 的配置和切换体验。

- 第一段：MP-00 到 MP-03，先把数据模型、配置读写、敏感信息隔离和迁移边界定稳。
- 第二段：MP-04 到 MP-06，落协议适配层、官方 OpenAI、OpenAI Compatible / 第三方中转。
- 第三段：MP-07 到 MP-10，落可用性判断、测试连接、Desktop 一级模型页、顶部快速切换和每轮元数据。
- 第四段：MP-11 到 MP-12，补 CLI/TUI 入口、smoke、真实 e2e 和文档收口。

## 关键规则

- 会话不绑定模型，模型是应用级当前选择。
- 恢复历史会话不自动切换模型。
- 每轮消息记录实际使用的 provider/profile/model/apiMode，仅用于审计、成本统计和排查。
- Desktop 启动时不自动发真实模型请求。
- 真实网络检测只在“测试连接”或“发送消息”时发生。
- 第三方中转是一等配置档案，不靠环境变量或伪装 provider 临时绕过。
- 顶部模型胶囊只做快速切换，完整配置放到左侧一级“模型”页面。
- API Key、OAuth token、自定义 header 等敏感信息只落本地安全配置，不进入仓库和普通导出。

## MP-00 设计口径复核与现有代码盘点

状态：第一版进行中。当前供应商内模型切换已落地，DeepSeek provider 第一版已落地，Profile / 完整模型页待后续。

目标：

- 复核设计文档里的核心结论是否和现有代码一致。
- 盘点现有 LLM Runtime、provider definition、model catalog、runtime status、Desktop 设置页、App Server 模型接口和 TUI/CLI 模型入口。
- 确认哪些能力直接复用，哪些需要扩展，哪些不能动。

建议扫描入口：

- [types.ts](D:/agent_project/claude-code-reforged/src/services/llm/types.ts)
- [providerDefinitions.ts](D:/agent_project/claude-code-reforged/src/services/llm/providerDefinitions.ts)
- [llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts)
- [modelCatalog.ts](D:/agent_project/claude-code-reforged/src/services/llm/modelCatalog.ts)
- [runtimeStatus.ts](D:/agent_project/claude-code-reforged/src/services/llm/runtimeStatus.ts)
- [claudeApiAdapter.ts](D:/agent_project/claude-code-reforged/src/services/llm/claudeApiAdapter.ts)
- [SettingsPage.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/pages/SettingsPage.tsx)
- [main.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/main.tsx)

验收：

- 明确现有 Core LLM Runtime 复用边界。
- 明确 Desktop 左侧一级“模型”页面需要新增还是复用设置页布局。
- 明确 App Server 需要新增或扩展哪些模型配置接口。
- 明确 CLI/TUI 入口需要保留哪些旧行为。

## MP-01 模型配置档案 Profile 数据模型

状态：第一版进行中。Core / App Server / SDK 已完成轻量状态查询和手动测试连接入口，Desktop 完整页面展示待 MP-08 落地。

目标：

- 引入“模型配置档案”作为前台和配置层的核心对象。
- 支持一个供应商多个 endpoint、多个模型和不同协议模式。

计划交付：

- Profile 类型定义。
- Profile id / name / providerType / apiMode / baseUrl / auth / defaultModel / models / capabilities / availability。
- 当前应用模型选择状态。
- 上一个选择和切换历史的最小结构。

验收：

- 能表达 Codex OAuth、官方 OpenAI、OpenAI Compatible / 第三方中转。
- Profile 与敏感凭据分离。
- 会话不保存“当前模型绑定”，只保存每轮实际使用记录。

## MP-02 Provider / Protocol / Auth / Capability 类型扩展

状态：待开始。

目标：

- 把 provider、protocol、auth、capability 从当前最小定义扩成多协议可用结构。

计划交付：

- `apiMode` 至少支持：
  - `anthropic-messages`
  - `openai-responses`
  - `openai-chat-completions`
  - `openai-compatible`
  - `codex-oauth`
  - `custom`
- auth strategy 支持：
  - OAuth
  - API Key
  - custom headers
  - none
- capability 支持：
  - streaming
  - tools
  - vision
  - structured output
  - reasoning
  - multimodal input

验收：

- provider 不再只表达供应商名称。
- protocol 能被 Core 和 Desktop 同时理解。
- 类型扩展不破坏现有 `anthropic` 和 `codex-oauth`。

## MP-03 配置读写、迁移和敏感信息隔离

状态：待开始。

目标：

- 扩展现有 LLM 配置读写，支持多个 Profile。
- 敏感信息和普通配置分离。
- 保留现有 `codex-oauth` 默认配置兼容。

计划交付：

- Profile 配置文件结构。
- 当前应用选择保存。
- API Key / custom header 的本地敏感信息保存策略。
- 旧 `provider/model` 配置迁移到默认 Profile。

验收：

- 老配置能自动迁移或兼容读取。
- 新配置支持多个 Profile。
- 普通导出默认不包含密钥。
- `npm.cmd run smoke:llm-config` 通过。

## MP-04 协议适配层抽象

状态：第一版进行中，`openai-chat` 已抽出公共适配器。

目标：

- 新增协议适配层，避免每个 provider 直接污染 Core 消息模型。

计划交付：

- Responses API adapter。
- Chat Completions adapter。
- Anthropic Messages adapter 兼容现有路径。
- Codex OAuth 特殊 transport 保持现有实现，但接入统一协议口径。

验收：

- 上层 Query / Tool 主循环继续只依赖 CCR 自己的 `LlmRuntime`。
- 工具调用、流式输出和 usage 都能通过统一事件归一化。

## MP-04a OpenAI Chat Completions 公共协议适配器

状态：已完成第一版。

目标：

- 把 DeepSeek 第一版中已经跑通的 Chat Completions 逻辑上移成公共协议适配器。
- 后续 Kimi、Qwen、NewAPI、OneAPI、OpenAI Compatible / relay 不再复制 messages/tools/stream/usage 映射。

已交付：

- 新增 `src/services/llm/protocols/openaiChatCompletionsAdapter.ts`。
- 支持请求映射：messages、tools、tool_choice、max_tokens、temperature、stream_options。
- 支持可选 thinking / reasoning_effort，用于 DeepSeek 这类供应商差异。
- 支持响应归一化：text、thinking、tool_call、usage、stopReason。
- 支持 SSE 流式解析和最终 response_complete。
- 支持 providerLabel / providerId 注入，保证同一个协议适配器可服务多个供应商。
- DeepSeek provider 已瘦身为供应商壳，只保留 baseUrl、API Key、默认模型和 DeepSeek thinking 规则。

验收：

- `npm.cmd run smoke:openai-chat-protocol` 通过。
- `npm.cmd run smoke:deepseek-provider` 通过。
- `npm.cmd run smoke:llm-runtime` 通过。
- `npm.cmd run smoke:app-server-client` 通过。

## MP-05 官方 OpenAI provider

状态：待开始。

目标：

- 接入官方 OpenAI API。

计划交付：

- OpenAI provider definition。
- API Key 认证。
- Responses API 优先。
- Chat Completions 兼容模式。
- 模型目录最小集合。
- provider smoke。

验收：

- 能配置官方 OpenAI profile。
- 能测试连接。
- 能完成最小文本请求。
- 支持流式输出和 usage 归一化。

## MP-06 OpenAI Compatible / 第三方中转 provider

状态：待开始。

目标：

- 把 NewAPI、OneAPI、各类 relay、自定义 endpoint 作为一等配置档案。

计划交付：

- `baseUrl` 配置。
- `apiMode` 显式选择。
- API Key / custom headers。
- 模型名透传。
- provider 差异声明。
- 错误和限流归一化。

验收：

- 第三方中转不需要伪装成官方 OpenAI。
- 能配置多个中转 Profile。
- 能测试连接。
- 模型名不被强制映射。

## MP-06a DeepSeek 官方 API provider 第一版

状态：已完成第一版。

目标：

- 先接入 DeepSeek 官方 API，验证 CCR 的 OpenAI Chat Completions 协议链路可以跑通真实供应商。
- 不把 DeepSeek 临时伪装成 OpenAI 或 Codex OAuth。

已交付：

- `deepseek` provider definition。
- 默认配置：`https://api.deepseek.com`、`deepseek-v4-flash`。
- 模型目录：`deepseek-v4-flash`、`deepseek-v4-pro`。
- API Key 来源：`CCR_DEEPSEEK_API_KEY`，兼容 `DEEPSEEK_API_KEY`。
- baseUrl 覆盖：`CCR_DEEPSEEK_BASE_URL`，兼容 `DEEPSEEK_BASE_URL`。
- Chat Completions 请求映射：messages、tools、tool_choice、thinking、reasoning_effort、max_tokens。
- 响应归一化：text、thinking、tool_call、usage、stopReason。
- SSE 流式事件归一化。
- 复用公共 `OpenAiChatCompletionsAdapter`，DeepSeek provider 不再持有协议映射主体逻辑。
- `model/set` 支持切换 provider，Desktop 顶部模型菜单能看到所有已注册 provider 的模型。
- smoke：`smoke:deepseek-provider`、LLM config/runtime/status、App Server client 模型切换。

验收：

- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:deepseek-provider` 通过。
- `npm.cmd run smoke:llm-config` 通过。
- `npm.cmd run smoke:llm-runtime` 通过。
- `npm.cmd run smoke:llm-runtime-status` 通过。

后续：

- MP-07 统一补“测试连接”和 availability 状态。
- MP-08 在 Desktop 一级“模型”页面里补 API Key 配置入口。
- MP-10 继续补每轮 provider/model/protocol 元数据审计展示。

## MP-07 可用性状态与测试连接

状态：待开始。

目标：

- 建立启动轻量判断和用户触发真实检测两层机制。

状态建议：

- `not_configured`
- `needs_auth`
- `configured`
- `auth_ready`
- `verified`
- `failed`

验收：

- Desktop 启动不自动发真实模型请求。
- App Server `model/availability` 可返回 `not_configured` / `needs_auth` / `configured` / `auth_ready` 等本地状态。
- App Server `model/test` 在缺少密钥时返回 `auth_required`，且 `networkChecked=false`。
- “测试连接”在凭据可用时会真实请求，并返回 `verified` 或 `failed`。
- Desktop IPC 已暴露 `getModelAvailability` / `testModelConnection`，但 UI 按钮和状态展示还在 MP-07b / MP-08。
- 发送消息失败后回写 Profile 状态和错误提示仍待 Profile 数据模型落地后补齐。
- CLI/TUI status 展示仍待 MP-11。

已交付：

- Core 新增 `getCoreModelAvailability` 和 `testCoreModelConnection`。
- Runtime status 支持按指定 provider/model 查询显示状态和认证状态。
- App Server 新增 `model/availability`、`model/test`。
- SDK client 新增 `getModelAvailability`、`testModelConnection`。
- Desktop preload / main 已暴露同名 IPC 能力，供后续模型页复用。
- smoke 覆盖 DeepSeek 缺密钥时不发真实网络请求的 `auth_required` 分支。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `npm.cmd run smoke:app-server-client` 通过。
- `npm.cmd run smoke:deepseek-provider` 通过。
- `npm.cmd run smoke:llm-runtime-status` 通过。

## MP-08 Desktop 一级“模型”页面

状态：待开始。

目标：

- 左侧导航新增一级“模型”。
- 页面标题为“模型与供应商”。

计划交付：

- 当前应用模型摘要。
- Profile 列表。
- Profile 新增、编辑、复制、删除。
- Codex OAuth、OpenAI API、OpenAI Compatible 三类配置表单。
- 测试连接按钮。
- 设置为当前模型 / 默认模型。

验收：

- 模型配置不藏在通用设置深处。
- 无可用模型时聊天区能跳转到该页。
- 设置页只保留摘要入口。

## MP-09 顶部当前模型快速切换

状态：待开始。

目标：

- 顶部模型胶囊用于快速切换当前应用模型。

计划交付：

- 展示 `Profile 名称 / model` 或 `Provider · model`。
- 点击展开已配置 Profile / model。
- 支持跳转到完整“模型与供应商”页面。

当前第一版：

- 顶部模型胶囊展示当前全局配置模型。
- 点击后展开当前 provider 下的模型列表。
- 选择模型后通过 App Server `model/set` 写入 `.ccr/data/llm.config.local.json`。
- 切换只影响下一轮消息，不绑定和改写历史会话。
- 当前任务运行中禁止切换，避免一轮消息中途改变模型。

验收：

- 顶部不展示 API Key、baseUrl 等复杂配置。
- 切换后从下一轮消息开始生效。
- 切换失败不破坏原配置。

## MP-10 每轮 provider/model/protocol 元数据记录

状态：待开始。

目标：

- 每轮消息记录实际使用的 provider/profile/model/apiMode。

计划交付：

- Turn metadata 字段。
- App Server 事件或 history 恢复读取字段。
- Desktop 历史展示可选显示。

验收：

- 恢复历史会话不自动切换模型。
- 可查看某轮实际使用的模型。
- 后续成本统计和错误排查有数据基础。

## MP-11 CLI / TUI 配置与切换入口补齐

状态：待开始。

目标：

- CLI / TUI 不落后于 Desktop。

计划交付：

- CLI 查看当前模型。
- CLI 切换当前 Profile / model。
- TUI 模型入口读取统一 Profile。
- 保留现有 `/model` 可用性。

验收：

- Desktop、CLI、TUI 使用同一套 Core 配置能力。
- 不在不同入口各自复制 provider 逻辑。

## MP-12 smoke、真实 e2e 和文档收口

状态：待开始。

目标：

- 用自动化验证守住多供应商接入边界。

计划交付：

- Profile config smoke。
- provider definition smoke。
- OpenAI provider smoke。
- OpenAI Compatible smoke。
- Desktop 模型页面 smoke。
- 可选真实 e2e 文档。
- 文档索引和 runbook 更新。

验收：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- LLM runtime smoke 通过。
- provider smoke 通过。
- `codex-oauth` 现有链路不回归。
