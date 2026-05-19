# CCR LLM Provider 与多模态协议长期路线图

更新时间：2026-05-19

## 1. 路线图目标

CCR 的长期目标不是“多接几个模型”，而是建立一套可持续扩展的多模型、多 provider、多模态输入输出协议体系。

最终希望达到：

1. 新 provider 接入时，只补 provider 壳、模型能力、协议差异、fixture 和 smoke，不改 Core / Desktop 的业务结构。
2. 文本、流式、工具、thinking、结构化输出、图片输入、文件输入、模型生成图片、音频、文件等能力都有统一协议面。
3. Desktop 和历史恢复只消费 CCR 标准结构，不直接消费任何 provider 原始响应。
4. 每个 provider 的接入程度、已验证模型、缺口和风险都能在文档中查到。
5. 真实联网 probe、mock smoke、fixture smoke、Desktop 展示 smoke 分层，不让本地日常验证依赖外部 API 稳定性。

相关文档：

- [CCR 协议统一化接入状态总账](./protocol-implementation-status.md)
- [CCR 标准 LLM 协议](./ccr-standard-llm-protocol.md)
- [CCR Provider 协议盘点与官方文档对照](./provider-protocol-inventory-and-official-docs.md)
- [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)
- [Provider 能力工具化后续方向](./provider-capability-tools-future.md)
- [CCR 多模态输入输出设计](./multimodal-input-output-design.md)
- [CCR 模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)
- [供应商接入文档](./provider-integrations/README.md)

## 2. 长期能力地图

| 能力域 | 长期目标 | 当前状态 | 关键缺口 |
| --- | --- | --- | --- |
| Provider / Profile | 多供应商、多账号、多 endpoint、多模型配置档案统一管理 | Profile、凭据隔离、模型页、顶部切换已落地第一版 | Gateway / relay 的能力覆盖和 probe 还不完整 |
| 文本生成 | 所有文本 provider 都走 `LlmProvider.generate(...)` | OpenAI、Codex OAuth、DeepSeek、MiniMax 已接；Kimi API / Kimi Code / GLM API / GLM Coding 待接 | Anthropic 官方 provider、Gemini adapter、Gateway profile |
| 流式输出 | provider delta 统一成 `LlmGenerateEvent` | OpenAI Chat compatible、MiniMax、Codex OAuth 已有流式入口 | Gemini streaming、Responses typed event 通用化 |
| 工具调用 | 不同 provider 的 tool schema、tool call、tool result 都映射为 CCR 标准工具协议 | OpenAI-style 和 Anthropic-style 第一版已落地 | Gemini `functionCall/functionResponse`、deferred/parallel 细节 |
| Thinking / Reasoning | 推理强度、thinking block、redacted thinking 按模型能力显式声明 | DeepSeek、MiniMax、OpenAI/Codex 部分已有映射 | MP-13 推理强度能力目录和 Profile 覆盖 |
| 历史校验 | 发送前按 provider profile 修复或阻断非法历史 | OpenAI-compatible / DeepSeek 已覆盖悬空 tool call / 孤立 tool result | Anthropic、Gemini、Responses 的完整回放规则 |
| 多模态输入 | 文本、图片、文件、音频、视频输入在 App Server / Core / provider adapter 中统一表达 | 文本、图片、附件元数据和 Desktop 展示已落地第一版 | 文件、音频、视频真实发送闭环 |
| 生成型多模态输出 | 模型生成图片、音频、文件、视频都走 `generatedArtifact` 生命周期 | 图片生成、落盘、恢复轻量化、Desktop 展示已落地 | 图生图、图片编辑、音频生成、文件生成、生命周期清理 |
| Provider 能力工具化 | 主推理模型可通过受控工具调用同供应商或显式配置的能力模型补视觉、图片生成等能力 | 已记录为后续方向，不进入当前发布主线 | 需要先完成已接 provider 成熟化、真实 probe、Desktop 数据边界展示 |
| 结构化输出 | JSON mode、JSON schema、tool-as-structured-output 有统一 schema profile 和 Desktop 视图 | `structured` 内容块入口已有 | provider profile、UI 视图、smoke 未收口 |
| 错误与安全 | provider 错误、限流、额度、安全拦截、模型拒答、工具错误统一成 `ErrorSnapshot` | P24 第一版已落地 | provider-specific request id、账单细节、安全诊断扩展 |
| 展示与恢复 | Desktop 只展示 CCR 标准内容块，恢复 payload 不携带 provider 大原文 | DisplayEvent、contentBlocks、generatedArtifact 已落地 | structured/audio/video/file 视图继续补 |
| 验证体系 | 每个 provider 有文档、fixture、smoke、真实 probe 记录 | provider fixture 和多类 smoke 已有第一版 | 新 provider 必填清单和 conformance matrix 需要常态化 |

