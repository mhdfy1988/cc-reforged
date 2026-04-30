# CCR Desktop 品牌与安装器体验 Todo

## 当前任务列表（实时）

- [x] B0 品牌阶段边界与资源方案
- [x] B1 正式图标资源生成与版本管理
- [x] B2 Electron Builder 图标与安装器品牌接入
- [x] B3 品牌产物 smoke 与文档更新
- [x] B4 重新打包验证与下一阶段决策

## 当前指针

- 进行中：B4 重新打包验证与下一阶段决策
- 当前正在做：品牌与安装器体验阶段已完成；等待确认下一阶段进入代码签名、自动更新，还是 GitHub Release 发布流程。
- 完成后下一项：待确认下一阶段主线

## B0 品牌阶段边界与资源方案

状态：已完成。

目标：

- 明确当前阶段聚焦 Desktop 品牌与安装器体验，不做代码签名、自动更新和 VS Code。
- 明确图标资源来源、生成方式和版本管理位置。
- 优先采用成熟工具链，避免手写脆弱的图像转换逻辑。

完成标准：

- todo 中写清当前阶段边界。
- 图标生成方案可重复执行。
- 若需要引入新依赖，说明用途和边界。

当前进展：

- 已明确当前阶段只做 Desktop 图标、安装器品牌和可验证产物。
- 已确认本机无稳定可用的 ImageMagick `magick`，Windows 自带 `convert.exe` 不是图片转换工具。
- 已引入 `sharp` 作为开发期图标生成依赖，只用于生成 Desktop 图标资源，不进入 CCR Core 运行时语义。

## B1 正式图标资源生成与版本管理

状态：已完成。

目标：

- 基于 `apps/desktop/assets/ccr-desktop-icon.svg` 生成 PNG / ICO 资源。
- 保留 SVG 作为单一设计源。
- 输出资源进入 `apps/desktop/assets/generated/`。

完成标准：

- 生成 `icon.png`。
- 生成 `icon.ico`。
- 生成脚本可重复执行。
- 资源不依赖手工复制。

当前进展：

- 已更新 `apps/desktop/assets/ccr-desktop-icon.svg`，移除 placeholder 语义。
- 已新增 `scripts/build-desktop-icons.mjs`。
- 已生成 `apps/desktop/assets/generated/icon.png`、`icon.ico` 和多尺寸 PNG。
- 已新增 `desktop:icons` 命令。

## B2 Electron Builder 图标与安装器品牌接入

状态：已完成。

目标：

- 将 Windows 打包配置接入 `icon.ico`。
- 保持 `productName = CCR Desktop`。
- 保持安装器产物命名无空格。
- 避免重新引入默认 Electron 图标。

完成标准：

- `package.json` 中 `build.win.icon` 指向生成的 `.ico`。
- `desktop:dist` 不再提示 default Electron icon。
- 打包态 App Server smoke 仍通过。

当前进展：

- `package.json` 已配置 `build.win.icon`。
- `package.json` 已配置 `nsis.installerIcon`、`nsis.uninstallerIcon`、`uninstallDisplayName`。
- Desktop `BrowserWindow` 已接入 `icon.png`，开发态和打包态共用同一套生成资源。
- `desktop-package.mjs` 会在打包前自动运行图标生成脚本。

## B3 品牌产物 smoke 与文档更新

状态：已完成。

目标：

- 新增或扩展 smoke，校验图标资源存在、大小合理、打包配置已指向图标。
- 更新安装器与发布准备文档。
- 更新发布验收 Runbook。

完成标准：

- 品牌 smoke 可独立运行。
- 文档说明图标生成命令和验证命令。
- `docs/README.md` 有阶段 todo 入口。

当前进展：

- 已新增 `scripts/smoke-desktop-branding.mjs`。
- 已新增 `smoke:desktop-branding` 并纳入 `ci:smoke`。
- 已新增 [CCR Desktop 品牌与安装器体验方案](../architecture/desktop-branding-installer-plan.md)。
- 已更新安装器发布准备方案、发布验收 Runbook 和文档索引。

## B4 重新打包验证与下一阶段决策

状态：已完成。

目标：

- 重新运行 `desktop:dist`。
- 运行发布产物 smoke、打包态 smoke 和总 smoke。
- 明确下一阶段建议进入代码签名还是自动更新。

完成标准：

- `desktop:dist` 通过。
- `smoke:desktop-release-artifacts` 通过。
- `smoke:desktop-packaged` 通过。
- `ci:smoke` 通过。
- 当前 todo gate 允许收口。

当前进展：

- 已运行 `npm.cmd run desktop:dist`，打包日志不再出现 `default Electron icon is used`。
- 已运行 `npm.cmd run smoke:desktop-branding` 通过。
- 已运行 `npm.cmd run smoke:desktop-release-artifacts` 通过。
- 已运行 `npm.cmd run smoke:desktop-packaged` 通过。
- 已运行 `npm.cmd run ci:smoke` 通过。
- 下一阶段建议优先进入代码签名准备；自动更新和 GitHub Release 都依赖签名与发布身份先稳定。

## 后续记录（追加）

- 初始化：从 Desktop 发布验收准备阶段继续拆出品牌与安装器体验主线。当前只做图标、安装器品牌和可验证产物，不做代码签名、自动更新、GitHub Release、VS Code。
- 第 1 轮：完成品牌与安装器体验阶段。基于 `ccr-desktop-icon.svg` 生成 `icon.png`、`icon.ico` 和多尺寸 PNG，引入 `sharp` 作为开发期图标生成工具；`package.json` 接入 `build.win.icon`、`nsis.installerIcon`、`nsis.uninstallerIcon`，Desktop BrowserWindow 也接入运行态 PNG 图标。`desktop:dist` 已确认不再提示默认 Electron 图标，`smoke:desktop-branding`、`smoke:desktop-release-artifacts`、`smoke:desktop-packaged`、`ci:smoke` 均通过。

## 备注

- 当前状态：active
- 下一步需要：确认下一阶段主线；建议优先做代码签名准备，再做自动更新和 GitHub Release。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 品牌与安装器体验。
- 当前非目标：不做代码签名、不启用自动更新、不做 GitHub Release、不做 VS Code 插件。
