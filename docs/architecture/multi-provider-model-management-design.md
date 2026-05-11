# CCR 多供应商模型与协议接入设计

## 1. 目标

这份文档沉淀 CCR 后续“多供应商模型接入”的产品和技术边界。

它覆盖两条线：

- Core 侧：多供应商、多协议、多认证方式、多模型目录和能力归一化。
- Desktop 侧：模型与供应商配置页、当前模型快速切换、连接测试和状态展示。

多模态输入/输出、附件上传、图片预览和文件内容发送不在本文展开，单独进入 [CCR 多模态输入输出设计](./multimodal-input-output-design.md)。本文只定义 provider/profile 的能力声明，例如 `vision`、`multimodalInput`、`fileInput`，供多模态专项判断当前模型是否可用。

这不是单纯给前台加几个模型选项，而是把 CCR 的 LLM Runtime 从“已有 `anthropic` / `codex-oauth` 原型”推进到“可管理多个模型配置档案”的阶段。

## 2. 关键结论

1. Desktop 打开后不强制先配置模型，默认直接进入应用。
2. 如果没有可用模型配置，在聊天区显示轻量引导卡片，而不是启动拦截向导。
3. 左侧导航新增一级菜单“模型”，页面标题为“模型与供应商”。
4. 顶部当前模型胶囊保留，用于快速切换当前应用模型。
5. 完整供应商、协议、密钥、模型目录管理放在“模型”一级页面里，不塞进顶部下拉。
6. 会话不绑定模型；模型是应用级当前运行态选择。
7. 每轮消息记录实际使用的 provider/model/protocol，作为审计、成本统计和排查依据，但恢复历史会话时不自动切换模型。
8. 启动时只做本地轻量可用性判断，真实网络检测只在“测试连接”或“发送消息”时触发。
9. 第三方中转是一级配置档案，不靠伪装 OpenAI 或临时环境变量绕过。

## 3. 参考经验

CC Switch 的核心经验值得吸收，但不能照搬它对外部 CLI 配置文件的写法。

可借鉴点：

- 用配置档案管理多个供应商 / endpoint。
- 提供快速切换，不要求用户手改配置文件。
- 提供连接测试，而不是只保存配置。
- 支持导入、导出、复制、回滚、上一个配置等操作。
- 对第三方中转、社区 relay、自定义 endpoint 给一等入口。

不照搬点：

- CCR 有自己的 Core LLM Runtime，不应通过改外部 `settings.json` 来切模型。
- CCR 的上层 Query / Tool 主循环应只依赖自己的 `LlmRuntime` 和 adapter。
- CCR 要把 protocol 作为一等对象，而不是只按 provider 名称分支。

参考资料：

