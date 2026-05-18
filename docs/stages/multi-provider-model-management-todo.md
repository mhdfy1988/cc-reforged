# CCR 多供应商模型与协议接入 Todo

## 目标

把 CCR 的 LLM Runtime 从当前 `anthropic` / `codex-oauth` 可扩展原型，推进到可管理多个模型配置档案、多个供应商、多个协议和第三方中转的正式能力。

参考设计：[CCR 多供应商模型与协议接入设计](../architecture/multi-provider-model-management-design.md)。

多模态输入/输出、附件上传和图片预览不在本文推进，单独见 [CCR 多模态输入输出 Todo](./multimodal-input-output-todo.md)。本文只提供模型能力声明和 provider/profile 选择能力。

## 当前任务列表（实时）

- [x] MP-00 设计口径复核与现有代码盘点
- [x] MP-01 模型配置档案 Profile 数据模型
- [x] MP-01a Profile 读取模型、零默认 Profile 与 App Server 查询
- [x] MP-02 Provider / Protocol / Auth / Capability 类型扩展
- [x] MP-03 配置读写和敏感信息隔离
- [x] MP-03a 从零开始的 v2 Profile 配置读取
- [x] MP-03b schemaVersion/current/profiles 配置写入
- [x] MP-03c 取消全量默认 Profile 派生，写入直达正式 Profile
- [x] MP-03d 去掉 credentialRef，凭据按 profileId 存储
- [x] MP-04 协议适配层抽象
- [x] MP-04a OpenAI Chat Completions 公共协议适配器
- [x] MP-04b Anthropic Messages 兼容公共协议适配器
- [ ] MP-05 官方 OpenAI provider
- [ ] MP-06 OpenAI Compatible / 第三方中转 provider
- [x] MP-06a DeepSeek 官方 API provider 第一版
- [x] MP-06b MiniMax 国际版 / 国内版官方 API provider 第一版
- [x] MP-07 可用性状态与测试连接
- [x] MP-07a Core / App Server / SDK 可用性状态与手动测试连接第一版
- [x] MP-07b Desktop 模型页展示、测试按钮和失败状态第一版
- [x] MP-08 Desktop 一级“模型”页面完整 Profile 管理
- [x] MP-08a 一级模型页骨架、供应商/模型列表、DeepSeek 凭据入口
- [x] MP-08a.1 Desktop 模型页三栏信息架构占位
- [x] MP-08b Profile 新增、编辑、复制、删除
- [x] MP-09a 顶部 Profile 分组模型快速切换第一版
- [x] MP-09b 顶部 Profile / 供应商完整快速切换
- [x] MP-10 每轮 provider/model/protocol 元数据记录
- [x] MP-11 CLI / TUI 配置与切换入口补齐
- [x] MP-12 smoke、真实 e2e 和文档收口
- [ ] MP-13 智能强度 / 推理强度能力目录、Profile 覆盖与 Desktop 入口

## 当前指针

- 进行中：准备当前版本文档收口与提交。
- 当前正在做：把 README、CHANGELOG、供应商接入文档和本 todo 调整到 0.4.3 当前状态。
- 当前进展：Core、App Server、SDK、Desktop、CLI 和 TUI 的多 Profile / 多模型第一版已经打通。Desktop 左侧已新增“模型”一级页面，按“供应商类型 / 连接配置 / 配置详情”三栏管理 Profile。顶部快速切换已拆成“模型切换”和“连接配置切换”两个入口。`llm.config.local.json` 已支持 `schemaVersion + current + providerOverrides + profiles`，写回不再保留旧顶层字段。全新安装没有默认 Profile；登录、保存 API Key 或新增连接配置时才生成 `providerType-数字` Profile。敏感凭据统一写入 `llm.credentials.local.json` 的 `profileCredentials[profileId]`，不再使用 `credentialRef` 或单独 `codex-oauth.json`。Profile 新增、编辑、复制、删除已从 Core -> App Server -> Desktop IPC -> 模型页接通。每轮 turn metadata 已记录 `profileId/profileName/provider/providerDisplayName/apiMode/authStrategy/model/requestedModel/contextWindow`，App Server SDK smoke 已覆盖。CLI 已新增 `ccr model status/list/set/profile`，TUI `/model` 已支持 `profile <profileId> [modelId]`。DeepSeek 复用 OpenAI Chat 公共适配器；MiniMax 国际版 / 国内版已切到 Anthropic Messages 公共适配器，测试连接和普通聊天链路已接通。
- 下一步：提交当前版本；后续主线在官方 OpenAI provider、OpenAI Compatible / 第三方中转、多模态专项、模型页细节打磨之间选择。
- 后续新增：补 MP-13，把“智能：低 / 中 / 高 / 超高”作为模型能力接入，而不是全局固定开关。该项需要同时覆盖能力目录、Profile 覆盖、顶部入口、provider adapter 参数映射和 turn metadata 记录。

