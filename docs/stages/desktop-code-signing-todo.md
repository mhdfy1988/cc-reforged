# CCR Desktop 代码签名准备 Todo

## 当前任务列表（实时）

- [x] S0 签名阶段边界与证书输入方案
- [x] S1 签名打包入口与配置切换
- [x] S2 签名预检与产物验签脚本
- [x] S3 代码签名 Runbook 与文档索引
- [x] S4 验证与下一阶段决策

## 当前指针

- 进行中：S4 验证与下一阶段决策
- 当前正在做：代码签名准备阶段已完成；等待确认下一阶段进入 GitHub Release 发布流程，还是自动更新状态机。
- 完成后下一项：待确认下一阶段主线

## S0 签名阶段边界与证书输入方案

状态：已完成。

目标：

- 明确当前阶段是代码签名准备，不要求当前机器已有证书。
- 明确默认 `desktop:dist` 仍生成未签名本机验证包。
- 明确正式签名使用 `WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD` 或 `CSC_LINK/CSC_KEY_PASSWORD`。
- 不把证书路径、密码或 token 写入仓库。

完成标准：

- todo 和文档写清签名边界。
- 签名证书输入只通过环境变量。
- 未签名开发包与正式签名包有不同命令。

当前进展：

- 已明确默认 `desktop:dist` 仍是未签名本机验证包。
- 已明确正式签名入口使用环境变量，不把证书路径、base64 或密码写入仓库。
- 支持 `WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD` 或 `CSC_LINK/CSC_KEY_PASSWORD`。

## S1 签名打包入口与配置切换

状态：已完成。

目标：

- 新增 `desktop:dist:signed`。
- 在 signed 模式下启用 `signAndEditExecutable` 和 `verifyUpdateCodeSignature`。
- 在 unsigned 模式下继续保持当前可用的本机打包路径。

完成标准：

- `desktop-package.mjs` 支持 `--signed`。
- 缺少证书环境变量时，signed 模式明确失败。
- 默认 `desktop:dist` 不要求证书。

当前进展：

- 已新增 `desktop:dist:signed`。
- `desktop-package.mjs` 已支持 `--signed`。
- signed 模式会临时生成 electron-builder signed config，启用 `signAndEditExecutable`、`verifyUpdateCodeSignature`、`forceCodeSigning`。
- unsigned 模式继续保持 `CSC_IDENTITY_AUTO_DISCOVERY=false`，避免普通本机打包被证书发现和权限问题干扰。

## S2 签名预检与产物验签脚本

状态：已完成。

目标：

- 新增签名 readiness smoke。
- 能检查证书环境变量是否成对出现。
- 能检查安装器是否已签名。
- 未签名包默认不失败，但 `CCR_REQUIRE_SIGNED=1` 时必须失败。

完成标准：

- 新增 `scripts/smoke-desktop-signing-readiness.mjs`。
- 新增 `smoke:desktop-signing-readiness`。
- Windows 下能调用 Authenticode 验签。

当前进展：

- 已新增 `scripts/smoke-desktop-signing-readiness.mjs`。
- 已新增 `smoke:desktop-signing-readiness` 并纳入 `ci:smoke`。
- 默认未签名安装器会报告 `NotSigned`，但不失败。
- `CCR_REQUIRE_SIGNED=1` 时，未签名安装器会失败。
- 缺少证书变量时，`desktop:dist:signed` 会明确失败。

## S3 代码签名 Runbook 与文档索引

状态：已完成。

目标：

- 新增代码签名方案文档。
- 明确本机签名、CI 签名、发布前验签步骤。
- 更新文档索引和发布验收 Runbook。

完成标准：

- 新增代码签名文档。
- `docs/README.md` 有入口。
- Runbook 中包含签名前后命令。

当前进展：

- 已新增 [CCR Desktop 代码签名准备方案](../architecture/desktop-code-signing-plan.md)。
- 已更新 [CCR Desktop 发布验收 Runbook](../architecture/desktop-release-acceptance-runbook.md)。
- 已更新 [CCR Desktop 安装器与发布准备方案](../architecture/desktop-installer-release-readiness.md)。
- 已更新 `docs/README.md`。

## S4 验证与下一阶段决策

状态：已完成。

目标：

- 运行默认 unsigned 打包验证。
- 运行签名 readiness smoke。
- 运行总 smoke。
- 明确下一阶段是自动更新还是 GitHub Release。

完成标准：

- `smoke:desktop-signing-readiness` 通过。
- `desktop:dist` 通过。
- `smoke:desktop-release-artifacts` 通过。
- `ci:smoke` 通过。
- 当前 todo gate 允许收口。

当前进展：

- 已验证 `npm.cmd run smoke:desktop-signing-readiness` 通过，当前安装器状态为 `NotSigned`。
- 已验证 `desktop:dist:signed` 在缺少证书环境变量时会按预期失败。
- 已验证 `CCR_REQUIRE_SIGNED=1` 会让未签名安装器验签失败。
- 已验证 `npm.cmd run desktop:dist` 通过。
- 已验证 `npm.cmd run smoke:desktop-release-artifacts` 通过。
- 已验证 `npm.cmd run smoke:desktop-packaged` 通过。
- 已验证 `npm.cmd run ci:smoke` 通过。
- 下一阶段建议先做 GitHub Release 发布流程，因为自动更新需要 release artifact 与签名状态共同稳定。

## 后续记录（追加）

- 初始化：从品牌与安装器体验阶段继续拆出代码签名准备主线。当前不要求证书，不做真实签名，只建立签名模式、预检、验签和 Runbook。
- 第 1 轮：完成代码签名准备阶段。新增 `desktop:dist:signed` 和 `--signed` 打包模式，signed 模式会要求 `WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD` 或 `CSC_LINK/CSC_KEY_PASSWORD`，并临时启用 `signAndEditExecutable`、`verifyUpdateCodeSignature`、`forceCodeSigning`。新增 `smoke:desktop-signing-readiness`，可检查证书环境变量配对、安装器 Authenticode 状态，并支持 `CCR_REQUIRE_SIGNED=1` 强制签名门禁。当前无证书环境下默认安装器正确报告 `NotSigned`，`desktop:dist:signed` 和 `CCR_REQUIRE_SIGNED=1` 均能按预期失败。`desktop:dist`、`smoke:desktop-release-artifacts`、`smoke:desktop-packaged`、`ci:smoke` 均通过。

## 备注

- 当前状态：active
- 下一步需要：确认下一阶段主线；建议先做 GitHub Release 发布流程，再做自动更新状态机。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 代码签名准备。
- 当前非目标：不申请证书、不提交证书、不启用自动更新、不做 GitHub Release、不做 VS Code 插件。
