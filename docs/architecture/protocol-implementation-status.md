# CCR 协议统一化接入状态总账

更新时间：2026-05-28

## 1. 文档目标

这份文档用于回答三个问题：

1. CCR 现在已经统一了哪些协议面。
2. 每个协议面对接到什么程度，是只有文档、已有类型，还是已经有 adapter、smoke 和 provider 实例。
3. 已经接入哪些 provider / model，后续接新模型时应该补哪一层。

它不是阶段 todo，也不是单个 provider 说明。它是后续逐项推进多模型、多 provider、多模态输入输出时的状态总账。

相关基础文档：

- [CCR 标准 LLM 协议 v0.1](./ccr-standard-llm-protocol.md)
- [CCR LLM Provider 与多模态协议长期路线图](./llm-provider-protocol-long-term-roadmap.md)
- [CCR Provider 协议盘点与官方文档对照](./provider-protocol-inventory-and-official-docs.md)
- [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)
- [CCR Provider 真实 Probe 设计与入口](./provider-real-probe-design.md)
- [CCR 多模态输入输出设计](./multimodal-input-output-design.md)
- [CCR 模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)
- [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md)
- [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](./thread-display-ordered-reducer-future-design.md)
- [供应商接入文档](./provider-integrations/README.md)

## 2. 状态定义

| 状态 | 含义 | 能否让后续 provider 直接复用 |
| --- | --- | --- |
| 已落地 | 有共享类型 / adapter / runtime 入口，并且有 smoke 或 fixture 覆盖 | 可以复用；新 provider 主要补 adapter、profile、fixture |
| 部分落地 | 有共享类型或 adapter，但 provider 覆盖、历史规则、smoke 或 UI 闭环不完整 | 可以作为基础，但不能直接宣称接入完成 |
| 文档就绪 | 已有标准和映射口径，但代码还没有主链路实现 | 先按文档补类型 / adapter / smoke |
| 未开始 | 只有需求方向，没有稳定协议和实现 | 需要先开 goal，明确第一版边界 |

## 3. 协议面总览

### 3.0 会话与展示协议阅读顺序

排查历史恢复、当前上下文、工具卡、附件、错误卡或 Desktop 可见历史时，先按这个顺序读：

1. [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md)：确认 `currentContextMessages`、`ThreadDisplaySnapshot.items`、`ThreadDisplayPatch.operations` 和 `messages` 兼容字段的边界。
2. [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md)：确认历史 / 实时输入如何进入同一个 reducer，以及工具、文件、附件、错误 projector 的职责。
3. [CCR 全事件统一 Ordered Display Reducer 设计方向](./thread-display-ordered-reducer-future-design.md)：确认后续 `orderKey` / `sourceIdentity` / ordered state machine 的演进方向。
4. 本文的协议面总览：只用于判断某个协议面当前是已落地、部分落地、文档就绪还是未开始。

不要从 `DisplayEvent`、`thread/messages/list.result.messages` 或 provider raw output 反推出 UI 历史状态；这些都不是当前展示事实源。

