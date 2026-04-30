# CCR Desktop GitHub Actions 发布流水线 Todo

## 当前任务列表（实时）

- [x] A0 发布流水线边界与触发方式
- [x] A1 GitHub Actions workflow 实现
- [x] A2 workflow 结构校验脚本
- [x] A3 发布方案文档与索引
- [x] A4 验证与下一阶段决策

## 当前指针

- 进行中：A4 验证与下一阶段决策
- 当前正在做：GitHub Actions 发布流水线准备已完成；等待进入自动更新状态机设计与实现。
- 完成后下一项：自动更新状态机设计与实现

## A0 发布流水线边界与触发方式

状态：已完成。

目标：

- 明确 GitHub Actions 是正式发布路径，本地 `gh` 只是辅助和应急路径。
- 第一版只支持手动触发 `workflow_dispatch`。
- 默认生成 GitHub Release draft，不直接公开发布。
- 默认不签名；如显式选择 signed，才读取 GitHub Secrets。

完成标准：

- todo 和文档写清边界。
- workflow 输入参数能区分 unsigned / signed、draft / public。
- 不自动创建 tag；必须基于已有 tag 发布。

当前进展：

- 已明确 GitHub Actions 是正式发布路径，本地 `gh` 只作为辅助和应急路径。
- 第一版使用 `workflow_dispatch` 手动触发。
- 默认创建 GitHub Release draft，不直接公开发布。
- 默认走 unsigned 打包；只有显式选择 `signed=true` 才读取 GitHub Secrets。
- 发布必须基于已有 tag，workflow 不自动创建 tag。

## A1 GitHub Actions workflow 实现

状态：已完成。

目标：

- 新增 `.github/workflows/desktop-release.yml`。
- 在 Windows runner 上安装依赖、构建、校验、打包 Desktop。
- 上传 `.exe`、`.blockmap`、`latest.yml` 到 GitHub Release。
- 复用 `scripts/prepare-desktop-github-release.mjs`，避免本地和 CI 两套发布逻辑。

完成标准：

- workflow 使用 `workflow_dispatch`。
- workflow 权限包含 `contents: write`。
- workflow 使用 Node 24。
- workflow 使用 `GH_TOKEN` 调用 release 脚本。

当前进展：

- 已新增 `.github/workflows/desktop-release.yml`。
- workflow 使用 `windows-latest`、Node 24、`npm.cmd install`。
- workflow 会先跑 `ci:smoke`，再按 `signed` 输入选择 `desktop:dist` 或 `desktop:dist:signed`。
- workflow 会运行 `smoke:desktop-release-artifacts`、`smoke:desktop-signing-readiness`、`release:desktop:check`。
- workflow 使用 `GH_TOKEN` 调用 `scripts/prepare-desktop-github-release.mjs --execute` 创建 GitHub Release。

## A2 workflow 结构校验脚本

状态：已完成。

目标：

- 新增本地 smoke，检查 workflow 关键结构。
- 防止后续误删 `workflow_dispatch`、`contents: write`、Node 24、release 执行步骤。

完成标准：

- 新增 `scripts/smoke-desktop-github-actions-release.mjs`。
- 新增 `smoke:desktop-github-actions-release`。
- 纳入 `ci:smoke`。

当前进展：

- 已新增 `scripts/smoke-desktop-github-actions-release.mjs`。
- 已新增 `smoke:desktop-github-actions-release`。
- 已纳入 `ci:smoke`。
- 校验覆盖 `workflow_dispatch`、`contents: write`、Node 24、tag checkout、unsigned/signed 打包、release 脚本和 `GH_TOKEN`。

## A3 发布方案文档与索引

状态：已完成。

目标：

- 新增 GitHub Actions Desktop 发布方案文档。
- 更新 `docs/README.md`。
- 更新 GitHub Release 发布流程文档，明确本地 `gh` 与 Actions 的关系。

完成标准：

- 文档包含触发入口、输入参数、Secrets、产物、失败边界。
- 文档说明不买证书时的 unsigned 路线。
- 文档说明未来接入代码签名的方式。

当前进展：

- 已新增 [CCR Desktop GitHub Actions 发布流水线](../architecture/desktop-github-actions-release-workflow.md)。
- 已更新 [CCR Desktop GitHub Release 发布流程](../architecture/desktop-github-release-workflow.md)，明确本地 `gh` 是辅助路径。
- 已更新 [CCR Desktop 发布验收 Runbook](../architecture/desktop-release-acceptance-runbook.md)。
- 已更新 `docs/README.md`。

## A4 验证与下一阶段决策

状态：未开始。

目标：

- 运行 workflow smoke。
- 运行 release check / dry-run。
- 运行总 smoke 和 todo gate。
- 明确下一阶段进入自动更新状态机。

完成标准：

- `npm.cmd run smoke:desktop-github-actions-release` 通过。
- `npm.cmd run release:desktop:check` 通过。
- `npm.cmd run release:desktop:dry-run` 通过。
- `npm.cmd run ci:smoke` 通过。
- 当前 todo gate 允许收口。

当前进展：

- 已验证 `npm.cmd run smoke:desktop-github-actions-release` 通过。
- 已验证 `npm.cmd run release:desktop:check` 通过，release 命令包含 `--verify-tag`。
- 已验证 `npm.cmd run release:desktop:dry-run` 通过，release 命令包含 `--verify-tag`。
- 已验证 `npm.cmd run ci:smoke` 通过。
- 已验证 `git diff --check` 通过。
- 下一阶段建议进入自动更新状态机设计与实现。

## 后续记录（追加）

- 初始化：从本地 GitHub Release 发布准备继续推进到正式 GitHub Actions 发布流水线。当前只做手动触发 draft release，不真实运行远端 workflow，不启用证书签名。
- 第 1 轮：完成 A0-A3。新增 `Desktop Release` GitHub Actions workflow，发布入口固定为手动触发，输入 `tag/draft/signed/require_signed`，默认 unsigned draft release。workflow 复用本地 `prepare-desktop-github-release.mjs` 创建 release，避免 CI 和本地两套发布逻辑；脚本新增 `--verify-tag`，防止 GitHub CLI 误创建 tag。新增 workflow smoke 并纳入 `ci:smoke`，发布文档和索引已更新。
- 第 2 轮：完成 A4 验证。`smoke:desktop-github-actions-release`、`release:desktop:check`、`release:desktop:dry-run`、`ci:smoke`、`git diff --check` 均通过。本轮未真实运行远端 workflow，也未创建 GitHub Release；当前只完成流水线文件和本地结构验证。

## 备注

- 当前状态：active
- 下一步需要：进入自动更新状态机设计与实现。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop GitHub Actions 发布流水线。
- 当前非目标：不真实创建 GitHub Release、不公开发布、不购买或提交证书、不做自动更新状态机、不做 VS Code 插件。
