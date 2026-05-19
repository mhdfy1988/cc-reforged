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
- [x] P21 文件、附件与引用系统
- [x] P22 结构化输出与 JSON/Schema 视图（已撤回，后续按具体场景重新设计）
- [x] P23 多模态输入/输出、附件上传与预览
- [x] P24 错误分类、限流与拒答状态治理
- [x] P25 原生上下文链路恢复与短期记忆治理
- [x] P26 上下文、压缩与记忆能力 App Server 桥接
- [x] STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke
- [x] STD-OUTPUT-03 生成型多模态输出设计
- [x] STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复
- [x] STD-OUTPUT-05 真实 provider 生成 API 接入
- [x] STD-OUTPUT-06 OpenAI 生成路径数据一致性
- [x] STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入
- [x] STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入
- [x] STD-OUTPUT-09 会话流生成图片输出闭环
- [x] STD-PROVIDER-01 Kimi / GLM Provider 接入
- [ ] STD-PROVIDER-02 已接 provider 成熟化与真实使用闭环

## 当前指针

- 已完成：P23 多模态输入/输出、附件上传与预览第一版。
- 已完成：P24 错误分类、限流与拒答状态治理第一版。
- 已完成：STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke 第一版。
- 已完成：STD-OUTPUT-03 生成型多模态输出设计第一版。
- 已完成：STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复第一版。
- 已完成：STD-OUTPUT-05 真实 provider 生成 API 接入第一版。
- 已完成：STD-OUTPUT-06 OpenAI 生成路径数据一致性第一版。
- 已完成：STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入第一版。
- 已完成：STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入第一版。
- 已完成：STD-OUTPUT-09 会话流生成图片输出闭环第一版。
- 已完成：STD-PROVIDER-01 Kimi / GLM Provider 接入第一版。
- 当前正在做：STD-PROVIDER-02 已接 provider 成熟化与真实使用闭环。
- 长期路线图：[CCR LLM Provider 与多模态协议长期路线图](../architecture/llm-provider-protocol-long-term-roadmap.md)。
- 后续方向记录：[Provider 能力工具化后续方向](../architecture/provider-capability-tools-future.md)，当前只沉淀想法，不进入发布主线。
- 下一步候选：先把 Codex OAuth、DeepSeek、MiniMax、Kimi、GLM 这几个已接 provider 做成熟；OpenAI-compatible / Gateway profile、Anthropic 官方 provider 标准化、Gemini adapter、Structured Output 和生成型多模态输出第二阶段后置。
- 历史会话恢复索引：[history-session-recovery-index-2026-05-18.md](history-session-recovery-index-2026-05-18.md)
- 说明：P22 全局结构化展示已撤回并标记完成，不再占用当前未完成指针；P23 不再和多供应商专项混在一起，附件真实随消息发送、预览、输入协议和多模态能力边界治理进入独立文档。

## 标准文档落地队列

来源：

- [CCR 模型输出归一化与展示标准](../architecture/model-output-normalization-and-display-standard.md)
- [CCR Provider 工具协议统一化标准](../architecture/provider-tool-protocol-normalization.md)

这些不是独立空文档，而是 P23 收口后继续实施的标准化队列。执行顺序如下：

1. [x] STD-PROTOCOL-01 CCR 标准 LLM 协议文档
   - 已完成：新增 `CCR 标准 LLM 协议 v0.1`，明确 CCR 不以某一家 provider 原始协议为标准，而以内部标准消息、内容块、工具、能力和错误快照为基准；已有多模态、输出展示和工具协议文档已引用该标准。
2. [x] STD-PROTOCOL-02 Provider 协议盘点与官方文档对照
   - 已完成：新增 `Provider 协议盘点与官方文档对照`，按官方文档列出 OpenAI Responses、OpenAI Chat、Anthropic Messages、Gemini GenerateContent、DeepSeek、MiniMax、OpenRouter 和 Vercel AI Gateway 需要对接的协议族、协议面、必须实现项和 probe 矩阵。
3. [x] STD-TOOL-01 修复 OpenAI-compatible / DeepSeek 悬空工具结果和 TodoWrite schema 常驻
   - 已完成：`TodoWrite` 不再 deferred；OpenAI-compatible 请求前会修复缺失工具结果；中断和参数错误不会让会话卡死。
4. [x] STD-TOOL-02 Provider 工具协议第一版收口
   - 目标：补 `ProviderToolProfile` 或等价结构，明确工具 schema、strict 支持、并行工具和工具结果回填能力。
   - 已完成：新增 `LlmProviderToolProfile` 与 `toolProtocolProfile` 解析入口；DeepSeek / OpenAI Chat compatible / Anthropic / MiniMax 已有内置或默认 profile；OpenAI Chat adapter 会按 profile 判断工具支持与工具结果修复；新增 `smoke:provider-tool-profile` 覆盖 DeepSeek、OpenAI-compatible、Anthropic 和 custom 默认行为。
5. [x] STD-DISPLAY-01 抽 `CcrContentBlock` 共享类型
   - 目标：把 Desktop / App Server / Runtime 里分散的 `text/image/file/audio/tool/json` 内容块口径收成共享类型。
   - Goal：[2026-05-18 STD-DISPLAY-01 CcrContentBlock 共享类型](../goals/2026-05-18-std-display-01-ccr-content-block.md)
   - 已完成：新增共享 `CcrContentBlock` 类型；LLM、Core、App Server 和 Desktop display event 已开始复用；Desktop 展示事件新增标准 `contentBlocks` 快照，现有 UI 行为保持不变。
