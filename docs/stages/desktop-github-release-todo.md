# CCR Desktop GitHub Release 发布流程 Todo

## 当前任务列表（实时）

- [x] R0 发布流程边界与安全约束
- [x] R1 发布清单与 dry-run 脚本
- [x] R2 发布 Runbook 与文档入口
- [x] R3 验证与下一阶段决策
- [x] R4 发布恢复与 unsigned 策略加固

## 当前指针

- 进行中：无
- 当前正在做：Desktop GitHub Release 发布流程已完成 0.4.1 真实发布，并补齐上传恢复、public 发布和 unsigned 发布策略。
- 完成后下一项：后续只在版本发布体验继续暴露问题时迭代。

## R0 发布流程边界与安全约束

状态：已完成。

目标：

- 明确当前阶段不是正式公开发版。
- 默认命令只做 check / dry-run，不触网。
- 真实创建 GitHub Release 必须显式走 draft 命令。
- 不自动创建 tag，不自动推送 tag。

完成标准：

- todo 和文档写清发布边界。
- 真实发布入口有防误触约束。
- 工作区脏、tag 不存在、`gh` 不存在时真实发布会失败。

当前进展：

- 已明确当前阶段不是正式公开发版，只做发布清单、dry-run 和 draft 入口。
- 默认 `release:desktop:check` / `release:desktop:dry-run` 不触网。
- 真实创建 GitHub Release 草稿必须显式运行 `release:desktop:draft`。
- 真实发布入口会检查 `gh`、本地 tag 和工作区状态，不自动创建 tag，也不自动推送 tag。

## R1 发布清单与 dry-run 脚本

状态：已完成。

目标：

- 新增 Desktop GitHub Release 准备脚本。
- 读取 `package.json`、`latest.yml` 和安装器产物。
- 输出 assets、sha256、release note 文件和 `gh release create` 命令。
- 支持 `--execute --draft` 真实创建草稿，但默认不执行。

完成标准：

- 新增 `scripts/prepare-desktop-github-release.mjs`。
- 新增 `release:desktop:check`。
- 新增 `release:desktop:dry-run`。
- 新增 `release:desktop:draft`。

当前进展：

- 已新增 `scripts/prepare-desktop-github-release.mjs`。
- 已新增 `release:desktop:check`、`release:desktop:dry-run`、`release:desktop:draft`。
- 脚本会读取 `package.json`、`latest.yml` 和 Desktop 产物，输出 assets、sha256、release note 路径和 `gh release create` 命令。
- 脚本会生成 `tmp/desktop-release/release-notes-v<version>.md`，该文件属于临时发布产物，不进入 git。

## R2 发布 Runbook 与文档入口

状态：已完成。

目标：

- 新增 GitHub Release 发布流程文档。
- 更新 Desktop 发布验收 Runbook。
- 更新 `docs/README.md`。

完成标准：

- 有清晰命令顺序。
- 有正式发布前检查项。
- 有当前限制说明。

当前进展：

- 已新增 [CCR Desktop GitHub Release 发布流程](../architecture/desktop-github-release-workflow.md)。
- 已更新 [CCR Desktop 发布验收 Runbook](../architecture/desktop-release-acceptance-runbook.md)。
- 已更新 `docs/README.md` 文档索引。

## R3 验证与下一阶段决策

状态：已完成。

目标：

- 运行 release check。
- 运行 release dry-run。
- 验证缺少 `gh` 时真实 draft 入口会明确失败。
- 运行相关 smoke 和 todo gate。
- 明确下一阶段是自动更新状态机还是签名证书实测。

完成标准：

- `npm.cmd run release:desktop:check` 通过。
- `npm.cmd run release:desktop:dry-run` 通过。
- `npm.cmd run release:desktop:draft` 在缺少 `gh` 时按预期失败。
- 当前 todo gate 允许收口。

当前进展：

- 已验证 `npm.cmd run release:desktop:check` 通过。
- 已验证 `npm.cmd run release:desktop:dry-run` 通过。
- 已验证 `npm.cmd run release:desktop:draft` 在本机缺少 GitHub CLI 时按预期失败，且未触网发布。
- 已验证 `npm.cmd run smoke:desktop-release-artifacts` 通过。
- 已验证 `npm.cmd run smoke:desktop-signing-readiness` 通过，当前安装器仍是 `NotSigned`。
- 已完成 0.4.1 真实公开发布验证；短期不购买代码签名证书，发布策略改为 unsigned + GitHub Release 校验。

## R4 发布恢复与 unsigned 策略加固

状态：已完成。

目标：

- release 脚本支持大安装包上传超时后的恢复。
- 本地脚本支持正式公开发布入口。
- unsigned 发布说明和校验策略落到 release note / runbook。

完成标准：

- 已存在 release 时可复用 release。
- 已匹配资产可跳过，缺失或不匹配资产逐个补传。
- 公开发布只在所有资产匹配后执行。
- 文档明确短期不购买代码签名证书。

当前进展：

- `scripts/prepare-desktop-github-release.mjs` 已改为可恢复发布流程。
- 新增 `release:desktop:public`。
- release note 模板已写明 unsigned 发布和 SHA256 校验。
- 发布 Runbook 已写明 Windows 未知发布者 / SmartScreen 的预期处理口径。

## 后续记录（追加）

- 初始化：从 Desktop 代码签名准备阶段继续进入 GitHub Release 发布流程准备。当前只做发布清单、dry-run 和 draft 入口，不创建真实 GitHub Release，不做自动更新状态机。
- 第 1 轮：完成 GitHub Release 发布流程准备。新增 `scripts/prepare-desktop-github-release.mjs`，默认 check / dry-run 只输出发布清单和 `gh release create` 命令，不触网；真实 draft 入口要求显式执行 `release:desktop:draft`，并检查 `gh`、tag 与工作区状态。新增 [CCR Desktop GitHub Release 发布流程](../architecture/desktop-github-release-workflow.md)，并更新发布验收 Runbook 与文档索引。当前 `release:desktop:check`、`release:desktop:dry-run`、`smoke:desktop-release-artifacts`、`smoke:desktop-signing-readiness` 均通过；`release:desktop:draft` 在本机缺少 GitHub CLI 时按预期失败。
- 第 2 轮：0.4.1 真实发布后补齐发布恢复能力。脚本改为先创建 / 复用 draft release，再逐个上传资产，最后按需公开；已上传且 sha256 / size 匹配的资产会跳过，适合大 exe 上传超时后的重跑恢复。短期明确采用 unsigned 发布策略，不购买代码签名证书。

## 备注

- 当前状态：done
- 下一步需要：后续版本发布时继续验证可恢复上传和 public feed smoke。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop GitHub Release 发布流程准备。
- 当前非目标：不申请付费代码签名证书、不做 VS Code 插件。