## 接下来安排

整体顺序：先做 Core 配置与协议模型，再做 provider 接入，最后做 Desktop / CLI / TUI 的配置和切换体验。

- 第一段：MP-00 到 MP-03，先把数据模型、配置读写和敏感信息隔离定稳。
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
- API Key、OAuth token、自定义 header 等敏感信息只落 `llm.credentials.local.json`，不进入仓库和普通导出。
- 供应商不是账号：一个供应商类型下面可以有多个账号 / API Key / endpoint / Profile，不能长期写死成“一个 provider 只有一个凭据”。
- 内置供应商目录不是连接配置：它只提供默认建议；真正保存和切换的对象必须是正式 Profile。
- 全新安装从零开始，不生成默认连接；Profile ID 创建后保持稳定，用户只改 `name`。
- 智能强度 / 推理强度不是所有模型通用能力；必须按 `profileId + model + apiMode` 解析，只有声明支持时才展示和发送，`max` / “超高”要单独声明支持。

## MP-00 设计口径复核与现有代码盘点

状态：第一版已完成。设计口径、现有代码盘点、Profile 配置、协议适配和 Desktop 模型页主链路已收口。

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

状态：第一版已完成。Profile 读取、零默认启动、App Server 查询接口、Desktop 三栏读取，以及 Profile 新增、编辑、复制、删除已落地。

目标：

- 引入“模型配置档案”作为前台和配置层的核心对象。
- 支持一个供应商多个账号、多个 API Key、多个 endpoint、多个模型和不同协议模式。

计划交付：

- Profile 类型定义。
- Profile id / name / providerType / apiMode / baseUrl / auth / accountId / defaultModel / models / capabilities / availability。
- Profile 作为真实数据主体，`providerType` 只作为供应商分类和 UI 分组字段。
- Profile 列表允许平铺存储，Desktop 按 `providerType` 分组展示。
- Profile 模型列表默认继承 providerType 的内置模型目录，同时允许连接配置覆盖或补充。
- 当前应用模型选择状态。
- 上一个选择和切换历史的最小结构。

验收：

- 能表达 Codex OAuth、官方 OpenAI、OpenAI Compatible / 第三方中转。
- 能表达“同一个供应商多个账号 / 多个 API Key”，例如 DeepSeek 工作 key 和个人 key、多个 Codex OAuth 账号。
- 能表达“OpenAI Compatible / 第三方中转下面多个 endpoint / 团队额度 / 自定义模型”，并且不误归类到真实模型供应商。
- Profile 与敏感凭据分离。
- 会话不保存“当前模型绑定”，只保存每轮实际使用记录。

MP-01a 已交付：

- `llm.config.local.json` 支持 `schemaVersion + current + profiles + providerOverrides`。
- 全新安装没有 Profile，Core 不再为任何内置供应商派生默认 Profile。
- `loadLlmConfig()` 返回 `currentProfileId` 和 resolved `profiles`；没有当前 Profile 时 provider/model 为空。
- App Server 新增 `model/profile/list` 和 `model/profile/set-current`。
- `model/list` 返回 `current.profileId`、Profile 列表，以及 provider 到 profile id 的分组关系。
- Desktop 模型页中间栏只展示正式 Profile；没有 Profile 时显示空态和创建入口。

## MP-02 Provider / Protocol / Auth / Capability 类型扩展

状态：第一版已完成。

目标：

- 把 provider、protocol、auth、capability 从当前最小定义扩成多协议可用结构。

计划交付：

- `apiMode` 至少支持：
  - `anthropic-messages`
  - `openai-responses`
  - `openai-chat`
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