6. [x] STD-HISTORY-01 History Validator 发送前历史校验
   - 目标：发送给 provider 前扫描历史，处理悬空 tool call、缺 tool result、Gemini `functionResponse`、Anthropic `tool_result` 和 reasoning / thinking 回放规则。
   - Goal：[2026-05-18 STD-HISTORY-01 History Validator 发送前历史校验](../goals/2026-05-18-std-history-01-history-validator.md)
   - 已完成：新增 LLM 历史校验器；OpenAI-compatible / DeepSeek 请求前会按 provider profile 修复缺失 tool result、丢弃孤立 tool result，且在不支持工具的 provider profile 下阻断非法工具历史。Anthropic / Gemini / Responses 规则已在 goal 中预留。
7. [x] STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke
   - 目标：补 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的输出样例，覆盖文本、工具、附件、错误和历史恢复。
   - Goal：[2026-05-18 STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke](../goals/2026-05-18-std-display-02-provider-output-fixtures.md)
   - 验收：新增 provider 时至少补一组 fixture，不允许 UI 直接消费 provider 原始结构。
   - 已完成：新增 provider 输出 fixture JSON 与 `smoke:provider-output-fixtures`，覆盖 OpenAI Responses、Anthropic Messages、Gemini GenerateContent、DeepSeek OpenAI Chat、OpenAI Compatible 的文本、工具调用、工具结果、附件历史恢复和错误快照场景。
8. [x] P24 ErrorSnapshot 与错误分类展示
   - 目标：把 provider 错误、工具错误、参数校验错误、中断、限流、认证过期等统一为可行动错误卡。
   - Goal：[2026-05-18 P24 ErrorSnapshot 错误分类与展示模型](../goals/2026-05-18-p24-errorsnapshot.md)
   - 已完成：P24-1 / P24-2 / P24-3 / P24-4 / P24-5 / P24-6 / P24-7 / P24-8；`ErrorSnapshot` 已支持结构化错误分类映射，Desktop display event 可携带 `errorSnapshot`，Desktop 错误卡已具备恢复动作、限流/额度提示、边界区分和安全诊断复制，收口 smoke 已覆盖主要错误分类。
9. [x] STD-OUTPUT-03 生成型多模态输出设计
   - 目标：模型生成图片、音频、文件这类输出单独设计生命周期和安全策略。
   - Goal：[2026-05-18 STD-OUTPUT-03 生成型多模态输出设计](../goals/2026-05-18-std-output-03-generated-multimodal-output.md)
   - 说明：这不是 P23 第一版范围，放在展示标准稳定后再做。
   - 已完成：`CcrContentBlock` 附件块新增生成来源、生命周期、安全状态、provider/model/outputId 等字段；Desktop `AttachmentSnapshot` 支持 `ModelOutput/generated`；assistant 消息中的模型生成图片可展示为模型生成输出；smoke 已覆盖生成图片展示链路。
10. [x] STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复
   - 目标：对齐 Codex 的生成图片落盘、`savedPath` 展示和恢复轻量化策略。
   - Goal：[2026-05-18 STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复](../goals/2026-05-18-std-output-04-generated-artifact-persistence.md)
   - 验收：生成图片可保存到本地；Desktop 优先展示 `savedPath`；thread resume 不返回大 base64；文本模型回放清空 image result 但保留 call id。
   - 已完成：新增生成物快照、落盘工具、恢复轻量化工具和模型回放策略；Desktop 附件区支持 savedPath、打开、定位、另存、复制路径；smoke 已覆盖本地落盘、savedPath 展示、resume 清 payload、文本模型回放清 result。
11. [x] STD-OUTPUT-05 真实 provider 生成 API 接入
   - 目标：把 OpenAI / OpenAI-compatible 图片生成 API 返回结果接入 CCR 生成物落盘与展示链路。
   - Goal：[2026-05-18 STD-OUTPUT-05 真实 provider 生成 API 接入](../goals/2026-05-18-std-output-05-real-provider-generation-api.md)
   - 验收：provider 生成响应先归一化为 `CcrImageContentBlock` 和 `generatedArtifact`；Desktop / resume 不直接消费 provider 原始 base64；smoke 使用 fixture/mock，不依赖真实联网生成。
   - 已完成：新增 OpenAI 图片生成 adapter、OpenAI provider `generateImage`、runtime 图片生成入口和 `smoke:generated-output-provider`；mock provider 响应可落盘为 `generated_outputs/<sessionId>/<outputId>.png`，Desktop / resume 均只消费轻量引用。
12. [x] STD-OUTPUT-06 OpenAI 生成路径数据一致性
   - 目标：让 OpenAI 直接 Image API 和 Responses/Codex `image_generation_call` 走同一个 CCR 生成物归一化入口。
   - Goal：[2026-05-18 STD-OUTPUT-06 OpenAI 生成路径数据一致性](../goals/2026-05-18-std-output-06-openai-generation-consistency.md)
   - 验收：`/images/generations` 与 `image_generation_call.result` 都输出同形 `CcrImageContentBlock` / `CcrGeneratedArtifactSnapshot`，不让同一家 provider 分裂成两套数据模型。
   - 已完成：抽出 `normalizeOpenAiGeneratedImageOutputs(...)`，Image API 和 Responses/Codex `image_generation_call` 共享同一落盘与展示归一化；smoke 覆盖 `gpt-image-1` 直接生成与 `gpt-5.5` 主模型工具生成同形输出。
