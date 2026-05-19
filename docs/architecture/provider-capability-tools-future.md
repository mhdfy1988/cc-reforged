# Provider 能力工具化后续方向

更新时间：2026-05-19

## 1. 定位

这是一个后续方向备忘录，不进入当前发布主线。

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

Provider 能力工具化要等这些基础稳定后再进入实现，否则很容易把“模型目录”“工具调用”“生成物落盘”“跨供应商数据边界”混成一团。

## 6. 未来实现草案

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

## 7. 非目标

- 当前发布版本不实现这个方向。
- 不把所有多模态模型平铺成主聊天模型来解决能力缺失。
- 不默认跨供应商调用。
- 不用模型名猜测工具模型。
- 不让 Desktop 直接消费能力工具的 provider 原始响应。

## 8. 后续触发条件

满足下面条件后，再考虑进入实施：

1. `STD-PROVIDER-02` 已接 provider 成熟度收口完成。
2. GLM / Kimi / MiniMax / Codex OAuth 的多模态和图片生成真实 probe 状态清晰。
3. `generatedArtifact`、历史恢复、错误快照和 Desktop 展示链路稳定。
4. 模型页能展示当前主模型、辅助能力模型和数据边界。
5. 有明确的第一批场景，例如 `glm-5.1 + glm-5v-turbo + glm-image`。
