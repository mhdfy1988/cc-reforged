# CCR 多供应商模型与协议接入设计

工具调用协议的统一化规则单独见 [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)。本文负责 provider、profile、模型能力和协议接入边界；不要在各工具里为每个 provider 单独写一套工具格式适配。

## 1. 目标

这份文档沉淀 CCR 后续“多供应商模型接入”的产品和技术边界。

它覆盖两条线：

- Core 侧：多供应商、多协议、多认证方式、多模型目录和能力归一化。
- Desktop 侧：模型与供应商配置页、当前模型快速切换、连接测试和状态展示。

多模态输入/输出、附件上传、图片预览和文件内容发送不在本文展开，单独进入 [CCR 多模态输入输出设计](./multimodal-input-output-design.md)。本文只定义 provider/profile/model 的能力声明，例如 `input.image`、`input.file`、`output.image`、`tools` 和能力限制，供多模态专项判断当前消息是否可发送。

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
10. 账号 / 凭据必须是一等概念：同一个供应商可以有多个账号、多个 API Key、多个 endpoint 和多套模型默认值，不能写死成“一个供应商只有一个凭据”。
11. 内置供应商只提供目录和默认建议，不作为可长期保存的默认连接配置；所有新增、登录、保存 key、切换 provider 的写入都应落成正式 Profile。

## 2.1 当前第一版落地状态

截至 MP-12 收口，已落地的第一版范围是：

- Core 配置读取只认 `schemaVersion + current + profiles + providerOverrides` 作为正式结构；不再保留旧 `provider/model/currentProfileId` 迁移链路。
- 全新安装没有默认 Profile，也不会自动生成 `codex-oauth-default`、`deepseek-default` 这类可见默认连接。
- 内置 provider 只提供供应商、协议和模型目录；真正能切换、能保存、能登录的对象必须是正式 Profile。
- Profile ID 由系统生成并保持稳定，格式为 `providerType-数字`，例如 `codex-oauth-1`、`deepseek-1`、`deepseek-2`；用户只改 `name`。
- 模型切换只在已有 Profile 内切换模型；API Key 保存、Codex OAuth 登录等写路径会先创建正式 Profile，再保存 `current.profileId/current.model` 和 `profileCredentials[profileId]`。
- 运行时请求也必须携带并使用 `profileId`：保存凭据、读取可用性、OAuth 登录、API Key 请求头生成和真实发起模型请求都以 `profileCredentials[profileId]` 为准，不能退回到“当前 provider 的第一个凭据”。
- DeepSeek 官方 API 已作为独立 provider 接入，复用公共 `OpenAiChatCompletionsAdapter`，不再伪装成官方 OpenAI。
- Core / App Server / SDK 已提供 `model/list`、`model/set`、`model/profile/list`、`model/profile/save`、`model/profile/copy`、`model/profile/delete`、`model/availability`、`model/test` 和 `model/credential/update`。
- Desktop 已有一级“模型”页面，按“供应商类型 / 连接配置 / 配置详情”三栏展示，支持 API Key 保存、清空和测试连接。
- 顶部快速切换已拆成两个入口：模型入口只切当前 Profile 下的模型，连接配置入口切换 Profile 并使用该 Profile 的默认模型。
- CLI 新增 `ccr model status/list/set/profile`；TUI `/model` 支持查看当前 Profile，并可通过 `/model profile <profileId> [modelId]` 切换。
- 每轮 turn metadata 已记录 `profileId/profileName/provider/providerDisplayName/apiMode/authStrategy/model/requestedModel/contextWindow`，用于审计和排查，不参与历史会话恢复时的自动切换。
- DeepSeek 已复用公共 `OpenAiChatCompletionsAdapter`；MiniMax 国际版 / 国内版已复用公共 `AnthropicMessagesAdapter`，不再把 MiniMax 特例塞进 OpenAI Chat 公共链路。

还未进入本轮第一版的范围：

- 官方 OpenAI provider 完整接入。
- OpenAI Compatible / 第三方中转的完整配置表单和自定义 header。
- 真实多账号 OAuth 登录管理。
- 多模态输入/输出、附件和图片预览。

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

### 4.0 最终口径：Profile 为主体，ProviderType 为分组

多供应商能力的核心不是“一个供应商下面固定一个账号”，也不是“一个连接配置里临时选择供应商后各自散落配置”，而是：

```text
真实数据主体：连接配置 Profile
展示组织方式：按供应商类型 providerType 分组
```