13. [x] STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入
   - 目标：让 OpenAI provider 能显式调用 Responses API 的 `image_generation` 工具，并复用现有生成物落盘与展示链路。
   - Goal：[2026-05-18 STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入](../goals/2026-05-18-std-output-07-openai-responses-image-generation-api.md)
   - 验收：`POST /responses` 请求体包含 `tools: [{ type: "image_generation" }]`；返回的 `image_generation_call.result` 复用 `normalizeOpenAiImageGenerationCall(...)`；Desktop / resume / safe raw 不泄露 base64。
   - 已完成：新增 Responses adapter、provider 显式路由和 smoke，默认 Images API 路径保持不变。
14. [x] STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入
   - 目标：把当前带 OpenAI 命名的共享图片生成归一化抽成 provider-neutral 层，并接入 MiniMax 国际版 / 国内版原生图片生成 API。
   - Goal：[2026-05-18 STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入](../goals/2026-05-18-std-output-08-provider-neutral-minimax-image-generation.md)
   - 验收：OpenAI / MiniMax 都复用同一个 `normalizeGeneratedImageOutputs(...)`；MiniMax `image_base64` 可落盘，`image_urls` 可轻量展示；Desktop / resume / safe raw 不泄露 base64。
   - 已完成：OpenAI 和 MiniMax 都复用通用图片生成归一化层；MiniMax 国际版 / 国内版已接原生图片生成 API。
15. [x] STD-OUTPUT-09 会话流生成图片输出闭环
   - 目标：把 provider 生成图片结果接入普通 turn/session 事件流，让 Desktop 聊天区直接展示模型生成图片。
   - Goal：[2026-05-18 STD-OUTPUT-09 会话流生成图片输出闭环](../goals/2026-05-18-std-output-09-session-generated-image-flow.md)
   - 验收：普通会话事件流输出标准 `contentBlocks` / `generatedArtifact`；Desktop 展示 `savedPath`；thread resume 不回放大 base64；smoke 覆盖会话流、展示和恢复轻量化。
   - 已完成：`turn/start options.imageGeneration` 接入普通会话流；Core 可切到 `runCoreImageGenerationTurn(...)` 调用 `LlmRuntime.generateImage(...)`；Desktop 展示 `ModelOutput/generated` 图片附件；恢复清理不回放大 base64；OpenAI / MiniMax provider 文档均已补会话流入口。
16. [x] STD-PROVIDER-01 Kimi / GLM Provider 接入
   - 目标：把当前可真实验证的 Kimi / GLM 按产品边界拆成 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` 四个 provider 接入 CCR，不伪装成 OpenAI；`kimi-api` / `glm-api` / `glm-coding` 走 OpenAI Chat compatible，`kimi-code` 走 Anthropic Messages compatible。
   - Goal：[2026-05-19 STD-PROVIDER-01 Kimi / GLM Provider 接入](../goals/2026-05-19-std-provider-01-kimi-glm-openai-chat-compatible.md)
   - 验收：新增 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` provider definition、配置、模型目录、provider 壳、fixture 和 smoke；文本、stream、tools、tool result、错误快照可归一化；回归 Codex OAuth / DeepSeek / MiniMax。
   - 当前状态：已完成第一版。新增四个独立 provider、共享 OpenAI Chat / Anthropic Messages 协议链路、模型目录、fixture 和 `smoke:kimi-glm-providers`；默认 smoke 不依赖真实联网。
17. [ ] STD-PROVIDER-02 已接 provider 成熟化与真实使用闭环
   - 目标：不急着新增 Gateway / 其他 provider，先把 Codex OAuth、DeepSeek、MiniMax、Kimi、GLM 这些当前可用 provider 做到“能稳定日常使用”。
   - Goal：[2026-05-19 STD-PROVIDER-02 已接 provider 成熟化与真实使用闭环](../goals/2026-05-19-std-provider-02-provider-maturity.md)
   - 验收：为每个已接 provider 建立成熟度矩阵，覆盖配置档案、凭据、模型目录、文本、stream、工具、普通会话、错误快照、Desktop 展示、真实 probe 记录和文档；没有 API Key 的项必须标明是未验证而不是已完成。
   - 当前状态：已补当前 provider 多模态能力初判和正式版目标 provider 成熟度总表；GLM 第一版按 `glm-api/glm-5.1` 最新文本主模型 + `glm-api/glm-5v-turbo` 多模态输入模型 + `glm-api/glm-image` 图片生成模型记录，其中 `glm-5v-turbo` 已进入文本+图片+视频能力目录，`glm-image` 已进入文本生图目录并接入 `/images/generations`，官方文件输入先标 pending。下一步补真实 probe 入口和普通会话 E2E。


## 归档索引

- 插队修复任务归档：[app-server-fix-archive.md](app-server-fix-archive.md)
- 已完成阶段归档：[app-server-completed-archive.md](app-server-completed-archive.md)
- 历史会话恢复索引：[history-session-recovery-index-2026-05-18.md](history-session-recovery-index-2026-05-18.md)