## MP-03 配置读写和敏感信息隔离

状态：第一版已完成。正式 Profile 写入、零默认启动、`profileCredentials[profileId]` 凭据读取和保存已落地。

目标：

- 扩展现有 LLM 配置读写，支持多个 Profile。
- 敏感信息和普通配置分离。
- `codex-oauth` 只保留内置 provider 定义，不再生成默认连接配置。

计划交付：

- Profile 配置文件结构。
- 当前应用选择保存。
- API Key / OAuth token / custom header 的本地敏感信息保存策略。
- 多账号 / 多 API Key 的 credential store 结构，支持按 `profileId` 查找具体凭据。
- 全新安装不生成默认 Profile；一旦用户保存凭据、登录或新增连接配置，就写入正式 Profile。

验收：

- 无 Profile 时 provider/model 为空，并能引导用户创建或登录。
- 新配置支持多个 Profile。
- 新配置支持同一 providerType 下多个 Profile / 多个凭据。
- 普通导出默认不包含密钥。
- `npm.cmd run smoke:llm-config` 通过。

MP-03a 已交付：

- 全新安装无 `llm.config.local.json` 时，`loadLlmConfig()` 返回空 current 和空 profiles。
- 不再读取旧顶层 `provider/model/currentProfileId` 作为正式配置。
- 不再生成 `codex-oauth-default`、`deepseek-default`。
- `smoke:llm-config` 覆盖零默认、显式 Profile、Profile 凭据和无旧字段写回。

MP-03b 已交付：

- 将 `llm.config.local.json` 的长期主结构调整为 `schemaVersion + current + profiles + providerOverrides`。
- `current` 只保存 `profileId` 和 `model`，不再写旧顶层 `provider/model/currentProfileId`。
- Profile 内部保存 `providerType`、`apiMode`、`endpoint`、`auth.strategy/accountId`、`models` 和 `availability`。
- `models` 从字符串数组升级为对象结构，支持 `builtin` / `custom` / `remote` / `mixed` 来源。
- CLI / TUI / App Server 全部切到 `current.profileId + current.model`。

MP-03c 已交付：

- 取消“所有内置 provider 自动派生默认 Profile”的行为，避免 UI 中出现用户没有创建过的伪连接配置。
- `loadLlmConfig()` 只解析文件内正式 `profiles`。
- `setCoreModel()` 只允许在已有 Profile 内切换模型；没有 Profile 时要求先创建或登录。
- Codex OAuth 登录完成后会确保当前登录配置写入正式 Profile。
- DeepSeek / API Key 保存时，如果没有对应 Profile，会先创建 `deepseek-数字` 正式 Profile，再按同一 `profileId` 保存密钥。
- 删除 Profile 时只在正式 Profile 集合中选择新的当前项；如果没有剩余正式 Profile，则清空当前选择并等待用户重新配置。
- `smoke:llm-config`、`smoke:cli-model`、`smoke:app-server-client` 已覆盖零默认和写入正式 Profile。

MP-03d 已交付：

- 去掉 Profile 内的 `credentialRef` 字段。
- `llm.credentials.local.json` 使用 `profileCredentials[profileId]` 保存敏感凭据。
- API Key 和 OAuth token 使用同一套 Profile 凭据槽。
- `codex-oauth.json` 不再作为 Codex OAuth 的专用凭据文件。
- 一个 Profile 对应一个凭据槽，哪怕两个 Profile 使用相同 API Key 字符串也分别保存。

## MP-04 协议适配层抽象

状态：第一版已完成。`openai-chat` 和 `anthropic-messages` 已抽出公共适配器。

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

## MP-06b MiniMax 国际版 / 国内版官方 API provider 第一版

状态：已完成第一版。

目标：

- 按官方文档接入 MiniMax API。
- 将 MiniMax 国际版和 MiniMax 国内版拆成两个供应商类型，避免靠 base URL 猜地区。
- 复用公共 Anthropic Messages 协议适配器，避免把 MiniMax 特例塞进 OpenAI Chat 公共链路。

已交付：

