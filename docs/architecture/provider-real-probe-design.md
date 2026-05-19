# CCR Provider 真实 Probe 设计与入口

## 目标

这份文档定义当前正式版 provider 的真实联网 probe 入口。它只覆盖已经进入成熟化主线的 provider，不新增 OpenAI-compatible / Gateway、Anthropic 官方或 Gemini。

当前目标 provider：

- `codex-oauth`
- `deepseek`
- `minimax`
- `minimax-cn`
- `kimi-api`
- `kimi-code`
- `glm-api`
- `glm-coding`

## 设计原则

1. probe 不改配置、不写凭据、不切当前 Profile。
2. probe 输出只给脱敏 JSON，不打印 API Key、OAuth token、raw response、base64 图片。
3. 默认只跑轻量检查：`auth,text,stream`。
4. 图片生成可能产生费用，必须通过 `--full` 或 `--checks image` 显式打开。
5. 没有凭据时不报错中断，记录为 `skipped/auth_missing`。
6. 每个检查都有限时，默认 `45000ms`。
7. 真实 probe 结果用于回填 provider 成熟度矩阵；默认 smoke 仍然保持 mock/fixture，不联网。

## CLI 入口

```powershell
npm.cmd run build
npm.cmd run probe:provider -- --dry-run
npm.cmd run probe:provider -- deepseek
npm.cmd run probe:provider -- kimi-api glm-api --checks text,stream,tool
npm.cmd run probe:provider -- kimi-code --checks text,stream
npm.cmd run probe:provider -- minimax minimax-cn glm-api --checks image
npm.cmd run probe:provider -- --full
```

参数：

| 参数 | 含义 |
| --- | --- |
| 无目标 | 扫描当前 8 个成熟化 provider |
| `providerId` | 只 probe 指定 provider |
| `profileId` | 只 probe 指定 profile |
| `--dry-run` | 只解析配置、凭据和计划，不发联网请求 |
| `--checks a,b` | 指定检查项，可选 `auth,text,stream,tool,image` |
| `--full` | 等价于 `auth,text,stream,tool,image` |
| `--timeout-ms 45000` | 单个检查超时时间 |

## 检查项

| 检查 | 行为 | 通过条件 |
| --- | --- | --- |
| `auth` | 读取 profile/env 凭据或 Codex OAuth availability | 凭据可用；缺失则后续联网检查跳过 |
| `text` | 发送一个最小文本生成请求 | provider 返回可解析标准输出 |
| `stream` | 发送一个最小流式请求 | 收到 `response_complete` 或等价最终事件 |
| `tool` | 要求模型调用 `probe_status` 工具 | 返回标准 `tool_call`，名称为 `probe_status` |
| `image` | 对支持生图的 provider 发最小文本生图请求 | 返回 `CcrImageContentBlock`；base64 不进入 raw |

`kimi-code` probe 必须落到 Anthropic Messages 路径 `https://api.kimi.com/coding/v1/messages`。如果结果仍然显示 `/v1/chat/completions` 或返回 `kimi-for-coding` 只允许 Coding Agent 的 403，说明当前配置或构建仍在走旧的 OpenAI Chat 兼容路径。

当前 `image` 只对下面 provider 启用：

| Provider | 图片模型 |
| --- | --- |
| `codex-oauth` | `gpt-5.5` |
| `minimax` | `image-01` |
| `minimax-cn` | `image-01` |
| `glm-api` | `glm-image` |

## 输出结构

输出是 JSON，核心字段：

```json
{
  "ok": true,
  "dryRun": true,
  "checkedAt": "2026-05-19T00:00:00.000Z",
  "configPath": ".../llm.config.local.json",
  "credentialsPath": ".../llm.credentials.local.json",
  "checks": ["auth", "text", "stream"],
  "results": [
    {
      "providerId": "deepseek",
      "profileId": "deepseek-1",
      "model": "deepseek-v4-flash",
      "auth": {
        "configured": true,
        "available": true,
        "sourceType": "file"
      },
      "checks": [
        {
          "name": "text",
          "status": "passed",
          "durationMs": 1234,
          "model": "deepseek-v4-flash",
          "outputTypes": ["thinking", "text"]
        }
      ]
    }
  ]
}
```

错误分类：

| 分类 | 含义 |
| --- | --- |
| `auth_missing` | 缺少 API Key / OAuth 凭据 |
| `auth` | 401、403、invalid key 等认证失败 |
| `rate_limit` | 限流 |
| `quota` | 余额或额度不足 |
| `network` | 网络、DNS、超时、中断 |
| `protocol` | 响应结构不符合 CCR adapter 预期 |
| `unknown` | 暂未归类 |

## 落点

- CLI：`scripts/probe-provider.mjs`
- npm script：`probe:provider`
- 默认输出目录：`.tmp/provider-probe`
- 成熟度记录：`docs/architecture/protocol-implementation-status.md`

## 后续回填规则

每次真实 probe 后，按下面口径更新成熟度矩阵：

- `mock 已过`：只通过默认 smoke / fixture。
- `真实可用`：真实 probe 对应检查通过。
- `真实失败`：真实 probe 发起成功但返回错误，记录错误分类。
- `缺 key`：本机没有对应凭据。
- `缺权限`：凭据存在，但模型或能力无权限。
- `接口不支持`：provider 明确不支持该能力。

## 当前脱敏记录

2026-05-19 已完成轻量真实 probe：

| Profile | Provider | Checks | 结果 | 备注 |
| --- | --- | --- | --- | --- |
| `deepseek-1` | `deepseek` | `auth,text,stream` | 通过 | 后续补 tool / 错误分类 |
| `minimax-cn-1` | `minimax-cn` | `auth,text,stream` | 通过 | 后续补 tool / 图片生成 / 错误分类 |
| `kimi-api-1` | `kimi-api` | `auth,text,stream` | 通过 | 首次 probe 发现 `kimi-k2.6` 只允许 `temperature: 1`，已在 provider 壳修正 |
| `glm-api-1` | `glm-api` | `auth,text,stream` | 通过 | 后续补 `glm-5v-turbo` 多模态和 `glm-image` 生图 |

`kimi-code` 当前本机配置里没有 `kimi-code-*` Profile / 凭据，暂不能真实 probe；保存配置后应确认请求落到 `https://api.kimi.com/coding/v1/messages`。