说明：`app-server-todo.md` 只保留当前任务列表、当前指针、标准队列和当前正在做的阶段详情；历史细节移动到归档文件。

## STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke

状态：已完成，STD-DISPLAY-02-1 / STD-DISPLAY-02-2 / STD-DISPLAY-02-3 / STD-DISPLAY-02-4 已完成。

Goal：[2026-05-18 STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke](../goals/2026-05-18-std-display-02-provider-output-fixtures.md)

目标：

- 为 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 建立 provider 输出 fixture。
- 覆盖文本、工具调用 / 工具结果、附件、错误快照、历史恢复这些展示高风险场景。
- 验证 provider 原始结构必须先归一化为 CCR 内容块 / DisplayEvent，再进入 Desktop UI。

执行顺序：

1. [x] STD-DISPLAY-02-1 入口盘点与 fixture 结构设计
   - 目标：盘点 provider adapter、`CcrContentBlock`、`DisplayEvent`、历史恢复 smoke 的真实入口。
   - 验收：明确 fixture 目录、样例 schema、归一化验证链路和第一版边界。
   - 已完成：确认链路为 provider adapter / protocol fixture -> `LlmContentPart` / `CcrContentBlock` -> `DisplayEvent`；fixture 落点为 `src/services/llm/fixtures/provider-output-fixtures.json`。
2. [x] STD-DISPLAY-02-2 Provider 输出 fixture 样例
   - 目标：补 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的最小 provider 原始输出样例。
   - 验收：每个 provider 至少有文本样例，关键 provider 具备工具、附件、错误或历史恢复样例。
   - 已完成：补 OpenAI Responses 文本、Anthropic 工具调用、Gemini functionCall、DeepSeek thinking + tool_calls、OpenAI Compatible 历史附件、工具结果历史恢复和限流错误样例。
3. [x] STD-DISPLAY-02-3 归一化 smoke
   - 目标：新增 smoke，读取 fixture 并验证输出只能通过 CCR 归一化内容块 / DisplayEvent 消费。
   - 验收：分类覆盖文本、工具、附件、错误、历史恢复，不直接把 provider 原始字段暴露给 UI。
   - 已完成：新增 `smoke:provider-output-fixtures`，验证目标 provider 覆盖、场景覆盖、CCR 内容块类型、DisplayEvent 类型，以及展示事件不泄露 provider 原始结构 marker。
4. [x] STD-DISPLAY-02-4 文档和验证收口
   - 目标：更新标准队列、goal、todo 和验证记录。
   - 验收：`typecheck`、相关 smoke、`git diff --check` 通过；如果有既有失败项，明确归因。
   - 已完成：已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`git diff --check`。

## STD-OUTPUT-03 生成型多模态输出设计

状态：已完成第一版，真实生成 API、下载落盘和完整安全扫描留给后续专项。

Goal：[2026-05-18 STD-OUTPUT-03 生成型多模态输出设计](../goals/2026-05-18-std-output-03-generated-multimodal-output.md)

Codex 源码对照索引：[OpenAI Codex 生成物源码对照索引](../references/openai-codex-generated-artifacts.md)

目标：

- 让模型生成图片、音频、文件这类输出能进入 CCR 标准内容块。
- 让 Desktop 能把模型生成物识别为 `ModelOutput`，并展示生命周期和安全状态。
- 为后续真实 provider 生成 API、下载落盘、历史恢复和安全扫描预留字段。

执行结果：

1. [x] STD-OUTPUT-03-1 生成型输出内容块与 Desktop 快照
   - 已完成：`CcrAttachmentContentBlockBase` 新增 `origin/lifecycle/safety/provider/model/outputId/expiresAt`；`CcrContentSource` 新增 `providerFile`。
   - 已完成：`AttachmentSnapshot` 新增 `ModelOutput` 来源、`generated` 状态、生成生命周期和输出安全字段。
   - 已完成：assistant message 中的模型生成附件不再标成工具输出附件，而是归类为模型生成输出。