- `minimax` provider definition：MiniMax 国际版，默认 `https://api.minimax.io/anthropic`。
- `minimax-cn` provider definition：MiniMax 国内版，默认 `https://api.minimaxi.com/anthropic`。
- 默认模型：`MiniMax-M2.7`。
- 模型目录：`MiniMax-M2.7`、`MiniMax-M2.7-highspeed`。
- API Key 来源：
  - 国际版：`CCR_MINIMAX_API_KEY`，兼容 `MINIMAX_API_KEY`。
  - 国内版：`CCR_MINIMAX_CN_API_KEY` / `MINIMAX_CN_API_KEY`，兼容 `CCR_MINIMAXI_API_KEY` / `MINIMAXI_API_KEY`。
- baseUrl 覆盖：
  - 国际版：`CCR_MINIMAX_BASE_URL`，兼容 `MINIMAX_BASE_URL`。
  - 国内版：`CCR_MINIMAX_CN_BASE_URL` / `MINIMAX_CN_BASE_URL`，兼容 `CCR_MINIMAXI_BASE_URL` / `MINIMAXI_BASE_URL`。
- Profile 凭据仍按 `profileCredentials[profileId]` 读取，不引入供应商级单凭据。
- `MiniMaxProvider` 已接入 `AnthropicMessagesAdapter`，支持文本、thinking、工具调用和 usage 归一化。
- `model/test` 已通过统一 LLM Runtime 真实请求 Anthropic Messages 链路，不再返回“未接线”的假失败。
- 文档：`docs/architecture/provider-integrations/minimax.md`。

验收：

- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:minimax-provider` 通过。

后续：

- 继续观察 MiniMax 真实工具调用边界，并补充 thinking / redacted thinking 的边界测试。
- MiniMax 新模型、thinking、多模态和真实上下文窗口以官方文档为准。

## MP-07 可用性状态与测试连接

状态：第一版已完成。Core / App Server / SDK / Desktop 手动检测链路已落地，并按 Profile 写回可用性状态。

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
- Desktop IPC 已暴露 `getModelAvailability` / `testModelConnection`，Desktop 一级模型页已接入状态展示和“测试连接”按钮。
- 发送消息失败后可回写 Profile 状态和错误提示。
- CLI/TUI status 已在 MP-11 补齐。

已交付：

- Core 新增 `getCoreModelAvailability` 和 `testCoreModelConnection`。
- Runtime status 支持按指定 provider/model 查询显示状态和认证状态。
- App Server 新增 `model/availability`、`model/test`。
- SDK client 新增 `getModelAvailability`、`testModelConnection`。
- Desktop preload / main 已暴露同名 IPC 能力，供后续模型页复用。
- smoke 覆盖 DeepSeek 缺密钥时不发真实网络请求的 `auth_required` 分支。
- Core / App Server / SDK 新增 `model/credential/update`，用于本地保存或清空 API Key。
- smoke 覆盖 `model/credential/update` 保存/清空 DeepSeek API Key 后的本地状态变化，并断言返回结果不泄露 `apiKey`。
- Desktop 顶部快速切换和模型页测试连接都传递 `profileId`，保证状态读取和模型切换能落到同一个连接配置。

验证：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `npm.cmd run smoke:app-server-client` 通过。
- `npm.cmd run smoke:deepseek-provider` 通过。
- `npm.cmd run smoke:minimax-provider` 通过。
- `npm.cmd run smoke:llm-runtime-status` 通过。

## MP-08 Desktop 一级“模型”页面

状态：第一版已完成。一级模型页、三栏结构、Profile 新增 / 编辑 / 复制 / 删除、凭据管理和测试连接已落地。

目标：

- 左侧导航新增一级“模型”。
- 页面标题为“模型与供应商”。

计划交付：

- 当前应用模型摘要。
- 供应商列表和模型列表。
- API Key 本地保存、覆盖和清空。
- 测试连接按钮。
- 设置为当前模型。
- Profile 新增、编辑、复制、删除。
- Codex OAuth、DeepSeek、MiniMax 等已接入 provider 的配置表单。
- 设置默认 Profile / 默认模型。

验收：

- 模型配置不藏在通用设置深处。
- 无可用模型时聊天区能跳转到该页。
- 设置页只保留摘要入口。

MP-08a 已交付：

- 左侧导航新增一级“模型”。
- 新增 Desktop `ModelsPage`，展示当前模型、供应商、协议、认证方式、可用性和能力声明。
- 供应商列表来自 App Server `model/list`，不在 Desktop 复制 provider 逻辑。
- 可用性来自 App Server `model/availability`，页面进入或切换供应商/模型时只做本地状态读取。
- “测试连接”调用 App Server `model/test`，只有用户手动触发才发真实模型请求。
- DeepSeek API Key 保存/清空通过 App Server `model/credential/update` 进入 Core，写入本机 `.ccr/data/llm.credentials.local.json`，不写入仓库。
- 保存/清空凭据后重置默认 LLM Runtime，避免旧 provider 实例继续持有旧 key。
- Desktop 模型页已从“供应商 + 详情”两层改为“供应商类型 / 连接配置 / 配置详情”三栏。
- 中间“连接配置”只展示正式 Profile；没有 Profile 时显示空态和新增入口。
- Desktop 展示、Core、CLI、TUI 共用同一套 `current.profileId + current.model` 配置读写链路。

MP-08b 已交付第一版：

- Core 新增 Profile 保存、复制、删除入口，写入 `schemaVersion + current + profiles + providerOverrides` 新结构。
- App Server / SDK / Desktop IPC 新增 `model/profile/save`、`model/profile/copy`、`model/profile/delete`。
- Desktop 模型页新增连接配置入口，支持填写名称、Base URL、默认模型和模型列表。
- 文件来源 Profile 支持编辑、复制和删除。
- Profile 删除只作用于正式 Profile，不会删除内置供应商目录。
- `smoke:app-server-client` 覆盖 Profile 新建、复制、删除，并继续断言返回结果不泄露密钥。

MP-08b 后续增强：

- 官方 OpenAI、OpenAI Compatible / 第三方中转的差异化表单。
- 设置页保留摘要入口，跳转到一级“模型”页面。

## MP-09 顶部当前模型快速切换

状态：第一版已完成。顶部下拉已按 Profile 分组展示，选择模型时传入 `profileId + model`，完整多 Profile 管理和最近使用分组留到 MP-09b。

目标：

- 顶部模型胶囊用于快速切换当前应用模型。

计划交付：

- 展示 `Profile 名称 / model` 或 `Provider · model`。
- 点击展开已配置 Profile / model。
- 支持跳转到完整“模型与供应商”页面。
- 多连接配置落地后，顶部下拉不再按裸供应商分组，而是按 Profile 分组。
- 多连接快速切换结构建议为：最近使用 -> 当前连接配置的模型 -> 其他连接配置。
- 选择某个 Profile 下的模型时，一次性写入 `current.profileId + current.model`，不单独切 provider。
- 下拉内只展示连接名、认证状态、模型名和上下文窗口；新增、编辑、endpoint 和凭据管理回到一级“模型”页面。
- UI 保持极简：顶部快速切换只解决 `profileId` 和 `model` 两件事，不展示 baseUrl、协议细节、完整能力矩阵或凭据路径。
- 模型页默认视图只展示必要摘要；复杂字段进入连接详情、折叠区或编辑表单，不在主视图堆卡片。

当前第一版：

- 顶部模型胶囊展示当前全局配置模型。
- 点击后展开 Profile 分组下的模型列表。
- 当前 Profile 排在顶部，当前 provider 相关 Profile 优先于其他 Profile。
- 选择模型后通过 App Server `model/set` 写入 `.ccr/data/llm.config.local.json`，并传递 `profileId + provider + model`。
- 切换只影响下一轮消息，不绑定和改写历史会话。
- 当前任务运行中禁止切换，避免一轮消息中途改变模型。
- 菜单保持简洁，只展示连接名、模型名和上下文窗口；不展示 baseUrl、凭据路径等配置细节。

MP-09b 已交付：

- 顶部快速切换拆成两个入口：模型胶囊负责切当前 Profile 下的模型；连接配置胶囊负责切 Profile / 供应商连接。
- 连接配置下拉按 Profile 展示，选择后一次性写入 `profileId + model`，默认使用该 Profile 的默认模型。
- 模型下拉不再塞所有供应商和所有 Profile，只展示当前连接配置下的模型，降低误切换成本。
- 当前任务运行中两个入口都会禁用切换，保持一轮消息内模型不变。
- 下拉仍保持轻量，只展示连接名、供应商摘要、模型名和上下文窗口；endpoint、凭据和编辑入口留在一级“模型”页面。

验收：

- 顶部不展示 API Key、baseUrl 等复杂配置。
- 切换后从下一轮消息开始生效。
- 切换失败不破坏原配置。
- 同一供应商存在多个连接配置时，顶部下拉能明确区分账号 / endpoint / Profile 名称。
- 恢复历史会话不自动切换 Profile，只保留当前应用选择。

## MP-10 每轮 provider/model/protocol 元数据记录

状态：已完成。

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

已交付：

- `CoreTurnMetadata` 新增 `profileId`、`profileName`、`providerDisplayName`、`apiMode`、`authStrategy` 和 `requestedModel`。
- `CoreSessionService.startTurn()` 在创建 turn 时把当前全局 Profile / provider / model / protocol 写成一轮请求的启动快照。
- `context/status` 优先返回 turn 的 `requestedModel`，避免模型响应别名覆盖上下文窗口和压缩阈值判断。
- Desktop 顶部上下文 tooltip 可查看连接配置、供应商、协议、认证方式和请求模型。
- 顶部切换 Profile 后刷新可用性时补传 `profileId`，避免误回默认 Profile 做状态检测。
- `smoke:app-server-client` 覆盖 turn 启动元数据，确认 App Server SDK 可读到实际 profile/provider/model/protocol。

验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run smoke:llm-config`
- `npm.cmd run smoke:app-server-client`
- `npm.cmd run desktop:build`

