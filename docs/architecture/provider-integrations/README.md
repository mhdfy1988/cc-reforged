# CCR Provider 接入文档

这里记录 CCR 每个内置 LLM 供应商的长期接入方案。它不是阶段 todo，也不是某一轮 goal；后续实现者应能从这里看懂一个 provider 的认证、协议、模型能力、请求链路和验证方式。

## 文档关注

- 供应商 ID、协议和认证方式
- Profile 与凭据如何落盘
- 请求链路如何进入统一 LLM Runtime
- 文本、工具、图片、文件等不同能力分别走哪个协议
- raw response 如何映射到 CCR 标准内容块
- smoke 覆盖了哪些关键不变式

## 当前文档

| 供应商 | 文档 |
| --- | --- |
| Codex OAuth | [codex-oauth.md](./codex-oauth.md) |
| DeepSeek | [deepseek.md](./deepseek.md) |
| GLM 通用 API / Coding Plan | [glm.md](./glm.md) |
| Kimi API / Kimi Code | [kimi.md](./kimi.md) |
| MiniMax 国际版 / 国内版 | [minimax.md](./minimax.md) |
| OpenAI | [openai.md](./openai.md) |
| OpenAI Chat 兼容说明 | [openai-chat-compatible-notes.md](./openai-chat-compatible-notes.md) |

## 能力分类

| 能力 | 总体标准 | 单厂商接入记录 |
| --- | --- | --- |
| 模型与 Profile | [多供应商模型与协议接入设计](../multi-provider-model-management-design.md) | 各 provider 文档 |
| 协议盘点 | [Provider 协议盘点与官方文档对照](../provider-protocol-inventory-and-official-docs.md) | 各 provider 文档 |
| 工具调用 | [Provider 工具协议统一化标准](../provider-tool-protocol-normalization.md) | 各 provider 文档 |
| 多模态输入输出 | [多模态输入输出设计](../multimodal-input-output-design.md) | 各 provider 文档 |
| 生成物展示 | [模型输出归一化与展示标准](../model-output-normalization-and-display-standard.md) | 各 provider 文档 |

## 新增供应商规则

新增供应商时，优先在本目录新增同名文档，并同步补对应 smoke。公共协议差异先落在 adapter，再由具体 provider 只保留供应商差异。

单厂商文档至少包含：

1. 供应商 ID、地区或环境边界。
2. 文本 / 工具 / 图片 / 文件等能力的协议入口。
3. 默认模型、模型能力和模型目录约束。
4. Profile、凭据和环境变量优先级。
5. 请求链路、adapter、runtime 注册点。
6. raw provider response 到 CCR 标准结构的映射。
7. smoke 覆盖的不变式和已知边界。

如果某能力只是阶段探索结果，先记入 `../../goals/`；一旦它会影响长期实现策略，就同步沉淀回本目录或上层 architecture 标准文档。
