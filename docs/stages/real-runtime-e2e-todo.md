# Claude Code Reforged 真实运行 E2E Todo

## 当前任务列表（实时）

- [ ] P1 干净环境复现（从 GitHub clone、安装、构建、typecheck、CLI smoke）
- [ ] P2 真实模型单轮调用验证（auth / API client / model / stream / headless prompt）
- [ ] P3 核心工具端到端验证（文件读写、搜索、PowerShell、权限询问、tool_result 回写）
- [ ] P4 权限安全专项验证（deny rules、复合命令、PowerShell/Bash parser、fail-closed）
- [ ] P5 依赖与 shim 收敛审查（真实依赖、optional fallback、feature-gated 延后项）
- [ ] P6 最小 CI / 回归脚本固化（install + build + typecheck + cli smoke）

## 当前指针

- 进行中：P1 干净环境复现
- 当前正在做：从远端仓库重新 clone 一份干净副本，并验证安装、构建、类型检查和 CLI 基础入口
- 完成后下一项：P2 真实模型单轮调用验证

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
