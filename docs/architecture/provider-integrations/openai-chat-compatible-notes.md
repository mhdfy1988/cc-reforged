# OpenAI Chat 兼容供应商差异记录

## 背景

CCR 的 `openai-chat` 适配器不能假设所有供应商都是“换一个 base URL 就完全兼容”。不同供应商通常共享 `messages / stream / tools` 这类主形态，但在输出 token 字段、thinking 参数、系统消息数量、工具调用细节上会有差异。

## 当前对照

| 供应商 | 官方入口 | 输出 token 字段 | tools | 当前 CCR 结论 |
| --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/chat/completions` | `max_tokens` | 支持 | 可走公共 `openai-chat`，另加 DeepSeek `thinking` / `reasoning_effort` 扩展。 |
| GLM API | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `max_tokens` | 支持 | 通用开放平台 API，应作为 `glm-api` 独立 provider 接入。 |
| GLM Coding Plan | `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions` | `max_tokens` | 支持 | Coding Plan 专用端点，应作为 `glm-coding` 独立 provider 接入，不和通用 API 混用。 |
| Kimi API / Moonshot | `https://api.moonshot.cn/v1/chat/completions` | `max_tokens` | 支持 | 开放平台通用 API，应作为 `kimi-api` 独立 provider 接入；`kimi-k2.6` 当前真实 probe 要求 `temperature: 1`，国际站 / 历史 endpoint 用 Profile override。 |
| Kimi Code | 不走此分支 | `max_tokens` | 不走此分支 | 已从当前 OpenAI Chat 兼容分支摘除，改走 Anthropic Messages `https://api.kimi.com/coding/v1/messages`。 |
| MiniMax 国际版 | `https://api.minimax.io/v1/chat/completions` | `max_completion_tokens` | 不走此分支 | 已从当前 MiniMax provider 摘除，改走 Anthropic-compatible。 |
| MiniMax 国内版 | `https://api.minimaxi.com/v1/chat/completions` | `max_completion_tokens` | 不走此分支 | 同国际版，避免把 MiniMax 特例塞进公共 OpenAI Chat。 |

## MiniMax 这次踩到的点

本地真实请求曾经只有这些字段：

```json
["model", "messages", "stream", "max_completion_tokens"]
```

字段本身没问题。失败原因是 CCR 的默认系统上下文会形成多条 `system` 消息，MiniMax OpenAI 兼容端点不接受这种 chat setting。

已验证：

- `14` 条很短的 `system` + `1` 条 `user`：返回 `400 invalid chat setting (2013)`。
- 合并成 `1` 条 `system` + `1` 条 `user`：成功。
- 合并后的长 `system`：成功。

因此 MiniMax 不再使用 `openai-chat` provider 分支。当前 MiniMax provider 改走 `anthropic-messages`，Kimi Code 也因为官方 Coding Agent 边界改走 `anthropic-messages`。公共 `openai-chat` 默认行为继续服务 DeepSeek、Kimi API、GLM API / GLM Coding 等更接近标准 Chat Completions 的供应商。

## 后续接入原则

- 公共 `openai-chat` 适配器只保留“标准默认行为”。
- 如果某个供应商为了可用性需要改 token 字段、系统消息结构或工具字段，先判断它是否应该拆到独立协议分支。
- 每个供应商的差异通过 provider options 显式打开；不能让单个供应商改变公共默认行为。
- 新供应商接入前先用最小请求和 CCR 实际请求各测一次，至少比较：URL、headers、body keys、messages role 分布、工具字段、输出 token 字段。
- 连续两次 400 不能继续猜字段，必须打印脱敏 payload 摘要再和官方文档逐项对照。

## 资料入口

- MiniMax OpenAI 兼容接口：<https://platform.minimax.io/docs/api-reference/text-openai-api>
- MiniMax 工具接入说明：<https://platform.minimax.io/docs/token-plan/other-tools>
- DeepSeek Chat Completions：<https://api-docs.deepseek.com/api/create-chat-completion>
- 智谱开放平台 API 使用概述：<https://docs.bigmodel.cn/cn/api/introduction>
- GLM Coding Plan 接入工具说明：<https://docs.bigmodel.cn/cn/coding-plan/tool/others>
- Kimi Chat Completions：<https://platform.kimi.ai/docs/api/chat>
- Kimi Code 第三方 Coding Agent 文档：<https://www.kimi.com/code/docs/third-party-tools/other-coding-agents.html>