## 3. Provider 覆盖目标

### 3.1 当前可真实验证优先组

这些 provider 有现实验证价值，应优先完成内置接入和回归矩阵：

| Provider | 协议族 | 当前定位 | 长期目标 |
| --- | --- | --- | --- |
| `codex-oauth` | Codex / ChatGPT backend | 已接文本和流式，图片生成 runtime 未独立接 | 稳定作为 Codex OAuth 主链路，补工具 fixture、模型能力和回放规则 |
| `deepseek` | OpenAI Chat compatible | 已落地第一版 | 作为 OpenAI Chat compatible 基准 provider，持续覆盖 thinking / tools / history repair |
| `minimax` / `minimax-cn` | Anthropic Messages compatible + MiniMax image_generation | 已落地文本和图片生成第一版 | 作为 Anthropic-compatible 和原生图片生成双协议样板 |
| `kimi-api` | OpenAI Chat compatible | 已落地第一版 | Kimi 开放平台通用 API，不伪装 OpenAI；覆盖文本、stream、tools、错误 |
| `kimi-code` | Anthropic Messages compatible | 已落地第一版 | Kimi Code 专用 provider，请求 `model` 字段固定为统一模型标识 `kimi-for-coding`，表达会员权益和工具环境边界 |
| `glm-api` | OpenAI Chat compatible | 文档就绪 / 待实现 | GLM 通用 API provider，覆盖 thinking、tools、多模态能力声明 |
| `glm-coding` | OpenAI Chat compatible | 文档就绪 / 待实现 | GLM Coding Plan 专用 provider，使用 Coding API 端点和对应订阅权益 |

### 3.2 协议族补齐组

这些 provider 或协议族不一定当前有 key，但决定 CCR 的长期协议覆盖面：

| Provider / 协议族 | 当前定位 | 长期目标 |
| --- | --- | --- |
| 官方 OpenAI | 已有文本和图片生成链路 | 对齐 OpenAI Chat、Responses、Images、结构化输出和生成工具 |
| 官方 Anthropic | 部分落地 / 暂无真实 key | 用 fixture/mock 先完成标准 adapter，后续有 key 再联网 probe |
| Gemini GenerateContent | 文档和 fixture 级 | 完成 `contents.parts`、`functionCall`、`functionResponse`、文件/图片输入 |
| OpenAI-compatible / Gateway | 部分落地 | 支持 NewAPI、OneAPI、OpenRouter、Vercel AI Gateway、自定义 relay，不靠模型名猜能力 |

### 3.3 生成型多模态扩展组

这些不是单个 provider 问题，而是输出生命周期问题：

| 输出类型 | 长期目标 | 第一批候选 |
| --- | --- | --- |
| 图片生成 | 已落地文本生图；后续补图生图和编辑 | OpenAI、MiniMax |
| 音频生成 | 统一落盘、播放、恢复、安全状态 | OpenAI / 其他支持音频生成的 provider |
| 文件生成 | 统一保存、打开、复制路径、恢复轻量化 | 代码文件、文档、表格类输出 |
| 视频生成 | 先定义生命周期和展示，不急于接真实 API | 后续独立专项 |

## 4. 阶段路线图

### L0 已完成基线

目标：建立多 provider 和多模态协议的基础骨架。

已完成：

- Profile / 凭据隔离。
- provider runtime。
- OpenAI Chat 和 Anthropic Messages 公共 adapter。
- 模型能力目录。
- 工具协议 profile。
- 历史校验第一版。
- `CcrContentBlock`、`DisplayEvent`、`ErrorSnapshot`。
- 生成图片、生成物落盘、恢复轻量化。
- provider fixture 和展示 smoke 第一版。

### L1 当前可验证 provider 补齐

目标：先把当前手里能真实验证的 provider 补齐，形成 OpenAI Chat compatible 和 Anthropic Messages compatible 的多厂商样板。

执行项：

1. `MP-06c` Kimi API provider。
2. `MP-06d` Kimi Code provider。
3. `MP-06e` GLM API provider。
4. `MP-06f` GLM Coding Plan provider。
5. 回归 Codex OAuth、DeepSeek、MiniMax。
6. 更新协议总账和 provider 文档。

当前阶段 Goal：

- [2026-05-19 STD-PROVIDER-01 Kimi / GLM Provider 接入](../goals/2026-05-19-std-provider-01-kimi-glm-openai-chat-compatible.md)

### L2 OpenAI-compatible / Gateway 能力覆盖

