# Provider 能力工具化后续方向

更新时间：2026-05-21

## 1. 定位

这是一个分阶段方向备忘录。2026-05-21 已进入第一轮最小实现：先只把 `GenerateImage` 生图能力做成 provider 能力工具快照，后续视觉 / 文件 / TTS 和跨供应商路由仍按本文约束推进。

当前主线仍然是把已接 provider 做成熟：Codex OAuth、DeepSeek、MiniMax、Kimi、GLM 的配置、凭据、模型目录、文本、stream、tool、多模态、图片生成、Desktop 展示、历史恢复、错误快照和真实 probe 状态先收口。

Provider 能力工具化解决的是另一类问题：主推理模型很强，但它自己未必具备视觉识别、图片生成、视频理解、文件理解等能力。CCR 可以把同一供应商或显式配置的其他供应商模型包装成能力工具，让主模型通过统一工具调用补齐这些能力。

## 2. 目标

长期目标不是把所有模型都标成“全能模型”，而是把能力拆清楚：

| 角色 | 示例 | 责任 |
| --- | --- | --- |
| 主模型 | `glm-api / glm-5.1` | 文本、推理、工具决策、最终回答 |
| 视觉工具模型 | `glm-api / glm-5v-turbo` | 图片 / 视频 / 文件理解，返回结构化描述 |
| 图片生成工具模型 | `glm-api / glm-image` | 文本生图、后续图生图 / 图片编辑 |
| 能力路由 | CCR Runtime | 决定是否允许调用、调用哪个 provider/model、如何记录和回放 |

用户仍然可以把 `glm-5.1` 当作主模型使用；需要图片理解或生图时，由 CCR 在受控边界内调用能力工具。

## 3. 第一阶段：同供应商能力工具

第一版如果后续要做，默认只允许同供应商内部调用。

示例：

```text
主模型：glm-api / glm-5.1
视觉工具：glm-api / glm-5v-turbo
图片生成工具：glm-api / glm-image
```

这样做的好处：

- 凭据、base URL、计费归属清晰。
- 用户选择 GLM，就默认只在 GLM 供应商内部补能力。
- 不把用户输入静默发给别的供应商。
- 不把 `glm-5.1` 误标为原生视觉或图片生成模型。
- 可以复用同一 Profile 的 API Key 和 provider 文档。

第一阶段只应做显式声明，不做模型名猜测。比如只有当 `glm-api` profile 明确声明 `visionToolModel=glm-5v-turbo` 或内置目录明确配置时，CCR 才允许主模型通过视觉工具调用它。

## 4. 第二阶段：显式跨供应商能力路由

后续可以扩展为“哪个好我接入哪个”，但必须显式配置，不能默认自动跨供应商。

示例：

```text
主模型：deepseek / deepseek-v4-pro
视觉工具：kimi-api / kimi-k2.6
图片生成工具：glm-api / glm-image
```

跨供应商阶段的基本要求：

- 必须由用户或 Profile 配置显式选择目标 provider/model。
- Desktop 要展示本轮可能调用哪些供应商。
- 会话历史和诊断信息要记录实际调用的 provider/model。
- 错误快照要能区分主模型错误、能力工具错误和路由错误。
- 需要未来的数据出域策略：哪些输入允许跨供应商，哪些必须留在当前供应商。

## 5. 与现有多模态主线的关系

这不是当前多模态第一版的替代品。

当前主线要先完成：

1. 已接 provider 的真实 probe 和成熟度矩阵。
2. 模型能力目录准确表达官方能力、CCR 已接能力和真实验证状态。
3. 图片 / 视频 / 文件输入继续走发送前能力校验。
4. 图片生成继续走 `generatedArtifact`、`savedPath`、Desktop 展示和历史恢复轻量化。
5. 发布前回归清单稳定。

Provider 能力工具化第一轮只做生图能力说明和诊断暴露，不改变多模态输入主线；后续视觉 / 文件 / TTS 仍要等真实 probe、配置入口和数据边界稳定后再继续。

## 6. 当前第一轮落点

当前已经落地的最小结构是 `LlmProviderCapabilityTools`：

```ts
type LlmProviderCapabilityTools = {
  imageGeneration: {
    available: boolean
    toolName: 'GenerateImage'
    provider: string
    providerDisplayName: string
    model: string
    source: 'builtin' | 'provider_metadata' | 'runtime_provider' | 'disabled_default'
    route: 'same_provider'
    dataBoundary: 'same_provider'
    message: string
    reason?: string
  }
}
```

当前只覆盖 `GenerateImage`：