2. [x] STD-OUTPUT-03-2 生成型输出 smoke 与文档收口
- 已完成：`smoke:desktop-display-events` 覆盖模型生成图片进入 assistant message、保留 provider/model/outputId/lifecycle/safety 元数据，并生成 `ModelOutput/generated` 附件快照。
- 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run desktop:build`、`git diff --check`。

## STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复

状态：已完成第一版，真实 provider 生成 API、完整安全扫描和媒体库留给后续专项。

Goal：[2026-05-18 STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复](../goals/2026-05-18-std-output-04-generated-artifact-persistence.md)

Codex 源码对照索引：[OpenAI Codex 生成物源码对照索引](../references/openai-codex-generated-artifacts.md)

目标：

- 补 `GeneratedArtifactSnapshot` 或等价结构，统一描述生成物本地引用。
- 模型生成图片支持保存到 `.ccr/generated_outputs/<sessionId>/<outputId>.png`。
- Desktop 生成物卡片优先展示 `savedPath`，提供打开、定位、另存、复制路径动作。
- 历史恢复只带轻量引用，不把大 base64 payload 回灌到 Desktop 或 resume 响应。

执行顺序：

1. [x] STD-OUTPUT-04-1 标准模型与落盘工具
   - 目标：补生成物快照类型、保存路径规则、base64 落盘工具。
   - 已完成：`CcrGeneratedArtifactSnapshot` 覆盖 id/type/status/savedPath/mime/provider/model/outputId/prompt/revisedPrompt/lifecycle/safety；`persistGeneratedArtifactFromBase64` 可写入 `generated_outputs/<sessionId>/<outputId>.png`。
2. [x] STD-OUTPUT-04-2 Desktop savedPath 展示与动作
   - 目标：附件快照优先携带 `savedPath`，UI 支持打开、定位、另存、复制路径。
   - 已完成：`AttachmentSnapshot` 支持 `savedPath/prompt/revisedPrompt/generatedArtifact`；生成物附件卡片支持打开、定位、另存和复制路径，图片预览优先走本地路径。
3. [x] STD-OUTPUT-04-3 恢复与回放轻量化 smoke
   - 目标：补恢复清理和模型回放策略工具。
   - 已完成：`sanitizeGeneratedArtifactsForResume` 会移除 `previewDataUrl` / 大 inline data，并清空 `image_generation_call.result`；`prepareGeneratedImageCallForModelReplay` 保留 call id，按模型能力决定是否带 result。
4. [x] STD-OUTPUT-04-4 文档和验证收口
   - 目标：更新 goal/todo，跑类型检查、build、Desktop smoke 和 diff 检查。
   - 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run desktop:build`、`git diff --check`。

## STD-OUTPUT-05 真实 provider 生成 API 接入

状态：已完成第一版；优先覆盖 OpenAI / OpenAI-compatible 图片生成最小闭环，真实联网生成不进入 smoke，smoke 使用 mock 响应。

Goal：[2026-05-18 STD-OUTPUT-05 真实 provider 生成 API 接入](../goals/2026-05-18-std-output-05-real-provider-generation-api.md)

目标：

- 对齐 OpenAI Images API 的请求和响应形态，补 CCR 内部图片生成请求 / 响应类型。
- provider 原始输出必须先归一化为 `CcrImageContentBlock` 和 `CcrGeneratedArtifactSnapshot`，再进入 Desktop / App Server。
- 生成结果复用 `generated_outputs/<sessionId>/<outputId>` 本地落盘，不把大 base64 传给 Desktop 或恢复响应。

执行顺序：

1. [x] STD-OUTPUT-05-1 官方 API / 本仓 provider 入口对照
   - 目标：确认 OpenAI Images API 和现有 `src/services/llm` provider/adapter 边界。
   - 验收：文档记录接口选择、字段映射和第一版边界。
   - 已完成：确认第一版走 OpenAI Images API `/images/generations`；Responses 多轮 `image_generation` 和音频/文件生成留给后续专项。
2. [x] STD-OUTPUT-05-2 图片生成适配器与 OpenAI provider 接入
   - 目标：补 `LlmImageGenerationRequest/Response`、OpenAI 图片生成 adapter 和 provider `generateImage` 入口。
   - 验收：请求能构造 `/images/generations`，响应能归一化为 CCR 图片内容块。
   - 已完成：`OpenAiImageGenerationAdapter` 支持 `b64_json` 落盘和 `url` 轻量引用；`OpenAiProvider` 读取 OpenAI API key / baseUrl 并提供 `generateImage(...)`。
3. [x] STD-OUTPUT-05-3 落盘 / Desktop / resume smoke
   - 目标：用 mock provider 响应验证图片 base64 落盘、Desktop 展示 `savedPath`、resume 清 payload。
   - 验收：新增 smoke 不依赖真实网络，且断言 UI 事件不包含 provider 原始 base64。
   - 已完成：新增 `smoke:generated-output-provider`，覆盖 mock OpenAI 响应、落盘、Desktop 展示、resume 清理，以及 OpenAI-compatible `response_format=b64_json` 请求构造。