- [HoBeedzc/cc-switch](https://github.com/HoBeedzc/cc-switch)
- [CC Switch 官网](https://ccswitch.ai/)
- [New API 的 CC Switch 说明](https://docs.newapi.ai/en/docs/apps/cc-switch)

## 4. 核心概念

### 4.1 模型配置档案

前台和配置层的核心对象不是裸 `provider/model`，而是“模型配置档案”。

示例：

```json
{
  "id": "newapi-work",
  "name": "NewAPI 工作账号",
  "providerType": "openai-compatible",
  "apiMode": "openai-chat-completions",
  "baseUrl": "https://example.com/v1",
  "auth": {
    "strategy": "api-key",
    "secretRef": "newapi-work-key"
  },
  "defaultModel": "deepseek-chat",
  "models": ["deepseek-chat", "claude-sonnet-4.5"],
  "capabilities": {
    "streaming": true,
    "tools": true,
    "vision": false,
    "structuredOutput": false,
    "reasoning": false
  },
  "availability": {
    "status": "verified",
    "lastCheckedAt": "2026-05-10T00:00:00.000Z"
  }
}
```

档案解决的问题：

- 用户能给中转、官方 API、本地模型起可读名字。
- 同一个供应商可以有多个 endpoint。
- 同一个 endpoint 可以有默认模型和可选模型列表。
- 可用性、测试结果、失败原因可以挂到档案上。
- 顶部快速切换时切的是明确档案，而不是隐含环境变量。

### 4.2 Provider 与 Protocol 分离

`provider` 表示供应商或配置档案类型，`apiMode` / `protocol` 表示调用协议。

建议最小枚举：

```ts
type LlmApiMode =
  | 'anthropic-messages'
  | 'openai-responses'
  | 'openai-chat-completions'
  | 'openai-compatible'
  | 'codex-oauth'
  | 'custom'
```

同一个 provider 可能支持多个协议。例如官方 OpenAI 可以走 `Responses API`，也可以保留 `Chat Completions` 兼容模式；第三方中转可能只支持 `Chat Completions`，也可能支持 `Responses API`。

### 4.3 第三方中转

第三方中转应作为一等配置档案：

- `providerType = openai-compatible`
- `baseUrl` 必填
- `apiMode` 显式选择 `openai-responses` 或 `openai-chat-completions`
- `model` 默认透传，不强行映射成官方模型名
- 支持自定义 headers
- 支持声明能力差异
- 支持测试连接和错误归一化

它不应该只是“OpenAI 的一个 key”，因为中转可能有不同的限流、错误码、工具调用兼容程度和模型命名方式。

## 5. Core 侧设计

### 5.1 分层

Core 侧建议拆成：

```text
Provider Profile
-> Protocol Adapter
-> Credential Resolver
-> Model Catalog
-> Capability Resolver
-> LlmRuntime
-> Claude/Core Adapter
-> Query / Tool 主循环
```

职责：

- Provider Profile：保存用户配置档案。
- Protocol Adapter：负责 Responses / Chat Completions / Anthropic Messages / Codex OAuth 等协议差异。
- Credential Resolver：把本地密钥、OAuth token、自定义 header 解析成请求凭据。
- Model Catalog：提供模型列表、上下文窗口、能力和展示名。
- Capability Resolver：判断当前模型是否支持 tools、vision、structured output、reasoning 等。
- LlmRuntime：选择 provider/profile/model 并发起调用。
- Claude/Core Adapter：把现有 Core 消息、工具和流式事件映射到统一 LLM Runtime。

### 5.4 协议适配器复用原则

多供应商不等于多套协议代码。CCR 后续新增供应商时，优先判断它能复用哪一种协议适配器：

```text
DeepSeek / Kimi / Qwen / NewAPI / OneAPI / relay
-> OpenAI Chat Completions Adapter
-> LlmRuntime event
```

供应商 provider 只负责：

- 供应商 id、展示名和默认模型。
- baseUrl 和 API Key / OAuth / custom headers 来源。
- 模型目录和能力声明。
- 少量供应商差异，例如 DeepSeek 的 `thinking`、`reasoning_content`。

协议适配器负责：

- `messages` 请求结构。
- `tools` / `tool_choice` 请求结构。
- `tool_calls` 响应解析。
- SSE 流式解析。
- text / thinking / tool_call 归一化。
- usage 和 stop reason 归一化。
- HTTP 错误信息归一化。

因此，新增一个 OpenAI Chat Completions 兼容供应商时，默认不再复制 `messages/tools/stream/usage` 映射逻辑，而是新增 provider 壳和必要 quirks。

### 5.2 不变式

- 上层 Query / Tool 主循环不直接依赖某个第三方 SDK。
- 新协议只增加 adapter，不改核心消息语义。
- API Key、OAuth token、自定义 header 不入仓。
- 供应商配置和凭据引用分离。
- 每次请求最终都能落到统一的 runtime event、usage 和错误分类。

### 5.3 第一版支持范围

第一版建议只做：

- 现有 `codex-oauth` 保持可用。
- DeepSeek 官方 API，作为第一条 OpenAI Chat Completions 兼容协议落地链路。
- 官方 OpenAI API。
- OpenAI Compatible / 第三方中转。
- 顶部快速切换。
- Desktop 模型一级页面。
- 测试连接。
- 每轮记录实际使用的 provider/profile/model/apiMode。

暂缓：

- Ollama / LM Studio。
- Azure OpenAI。
- AWS Bedrock。
- Gemini。
- 自动按能力选模型。
- 多账号自动轮换。

这些都应留扩展点，但不要第一版一起做。

## 6. 可用性判断

“可用”不能只靠配置文件里写了 provider/model，也不能在启动时强制真实请求。

建议状态：

```ts
type ProviderAvailability =
  | 'not_configured'
  | 'needs_auth'
  | 'configured'
  | 'auth_ready'
  | 'verified'
  | 'failed'
```

含义：

- `not_configured`：缺 provider、model、baseUrl 等关键配置。
- `needs_auth`：缺 API Key、OAuth 登录态或必要 header。
- `configured`：配置完整，但还没做过真实连接测试。
- `auth_ready`：本地凭据看起来可用，例如 token 未过期或 refresh token 存在。
- `verified`：最近一次测试连接成功。
- `failed`：最近一次测试连接失败。

启动 Desktop 时只做：

- 读取本地配置。
- 校验字段完整性。
- 校验凭据是否存在。
- 对 OAuth 判断 token 过期时间或 refresh token 是否存在。
- 不发真实模型请求。

真实网络检测只发生在：

- 用户点击“测试连接”。
- 用户实际发送消息。

这样可以避免启动慢、浪费额度、第三方中转不稳定导致 App 看起来坏掉。

## 7. 会话与模型关系

最终规则：

```text
会话不绑定模型。
模型是应用级当前选择。
恢复历史会话不自动切换模型。
每轮消息记录实际使用的模型，只用于审计和排查。
```

示例：

```text
当前应用模型：OpenAI Compatible / deepseek-chat

打开会话 A -> 使用 deepseek-chat
打开会话 B -> 仍使用 deepseek-chat
切换到 Codex OAuth / gpt-5.4
打开会话 A -> 继续使用 gpt-5.4
新建会话 -> 使用 gpt-5.4
```

每轮消息可以记录：

```json
{
  "providerProfileId": "codex-oauth-default",
  "providerType": "codex-oauth",
  "apiMode": "codex-oauth",
  "model": "gpt-5.4"
}
```

这条记录不参与恢复时自动切换，只用于：

- 历史审计。
- 成本统计。
- 错误排查。
- 展示“本轮由哪个模型回答”。

## 8. Desktop 侧设计

### 8.1 左侧一级菜单

左侧导航建议：

```text
聊天
模型
MCP
日志

设置
```

“模型”是一级菜单，不只放在“设置”里。原因是模型会直接影响下一轮对话，不是低频偏好设置。

页面标题：

```text
模型与供应商
```

页面职责：

- 查看当前应用模型。
- 切换当前应用模型。
- 管理多个模型配置档案。
- 配置官方 OpenAI、OpenAI Compatible / 第三方中转、Codex OAuth。
- 测试连接。
- 设置默认模型。
- 查看上次测试状态和失败原因。

### 8.2 顶部快速切换

顶部当前模型胶囊保留，例如：

```text
Codex OAuth · gpt-5.4
```

点击后只做快速切换：

- 显示已配置档案。
- 支持切换当前应用模型。
- 支持跳转到“模型与供应商”完整页面。
- 不展示 API Key、baseUrl、自定义 header 等复杂配置。

### 8.3 设置页关系

“设置”页不承载完整 provider 管理，只放摘要入口：

```text
模型与供应商
当前：Codex OAuth / gpt-5.4
[打开]
```

这样既符合用户在设置里找配置的直觉，也避免模型配置被藏得太深。

### 8.4 首次打开体验

不做启动拦截向导。

流程：

```text
打开 Desktop
-> 进入聊天页
-> 读取当前模型配置
-> 有 configured / auth_ready / verified：允许聊天
-> not_configured / needs_auth：聊天区显示配置引导卡
```

引导卡示例：

```text
还没有可用模型

配置一个供应商后开始使用。
[配置 Codex OAuth] [配置 OpenAI API] [配置第三方中转]
```

## 9. 切换与回滚

切换模型时：

- 只改变应用级当前选择。
- 从下一轮消息开始生效。
- 不修改历史会话绑定。
- 如果新配置测试失败，提示用户但不破坏旧配置。
- 保留上一个可用配置，支持一键回退。

建议保留：

- 上一个配置档案。
- 当前配置档案。
- 切换历史。
- 删除前确认。
- 复制配置。
- 导出 / 导入配置。

密钥导出策略：

- 默认导出不含密钥。
- 后续可以支持加密导出。

## 10. 后续实施顺序

建议拆成：

1. 设计收口：确定 Profile、apiMode、availability、per-turn metadata。
2. Core 配置模型：扩展 `llmConfig`、provider definition、model catalog。
3. Protocol Adapter：新增 OpenAI Responses / Chat Completions adapter。
4. Provider：实现官方 OpenAI 和 OpenAI Compatible。
5. Desktop 一级“模型”页面：档案列表、详情、测试连接。
6. 顶部快速切换：只切当前应用模型。
7. 每轮 metadata：记录实际 provider/profile/model/apiMode。
8. Smoke：离线配置 smoke、provider smoke、可选真实 e2e。

## 11. 验收标准

- Desktop 左侧出现一级“模型”页面。
- 打开 Desktop 不强制配置模型。
- 无模型配置时，聊天区出现引导卡。
- 顶部模型胶囊可以快速切换当前应用模型。
- 会话恢复不改变当前应用模型。
- 每轮消息能记录实际使用的 provider/profile/model/apiMode。
- OpenAI API 和 OpenAI Compatible 至少各有一个可配置档案。
- 第三方中转支持 baseUrl、apiMode、API Key、自定义 header 和模型名透传。
- 启动时不自动发真实模型请求。
- “测试连接”能更新 availability 状态。
- `codex-oauth` 现有链路不回归。
- `npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、LLM runtime smoke 和 provider smoke 通过。

## 12. DeepSeek 第一版落地口径

DeepSeek 先作为独立供应商进入 Core，而不是临时伪装成 OpenAI 或 Codex OAuth。

官方文档口径：

- OpenAI 格式基础地址：`https://api.deepseek.com`
- Chat Completions 入口：`/chat/completions`
- 当前模型：`deepseek-v4-flash`、`deepseek-v4-pro`
- 上下文窗口：`1M`
- 最大输出：`384K`
- 默认 thinking 开启，通过 `thinking: { type: "enabled" | "disabled" }` 控制
- 工具调用通过 OpenAI Chat Completions 的 `tools` / `tool_calls` 结构承载

第一版代码行为：

- provider id：`deepseek`
- apiMode：`openai-chat`
- authStrategy：`api_key`
- API Key 来源：`CCR_DEEPSEEK_API_KEY`，兼容 `DEEPSEEK_API_KEY`
- baseUrl 来源：默认 `https://api.deepseek.com`，可用 `CCR_DEEPSEEK_BASE_URL` 或 `DEEPSEEK_BASE_URL` 覆盖
- 模型目录内置 `deepseek-v4-flash` 和 `deepseek-v4-pro`
- 支持文本、thinking、工具调用、usage 和流式 SSE 归一化
- DeepSeek provider 已瘦身为供应商壳，协议公共逻辑已上移到 `OpenAiChatCompletionsAdapter`

暂缓项：

- 不把 DeepSeek API Key 写入普通 `llm.config.local.json`
- 不实现独立“测试连接”按钮，等 MP-07 统一做 availability
- 不做 DeepSeek 图片/多模态能力，交给多模态专项
- 不支持旧别名 `deepseek-chat` / `deepseek-reasoner` 作为默认选项，避免新接入一开始就走即将迁移的口径
