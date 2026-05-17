# Codex OAuth 供应商接入记录

## 接入目标

`codex-oauth` 是 CCR 的内置 OAuth 供应商，用于复用用户的 Codex / ChatGPT 登录凭据访问 `chatgpt.com/backend-api`。

它不是普通 OpenAI API Key provider，也不是 OpenAI Compatible endpoint。它使用 OAuth refresh token，运行时走 `@mariozechner/pi-ai` 的 `openai-codex-responses` 模型接口。

## 供应商定义

| 字段 | 值 |
| --- | --- |
| 供应商 ID | `codex-oauth` |
| 显示名 | `Codex OAuth` |
| 协议 | `openai-responses` |
| 认证 | `oauth_refreshable` |
| 默认 Base URL | `https://chatgpt.com/backend-api` |
| 默认模型 | `gpt-5.4` |
| 默认 transport | `sse` |

## 模型目录

| 模型 ID | 显示名 | 上下文 |
| --- | --- | --- |
| `gpt-5.5` | GPT-5.5 | 200K |
| `gpt-5.4` | GPT-5.4 | 200K |
| `gpt-5.4-mini` | GPT-5.4 Mini | 200K |

## 配置结构

普通配置写入 `llm.config.local.json`：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "codex-oauth-1",
    "model": "gpt-5.4"
  },
  "profiles": {
    "codex-oauth-1": {
      "name": "Codex OAuth 账号 1",
      "providerType": "codex-oauth",
      "apiMode": "openai-responses",
      "auth": {
        "strategy": "oauth_refreshable"
      },
      "defaultModel": "gpt-5.4",
      "models": {
        "source": "mixed",
        "default": "gpt-5.4",
        "include": ["gpt-5.5", "gpt-5.4-mini"]
      }
    }
  }
}
```

敏感凭据写入 `llm.credentials.local.json`：

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
        "expires": 177946046920,
        "accountId": "..."
      }
    }
  }
}
```

关键不变式：

- OAuth token 按 `profileId` 存储。
- 多个 Codex OAuth 账号可以共存。
- `codex-oauth.json` 不再作为专用凭据文件。
- Profile ID 不随邮箱、账号名或显示名变化。

## OAuth 流程

1. `CodexOAuthSession.beginAuthorization()` 生成 PKCE verifier、challenge 和 state。
2. 打开授权 URL：`https://auth.openai.com/oauth/authorize`。
3. 本地回调监听 `http://localhost:1455/auth/callback`。
4. 收到 code 后调用 token endpoint 换取 access / refresh token。
5. token 写入 `llm.credentials.local.json` 的 `profileCredentials[profileId]`。
6. 后续请求前如果 access token 临近过期，自动用 refresh token 刷新并写回同一个 Profile 凭据槽。

## 请求链路

```text
Core LlmRuntime
-> CodexOAuthProvider
-> CodexOAuthSession.getValidCredential()
-> @mariozechner/pi-ai openai-codex-responses
-> https://chatgpt.com/backend-api
```

`CodexOAuthProvider` 负责把 CCR 内部消息转换成 pi-ai 消息：

- `system` 消息合并成 system prompt。
- `user` 消息支持文本内容；`gpt-5.5` 图片输入会在 provider 边界读取为 base64，并映射成 pi-ai 的 `image` content block。
- `assistant` 支持 text、thinking、tool_call。
- `tool` 消息转换成 toolResult。
- 流式事件归一化回 CCR 的 `thinking_*`、`content_part`、`response_complete`。

## 环境变量

临时凭据覆盖：

- `CCR_CODEX_OAUTH_ACCESS_TOKEN`
- `CCR_CODEX_OAUTH_REFRESH_TOKEN`
- `CCR_CODEX_OAUTH_EXPIRES_AT`
- `CCR_CODEX_OAUTH_ACCOUNT_ID`

OAuth endpoint 覆盖：

- `CCR_CODEX_OAUTH_BASE_URL`
- `CCR_CODEX_OAUTH_AUTHORIZE_URL`
- `CCR_CODEX_OAUTH_TOKEN_URL`
- `CCR_CODEX_OAUTH_REDIRECT_URI`
- `CCR_CODEX_OAUTH_SCOPE`
- `CCR_CODEX_OAUTH_CLIENT_ID`

环境变量只用于调试或临时覆盖，正式 Desktop 配置仍然以 Profile 和本地凭据文件为准。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/CodexOAuthProvider.ts`
- OAuth 会话：`src/services/llm/sessions/CodexOAuthSession.ts`
- 默认会话工厂：`src/services/llm/sessions/defaultCodexOAuthSession.ts`
- 凭据存储：`src/services/llm/providerCredentials.ts`

## 验证

```powershell
npm.cmd run build -- --pretty false
npm.cmd run smoke:codex-oauth-session
npm.cmd run smoke:codex-oauth-provider
```

验证内容：

- 授权 URL、PKCE、redirect URI 和 token exchange 字段正确。
- refresh token 会刷新 access token，并写回同一 Profile 凭据槽。
- 多个 `codex-oauth` Profile 的 OAuth 凭据不会互相覆盖。
- `CodexOAuthProvider` 能把消息、thinking、tool_call、tool_result 和 usage 归一化。
- `CodexOAuthProvider` 已覆盖 `gpt-5.5` 文本 + 图片用户输入映射；`gpt-5.4` / `gpt-5.4-mini` 仍按文本能力处理，避免未验证模型误收图片。
- 流式事件能转换成 CCR 统一事件。

## 后续

- 如果官方 Codex OAuth 流程变化，先更新 session 层，不改 Profile / 凭据结构。
- 后续如果继续打开其他 Codex OAuth 模型的图片或文件能力，必须同时更新内置能力目录、provider 映射和 smoke，不只改前端标签。