也就是说，Core 侧长期只关心当前选中的是哪个 `profileId`，而不是直接把 `provider` 当成唯一账号或唯一凭据。`providerType` 只是这个 Profile 所属的供应商分类。

示例：

```json
{
  "profiles": [
    {
      "id": "deepseek-1",
      "name": "DeepSeek 工作 Key",
      "providerType": "deepseek",
      "apiMode": "openai-chat",
      "baseUrl": "https://api.deepseek.com",
      "defaultModel": "deepseek-v4-flash",
      "models": ["deepseek-v4-flash", "deepseek-v4-pro"]
    },
    {
      "id": "deepseek-2",
      "name": "DeepSeek 个人 Key",
      "providerType": "deepseek",
      "apiMode": "openai-chat",
      "baseUrl": "https://api.deepseek.com",
      "defaultModel": "deepseek-v4-pro",
      "models": ["deepseek-v4-flash", "deepseek-v4-pro"]
    },
    {
      "id": "openai-compatible-1",
      "name": "NewAPI 团队中转",
      "providerType": "openai-compatible",
      "apiMode": "openai-chat",
      "baseUrl": "https://newapi.example.com/v1",
      "defaultModel": "deepseek-chat",
      "models": ["deepseek-chat", "claude-sonnet-4.5"]
    }
  ],
  "currentProfileId": "deepseek-1",
  "currentModel": "deepseek-v4-flash"
}
```

Desktop 可以按 `providerType` 分组展示：

```text
DeepSeek
-> deepseek-1 / DeepSeek 工作 Key
-> deepseek-2 / DeepSeek 个人 Key

OpenAI Compatible
-> openai-compatible-1 / NewAPI 团队中转
```

这条口径带来的不变式：

- 用户真正切换的是 Profile，不是抽象供应商。
- 一个 `providerType` 可以有多个 Profile。
- 一个 Profile 绑定一套主要 endpoint、认证方式、凭据槽和默认模型。
- 内置 provider 目录不是 Profile；它只负责提供展示名、协议默认值、内置模型目录和能力默认值。
- 全新安装不生成默认 Profile；只有用户登录、保存 API Key 或显式新增连接配置时才创建 Profile。
- 任何会改变当前连接、模型或凭据的写入操作，都必须写入正式 `profiles` 和 `profileCredentials[profileId]`，不能只改顶层 `provider/model` 或依赖运行时默认值。
- 第三方中转按连接行为归类到 `openai-compatible`，不要因为里面跑 DeepSeek 模型就归到官方 `deepseek`。
- `providerType` 可以提供内置模型目录；Profile 可以继承、覆盖或补充自己的模型列表。
- 新建连接配置时，用户先选供应商类型，再填写协议、endpoint、凭据和默认模型，最终保存成一个 Profile。

### 4.1 账号 / 凭据配置档案

后续正式模型里，用户真正切换的对象不应是裸供应商，而是“账号 / 凭据配置档案”。

也就是说：

```text
账号 / 凭据配置档案
-> 供应商类型
-> 协议模式
-> endpoint / baseUrl
-> 本 Profile 对应的凭据槽
-> 可用模型列表
-> 默认模型
```

这样可以表达几种真实使用场景：

- 同一个供应商有多个账号，例如两个 Codex OAuth 账号。
- 同一个供应商有多个 API Key，例如一个 DeepSeek 工作 key、一个 DeepSeek 个人 key。
- 同一个第三方中转有多个 endpoint 或多个团队额度。
- 同一个账号下可以配置多个模型，并选择一个默认模型。
- 切换账号 / 凭据配置档案时，供应商、协议、凭据、默认模型一起切换。

第一版临时实现里，`deepseek` 只有一个本地 API Key，`codex-oauth` 只有一个本地 OAuth 凭据。这个只是过渡形态，不能作为长期数据模型的不变式。长期不变式应是：

- `providerType` 表示供应商类型，例如 `codex-oauth`、`deepseek`、`openai-compatible`。
- `profileId` 同时表示用户可见配置档案和凭据存储槽；凭据文件按 `profileCredentials[profileId]` 查找。
- 一个 `providerType` 可以对应多个 `profileId`。
- 一个 `profileId` 通常只绑定一个主要凭据，但可以列出多个模型。

### 4.2 模型配置档案

前台和配置层的核心对象不是裸 `provider/model`，而是“模型配置档案”。

示例：

