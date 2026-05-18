# Goal: STD-HISTORY-01 History Validator 发送前历史校验

## 目标

在消息发送给 provider 前，增加一层 CCR 标准历史校验器（History Validator），扫描、修复或阻断非法历史。

这一步优先解决真实出现过的问题：DeepSeek / OpenAI-compatible 会话在工具调用中断、工具参数错误或缺少工具结果后，再次发送会触发 provider 400，导致整个会话不可继续。

本 goal 的核心不是新增模型能力，而是让现有历史进入 provider 前满足 CCR 标准协议和各 provider 的最低顺序要求。

## 迭代 1：协议面拆解

第一轮先按协议族拆清楚“什么历史是非法的”：

1. OpenAI Chat / DeepSeek：
   - assistant 返回 `tool_calls[]` 后，后续必须有对应 `role: "tool"` + `tool_call_id`。
   - 同一条 assistant message 中可能有多个 tool call，不能只补最后一个。
   - 工具参数错误、中断、权限拒绝也要回填标准工具结果，不能让 call 悬空。
2. Anthropic Messages / MiniMax Anthropic-compatible：
   - assistant 返回 `tool_use` block 后，下一轮 user content 中必须有对应 `tool_result`。
   - top-level `system` 和 `user/assistant` 历史不能被 OpenAI-style 角色规则误处理。
   - thinking / interleaved thinking 不能由 UI 层随意丢弃或拼接。
3. Gemini GenerateContent：
   - `functionCall` 后要有 `functionResponse` part。
   - Gemini 的 `contents.role = user/model` 不等于 OpenAI `tool` role。
   - thought signature / thinking 规则需要后续 adapter 明确，第一版先预留校验入口。
4. OpenAI Responses：
   - function call item 要有 `function_call_output`。
   - reasoning item 是否可回放要按 provider 规则处理，不能简单转成普通 text。
5. Gateway：
   - gateway 不是协议标准，只能按 profile / apiMode 走对应校验规则。

第一轮还要盘点当前真实代码路径：

- `turn/start` 如何把历史上下文传进 Core。
- `queryModel` / provider adapter 如何拿到 `LlmMessage[]`。
- 现有 OpenAI-compatible / DeepSeek 工具结果修复入口在哪里。
- 历史恢复、transcript、Desktop display event 和 provider request 之间哪些字段可能丢失。

## 迭代 2：第一版落地边界

第二轮把第一版范围收紧到“能阻断真实会话损坏”的最小实现：

本次优先做：

- 新增共享 `HistoryValidator` 或等价模块，输入为 CCR 标准 `LlmMessage[]` 和 provider profile。
- 对 OpenAI Chat / DeepSeek / OpenAI-compatible 历史做第一版强校验：
  - 找出悬空 `tool_call`。
  - 自动补标准 synthetic `tool_result`，或返回阻断诊断。
  - 保留 tool call id、tool name、错误来源和修复原因。
- 把校验结果接到 provider 请求前，而不是 UI 或 Desktop 展示层。
- 补 smoke，覆盖中断、工具参数错误、缺 tool result、多 tool call 和历史恢复后再次发送。
- 文档说明哪些是自动修复、哪些是阻断、哪些只是登记为后续。

本次预留但不强行完成：

- Anthropic `tool_use -> tool_result` 完整修复。
- Gemini `functionCall -> functionResponse` 完整修复。
- OpenAI Responses `function_call_output` 完整修复。
- 完整 thinking / reasoning 回放策略。
- ErrorSnapshot UI 展示；本次只返回诊断，展示进入 P24。
- 新 provider、新 gateway profile、发布打包。

## 验收标准

- [x] 发送给 OpenAI-compatible / DeepSeek 前，历史中悬空 tool call 会被发现。
- [x] 工具参数错误、中断或缺失结果不会再次把会话送成 provider 400。
- [x] 多个 tool call 的匹配按 id 逐个处理，不靠“最近一个工具”猜测。
- [x] History Validator 的结果能区分 `ok`、`repaired`、`blocked`。
- [x] 修复结果保留标准 `CcrContentBlock` / `LlmToolResultPart` 语义。
- [x] Anthropic / Gemini / Responses 的规则已在代码或文档中预留，后续不会混进 OpenAI Chat 规则。
- [x] smoke 覆盖 OpenAI-compatible / DeepSeek 的历史修复场景。
- [x] `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:provider-tool-profile
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

完成后进入 `P24 ErrorSnapshot`：

- 把 provider 错误、工具错误、参数校验错误、中断、限流、认证过期和拒答统一成可行动错误快照。
- 把 History Validator 的阻断诊断接到用户可理解的错误卡。
- 避免再出现“明明是协议/工具结果问题，却显示 path not found”。

## 执行结果

状态：已完成第一版。

已完成：

- 新增 `src/services/llm/historyValidator.ts`，提供 `validateLlmHistoryForProvider(...)`。
- History Validator 返回 `ok`、`repaired`、`blocked` 三种状态，并保留结构化诊断。
- OpenAI-compatible / DeepSeek 请求前会先基于 provider tool profile 校验标准 `LlmMessage[]`。
- 缺失 tool result 时补 synthetic `tool_result`，保留 `toolCallId`、`toolName`、`TOOL_CALL_INTERRUPTED` 和中断说明。
- 延迟或孤立 tool result 会在发送前丢弃，避免污染 OpenAI Chat / DeepSeek 请求顺序。
- 不支持工具的 provider profile 遇到 `tool_call` 会返回阻断诊断，不会静默发送非法历史。
- `smoke:provider-tool-profile` 新增合法历史、缺失结果、多 tool call、延迟结果和不支持工具五类断言。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:provider-tool-profile`
- `npm.cmd run smoke:openai-chat-protocol`
- `npm.cmd run smoke:deepseek-provider`
- `npm.cmd run smoke:desktop-display-events`
- `git diff --check`