| 主 provider | 生图工具模型 | 来源 | 数据边界 |
| --- | --- | --- | --- |
| `glm-api` | `glm-image` | provider metadata / 内置默认 | 同供应商 |
| `openai` | `gpt-image-1` | provider metadata / 内置默认 | 同供应商 |
| `codex-oauth` | 当前 hosted image generation 模型 | 内置实现 | 同供应商 |
| `minimax` / `minimax-cn` | `image-01` | provider metadata / 内置默认 | 同供应商 |

已接入位置：

- `GenerateImageTool.validateInput()`：当前 provider 不支持生图时返回友好错误。
- `GenerateImageTool.call()`：使用同一份能力工具快照决定默认生图模型，并把 provider/model/dataBoundary 写入 metadata。
- App Server `config/get`、`model/list`、`model/availability`：返回 `capabilityTools`。
- Desktop 模型页：展示当前生图能力来自哪个 provider/model。
- 诊断属性：`LLM capability tools` 可看到生图能力来源或不可用原因。

## 7. 0.7+ 后置方向：能力工具管理模块

独立的“能力工具管理模块”先后置到 `0.7+` 之后，不进入当前第五期后半，也不作为 `0.6.0` 的前置条件。

这个模块的目标是把多 provider 能力组合显式配置出来，而不是把能力散落在普通模型列表和 prompt 里。典型目标场景：

```text
主推理模型：deepseek / deepseek-v4-pro
视觉理解工具：glm-api / glm-4.6v
图片生成工具：openai / gpt-image-1
```

页面上可以独立展示：

| 能力槽位 | 示例 | 当前策略 |
| --- | --- | --- |
| 主推理 | `deepseek / deepseek-v4-pro` | 仍由现有模型配置负责 |
| 图片理解 | `glm-api / glm-4.6v` | 0.7+ 后显式配置 |
| 图片生成 | `openai / gpt-image-1` | 0.7+ 后显式配置 |
| 视频理解 | 待定 | 0.7+ 后再接 |
| 视频生成 | 待定 | 0.7+ 后再接 |
| 文件理解 | 待定 | 0.7+ 后再接 |
| 语音合成 | 待定 | 0.7+ 后再接 |

后续做这个模块时必须满足：

- 用户显式选择跨供应商能力工具，不能自动把输入发给另一个 provider。
- UI 必须展示本轮可能调用的 provider/model 和数据边界。
- 会话历史、诊断和错误快照必须记录实际能力工具 provider/model。
- 配置层要区分“主模型配置”和“能力工具配置”，避免把 `glm-4.6v`、`gpt-image-1` 误当成主聊天模型。
- 第一版只做少量槽位，例如图片理解和图片生成，视频 / 文件 / 语音继续后置。

当前第五期只保留 `GenerateImage` 的能力快照作为地基，不继续扩成完整管理页。

## 8. 未来实现草案

后续实现时可以考虑新增一个 `ProviderCapabilityToolProfile` 或等价结构：

```ts
type ProviderCapabilityToolProfile = {
  provider: string
  profileId?: string
  primaryModel: string
  tools?: {
    vision?: {
      provider: string
      model: string
      allowedInputModalities: Array<'image' | 'video' | 'file'>
      sameProviderOnly?: boolean
    }
    imageGeneration?: {
      provider: string
      model: string
      allowedOutputModalities: Array<'image'>
      sameProviderOnly?: boolean
    }
  }
}
```

运行时流程：

```text
用户消息
-> 当前主模型能力检查
-> 如果主模型不支持目标能力，但 profile 声明了能力工具
-> CCR 注入受控工具或内部路由
-> 能力工具返回标准内容块 / generatedArtifact
-> 主模型继续推理或直接输出
-> Desktop 只展示 CCR 标准结构
```

## 9. 非目标

- 当前第一轮不实现视觉理解、视频理解、文件理解和 TTS。
- 当前第一轮不实现跨供应商能力路由。
- 当前第五期不实现独立能力工具管理页。
- 不把所有多模态模型平铺成主聊天模型来解决能力缺失。
- 不默认跨供应商调用。
- 不用模型名猜测工具模型。
- 不让 Desktop 直接消费能力工具的 provider 原始响应。

## 10. 后续触发条件

满足下面条件后，再考虑进入实施：

1. `STD-PROVIDER-02` 已接 provider 成熟度收口完成。
2. GLM / Kimi / MiniMax / Codex OAuth 的多模态和图片生成真实 probe 状态清晰。
3. `generatedArtifact`、历史恢复、错误快照和 Desktop 展示链路稳定。
4. 模型页能展示当前主模型、辅助能力模型和数据边界。
5. 有明确的第一批场景，例如 `glm-5.1 + glm-5v-turbo + glm-image`。