4. [x] STD-OUTPUT-05-4 文档和验证收口
   - 目标：更新 goal/todo，跑类型检查、build、相关 smoke 和 diff 检查。
   - 验收：明确通过命令和遗留风险。
   - 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:llm-runtime`、`git diff --check`。

## STD-OUTPUT-06 OpenAI 生成路径数据一致性

状态：已完成第一版，目标是把同一家 OpenAI 的两种生成入口收敛到同一套 CCR 数据模型。

Goal：[2026-05-18 STD-OUTPUT-06 OpenAI 生成路径数据一致性](../goals/2026-05-18-std-output-06-openai-generation-consistency.md)

目标：

- 直接 Image API：`/images/generations` 返回 `data[].b64_json` / `data[].url`。
- Responses / Codex 风格：主模型例如 `gpt-5.5` 触发 `image_generation_call`，结果在 `result` 字段中返回。
- 两条路径都必须归一化为同形 `CcrImageContentBlock` 和 `CcrGeneratedArtifactSnapshot`，共享落盘、Desktop 展示、resume 清理策略。

执行顺序：

1. [x] STD-OUTPUT-06-1 共享归一化入口
   - 目标：抽出 `normalizeOpenAiGeneratedImageOutputs(...)`，让 Image API 和 image_generation_call 共用。
   - 验收：两条路径不再各自组装 `CcrImageContentBlock`。
   - 已完成：`normalizeOpenAiImageGenerationResponse(...)` 和 `normalizeOpenAiImageGenerationCall(...)` 都调用共享归一化入口。
2. [x] STD-OUTPUT-06-2 Responses/Codex image_generation_call 适配
   - 目标：新增 `normalizeOpenAiImageGenerationCall(...)`，接受 `id/call_id/result/revised_prompt`。
   - 验收：`gpt-5.5` 这类主模型触发的图片生成结果可以保留主模型名，同时复用同一落盘结构。
   - 已完成：`image_generation_call.result` 支持 data URL / base64，落盘后输出同形 `CcrImageContentBlock`；Responses/Codex 路径保留主模型名，例如 `gpt-5.5`。
3. [x] STD-OUTPUT-06-3 一致性 smoke / fixture
   - 目标：扩展 `smoke:generated-output-provider` 和 provider fixture。
   - 验收：Image API 与 Responses/Codex 工具调用输出的 origin/lifecycle/safety/provider/mime/source/generatedArtifact 口径一致。
   - 已完成：`smoke:generated-output-provider` 新增直接 Image API 与 Responses/Codex 工具调用同形断言；provider fixture 新增 `provider-openai-responses-image-generation-call`。
4. [x] STD-OUTPUT-06-4 文档和验证收口
   - 目标：更新 goal/todo，跑类型检查、build、相关 smoke 和 diff 检查。
   - 验收：明确通过命令和遗留风险。
   - 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。

## STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入

状态：已完成第一版，目标是把真实 Responses API `image_generation` 工具请求接入 provider，但保持默认 Images API 路径不变。

Goal：[2026-05-18 STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入](../goals/2026-05-18-std-output-07-openai-responses-image-generation-api.md)

目标：

- 新增 `OpenAiResponsesImageGenerationAdapter`，负责构造 `POST /responses` 请求。
- 请求体使用 `model/input/tools`，其中 `tools` 包含 `type: "image_generation"`。
- 返回结果只消费 `response.output[]` 里的 `image_generation_call`，并复用 `normalizeOpenAiImageGenerationCall(...)`。
- `OpenAiProvider.generateImage(...)` 通过 metadata 显式切到 Responses 路径，默认仍走 Images API。

执行顺序：

1. [x] STD-OUTPUT-07-1 Responses adapter 与请求体构造
   - 目标：补 `OpenAiResponsesImageGenerationAdapter` 和 `toOpenAiResponsesImageGenerationRequestBody(...)`。
   - 验收：mock fetch 能看到 `/responses` URL、主模型和 `image_generation` 工具。
   - 已完成：adapter 构造 `POST /responses`，支持主模型、输入文本、`size / quality / output_format` 和 mock fetch 验证。
2. [x] STD-OUTPUT-07-2 OpenAI provider 显式路由
   - 目标：在 `metadata.imageGenerationApi = "responses"` 或 `metadata.apiMode = "openai-responses"` 时走 Responses 图片生成路径。
   - 验收：默认 Images API 不变；显式 metadata 才走 Responses。
   - 已完成：新增轻量路由 helper；`OpenAiProvider.generateImage(...)` 显式 metadata 走 Responses，默认仍走 Images API。
3. [x] STD-OUTPUT-07-3 smoke 与文档收口
   - 目标：扩展 `smoke:generated-output-provider`，验证落盘、safe raw、provider 路由和文档记录。
   - 验收：类型检查、build、相关 smoke 和 diff 检查通过。
   - 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:llm-runtime`。

## STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入

状态：已完成第一版，目标是先把图片生成归一化从 OpenAI 命名中抽出来，再接 MiniMax 国际版 / 国内版图片生成。

Goal：[2026-05-18 STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入](../goals/2026-05-18-std-output-08-provider-neutral-minimax-image-generation.md)

目标：

- 新增 provider-neutral 的 `normalizeGeneratedImageOutputs(...)`。
- OpenAI adapter 只负责 OpenAI raw response 映射，不再承载通用图片输出命名。
- 新增 `MiniMaxImageGenerationAdapter`，接入 `POST /v1/image_generation`。
- `MiniMaxProvider` / `MiniMaxChinaProvider` 实现 `generateImage(...)`，文本聊天链路保持不变。

执行顺序：

1. [x] STD-OUTPUT-08-1 MiniMax 接入文档与官方 API 对照
   - 目标：先生成文档，明确 OpenAI 现有文档、MiniMax 原生图片接口、字段映射和第一版边界。
   - 已完成：新增 goal 文档，确认 MiniMax 图片生成走 native `image_generation`，不是 Anthropic-compatible 聊天协议。
2. [x] STD-OUTPUT-08-2 通用图片生成归一化层
   - 目标：从 OpenAI adapter 中抽出 `normalizeGeneratedImageOutputs(...)`。
   - 验收：OpenAI Images API 和 Responses `image_generation_call` 仍然输出同形内容块。
   - 已完成：新增 `generatedImageOutputAdapter.ts`；OpenAI 两条路径继续复用同一通用归一化入口。
3. [x] STD-OUTPUT-08-3 MiniMax 图片生成 adapter/provider
   - 目标：接入 MiniMax 国际版 / 国内版图片生成 API。
   - 验收：mock base64 响应可落盘，mock URL 响应可作为临时图片块展示。
   - 已完成：新增 `MiniMaxImageGenerationAdapter`；`minimax` / `minimax-cn` provider 实现 `generateImage(...)`；模型目录新增 `image-01` / `image-01-live`。