过程记录：

- 依赖 `dist` 的 smoke 不能和 `npm.cmd run build` 并行跑；必须先 build，再跑 app-server client smoke，否则会读到旧构建产物并误判字段缺失。

## MP-11 CLI / TUI 配置与切换入口补齐

状态：已完成第一版。

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

已交付：

- 新增 CLI `ccr model status`，查看当前 `profileId/provider/model/apiMode/authStrategy`。
- 新增 CLI `ccr model list`，按供应商列出 Profile 和模型。
- 新增 CLI `ccr model set <model>`，切换当前 Profile 下的模型；支持 `--provider` 和 `--profile`。
- 新增 CLI `ccr model profile <profileId> [model]`，切换当前 Profile，并可指定本轮之后使用的模型。
- TUI `/model info` 在非 Anthropic provider 下展示当前 Profile、协议和模型。
- TUI `/model profile <profileId> [modelId]` 复用 `setCoreModelProfile()`，不在 TUI 内复制 provider 逻辑。
- `setCoreModel()` 写入配置后会重置默认 LLM Runtime，避免 CLI / TUI 切换后继续使用旧 runtime 缓存。
- 新增 `smoke:cli-model`，使用临时 `CCR_LLM_CONFIG_PATH` 验证 CLI `status/list/set/profile` 和配置落盘。

验证：

- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build -- --pretty false`
- `npm.cmd run smoke:cli-model`
- `npm.cmd run smoke:app-server-client`

## MP-12 smoke、真实 e2e 和文档收口

状态：已完成当前第一版收口。

目标：

- 用自动化验证守住多供应商接入边界。

计划交付：

- Profile config smoke。
- provider definition smoke。
- DeepSeek provider smoke。
- MiniMax provider smoke。
- Desktop 模型页面构建验证。
- CLI model smoke。
- App Server SDK smoke。
- 文档索引和 README 更新。

已交付：

- 根 README 和中文 README 已更新多供应商第一版能力说明，补充 `ccr model status/list/set/profile`。
- 设计文档补齐当前第一版落地状态，并把 `apiMode` 口径统一到代码实际枚举：`anthropic-messages`、`openai-responses`、`openai-chat`、`custom`。
- 供应商接入文档已覆盖 Codex OAuth、DeepSeek 和 MiniMax。
- 设计文档明确顶部快速切换拆成“模型”和“连接配置”两个入口，恢复历史会话不自动改当前 Profile。
- MP-10 / MP-11 / MP-12 的验证命令已回写到 todo，后续可以按同一套 smoke 复查。

验收：

- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:llm-config` 通过。
- `npm.cmd run smoke:openai-chat-protocol` 通过。
- `npm.cmd run smoke:deepseek-provider` 通过。
- `npm.cmd run smoke:minimax-provider` 通过。
- `npm.cmd run smoke:cli-model` 通过。
- `npm.cmd run smoke:app-server-client` 通过。
- `npm.cmd run desktop:build` 通过。
- `codex-oauth` 现有链路不回归。

