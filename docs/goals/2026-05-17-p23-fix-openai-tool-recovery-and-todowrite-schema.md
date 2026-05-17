# Goal: P23-FIX OpenAI-compatible 工具恢复与 TodoWrite schema 常驻

## 目标

修复 DeepSeek / OpenAI-compatible 严格工具协议下的两个阻断问题：

- 会话历史中出现悬空 `tool_calls`、工具参数错误或工具执行中断时，后续请求不能因为缺少对应 `tool` result 而 400，导致整个会话不可继续。
- `TodoWrite` 必须首轮携带完整 schema 给模型，避免第三方模型在 deferred 场景下猜测成 `name` / `description` 结构。

## 为什么现在做

DeepSeek 测试中出现过 `assistant message with 'tool_calls' must be followed by tool messages`。这类错误会让当前会话后续请求都失败，比普通多模态能力缺口优先级更高。

同时，TodoWrite 参数错误暴露出核心工具不适合 deferred：模型没有拿到 schema 时会猜字段，造成待办展示和工具错误混在一起。

## 范围

1. OpenAI-compatible 请求前修复：
   - 扫描将要发送的 OpenAI Chat messages。
   - 每个 assistant `tool_calls` 后必须紧跟对应 `tool` message。
   - 缺失时补 synthetic tool result，错误码为 `TOOL_CALL_INTERRUPTED`。
   - 孤立 tool result 不再继续发送给严格 OpenAI-compatible 网关。
   - 如果 normalized 后的同一个用户消息同时包含 `tool_result` 和真实用户文本，拆分为 LLM runtime 消息时必须先发 `tool`，再发 `user`，避免出现 `assistant -> user -> tool`。
2. TodoWrite schema：
   - `TodoWrite` 不再走 deferred。
   - 首轮工具列表直接携带严格 `todos[].content/status/activeForm` schema。
   - 不把 `name` / `description` 静默兼容成合法 Todo。
3. Desktop 展示：
   - 非法 TodoWrite 输入显示为可见工具错误卡。
   - 合法 TodoWrite 仍显示 Todo overlay。
   - 控制类工具失败时不再因为 hidden timeline 被吞掉。

## 非目标

- 不重做全部 provider tool-calling 抽象。
- 不为每个 provider 单独维护一套工具字段映射。
- 不把非法 TodoWrite 参数做兼容迁移。
- 不发布、不打包安装包。

## 验收标准

- DeepSeek / OpenAI-compatible 发请求前不会带悬空 `assistant.tool_calls`。
- 缺失 tool result 时补齐 `TOOL_CALL_INTERRUPTED`，会话可以继续。
- 已存在的合法 tool result 不被替换。
- `TodoWrite` 默认随工具 schema 发送给模型。
- 合法 TodoWrite 仍进入 Todo overlay。
- 非法 TodoWrite 显示工具错误卡，并保留原始错误原因。

## 验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:llm-claude-adapter
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server-client
npm.cmd run desktop:build
git diff --check
```

额外观察：

- `npm.cmd run typecheck:desktop` 可作为参考，但当前仓库该命令仍会命中既有 `MACRO`、`Bun`、可选 SDK / 原生依赖类型缺失问题。

## 本轮进展

状态：已完成自动验证。

已完成：

- OpenAI Chat Completions adapter 已在请求前修复工具消息序列。
- 缺失 tool result 时会插入 synthetic `TOOL_CALL_INTERRUPTED`。
- `claudeApiAdapter` 已修复混合 `tool_result + user text` 拆分顺序，避免 DeepSeek 看到 `assistant -> user -> tool`。
- `TodoWrite` 已改为 `alwaysLoad`，不再依赖 ToolSearch 才暴露 schema。
- 非法 TodoWrite fixture 已固定为工具错误卡，不会变成 Todo overlay。
- 控制类工具失败合并结果后会重新显示在时间线中。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:llm-claude-adapter`
- `npm.cmd run smoke:openai-chat-protocol`
- `npm.cmd run smoke:deepseek-provider`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run smoke:app-server-client`
- `npm.cmd run desktop:build`
- `git diff --check`

已知情况：

- `npm.cmd run typecheck:desktop` 仍失败在既有桌面 tsconfig 环境噪声上，不是本轮修复引入。