| 协议面 | 当前状态 | 标准文档 | 代码落点 | 已覆盖 provider / model | 下一步缺口 |
| --- | --- | --- | --- | --- | --- |
| Provider / Profile / Credential | 已落地 | [多供应商模型与协议接入设计](./multi-provider-model-management-design.md) | `src/services/llm/llmConfig.ts`、`providerCredentials.ts`、`providerDefinitions.ts` | `openai`、`codex-oauth`、`deepseek`、`kimi-api`、`kimi-code`、`glm-api`、`glm-coding`、`minimax`、`minimax-cn`、`anthropic` 定义已存在 | Gateway / OpenRouter / Vercel AI Gateway 需要 profile 与 probe 记录 |
| LLM Runtime provider 接口 | 已落地 | [标准 LLM 协议](./ccr-standard-llm-protocol.md) | `src/services/llm/types.ts`、`llmRuntime.ts`、`defaultRuntime.ts` | `generate` / `stream` / `generateImage` 已作为统一入口 | 音频生成、文件生成还没有 runtime 方法 |
| 标准消息协议 | 已落地 | [标准 LLM 协议](./ccr-standard-llm-protocol.md) | `LlmMessage`、`LlmContentPart` in `src/services/llm/types.ts` | OpenAI Chat、DeepSeek、MiniMax Anthropic-compatible、Codex OAuth 已有映射；Anthropic adapter 可复用 | Gemini `contents.parts` 还没有完整 adapter |
| 标准内容块 | 已落地 | [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md) | `src/types/contentBlocks.ts` | `text`、`thinking`、`image`、`file`、`audio`、`video`、`tool_call`、`tool_result`、`json`、`structured`、`error` | `structured` 只是内容块入口，产品化视图还未收口 |
| 模型能力声明 | 已落地 | [多模态输入输出设计](./multimodal-input-output-design.md) | `LlmModelCapabilities`、`modelCapabilities.ts`、`modelCatalog.ts` | OpenAI、Codex OAuth、DeepSeek、Kimi API、Kimi Code、GLM API、GLM Coding、MiniMax 国际版 / 国内版已有内置模型目录 | OpenAI-compatible / Gateway 不能只靠模型名，需要 profile override 和 probe |
| 文本生成 | 已落地 | [标准 LLM 协议](./ccr-standard-llm-protocol.md) | `LlmProvider.generate(...)` | OpenAI、DeepSeek、Kimi API、Kimi Code、GLM API、GLM Coding、MiniMax、Codex OAuth 已接；Anthropic provider 壳存在 | Anthropic 官方 provider 因暂缺真实 key 后置，先不作为实测主线 |
| 流式输出 | 已落地 | [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md) | `LlmGenerateEvent`、provider `stream(...)` | OpenAI Chat、DeepSeek、MiniMax、Codex OAuth 已有流式入口 | Gemini streaming、Responses typed event 通用化还未完成 |
| 工具定义 / 调用 / 结果 | 已落地 | [Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md) | `LlmToolDefinition`、`LlmProviderToolProfile`、OpenAI / Anthropic adapters | OpenAI Chat、DeepSeek、MiniMax Anthropic-compatible、OpenAI-compatible profile 已覆盖第一版 | Gemini `functionCall/functionResponse` 需要 adapter 与 history rule |
| 发送前历史校验 | 部分落地 | [STD-HISTORY-01 goal](../goals/2026-05-18-std-history-01-history-validator.md) | `src/services/llm/historyValidator.ts` | OpenAI-compatible / DeepSeek 的悬空 tool call、孤立 tool result 已处理 | Anthropic、Gemini、Responses 的历史规则需要补齐 |
| 多模态输入 | 已落地第一版 | [多模态输入输出设计](./multimodal-input-output-design.md) | `src/app-server/turnInput.ts`、Desktop 附件链路、OpenAI / Anthropic adapter 图片映射、OpenAI Chat compatible `video_url` 映射 | OpenAI `gpt-5.4` 支持图片输入；Codex OAuth `gpt-5.5` 支持图片输入；`kimi-api/kimi-k2.6` 支持图片+视频输入；`glm-api/glm-5v-turbo` 支持图片+视频输入；MiniMax / DeepSeek 当前文本模型目录为文本输入 | GLM 官方文件输入尚未完整映射；音频输入仍主要是协议/展示入口 |
| Provider 输出 fixture | 已落地 | [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md) | `src/services/llm/fixtures/provider-output-fixtures.json`、`scripts/smoke-provider-output-fixtures.mjs` | OpenAI Responses、OpenAI image generation、MiniMax image generation、Anthropic tool、Gemini function、DeepSeek thinking tool、Kimi API text、Kimi Code tool、GLM API text、GLM Coding tool、OpenAI-compatible history / error | 新增 provider 时必须补 fixture；Gemini 目前是 fixture 级，不是完整 runtime provider |
| 错误快照 | 已落地 | [P24 ErrorSnapshot goal](../goals/2026-05-18-p24-errorsnapshot.md) | `src/types/errorSnapshot.ts`、Desktop ErrorCard | auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown 已覆盖 | provider-specific request id / billing details 可继续丰富 |
| 模型生成图片请求 | 已落地 | [OpenAI provider 文档](./provider-integrations/openai.md)、[Codex OAuth provider 文档](./provider-integrations/codex-oauth.md)、[MiniMax provider 文档](./provider-integrations/minimax.md) | `LlmImageGenerationRequest`、`LlmRuntime.generateImage(...)`、`OpenAiResponsesHostedImageGenerationAdapter` | OpenAI Images API、OpenAI Responses image_generation、Codex OAuth hosted `image_generation`、MiniMax native image_generation；OpenAI-compatible 可按 profile 复用 hosted adapter | 图生图、图片编辑还未设计 |
| 生成图片输出归一化 | 已落地 | [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md) | `generatedImageOutputAdapter.ts` | OpenAI / MiniMax 共用 `normalizeGeneratedImageOutputs(...)` | 音频 / 文件 / 视频生成物还没有同等级 adapter |
| 生成物落盘与恢复 | 已落地 | [STD-OUTPUT-04 goal](../goals/2026-05-18-std-output-04-generated-artifact-persistence.md) | `src/utils/generatedArtifacts.ts` | 图片落盘、`savedPath`、resume 清 payload 已覆盖 | 生成物安全扫描、生命周期清理、媒体库还未做 |
| 普通会话流生成图片 | 已落地 | [STD-OUTPUT-09 goal](../goals/2026-05-18-std-output-09-session-generated-image-flow.md) | `src/core/coreImageGenerationTurnRunner.ts`、`turn/start options.imageGeneration` | OpenAI / Codex OAuth / MiniMax 都可通过统一 runtime 进入会话流；smoke 使用 mock/fixture 验证 | 真实联网 E2E 仍需单独 probe，不进默认 smoke |
| 当前模型上下文物化 | 已落地 | [会话上下文与展示链路权威契约](./session-context-and-display-contract.md) | `src/utils/conversationMaterialization.ts` | `currentContextMessages` 已由 ordered transcript events 生成；孤立 `tool_result` 诊断丢弃；`buildConversationChain(...)` 退出当前上下文主链路 | fork / branch 语义、legacy/native helper 是否最终移除仍可后续单独治理 |
| ThreadDisplay 展示 reducer | 已落地 | [ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md)、[Ordered Display Reducer 设计方向](./thread-display-ordered-reducer-future-design.md) | `src/app-server/threadDisplay.ts`、`threadDisplayInputEvent.ts`、`src/display/threadDisplay*Projector.ts` | 历史和实时统一进入 `ThreadDisplayReducerInputEvent`；工具、文件、附件、错误 projector 已拆分；旧 reducer 入口已移除 | 后续按 `orderKey` / `sourceIdentity` 补强输入事实，并演进到唯一 ordered display state |
| Desktop 展示 snapshot / patch 协议 | 已落地 | [会话上下文与展示链路权威契约](./session-context-and-display-contract.md) | `ThreadDisplaySnapshot.items`、`ThreadDisplayPatch.operations`、Desktop `threadDisplaySnapshot` | `thread/resume` 和 `thread/messages/list` 使用 `displaySnapshot`；`messages` 仅作为兼容 / current-context 载荷；协议错误进入错误卡 | 新建 `thread/display/snapshot` 纯展示接口可作为命名清理项 |
| DisplayEvent / Snapshot 展示协议 | 已落地 | [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md) | `apps/desktop/src/renderer/src/domain/displayEvents.ts`、`fileEvents.ts` | 文本、工具、附件、错误、生成图片已进入标准展示事件；当前事实源来自 App Server ThreadDisplay snapshot / patch | 结构化输出视图、音频/视频生成视图待补；Renderer 通用卡片骨架仍是视觉层重构 |
| Structured Output | 文档就绪 / 部分入口 | [Provider 协议盘点](./provider-protocol-inventory-and-official-docs.md) | `CcrContentBlock type: structured` | 内容块类型存在，provider 兼容策略未系统完成 | 需要新 goal：schema profile、JSON mode、UI 视图、smoke |
| 音频 / 文件 / 视频生成 | 未开始 | [STD-OUTPUT-03 goal](../goals/2026-05-18-std-output-03-generated-multimodal-output.md) | `CcrContentBlock` 已预留类型 | 暂无真实 provider 生成 API 接入 | 需要先开第二阶段 goal，确定 provider 和生命周期策略 |

