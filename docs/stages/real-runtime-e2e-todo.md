# Claude Code Reforged 真实运行 E2E Todo

## 当前任务列表（实时）

- [x] P1 干净环境复现（从 GitHub clone、安装、构建、typecheck、CLI smoke）
- [ ] P2 真实模型单轮调用验证（auth / API client / model / stream / headless prompt）
- [ ] P3 核心工具端到端验证（文件读写、搜索、PowerShell、权限询问、tool_result 回写）
- [ ] P4 权限安全专项验证（deny rules、复合命令、PowerShell/Bash parser、fail-closed）
- [ ] P5 依赖与 shim 收敛审查（真实依赖、optional fallback、feature-gated 延后项）
- [ ] P6 最小 CI / 回归脚本固化（install + build + typecheck + cli smoke）

## 当前指针

- 进行中：P2 真实模型单轮调用验证
- 当前正在做：验证真实 headless prompt 的 auth 来源、API client、模型选择、流式输出和错误处理表现
- 完成后下一项：P3 核心工具端到端验证

## 执行边界

- 当前仓库：`D:\agent_project\claude-code-reforged`
- 干净验证目录：`D:\agent_project\_clean_smoke`
- 当前阶段目标：证明恢复版不只是在本地修复目录里能跑，而是在干净环境中也能复现基础运行闭环。
- 当前阶段非目标：不在 P1 中要求真实模型调用成功；真实 API、登录态、模型请求和流式响应放到 P2。

## 验收口径

- P1 完成标准：干净 clone 后，`npm.cmd install`、`npm.cmd run build -- --pretty false`、`npm.cmd run typecheck -- --pretty false`、`node .\cli.js --version`、`node .\cli.js --help` 均有明确结果；如失败，记录失败点并转入修复。
- P2 完成标准：至少完成一次真实 headless prompt 调用，明确 auth 来源、模型选择、请求链路、流式输出和错误处理表现。
- P3 完成标准：在临时目录完成一轮模型驱动或可等价复现的工具调用链，确认工具输入、权限判定、执行结果和消息回写关系。
- P4 完成标准：危险命令默认 fail-closed；复合命令、超长命令、PowerShell 特殊语法不能绕过 deny rules。
- P5 完成标准：列出恢复期 shim / 真实依赖 / optional fallback 的当前边界，并给出保留、替换或延后的结论。
- P6 完成标准：形成可重复运行的最小回归入口，并在本地验证通过。

## 后续记录（追加）

- 初始化：typecheck 清零、runtime smoke 完成、首次代码已推送 GitHub 后，本阶段接管为新的权威 todo。推进顺序从静态修复转向真实运行端到端验证，先干净环境复现，再进入真实模型和真实工具链。
- 第 1 轮：P1 干净环境复现完成。第一次干净 `npm.cmd install` 失败，原因是恢复期依赖清单中保留了只用于无效类型导入的 `@anthropic-ai/claude-agent-sdk@0.2.94`，它要求 peer `zod@^4.0.0`，与根项目 `zod@^3.25.76` 冲突；已删除 `src/cli/print.ts` 中未使用的外部 `PermissionMode` 类型导入，并从 `package.json` / `package-lock.json` 移除该依赖。第二次干净安装又被 `prepare` 发布保护误伤；已将发布保护移动到 `prepublishOnly`，只拦发布不拦普通安装。最终从 GitHub 浅克隆 `24a1f1d` 到 `D:\agent_project\_clean_smoke\cc-reforged-e2e`，`npm.cmd install`、`npm.cmd run build -- --pretty false`、`npm.cmd run typecheck -- --pretty false`、`node .\cli.js --version`、`node .\cli.js --help` 全部通过。当前切到 P2 真实模型单轮调用验证。
- 第 2 轮：P2 真实模型单轮调用验证已推进到认证边界。环境检查确认 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`CLAUDE_CODE_OAUTH_TOKEN`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`、`CLAUDE_CODE_USE_BEDROCK`、`CLAUDE_CODE_USE_VERTEX` 均未设置。随后在干净副本执行 `node .\cli.js -p "Reply exactly: OK" --model sonnet --output-format json --max-budget-usd 0.01 --no-session-persistence`，命令成功进入 headless JSON result 链路，但返回 `Not logged in · Please run /login`，`duration_api_ms=0`、`total_cost_usd=0`、`usage.input_tokens=0`。结论：P2 当前不是代码执行 blocker，而是需要先确定认证方式。

## 备注

- 当前状态：decision-needed
- 决策点：P2 真实模型调用需要一个可用认证来源。可选路径是设置 `ANTHROPIC_API_KEY`，运行 CLI 登录以写入本机认证态，或配置兼容的 `ANTHROPIC_BASE_URL` / 第三方 provider。
- 下一步需要：选定认证方式后，重新执行 P2 的最小 headless prompt，再继续 P3 核心工具端到端验证。