## MP-13 智能强度 / 推理强度能力目录、Profile 覆盖与 Desktop 入口

状态：待开始。

目标：

- 把“智能：低 / 中 / 高 / 超高”从静态 UI 选项升级为模型能力驱动的运行时能力。
- 当前模型支持时才允许选择和发送；当前模型不支持时不展示或置灰，并且请求体不带推理强度字段。
- OpenAI Compatible / 第三方中转可以通过 Profile 覆盖声明支持、禁用或限制具体强度。

计划交付：

- 能力目录扩展 `reasoning` 能力，记录 `supported`、`efforts`、`defaultEffort` 和来源。
- Profile `capabilityOverrides` 支持覆盖推理强度能力。
- Desktop 顶部模型区增加轻量“智能”入口，选项为 `低 / 中 / 高 / 超高`。
- 当前任务运行中禁止切换智能强度，避免同一轮请求状态不一致。
- 发送前解析最终 `reasoningEffort`，并写入 turn metadata。
- Provider adapter 映射统一：
  - Anthropic / Claude：`output_config.effort`。
  - Codex OAuth：pi-ai provider `reasoningEffort`。
  - OpenAI Chat / DeepSeek 类：按 provider 能力映射 `thinking` / `reasoning_effort`。
  - 未声明支持：不发送对应字段。
- 更新 `CHANGELOG.md` 当前未发布说明时必须按类别整理，一级分类统一为：新功能、改动、BUG 修复。能力目录、Profile 覆盖、Desktop 入口、Provider 参数映射、metadata / 历史展示、验证与兼容性等内容按实际影响归入这三类。

验收：

- 支持推理强度的模型能在 Desktop 看到入口，并按选择值发出正确 provider 参数。
- 不支持推理强度的模型不会显示可用入口，也不会把 `reasoningEffort` 偷偷发出去。
- `max` / “超高”只有模型或 Profile 明确声明支持时才可选。
- Profile 覆盖可以禁用某个中转的推理强度能力。
- 历史恢复只展示当轮实际使用的 `reasoningEffort`，不自动切换当前应用强度。
- smoke 覆盖支持、不支持、Profile 覆盖、`max` 限制和 metadata 记录。
- `CHANGELOG.md` 不使用单段流水账，必须按“新功能 / 改动 / BUG 修复”三类写清楚本轮变化。

## 后续记录（追加）

### 2026-05-12 MP-12 收口

- 完成 README / README.zh-CN 更新，说明 Profile 优先配置、CLI `ccr model` 入口、Desktop 一级“模型”页面和顶部模型 / 连接配置双入口。
- 完成设计文档收口，把 `apiMode` 统一到当前代码实际枚举：`anthropic-messages`、`openai-responses`、`openai-chat`、`custom`。
- 已验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run typecheck:desktop`、`npm.cmd run build -- --pretty false`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:openai-chat-protocol`、`npm.cmd run smoke:deepseek-provider`、`npm.cmd run smoke:cli-model`、`npm.cmd run smoke:app-server-client`、`npm.cmd run desktop:build`。
- 当前一口气完成范围已收口，后续主线应在官方 OpenAI provider、OpenAI Compatible / 第三方中转、多模态输入输出、Desktop 模型页细节打磨之间重新选择。

### 2026-05-13 MiniMax 与发布文档收口

- MiniMax 国际版 / 国内版切到 Anthropic Messages 兼容协议，OpenAI Chat 分支不再作为 Desktop 可选入口。
- `smoke:minimax-provider` 覆盖 provider、adapter 和 `model/test` 链路；DeepSeek / OpenAI Chat smoke 保留为公共接口回归。
- README、CHANGELOG、供应商接入文档和本 todo 已同步到 `0.4.3` 当前状态，准备提交版本。

## 备注

- 当前状态：ready-for-release
- 暂停原因：本轮多供应商第一版、MiniMax Anthropic Messages 接入和文档收口已经完成，等待提交与发布决策。
- 下一步需要：在“官方 OpenAI provider / OpenAI Compatible 第三方中转 / 多模态输入输出 / Desktop 模型页细节打磨”里选下一条主线。
