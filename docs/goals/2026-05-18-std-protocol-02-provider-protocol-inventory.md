# Goal: STD-PROTOCOL-02 Provider 协议盘点与官方文档对照

## 目标

在继续实现 `CcrContentBlock` 或新增 provider 前，先把 CCR 需要对接的外部协议面完整列出来，并对照官方文档形成一份协议盘点矩阵。

这份文档回答：

- 当前和后续需要对接哪些 provider 协议。
- 每个协议在消息、内容块、多模态、工具、工具结果、结构化输出、reasoning、streaming、错误和能力发现上有什么差异。
- 哪些能力第一版必须做，哪些只登记为后续实现。
- 后续出现兼容问题时应更新哪一类协议点，而不是临时补丁。

## 迭代 1：协议面拆解

第一轮先按能力面拆：

1. 消息与角色协议。
2. 内容块与多模态输入。
3. 文件上传和文件引用。
4. 工具定义、工具调用、工具结果。
5. strict / structured output / JSON mode。
6. reasoning / thinking / effort。
7. streaming。
8. usage / token / context。
9. 错误、限流、认证、finish reason。
10. 模型能力发现和 gateway profile 覆盖。

## 迭代 2：Provider 范围收紧

第二轮按当前项目真实范围收敛，不把所有 AI API 都塞进第一版。

本次盘点覆盖：

- OpenAI Responses。
- OpenAI Chat Completions。
- Anthropic Messages。
- Gemini GenerateContent。
- DeepSeek Chat Completions / DeepSeek Anthropic-compatible。
- MiniMax Anthropic-compatible。
- OpenRouter / Vercel AI Gateway 这类 gateway 能力目录和 OpenAI-compatible 路由。

本次不做：

- 不实现代码。
- 不接入新 provider。
- 不做 SDK 选择。
- 不打包、不发布。

## 验收标准

- [x] 有一份独立文档列出所有协议点和官方文档来源。
- [x] 能看出哪些是必须实现，哪些是 profile / probe / 后续任务。
- [x] 能看出 OpenAI / Anthropic / Gemini / DeepSeek / MiniMax / Gateway 的字段差异。
- [x] `git diff --check` 通过。

## 完成后下一步

后续 `STD-DISPLAY-01 CcrContentBlock` 和 `P24 ErrorSnapshot` 要从这份盘点文档中抽取第一批实现项。

## 结果

- 新增：[CCR Provider 协议盘点与官方文档对照](../architecture/provider-protocol-inventory-and-official-docs.md)。
- 覆盖协议族：OpenAI Responses、OpenAI Chat Completions、Anthropic Messages、Gemini GenerateContent、DeepSeek OpenAI / Anthropic compatible、MiniMax OpenAI / Anthropic compatible、OpenRouter、Vercel AI Gateway。
- 覆盖协议面：endpoint、认证、模型目录、消息角色、内容块、多模态、文件 API、工具定义 / 调用 / 结果、structured output、reasoning / thinking、streaming、usage、finish reason、错误、限流、输出媒体和历史恢复。
