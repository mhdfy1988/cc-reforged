# Goal: STD-PROTOCOL-01 CCR 标准 LLM 协议文档

## 目标

补一份 CCR 自己的标准协议文档，用来回答“多模型、多 provider、多模态、工具调用、错误展示到底以什么结构为准”。

该文档不是把 OpenAI、Anthropic、Gemini、DeepSeek 任意一家当作标准，而是定义 CCR 内部协议：

- Provider 原始协议只允许进入 provider adapter。
- Core / App Server / Desktop 之间优先消费 CCR 标准消息、内容块、工具调用、工具结果和错误快照。
- 新 provider 接入时，先写 provider 方言映射，再映射到 CCR 标准协议。

## 迭代 1：目标拆解

第一轮先把文档要解决的问题拆清楚：

1. 明确“内部标准协议”和“外部 provider 方言”不是同一层。
2. 明确 CCR 标准协议第一版包含：
   - 消息信封。
   - 内容块。
   - 工具定义。
   - 工具调用。
   - 工具结果。
   - 模型能力。
   - Provider 工具协议 profile。
   - 错误快照。
3. 明确当前已实现字段和后续待实现字段。
4. 给出 OpenAI Chat、OpenAI Responses、Anthropic、Gemini、DeepSeek 的方言映射表。
5. 明确协议更新规则：后续出问题先更新协议文档，再改 adapter / UI。

## 迭代 2：边界收紧

第二轮把本次范围收窄到文档，不扩散到代码重构。

本次只做：

- 新增 `CCR 标准 LLM 协议 v0.1` 文档。
- 在已有 Provider 工具协议、多模态、输出归一化文档中挂引用。
- 更新 `CHANGELOG.md` 的未发布说明。

本次不做：

- 不抽 `CcrContentBlock` 代码类型。
- 不重写 provider adapter。
- 不做 ErrorSnapshot UI。
- 不新增 provider。
- 不打包、不发布。

## 验收标准

- 能从文档上明确看出 CCR 不是以某一家 provider 为标准。
- 能看到 CCR 标准消息、内容块、工具和错误的字段定义。
- 能看到外部 provider 到 CCR 标准协议的映射口径。
- 能看到协议版本、兼容规则和更新流程。
- `git diff --check` 通过。

## 完成后下一步

文档完成后，后续 `STD-DISPLAY-01 CcrContentBlock 共享类型` 应以该协议文档为准，把当前散落的内容块口径收成代码层共享类型。

## 执行结果

状态：已完成文档落地。

已完成：

- 新增 [CCR 标准 LLM 协议 v0.1](../architecture/ccr-standard-llm-protocol.md)。
- 明确 CCR 不以 OpenAI / Anthropic / Gemini / DeepSeek 任意一家原始协议为标准。
- 定义标准消息信封、内容块、工具定义、工具调用、工具结果、模型能力、Provider 工具 profile、错误快照。
- 补充 OpenAI Chat / DeepSeek、OpenAI Responses、Anthropic Messages、Gemini 到 CCR 标准协议的映射总表。
- 在多模态、输出展示、Provider 工具协议三份文档中增加标准协议引用。
- 更新 `CHANGELOG.md` 未发布说明。

已完成验证：

- `git diff --check`

未做：

- 未改运行代码。
- 未抽 `CcrContentBlock` 共享代码类型。
- 未打包、未发布。