4. [x] STD-OUTPUT-08-4 smoke / fixture / 文档收口
   - 目标：扩展 `smoke:generated-output-provider` 和 provider fixture。
   - 验收：类型检查、build、相关 smoke 和 diff 检查通过。
   - 已完成验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`。

## P24 错误分类、限流与拒答状态治理

状态：已完成，P24-1 / P24-2 / P24-3 / P24-4 / P24-5 / P24-6 / P24-7 / P24-8 已完成。

Goal：[2026-05-18 P24 ErrorSnapshot 错误分类与展示模型](../goals/2026-05-18-p24-errorsnapshot.md)

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

1. [x] P24-1 错误来源与现有错误码盘点
   - 目标：盘点 Desktop client-error、App Server JSON-RPC error、CoreError、provider error、tool error、MCP error。
   - 具体动作：列出已有 error kind/code/message/requestId 字段，标出脱敏风险。
   - 已完成：确认 Desktop `DisplayEvent`、工具 `ToolSnapshot.errorClass`、Core `CoreError.kind`、App Server JSON-RPC error 是第一版主要来源。
2. [x] P24-2 ErrorSnapshot 展示模型
   - 目标：定义统一错误展示快照。
   - 具体动作：包含 `category/severity/source/retryable/actions/requestId/safeDetails/rawRef`。
   - 已完成：新增共享 `CcrErrorSnapshot` 类型，Desktop `DisplayEvent` 已支持 `errorSnapshot` 字段。
3. [x] P24-3 错误分类映射器
   - 目标：把已知错误映射到稳定分类。
   - 具体动作：覆盖 auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown。
   - 已完成：`createCcrErrorSnapshot(...)` 现在会优先读取 `error` / `safeDetails` 里的 `status/code/kind/type/stopReason/cause` 等结构化线索，再用 message 兜底；smoke 覆盖 auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown。
4. [x] P24-4 用户动作与恢复入口
   - 目标：错误卡片提供下一步动作。
   - 具体动作：重新登录、重试 turn、切换模型、打开日志、复制诊断信息；不支持的动作先显示禁用原因。
   - 验收：用户看到错误后知道能点什么，而不是只能截图。
   - 已完成：Desktop `ErrorCard` 已渲染分类、来源、定位字段、折叠诊断和推荐动作；重新登录、打开日志页、打开模型页、复制诊断已接通，重试在缺少可重放输入快照时显示禁用原因。
5. [x] P24-5 限流、额度和重试时间展示
   - 目标：把 provider 返回的 retry-after、quota、billing、rate limit 信息展示出来。
   - 具体动作：解析已知字段，显示剩余等待时间和建议。
   - 验收：限流错误不再只是普通红框。
   - 已完成：`ErrorSnapshot` 新增 `retryAfterMs` 自动推断（支持 `retry-after` / `retryAfterMs` / reset 字段），`ErrorCard` 已展示等待提示与额度/账单提示，smoke 已覆盖限流与额度提示断言。
6. [x] P24-6 模型拒答与安全拦截区分
   - 目标：区分模型拒答、本地权限拒绝、本地安全策略、provider safety。
   - 具体动作：分别展示来源、原因和用户可做动作。
   - 验收：用户能看出是模型不回答、工具没权限，还是 CCR 本地拦截。
   - 已完成：错误卡新增边界标签与解释提示，可区分模型拒答、Provider 安全策略、CCR 本地安全策略、工具权限拒绝；smoke 覆盖四类边界判断。
7. [x] P24-7 日志脱敏与复制诊断
   - 目标：错误详情可排查但不泄露 token、refresh token、cookie、路径敏感片段。
   - 具体动作：复用现有日志脱敏规则，提供复制安全诊断包。
   - 验收：复制诊断不包含常见 secret key。
   - 已完成：复制诊断包在写入剪贴板前会递归脱敏，覆盖 token、refresh token、cookie、authorization、secret key，以及 Windows / macOS / Linux 用户目录片段；smoke 已覆盖安全诊断包断言。
8. [x] P24-8 Fixture / Smoke / 文档收口
   - 目标：补 auth、rate limit、tool error、network、protocol、safety、unknown 的回归样例。
   - 验收：`typecheck`、`typecheck:desktop`、`build`、`desktop:build`、App Server/Display event smoke 通过。
   - 已完成：`smoke:desktop-display-events` 新增 P24 错误分类收口矩阵，覆盖 auth、rate limit、quota、tool、network、protocol、safety、unknown；收口验证已覆盖 `typecheck`、`build`、`smoke:app-server`、`smoke:desktop-display-events`、`desktop:build`、`git diff --check`，`typecheck:desktop` 仍停在仓库既有类型缺口。

## 后续记录（追加）

- 2026-05-18：修正 P22 已撤回但仍为未完成状态导致的 todo gate 歧义；完成 P24-3 错误分类映射器，分类器改为结构化线索优先、message 兜底，并补 `smoke:desktop-display-events` 覆盖 auth、rate limit、quota、model refusal、safety、tool、network、protocol、unknown；当前指针切到 P24-4 用户动作与恢复入口。
- 2026-05-18：完成 P24-4 用户动作与恢复入口；错误卡片从普通红框升级为结构化卡片，支持重新登录、打开日志页、打开模型页、复制脱敏诊断，暂不支持直接重试时展示禁用原因；已通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build`，`typecheck:desktop` 仍受仓库既有 MACRO / Bun / 可选依赖类型缺失影响。
- 2026-05-18：完成 P24-5 限流、额度和重试时间展示；`ErrorSnapshot` 会自动解析 retry-after/reset 并生成 `retryAfterMs`，错误卡新增等待提示和额度/账单提示，已通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build`。
- 2026-05-18：完成 P24-6 模型拒答与安全拦截区分；错误卡新增边界标签与说明，区分模型拒答、Provider 安全策略、CCR 本地安全策略、工具权限拒绝，已通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build`。
- 2026-05-18：完成 P24-7 日志脱敏与复制诊断；复制诊断包改为递归安全化后再复制，覆盖 token、refresh token、cookie、authorization、secret key 和用户目录路径片段，已通过 `npm.cmd run smoke:desktop-display-events`、`npm.cmd run typecheck`、`npm.cmd run desktop:build`、`git diff --check`。
- 2026-05-18：完成 P24-8 Fixture / Smoke / 文档收口；`smoke:desktop-display-events` 新增 P24 分类收口矩阵，覆盖 auth、rate limit、quota、tool、network、protocol、safety、unknown；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build`、`git diff --check`。`npm.cmd run typecheck:desktop` 仍失败在仓库既有 `MACRO` / `Bun` / 可选原生依赖类型缺失。
- 2026-05-18：完成 STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke；新增 `src/services/llm/fixtures/provider-output-fixtures.json` 和 `smoke:provider-output-fixtures`，覆盖 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的文本、工具调用、工具结果、附件、错误和历史恢复场景；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`git diff --check`。
- 2026-05-18：完成 STD-OUTPUT-03 生成型多模态输出设计第一版；标准内容块和 Desktop 附件快照支持模型生成物来源、生命周期、安全状态、provider/model/outputId，assistant 消息可展示模型生成图片；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run desktop:build`、`git diff --check`。
- 2026-05-18：完成 STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复第一版；新增生成物快照和 `generated_outputs/<sessionId>/<outputId>` 落盘工具，Desktop 生成物附件支持 `savedPath`、打开、定位、另存和复制路径，恢复清理会移除大 base64 payload，文本模型回放 image generation call 时保留 id 并清空 result；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run desktop:build`、`git diff --check`。
- 2026-05-18：完成 STD-OUTPUT-05 真实 provider 生成 API 接入第一版；新增 `OpenAiImageGenerationAdapter`、`OpenAiProvider.generateImage(...)`、runtime `generateImage(...)` 和 `smoke:generated-output-provider`，mock OpenAI 图片响应可落盘并进入 Desktop `ModelOutput/generated` 展示，resume 继续清理大 base64；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:llm-runtime`、`git diff --check`。本轮修正了 runtime smoke 写死默认 provider 数量的问题，后续新增 provider 时应同步验证 provider 列表。
- 2026-05-18：完成 STD-OUTPUT-06 OpenAI 生成路径数据一致性第一版；直接 Image API 与 Responses/Codex `image_generation_call` 共享 `normalizeOpenAiGeneratedImageOutputs(...)`，`gpt-5.5` 主模型触发的图片生成可保留主模型名并输出同形生成物快照；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。
- 2026-05-18：完成 STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入第一版；新增 `OpenAiResponsesImageGenerationAdapter` 和 `toOpenAiResponsesImageGenerationRequestBody(...)`，`OpenAiProvider.generateImage(...)` 可通过 metadata 显式切到 Responses `image_generation` 工具路径，返回的 `image_generation_call.result` 继续复用共享归一化和落盘策略；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:llm-runtime`。
- 2026-05-18：完成 STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入第一版；新增 `normalizeGeneratedImageOutputs(...)` 通用归一化层，OpenAI 和 MiniMax 都复用同一生成物模型；MiniMax 国际版 / 国内版接入原生 `POST /v1/image_generation`，支持 base64 落盘和 URL 临时引用，模型目录新增 `image-01` / `image-01-live`；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:generated-output-provider`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`。
- 2026-05-19：完成 STD-OUTPUT-09 会话流生成图片输出闭环第一版；新增 `CoreImageGenerationTurnRunner`、`turn/start options.imageGeneration`、Desktop 图片生成轻量入口和 `smoke:session-generated-image-flow`，普通会话可输出标准 `contentBlocks` / `generatedArtifact` 并由 Desktop 展示 `ModelOutput/generated`；补齐 OpenAI provider 长期接入文档，MiniMax 文档同步会话流入口；已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:session-generated-image-flow`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:turn-input`、`npm.cmd run smoke:generated-output-provider`、`git diff --check`。
- 2026-05-19：完成 STD-PROVIDER-01 Kimi / GLM Provider 接入第一版；新增 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` provider definition、默认配置、模型目录和 provider 壳，`kimi-api` / `glm-api` / `glm-coding` 复用公共 `OpenAiChatCompletionsAdapter`，`kimi-code` 复用 `AnthropicMessagesAdapter` 并落到 `https://api.kimi.com/coding/v1/messages`，四者保留独立 providerType、base URL、模型标识和凭据环境变量；新增 `smoke:kimi-glm-providers` 与 provider fixture，已通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:kimi-glm-providers`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:openai-chat-protocol`、`npm.cmd run smoke:deepseek-provider`、`npm.cmd run smoke:minimax-provider`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。