```json
{
  "id": "newapi-work",
  "name": "NewAPI 工作账号",
  "providerType": "openai-compatible",
  "apiMode": "openai-chat",
  "baseUrl": "https://example.com/v1",
  "auth": {
    "strategy": "api_key",
    "accountId": "work"
  },
  "defaultModel": "deepseek-chat",
  "models": ["deepseek-chat", "claude-sonnet-4.5"],
  "capabilityOverrides": {
    "default": {
      "inputModalities": ["text"],
      "outputModalities": ["text"],
      "tools": true,
      "structuredOutput": false,
      "reason": "NewAPI 工作账号当前只允许文本输入"
    },
    "models": {
      "claude-sonnet-4.5": {
        "inputModalities": ["text", "image"],
        "outputModalities": ["text"],
        "tools": true,
        "structuredOutput": false,
        "image": {
          "maxImages": 10,
          "maxImageBytes": 10485760,
          "mimeTypes": ["image/png", "image/jpeg"]
        }
      }
    }
  },
  "availability": {
    "status": "verified",
    "lastCheckedAt": "2026-05-10T00:00:00.000Z"
  }
}
```

档案解决的问题：

- 用户能给中转、官方 API、本地模型起可读名字。
- 同一个供应商可以配置多个账号或多个 API Key。
- 同一个供应商可以有多个 endpoint。
- 同一个 endpoint 可以有默认模型和可选模型列表。
- 可用性、测试结果、失败原因可以挂到档案上。
- 顶部快速切换时切的是明确档案，而不是隐含环境变量。

### 4.2.1 模型能力声明

模型能力不是普通展示标签，而是发送前校验和 provider adapter 映射的输入。

第一版能力结构：

```ts
type LlmModelCapabilities = {
  inputModalities: Array<'text' | 'image' | 'file' | 'audio'>
  outputModalities: Array<'text' | 'image' | 'audio'>
  tools: boolean
  structuredOutput: boolean
  source: 'builtin' | 'profile_override' | 'default'
  reason: string
  baseSource?: 'builtin' | 'default'
  image?: {
    maxImages?: number
    maxImageBytes?: number
    mimeTypes?: string[]
  }
}
```

第一版能力来源只保留两层：

1. 内置能力目录。
   - 官网 / 官方文档是这份目录的事实来源。
   - 来源包括模型页、vision/audio/file input 文档、SDK 示例和官方限制说明。
   - CCR 维护版本化 catalog，保存已确认模型能力。
   - 官网信息更新后，需要通过代码变更或 catalog 更新进入 CCR，不能运行时临时抓网页。
   - 这层适合官方 OpenAI、Anthropic、Gemini、MiniMax、DeepSeek 等 provider。
2. Profile 覆盖。
   - 用户或中转配置可以显式声明能力。
   - 用于处理“模型名支持图片，但当前中转禁用了图片”或“中转额外支持某能力”的情况。
   - OpenAI Compatible / 第三方中转默认必须走 Profile 覆盖，不能只按模型名继承官方模型能力。

如果两层都没有命中，则使用默认能力：

- 只支持文本输入和文本输出。
- `source = 'default'`，`reason` 说明未命中内置目录或 Profile 覆盖。

不变式：

- 能力必须按 `profileId + model + apiMode` 解析，不能只按裸模型名判断。
- OpenAI Compatible / 第三方中转默认是未知能力；除非 Profile 覆盖明确支持，否则不启用图片/文件输入。
- 多模态专项只消费解析后的能力，不在 Desktop UI 或 provider adapter 里再次猜模型能力。
- 每轮 metadata 可以记录实际使用能力快照，便于排查“为什么这个附件被阻止/降级”。
- 官网是第一来源，但不是运行时唯一真相；最终能力必须由当前 Profile、模型和协议模式解析得出。

