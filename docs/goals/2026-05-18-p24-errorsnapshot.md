# Goal: P24 ErrorSnapshot 错误分类与展示模型

## 目标

把 CCR 里分散的错误从“普通红框字符串 / console 错误 / provider 原始错误”收敛成统一的错误快照（ErrorSnapshot）。

第一版目标不是一次性做完所有恢复动作，而是先让 Desktop / App Server / Core / provider / tool 的错误有稳定分类、来源、严重级别、用户可读说明和脱敏诊断入口。

## 迭代 1：错误来源拆解

第一轮先盘点真实错误入口，不凭字符串临时猜：

1. Desktop renderer：
   - client-error / uncaught error。
   - DisplayEvent 里已有错误、工具失败、结构化解析失败。
   - 用户看到的大红框、工具卡错误、日志页错误详情。
2. App Server：
   - JSON-RPC error。
   - handler 参数错误、thread/turn/session 状态错误。
   - notification 里的 `response_error` / `turn/error` 类事件。
3. Core：
   - `CoreError` 或现有业务错误。
   - 权限、workspace、配置、会话恢复、上下文压缩错误。
4. Provider：
   - API key 缺失 / 认证失败。
   - 429 / quota / billing。
   - protocol 400，例如 tool result 缺失、schema 不支持、非法 role 顺序。
   - refusal / safety / content filter。
   - network / timeout / proxy。
5. Tool / MCP：
   - 工具参数校验失败。
   - 文件不存在、命令不存在、权限拒绝。
   - MCP server 连接失败、工具执行失败。

第一轮产出：

- 现有字段和现有错误来源位置。
- 哪些错误已经结构化，哪些只能暂时从 message 映射。
- 哪些字段有敏感信息，需要脱敏后进入 `safeDetails`。

## 迭代 2：第一版落地边界

第二轮把实现压到可验证的最小闭环：

本次优先做：

- 新增共享 `ErrorSnapshot` 类型和分类枚举。
- 新增错误归一化函数，把 `unknown/error/string/provider/tool` 输入映射成 ErrorSnapshot。
- 先覆盖这些分类：
  - `auth_expired`
  - `rate_limited`
  - `quota_exceeded`
  - `model_refusal`
  - `safety_blocked`
  - `tool_error`
  - `network_error`
  - `protocol_error`
  - `unknown_error`
- Desktop display event 支持携带 `errorSnapshot`。
- 工具错误、provider 请求错误、History Validator 阻断错误至少能进入 ErrorSnapshot。
- smoke 覆盖分类、脱敏和 display event 映射。

本次不做：

- 不做完整重试 turn。
- 不做重新登录 OAuth 流程。
- 不做复杂倒计时 UI。
- 不接新 provider。
- 不发版本、不打包。

## 验收标准

- [x] 有统一 `ErrorSnapshot` 类型和分类枚举。
- [x] 已知错误能映射到稳定 `category/source/severity/retryable`。
- [x] 未知错误不会崩溃，进入 `unknown_error`。
- [x] Provider 认证、限流、额度、协议错误能被区分。
- [x] Tool 错误和 provider 错误不会都显示成同一种红框。
- [x] `safeDetails` 不包含常见 token / api key / cookie / authorization。
- [x] Desktop display event 能携带 `errorSnapshot`，后续 UI 可以直接渲染。
- [x] smoke 覆盖分类、脱敏和展示事件。
- [x] `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:desktop-display-events
npm.cmd run desktop:build
git diff --check
```

## 完成后下一步

完成第一版后，再补：

- P24-4 用户恢复动作：重试、切模型、打开日志、复制诊断。
- P24-5 限流和额度倒计时展示。
- P24-6 模型拒答、本地权限拒绝、本地安全拦截的 UI 区分。
- STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke。

## 执行结果

状态：P24-1 / P24-2 第一版已完成，P24 整体继续推进。

已完成：

- 新增 `src/types/errorSnapshot.ts`，定义 `CcrErrorSnapshot`、错误分类、严重级别、来源和推荐动作。
- 新增 `createCcrErrorSnapshot(...)` 和 `sanitizeErrorDetails(...)`。
- Desktop `DisplayEvent` 新增 `errorSnapshot` 字段。
- `createErrorDisplayEvent(...)` 会为普通错误生成 ErrorSnapshot。
- 工具失败事件会从 `ToolSnapshot.errorMessage/errorClass` 生成 `tool_error` 快照。
- smoke 覆盖 provider 认证错误分类、工具错误快照和诊断脱敏。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run desktop:build`
- `git diff --check`