目标：把自定义 endpoint、中转、网关作为一等 Profile，而不是临时改 base URL。

执行项：

1. `MP-06g` OpenAI-compatible / Gateway profile 能力覆盖。
2. Profile capability override。
3. provider probe 和 conformance fixture。
4. OpenRouter / Vercel AI Gateway / NewAPI / OneAPI 差异记录。

验收重点：

- 不靠模型名猜工具、多模态、structured output。
- Desktop 模型页能展示 profile 能力来源。
- 真实 probe 与默认 smoke 分离。

### L3 协议族补齐

目标：补齐非 OpenAI Chat compatible 的主流协议族。

执行项：

1. 官方 Anthropic provider 标准化。
2. Gemini GenerateContent adapter。
3. Anthropic / Gemini 历史校验规则。
4. 多模态输入在 Gemini / Anthropic 的真实发送边界。

验收重点：

- Anthropic `tool_use/tool_result` 不再依赖 transition metadata。
- Gemini `functionCall/functionResponse` 能进入标准工具协议。
- provider raw response 不进入 Desktop。

### L4 Structured Output 产品化

目标：让结构化输出成为可声明、可验证、可展示的能力。

执行项：

1. 定义 `structured` 内容块和 JSON schema 的关系。
2. 区分 JSON mode、JSON schema、tool-as-structured-output。
3. 增加 provider schema profile。
4. Desktop 增加结构化视图和复制/展开能力。
5. 补 fixture 和 smoke。

### L5 生成型多模态输出第二阶段

目标：把图片之外的模型生成物纳入同一生命周期。

执行项：

1. 图生图 / 图片编辑。
2. 音频生成。
3. 文件生成。
4. 视频生成协议预留。
5. 生成物安全扫描、生命周期清理和媒体库。

验收重点：

- 所有生成物先落为 `generatedArtifact`，再进入 Desktop。
- thread resume 不回灌大 payload。
- 文本模型回放按能力决定是否带生成结果。

### L6 验证、可观测与发布硬化

目标：让多 provider 接入进入可长期维护状态。

执行项：

1. Provider conformance matrix。
2. 每个 provider 的 fixture、mock smoke、真实 probe 记录。
3. 错误、限流、quota、request id、账单提示补强。
4. 模型页显示 provider 健康状态、能力来源和最近 probe 结果。
5. 发布前回归清单和文档收口。

### L7 Provider 能力工具化

目标：在多 provider、多模态基础稳定后，把视觉识别、图片生成等能力包装成受控工具，让强推理主模型可以调用辅助能力模型。

执行原则：

1. 第一阶段默认只允许同供应商内部调用，例如 `glm-api / glm-5.1` 调用 `glm-api / glm-5v-turbo` 和 `glm-api / glm-image`。
2. 第二阶段才允许显式跨供应商能力路由，例如主模型用 DeepSeek，视觉工具用 Kimi，图片生成用 GLM 或 MiniMax。
3. 跨供应商必须由用户或 Profile 明确配置，不能静默自动选择。
4. Desktop、日志、历史恢复和错误快照必须记录实际调用的 provider/model。
5. 该方向不进入当前发布版本，详见 [Provider 能力工具化后续方向](./provider-capability-tools-future.md)。

## 5. 当前执行原则

1. 当前主线仍然是 `STD-PROVIDER-01`，因为它是 L1 的第一步。
2. Kimi / GLM 不是长期目标本身，只是验证 OpenAI Chat compatible 多厂商接入的第一组样板。
3. Anthropic / Gemini 不取消，只是因为当前缺真实 key 或需要单独协议族，放到 L3。
4. 结构化输出、音频、文件、视频不抢当前 provider 接入主线，放到 L4 / L5。
5. Provider 能力工具化作为 L7 后续方向保留，当前只记录设计，不进入 `STD-PROVIDER-02` 实施范围。
6. 每完成一个阶段，都要回写：
   - 协议总账。
   - 对应 provider 文档。
   - stage todo 当前指针。
   - goal 验证记录。

## 6. 当前下一步

短期：

1. 实现 Kimi API / Kimi Code provider。
2. 实现 GLM API / GLM Coding provider。
3. 回归 Codex OAuth / DeepSeek / MiniMax。

中期：

1. 做 OpenAI-compatible / Gateway profile 能力覆盖。
2. 补 Anthropic 官方 provider fixture/mock 标准化。
3. 补 Gemini GenerateContent adapter。

长期：

1. Structured Output 产品化。
2. 图生图、音频生成、文件生成和生成物生命周期治理。
3. Provider conformance matrix 和发布前回归体系。
4. Provider 能力工具化：先同供应商能力工具，再显式跨供应商能力路由。
