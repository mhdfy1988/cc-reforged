# OpenAI Chat 兼容供应商差异记录

## 背景

CCR 的 `openai-chat` 适配器不能假设所有供应商都是“换一个 base URL 就完全兼容”。不同供应商通常共享 `messages / stream / tools` 这类主形态，但在输出 token 字段、thinking 参数、系统消息数量、工具调用细节上会有差异。

## 当前对照

| 供应商 | 官方入口 | 输出 token 字段 | tools | 当前 CCR 结论 |
| --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/chat/completions` | `max_tokens` | 支持 | 可走公共 `openai-chat`，另加 DeepSeek `thinking` / `reasoning_effort` 扩展。 |
| Z.AI / GLM | `https://api.z.ai/api/paas/v4/chat/completions` | `max_tokens` | 支持 | 更接近标准 Chat Completions；后续接入时优先复用公共适配器，再补 GLM thinking / 多模态能力。 |
| Kimi / Moonshot | `https://api.moonshot.ai/v1/chat/completions` | `max_tokens` | 支持 | 官方声明兼容 OpenAI Chat Completions；后续按普通 OpenAI compatible 接入，再单独补 Kimi thinking / 长上下文能力。 |
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

因此 MiniMax 不再使用 `openai-chat` provider 分支。当前 MiniMax provider 改走 `anthropic-messages`，公共 `openai-chat` 默认行为继续服务 DeepSeek、Kimi、GLM 等更接近标准 Chat Completions 的供应商。

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
- Z.AI Chat Completion：<https://docs.z.ai/api-reference/llm/chat-completion>
- Kimi Chat Completions：<https://platform.kimi.ai/docs/api/chat>