当前代码中的能力解析文件、已内置模型能力和缺口清单见 [CCR 多模态输入输出设计：当前实现状态](./multimodal-input-output-design.md#32-当前实现状态)。多供应商专项负责维护 provider/profile/model 能力来源，多模态专项只消费最终解析结果。

### 4.3 Provider 与 Protocol 分离

`provider` 表示供应商或配置档案类型，`apiMode` / `protocol` 表示调用协议。

建议最小枚举：

```ts
type LlmApiMode =
  | 'anthropic-messages'
  | 'openai-responses'
  | 'openai-chat'
  | 'custom'
```

这是当前代码里的最小枚举。`codex-oauth`、`deepseek`、`openai-compatible` 这类名称属于 `providerType`，不再塞进 `apiMode`。同一个 provider 可能支持多个协议。例如官方 OpenAI 可以走 `openai-responses`，也可以保留 `openai-chat` 兼容模式；第三方中转可能只支持 `openai-chat`，也可能支持 `openai-responses`。

### 4.4 第三方中转

第三方中转应作为一等配置档案：

- `providerType = openai-compatible`
- `baseUrl` 必填
- `apiMode` 显式选择 `openai-responses` 或 `openai-chat`
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

### 5.2 配置文件落地结构

第一版正式配置只保留 `schemaVersion + current + profiles + providerOverrides`。全新安装时如果用户还没有登录、保存 API Key 或新增连接配置，则不会生成任何 Profile，也不会生成默认配置文件。

当前主格式为：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "codex-oauth-1",
    "model": "gpt-5.5"
  },
  "providerOverrides": {
    "codex-oauth": {
      "displayName": "Codex OAuth"
    }
  },
  "profiles": {
    "codex-oauth-1": {
      "name": "Codex OAuth 登录配置",
      "providerType": "codex-oauth",
      "apiMode": "openai-responses",
      "endpoint": {
        "baseUrl": "https://chatgpt.com/backend-api"
      },
      "auth": {
        "strategy": "oauth_refreshable"
      },
      "models": {
        "source": "builtin",
        "default": "gpt-5.5",
        "include": ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
        "custom": []
      },
      "availability": {
        "status": "auth_ready",
        "lastCheckedAt": "2026-05-11T00:00:00.000Z"
      }
    }
  }
}
```

核心取舍：

- `current.profileId` 是当前连接配置，`current.model` 是当前模型；不再把顶层 `provider/model` 作为长期主结构。
- `providerType` 只是分组和默认目录来源，例如 `codex-oauth`、`deepseek`、`openai-compatible`。
- `profiles` 才是用户真正管理的连接配置；一个 `providerType` 下可以有多个 Profile。
- `profileId` 是稳定主键，创建后不改名；用户可改的是 `name`。
- `providerOverrides` 只保存用户覆盖项，内置供应商定义仍来自代码里的 provider definition，避免配置文件复制一大份默认目录。
- `models` 使用对象结构，而不是单纯字符串数组；这样可以表达“继承内置目录”“追加自定义模型”“远程读取模型目录”等来源。
- API Key、OAuth token、自定义 header 不写入 `llm.config.local.json`，而是按同一个 `profileId` 写入本机敏感凭据文件。

敏感凭据独立放在本机数据文件 `llm.credentials.local.json`：

```json
{
  "schemaVersion": 2,
  "profileCredentials": {
    "codex-oauth-1": {
      "type": "oauth",
      "providerType": "codex-oauth",
      "oauth": {
        "access": "...",
        "refresh": "...",
        "expires": 179935097392,
        "accountId": "..."
      }
    },
    "deepseek-1": {
      "type": "api_key",
      "providerType": "deepseek",
      "apiKey": "..."
    }
  }
}
```

不变式：

1. 没有 Profile 时，当前模型为空，聊天区提示用户配置或登录。
2. 新建 Profile 时使用 `providerType-数字` 生成 ID，例如 `deepseek-1`。
3. 一个 Profile 对应一个凭据槽，哪怕两个 Profile 里填了同一个 API Key 字符串，也分别存储。
4. OAuth 与 API Key 都走 `profileCredentials[profileId]`，不再单独保存 `codex-oauth.json`。
5. 删除 Profile 时同步清理该 `profileId` 对应的凭据槽。

### 5.3 协议适配器复用原则

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

### 5.4 不变式

- 上层 Query / Tool 主循环不直接依赖某个第三方 SDK。
- 新协议只增加 adapter，不改核心消息语义。
- API Key、OAuth token、自定义 header 不入仓。
- 供应商配置和凭据引用分离。
- 每次请求最终都能落到统一的 runtime event、usage 和错误分类。

### 5.5 第一版支持范围

当前第一版已经覆盖：

- 现有 `codex-oauth` 保持可用。
- DeepSeek 官方 API，作为第一条 OpenAI Chat Completions 兼容协议落地链路。
- 公共 OpenAI Chat Completions 协议适配器。
- 顶部模型 / 连接配置快速切换。
- Desktop 一级“模型”页面第一版。
- 本地可用性判断和手动“测试连接”。
- 每轮记录实际使用的 provider/profile/model/apiMode/authStrategy。
- CLI / TUI 模型状态查看和切换入口。

下一批继续补：

- 官方 OpenAI API。
- OpenAI Compatible / 第三方中转。
- 更细的 Desktop Profile 差异化表单和自定义 headers。

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
  "profileId": "codex-oauth-1",
  "profileName": "Codex OAuth 登录配置",
  "provider": "codex-oauth",
  "providerDisplayName": "Codex OAuth",
  "apiMode": "openai-responses",
  "authStrategy": "oauth_refreshable",
  "model": "gpt-5.4",
  "requestedModel": "gpt-5.4",
  "contextWindow": 200000
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

顶部保留两个轻量胶囊：

```text
gpt-5.4
Codex OAuth · 已连接
```

模型胶囊只切当前 Profile 下的模型；连接配置胶囊只切当前 Profile / provider connection。两个入口都只做快速切换：

- 显示当前连接配置或当前连接配置下的模型。
- 支持切换当前应用模型或当前连接配置。
- 支持跳转到“模型与供应商”完整页面。
- 不展示 API Key、baseUrl、自定义 header 等复杂配置。
- 当前任务运行中禁用切换，避免同一轮消息中途改变运行时。

### 8.3 设置页关系

“设置”页不承载完整 provider 管理，只放摘要入口：

```text
模型与供应商
当前：Codex OAuth / gpt-5.4
[打开]
```

这样既符合用户在设置里找配置的直觉，也避免模型配置被藏得太深。

### 8.4 模型页三栏结构

“模型与供应商”页面采用三栏结构：

```text
供应商类型
-> 连接配置
-> 配置详情
```

三栏含义：

- 供应商类型：只表示分类和默认能力目录，例如 `Codex OAuth`、`DeepSeek`、`OpenAI API`、`OpenAI Compatible`、`本地模型`。
- 连接配置：用户真正切换和管理的实例，例如 `DeepSeek 工作 Key`、`DeepSeek 个人 Key`、`NewAPI 团队中转`、`Codex OAuth 个人账号`。
- 配置详情：展示该连接配置的协议、认证方式、endpoint、凭据状态、默认模型、模型列表、可用性检测和操作按钮。

这里的关键是：界面上供应商在最前面，但数据主体仍然是一个个连接配置 Profile。供应商类型只是帮助用户找配置的分组，不应反向约束 Core 变成“一个 provider 只能有一个凭据”。

新建连接配置流程：

```text
点击“新增连接配置”
-> 选择供应商类型
-> 选择或确认协议模式
-> 填 endpoint / baseUrl
-> 选择认证方式并保存凭据
-> 选择默认模型和可用模型列表
-> 保存为 Profile
```

编辑连接配置流程：

```text
选择供应商类型
-> 选择连接配置 Profile
-> 修改 endpoint / 凭据 / 模型列表 / 默认模型
-> 保存
-> Core 重建对应 runtime，下一轮消息生效
```

第一版 Desktop 已经可以同时展示运行时派生 Profile 和文件内保存 Profile。没有显式保存 Profile 时，会用 provider 派生默认连接配置：

```text
DeepSeek
-> DeepSeek API Key
-> deepseek-v4-flash / deepseek-v4-pro
```

这个过渡形态保证旧配置也能在三栏结构里显示；一旦用户新增、复制或编辑连接配置，中间栏就直接展示真实 `profileId` 列表，并通过 Core 写入 `current.profileId + current.model`。

### 8.5 首次打开体验

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

当前第一版已达成：

- Desktop 左侧出现一级“模型”页面。
- 打开 Desktop 不强制配置模型。
- 顶部模型胶囊可以快速切换当前应用模型，连接配置胶囊可以快速切换 Profile。
- 会话恢复不改变当前应用模型。
- 每轮消息能记录实际使用的 provider/profile/model/apiMode。
- DeepSeek 官方 API 有独立 provider 和可配置 API Key。
- 启动时不自动发真实模型请求。
- “测试连接”能返回 availability 状态。
- `codex-oauth` 现有链路不回归。
- `npm.cmd run typecheck -- --pretty false`、`npm.cmd run build -- --pretty false`、LLM runtime smoke、provider smoke、CLI model smoke 和 Desktop build 通过。

后续继续验收：

- 无模型配置时，聊天区出现引导卡。
- OpenAI API 和 OpenAI Compatible 至少各有一个可配置档案。
- 第三方中转支持 baseUrl、apiMode、API Key、自定义 header 和模型名透传。
- Profile 可用性测试结果持久化回写。

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
- 不把 DeepSeek 可用性结果作为启动时真实网络检测；只在用户点击“测试连接”或实际发送消息时请求网络
- 不做 DeepSeek 图片/多模态能力，交给多模态专项
- 不支持旧别名 `deepseek-chat` / `deepseek-reasoner` 作为默认选项，避免新接入一开始就走即将迁移的口径