## 4. Provider / Model 接入状态

| Provider ID | 协议族 | 当前实现程度 | 已登记模型 | 文本 | 流式 | 工具 | 多模态输入 | 图片生成 | 文档 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `openai` | OpenAI Chat + Images + Responses hosted image_generation | 已落地第一版 | `gpt-5.4`、`gpt-image-1` | 已接 | 已接 | 已接 OpenAI-style | `gpt-5.4` 目录声明文本+图片输入 | 已接 `gpt-image-1` / Responses image_generation；hosted tool 已抽成公共适配器 | [openai.md](./provider-integrations/openai.md) |
| `codex-oauth` | Codex / ChatGPT backend via `pi-ai` + hosted `image_generation` | 已接 provider；图片生成 mock 已过，真实 probe 待验 | `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini` | 已接 | 已接 | 随 `pi-ai` provider 映射，仍需更细 fixture | `gpt-5.5` 目录声明文本+图片输入 | 已接 Codex hosted `image_generation`，走 `/codex/responses` | [codex-oauth.md](./provider-integrations/codex-oauth.md) |
| `deepseek` | OpenAI Chat compatible | 已落地第一版 | `deepseek-v4-flash`、`deepseek-v4-pro` | 已接 | 已接 | 已接 OpenAI-style，含 history repair | 当前目录为文本输入 | 未接 | [deepseek.md](./provider-integrations/deepseek.md) |
| `kimi-api` | OpenAI Chat compatible | 已落地第一版 | `kimi-k2.6` | 已接 | 已接 | 已接 OpenAI-style，含 history repair | `kimi-k2.6` 目录声明文本+图片+视频输入，adapter 已支持 `image_url` / `video_url` | 未接 | [kimi.md](./provider-integrations/kimi.md) |
| `kimi-code` | Anthropic Messages compatible | 已落地第一版 | 统一模型标识 `kimi-for-coding` | 已接 | 已接 | 已接 Anthropic-style，含 history repair | 第一版目录为文本输入 | 未接 | [kimi.md](./provider-integrations/kimi.md) |
| `glm-api` | OpenAI Chat compatible + Images generation | 已落地第一版 | `glm-5.1`、`glm-5v-turbo`、`glm-image` | 已接 | 已接 | 已接 OpenAI-style，含 history repair | `glm-5.1` 文本输入；`glm-5v-turbo` 目录声明文本+图片+视频输入，官方文件输入先标 pending | 已接 `glm-image` 文本生图 | [glm.md](./provider-integrations/glm.md) |
| `glm-coding` | OpenAI Chat compatible | 已落地第一版 | `glm-5.1` | 已接 | 已接 | 已接 OpenAI-style，含 history repair | 第一版目录为文本输入 | 未接 | [glm.md](./provider-integrations/glm.md) |
| `minimax` | Anthropic Messages compatible + MiniMax image_generation | 已落地第一版 | `MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`image-01`、`image-01-live` | 已接 | 已接 | 已接 Anthropic-style | 文本模型目录为文本输入 | 已接 `image-01` / `image-01-live` 文本生图 | [minimax.md](./provider-integrations/minimax.md) |
| `minimax-cn` | Anthropic Messages compatible + MiniMax image_generation | 已落地第一版 | 同 `minimax` | 已接 | 已接 | 已接 Anthropic-style | 文本模型目录为文本输入 | 已接国内版 `/v1/image_generation` 文本生图 | [minimax.md](./provider-integrations/minimax.md) |
| `anthropic` | Anthropic Messages | 部分落地 | 当前主要走默认模型 / 显式兼容目录 | Provider 壳存在 | Provider 壳存在 | `AnthropicMessagesAdapter` 已实现，但官方 AnthropicProvider 仍是过渡 metadata 路线 | adapter 支持 user image block 映射，能力目录需补 | 未接 | 待补独立长期文档 |
| OpenAI-compatible custom profile | OpenAI Chat compatible | 部分落地 | 由用户 profile / gateway 决定 | 公共 adapter 可复用 | 公共 adapter 可复用 | 已有 tool profile / history repair 默认规则 | 必须靠 profile capability override | 未作为独立 provider 接图片生成；如网关支持 Responses hosted `image_generation`，可复用公共适配器 | [openai-chat-compatible-notes.md](./provider-integrations/openai-chat-compatible-notes.md) |
| Gemini | Gemini GenerateContent | 文档和 fixture 级 | 未登记正式 provider 模型目录 | 未接 runtime provider | 未接 | fixture 覆盖 `functionCall`，但 adapter 未完成 | 协议盘点有 file/image/audio 规则 | 未接 | 待补独立 provider 文档 |
| OpenRouter / Vercel AI Gateway | Gateway / OpenAI-compatible variants | 文档盘点级 | 未登记 | 未接独立 provider | 未接 | 需要独立 profile / probe | 不能靠模型名猜能力 | 未接 | 待补 provider 文档 |

## 4.1 当前正式版目标 Provider 成熟度矩阵

状态含义：

- 已完成：代码、mock smoke 或文档已有稳定覆盖。
- mock 已过：默认 smoke / fixture 已验证，但没有真实联网记录。
- 待复查：已有能力，但还需要按真实日常使用路径重新过一遍。
- 真实未验证：默认 smoke 不联网，仍缺真实 API Key probe 记录。
- 不适用：当前 provider 不应该支持该能力，或不作为第一版目标。

范围说明：这张表只覆盖当前正式版要先做熟的 provider：Codex OAuth、DeepSeek、MiniMax、Kimi、GLM。`openai` 官方 API 可作为标准链路和图片生成参考继续保留；`anthropic` 官方、Gemini、OpenAI-compatible / Gateway 先按后置项处理，不算本轮“已全部接进来”。

| Provider | 配置 | 凭据 | 模型目录 | 文本 | stream | tool | 多模态 | 图片生成 | Desktop 展示 | 历史恢复 | 错误快照 | 真实 probe | 当前缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `codex-oauth` | 已完成 | OAuth 已接，失效/刷新待复查 | `gpt-5.5` / `gpt-5.4` / `gpt-5.4-mini` 已登记 | 已完成 | 已完成 | 待复查 | `gpt-5.5` 图片输入已接；视频/文件未声明 | mock 已过，Codex hosted `image_generation` 已接 | 待复查 | mock 已过 | 待复查 | 待复查 | 可日常使用，但还需要补 OAuth 失效场景、真实图片生成 probe 和真实会话回归 |
| `deepseek` | 已完成 | API key 文件/环境变量已接 | `deepseek-v4-flash` / `deepseek-v4-pro` 已登记 | 已完成 | 已完成 | 已完成 | 不适用，当前目录按文本模型处理 | 不适用 | 待复查 | 待复查 | 待复查 | 文本 / stream 真实通过 | 第一版较稳，下一步补真实 tool、错误 probe 和普通会话 E2E |
| `minimax` | 已完成 | API key 文件/环境变量已接 | `MiniMax-M2.7` / `MiniMax-M2.7-highspeed` / `image-01` / `image-01-live` 已登记 | 已完成 | 已完成 | 已完成 | 文本模型按文本输入；图片能力走独立生成 API | 已完成第一版 | 待复查 | mock 已过 | 待复查 | 真实未验证 | 文本和图片已接，需补真实工具边界、图片生成 probe 和错误治理 |
| `minimax-cn` | 已完成 | API key 文件/环境变量已接 | 同 `minimax`，国内版 base URL 独立 | 已完成 | 已完成 | 已完成 | 文本模型按文本输入；图片能力走独立生成 API | 已完成第一版 | 待复查 | mock 已过 | 待复查 | 文本 / stream 真实通过 | 国内版文本链路已通，下一步补真实 tool、图片生成 probe、错误治理和普通会话 E2E |
| `kimi-api` | 已完成 | API key 文件/环境变量已接 | `kimi-k2.6` 已登记 | 文本真实通过 | stream 真实通过 | mock 已过 | 文本+图片+视频输入目录和 adapter 已接 | 不适用 | 待复查 | 待复查 | 待复查 | 文本 / stream 真实通过 | `kimi-k2.6` 已按真实 probe 固定 `temperature: 1`；下一步补图片、视频、工具历史和普通会话 E2E |
| `kimi-code` | 已完成 | API key 文件/环境变量已接 | `kimi-for-coding` 已登记 | mock 已过 | mock 已过 | mock 已过 | 暂按文本输入；不把 Coding 统一模型标识当成通用多模态模型 | 不适用 | 待复查 | 待复查 | 待复查 | 真实未验证 | 已从 OpenAI Chat 兼容入口改为 Anthropic Messages `/v1/messages`；下一步需要重建真实 Profile 后 probe |
| `glm-api` | 已完成 | API key 文件/环境变量已接 | `glm-5.1` / `glm-5v-turbo` / `glm-image` 已登记 | 文本真实通过 | stream 真实通过 | mock 已过 | `glm-5v-turbo` 文本+图片+视频已接，文件输入 pending | `glm-image` 已接第一版 | 待复查 | 待复查 | 待复查 | GLM-5.1 文本 / stream 真实通过 | 需要补 GLM-5.1 tool、GLM-5V 多模态、GLM-Image 生图真实 probe |
| `glm-coding` | 已完成 | API key 文件/环境变量已接 | `glm-5.1` 已登记 | mock 已过 | mock 已过 | mock 已过 | 暂按文本输入；Coding Plan 边界未声明多模态 | 不适用 | 待复查 | 待复查 | 待复查 | 真实未验证 | 需要验证 Coding Plan 专用端点和产品边界提示 |

## 4.2 当前 Provider 多模态能力矩阵

这里记录的是“正式版用户能否安全使用”的口径，不只记录官网能力。

| Provider / 模型 | 官方能力 | CCR 已接能力 | 真实 probe | 结论 |
| --- | --- | --- | --- | --- |
| `codex-oauth` / `gpt-5.5` | 文本+图片输入；图片生成由 Codex hosted `image_generation` 工具完成 | 文本+图片输入已接；文本生图输出 mock 已过，生成物可落盘和恢复轻量化 | 待复查 | 可作为图片输入和 Codex OAuth 生图主线；不声明视频/文件 |
| `codex-oauth` / `gpt-5.4`、`gpt-5.4-mini` | 不作为当前多模态模型 | 文本输入 | 待复查 | 保持纯文本 |
| `deepseek` / `deepseek-v4-flash`、`deepseek-v4-pro` | 当前官方 API 未声明图片/视频输入 | 文本输入 | 文本 / stream 真实通过 | 不启用多模态 |
| `minimax-cn` / `MiniMax-M2.7`、`MiniMax-M2.7-highspeed` | 文本模型线 | 文本输入 | 文本 / stream 真实通过 | 多模态输出走 `image-01`，不混到文本模型 |
| `minimax` / `image-01`、`image-01-live` | 图片生成 | 文本生图输出已接，生成物可落盘和恢复轻量化 | 真实未验证 | 可作为图片生成主线；图生图待后续 |
| `kimi-api` / `kimi-k2.6` | 文本、图片、视频输入 | 文本+图片+视频输入目录已接；OpenAI Chat compatible adapter 支持 `image_url` / `video_url`；`temperature` 固定为真实接口要求的 `1` | 文本 / stream 真实通过；图片 / 视频未验证 | 下一步必须补图片/视频真实 probe |
| `kimi-code` / `kimi-for-coding` | Coding 统一模型标识，不能直接等同 Kimi API 模型能力 | 文本输入 | 真实未验证 | 暂不启用多模态 |
| `glm-api` / `glm-5.1` | 文本/推理主模型 | 文本输入 | 文本 / stream 真实通过 | 保持纯文本主线 |
| `glm-api` / `glm-5v-turbo` | 图像、视频、文件、文本输入 | 文本+图片+视频输入目录已接；官方文件输入标记 pending | 真实未验证 | 下一步补图片/视频 probe；文件输入单独设计 |
| `glm-api` / `glm-image` | 文本生图 | 文本输入、图片输出目录已接；`generateImage(...)` 走 `/images/generations` | 真实未验证 | 下一步补真实图片生成 probe |
| `glm-coding` / `glm-5.1` | Coding Plan 专用模型/端点 | 文本输入 | 真实未验证 | 暂不启用多模态 |

当前主线：先把这张矩阵逐项补齐，再继续 OpenAI-compatible / Gateway、Anthropic 或 Gemini。

## 5. 当前可复用的接入链路

### 5.1 新增 OpenAI Chat compatible 文本模型

适用对象：DeepSeek、Kimi API、Kimi Code、GLM API、GLM Coding 类，以及部分 OpenAI-compatible gateway。

需要补：

1. Provider/Profile 配置。
2. 模型目录或 profile capability override。
3. `LlmProviderToolProfile`，确认工具能力。
4. provider 输出 fixture，至少覆盖文本、工具调用、工具结果、错误。
5. 真实请求 smoke 或 mock fetch smoke。

可复用：

- `OpenAiChatCompletionsAdapter`
- `validateLlmHistoryForProvider(...)`
- `CcrContentBlock`
- `ErrorSnapshot`
- Desktop DisplayEvent

不能省略：

- 不能只填模型名就默认支持图片、工具或 structured output。
- 不能让 Desktop 直接消费 provider raw response。

### 5.2 新增 Anthropic Messages compatible 文本模型

适用对象：MiniMax 当前文本链路、后续可能的 Anthropic-compatible provider。

需要补：

1. Provider/Profile 配置。
2. `AnthropicMessagesAdapter` 是否满足该 provider 的 headers、base URL、tool behavior。
3. 模型能力目录。
4. thinking / redacted thinking 的历史策略。
5. 工具结果回填 smoke。

可复用：

- `AnthropicMessagesAdapter`
- 标准 `tool_call` / `tool_result`
- 标准 thinking block

当前注意点：

- 官方 `AnthropicProvider` 仍处于 transition metadata 路线，不能直接视为完整标准 adapter 接入。

### 5.3 新增图片生成 provider

适用对象：已经有 text-to-image API 的 provider。

需要补：

1. `LlmProvider.generateImage(...)`。
2. provider 原始响应到 `GeneratedImageOutputItem` 的 adapter。
3. 调用 `normalizeGeneratedImageOutputs(...)`。
4. 模型目录标记 `outputModalities: ['image']`。
5. provider fixture / smoke。
6. 长期 provider 文档说明请求路径、落盘、恢复清理。

可复用：

- `LlmImageGenerationRequest`
- `normalizeGeneratedImageOutputs(...)`
- `CcrGeneratedArtifactSnapshot`
- `persistGeneratedArtifactFromBase64(...)`
- `sanitizeGeneratedArtifactsForResume(...)`
- `runCoreImageGenerationTurn(...)`
- Desktop `ModelOutput/generated` 展示

不能省略：

- base64 不允许直接进入 Desktop 或恢复 payload。
- URL 输出不能伪装成本地 `savedPath`。
- 文本模型回放时要清空大 result，只保留 call id。

### 5.4 新增多模态输入模型

适用对象：支持图片、文件、音频输入的模型。

需要补：

1. `LlmModelCapabilities.inputModalities`。
2. 附件数量、大小、mime 限制。
3. App Server 输入校验。
4. provider adapter 内容块映射。
5. Desktop 附件展示和历史恢复 smoke。

当前已落地：

- App Server 可表达文本、图片、文件、音频附件元数据。
- OpenAI Chat adapter 可把图片输入映射为 `image_url`。
- Anthropic Messages adapter 可把 user image block 映射为 Anthropic image source。

当前缺口：

- 文件输入、音频输入、视频输入还没有完整 provider 发送闭环。
- MiniMax / DeepSeek 当前内置能力仍是文本输入。

## 6. 后续逐项过的建议顺序

完整长期路线见 [CCR LLM Provider 与多模态协议长期路线图](./llm-provider-protocol-long-term-roadmap.md)。这里保留当前执行摘要，避免协议总账变成第二份路线图。

### L1：优先补当前可真实验证的 provider

1. Kimi / GLM provider 接入。
   - 状态：已完成第一版；`kimi-api` / `glm-api` / `glm-coding` 走 OpenAI Chat compatible，`kimi-code` 走 Anthropic Messages compatible；均已补 provider 定义、默认配置、模型目录、provider 壳、fixture 和 smoke。
   - 验证：文本、stream、OpenAI-style / Anthropic-style tools、tool result 历史、错误快照 fixture；真实联网 probe 仍需单独执行。
2. Codex OAuth / DeepSeek / MiniMax 回归 smoke。
   - 状态：已完成本轮回归；Codex OAuth 图片生成已补 hosted `image_generation` mock。
   - 验证：现有 provider fixture、runtime smoke、generated output smoke、Desktop display smoke。
3. 已接 provider 成熟化。
   - 目标：先把 Codex OAuth、DeepSeek、MiniMax、Kimi、GLM 做到可稳定日常使用。
   - 状态：统一真实 probe 入口已落地为 `npm.cmd run probe:provider`；默认只跑 `auth,text,stream`，图片生成需显式 `--full` 或 `--checks image`。
   - 验证：成熟度矩阵、真实 probe、普通会话 E2E、Desktop 配置体验、错误恢复。
4. OpenAI-compatible / Gateway profile。
   - 目标：不能只靠模型名猜能力。
   - 验证：profile capability override、工具 profile、provider fixture。

### L2：OpenAI-compatible / Gateway 能力覆盖

1. Profile capability override。
   - 目标：不能只靠模型名猜能力。
   - 验证：工具、多模态、structured output 能力来源可追踪。
2. Gateway / relay provider 差异记录。
   - 目标：NewAPI、OneAPI、OpenRouter、Vercel AI Gateway、自定义 endpoint 都是一等 Profile。
   - 验证：provider probe、fixture、Desktop 能力来源展示。

### L3：暂缺真实 key 或需要单独协议族的 provider

1. Anthropic 官方 provider 标准化。
   - 目标：去掉 transition metadata 依赖，直接消费 `LlmMessage`。
   - 验证：先用 fixture/mock 覆盖文本、stream、tool_use/tool_result、thinking、图片输入；有真实 key 后再补联网 probe。
2. Gemini adapter。
   - 目标：实现 `GenerateContent` 的 `contents.parts`、`functionCall`、`functionResponse`。
   - 验证：文本、工具、历史校验、图片/文件输入边界。

### L4：结构化输出

1. 明确 `structured` 内容块和 JSON schema 的关系。
2. 区分 JSON mode、JSON schema、tool-as-structured-output。
3. 补 provider profile：OpenAI Responses、OpenAI Chat、Gemini、Anthropic-compatible。
4. 补 Desktop 结构化视图和 smoke。

### L5：生成型多模态输出第二阶段

1. 图生图 / 图片编辑。
2. 音频生成。
3. 文件生成。
4. 生成物生命周期清理与安全扫描。

这些能力应先扩展 `generatedArtifact` 生命周期和安全策略，再接 provider API。

### L6：验证、可观测与发布硬化

1. Provider conformance matrix。
2. 每个 provider 的 fixture、mock smoke、真实 probe 记录。
3. 模型页显示 provider 健康状态、能力来源和最近 probe 结果。
4. 发布前回归清单和文档收口。

## 7. 每接一个 provider 必填清单

新增 provider 时，不允许只补一个 HTTP 调用。至少要填完：

| 项 | 要求 | 位置 |
| --- | --- | --- |
| Provider ID | 稳定 ID，不能靠 base URL 猜地区 | `providerDefinitions.ts` |
| Profile 配置 | `apiMode`、`authStrategy`、`baseUrl`、默认模型 | `llmConfig.ts` / provider 文档 |
| 凭据来源 | profile credential + env fallback | `providerCredentials.ts` / provider class |
| 模型目录 | 默认模型、上下文、输入/输出模态、工具能力 | `modelCatalog.ts` |
| 工具 profile | schema style、result style、strict、parallel、deferred | `toolProtocolProfile.ts` |
| 文本 adapter | provider raw message <-> `LlmMessage` / `LlmContentPart` | `src/services/llm/protocols/` |
| 历史规则 | tool call / tool result 成对、thinking 回放 | `historyValidator.ts` |
| 错误映射 | auth、rate limit、quota、safety、protocol | `ErrorSnapshot` / adapter safe details |
| 输出 fixture | 文本、工具、附件、错误、历史恢复 | `provider-output-fixtures.json` |
| smoke | provider adapter、runtime、display、resume | `scripts/smoke-*.mjs` |
| 长期文档 | 认证、协议、模型、能力、验证、边界 | `docs/architecture/provider-integrations/` |

## 8. 当前结论

现在 CCR 已经具备后续多模型接入的主干协议：

- 标准消息。
- 标准内容块。
- 模型能力。
- provider runtime。
- 工具 profile。
- 历史校验。
- 错误快照。
- 生成图片和生成物落盘。
- Desktop 展示事件。

后续接新模型时，原则上不应该再从 Core 或 UI 重新开一套结构；应优先补 provider adapter、profile、model capabilities、fixture 和 smoke。

还不能直接复用完成的重点缺口是：

- Gemini `GenerateContent` 完整 adapter。
- Anthropic 官方 provider 标准化。
- OpenAI-compatible / Gateway 的能力 probe 和 profile 管理。
- Structured Output 产品化。
- 文件 / 音频 / 视频输入输出。
- Gateway / OpenRouter / Vercel AI Gateway 的能力 probe 和 profile 管理。
