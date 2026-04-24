# Claude Code Reforged 真实运行 E2E Todo

## 当前任务列表（实时）

- [x] P1 干净环境复现（从 GitHub clone、安装、构建、typecheck、CLI smoke）
- [ ] P2 真实模型单轮调用验证（auth / API client / model / stream / headless prompt）
- [x] P3 核心工具端到端验证（文件读写、搜索、PowerShell、权限询问、tool_result 回写）
- [x] P4 权限安全专项验证（deny rules、复合命令、PowerShell/Bash parser、fail-closed）
- [x] P5 依赖与 shim 收敛审查（真实依赖、optional fallback、feature-gated 延后项）
- [x] P6 最小 CI / 回归脚本固化（install + build + typecheck + cli smoke）

## 当前指针

- 进行中：P2 真实模型单轮调用验证
- 当前正在做：等待可用真实认证来源后，重新执行最小 headless prompt，验证 API client、模型选择、流式输出和错误处理表现
- 完成后下一项：无；P2 通过后本阶段闭环

## 执行边界

- 当前仓库：`D:\agent_project\claude-code-reforged`
- 干净验证目录：`D:\agent_project\_clean_smoke`
- 当前阶段目标：证明恢复版不只是在本地修复目录里能跑，而是在干净环境中也能复现基础运行闭环。
- 当前阶段非目标：不伪造真实模型调用成功；没有认证来源时，只能验证 headless JSON auth-gate 路径，不能把它记成 P2 通过。

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
- 第 3 轮：P3-P6 已固化为可重复脚本和 CI 入口。新增 `scripts/smoke-runtime.mjs`，覆盖 CLI version/help、无认证 headless JSON auth-gate、工具注册表、`Write -> Read -> tool_result` 回写、PowerShell 工具执行和 `tool_result` 回写；新增 `scripts/smoke-permissions.mjs`，覆盖 Bash deny rules、复合命令、51 子命令上限、`curl|sh`、`wget`、PowerShell `Remove-Item` / `Invoke-WebRequest` 等危险路径，验收口径是危险命令绝不直接 `allow`；新增 `scripts/smoke-deps.mjs`，覆盖移除 `@anthropic-ai/claude-agent-sdk`、保留 `zod@^3.25.76`、发布保护迁到 `prepublishOnly`、shim 声明存在、`npm pack --dry-run` 不包含 `src/` / `tmp/`；新增 `scripts/ci-smoke.mjs` 和 `.github/workflows/ci.yml` 串联 build、typecheck、CLI smoke、runtime smoke、permission smoke、dependency smoke。已在本地运行 `npm.cmd run ci:smoke` 通过。期间修正了两个脚本层问题：Node 在 Windows 下调用 `.cmd` 需经 `cmd.exe /c`，以及 `Write` 工具 smoke 需使用唯一临时文件名以避开“未先读就覆盖既有文件”的正确保护。

## 备注

- 当前状态：blocked
- 阻塞点：P2 真实模型调用需要一个可用认证来源；当前环境没有 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`CLAUDE_CODE_OAUTH_TOKEN`、`ANTHROPIC_BASE_URL` 或可用第三方 provider 配置。
- 下一步需要：设置真实认证来源后，重新执行最小 headless prompt；通过后本阶段即可闭环。
