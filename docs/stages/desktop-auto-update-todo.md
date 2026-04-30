# CCR Desktop 自动更新状态机 Todo

## 当前任务列表（实时）

- [x] U0 自动更新方案边界与成熟库选择
- [x] U1 更新状态机与主进程适配层
- [x] U2 preload / renderer 更新入口
- [x] U3 自动更新 smoke 与文档索引
- [x] U4 验证与下一阶段决策

## 当前指针

- 进行中：U4 验证与下一阶段决策
- 当前正在做：自动更新状态机阶段已完成；等待进入真实远端发布演练。
- 完成后下一项：真实远端发布演练

## U0 自动更新方案边界与成熟库选择

状态：已完成。

目标：

- 明确第一版采用提示式自动更新，不静默强制更新。
- 复用 `electron-updater`，不手写下载/覆盖安装逻辑。
- 开发态默认禁用真实更新。
- Core runtime 第一版跟随 Desktop 整包升级，不单独热更新。

完成标准：

- 依赖清单包含 `electron-updater`。
- 文档写清开发态、打包态、签名与 GitHub Release 的边界。

当前进展：

- 已安装 `electron-updater` 作为运行态依赖。
- 已明确第一版只做 Desktop 整包更新，不做 Core 独立热更新。
- 已明确开发态禁用真实更新。

## U1 更新状态机与主进程适配层

状态：已完成。

目标：

- 新增纯状态机。
- 新增 `DesktopUpdateService` 适配 `electron-updater`。
- 主进程持有更新状态并通过事件广播。
- 安装更新前先收尾 App Server 子进程。

完成标准：

- 新增 `apps/desktop/src/main/updateState.ts`。
- 新增 `apps/desktop/src/main/updateService.ts`。
- 主进程新增 `updates` 状态。
- 主进程新增 update IPC。

当前进展：

- 已新增 `DesktopUpdateState` 和 `reduceDesktopUpdateState(...)`。
- 已新增 `DesktopUpdateService`，设置 `autoDownload=false`、`autoInstallOnAppQuit=false`。
- 主进程已接入 `ccr:update-status`、`ccr:update-check`、`ccr:update-download`、`ccr:update-install`。
- 安装前会先 `closeManagedClient()`，并用 `updateInstallInProgress` 避免 updater 退出被 `before-quit` 阻断。

## U2 preload / renderer 更新入口

状态：已完成。

目标：

- preload 暴露更新白名单 API。
- 设置页显示自动更新状态。
- UI 按 `canCheck / canDownload / canInstall` 控制按钮状态。

完成标准：

- preload 包含 `getUpdateStatus/checkForUpdates/downloadUpdate/installUpdate`。
- 设置页有自动更新卡片。
- 不在 renderer 里直接引入 Electron 或 `electron-updater`。

当前进展：

- preload 已暴露更新 API。
- 设置页已新增自动更新卡片、进度条和按钮。
- 顶栏已新增 Codex 风格轻量更新提示：检测到更新后在右侧显示版本信息和 `下载更新` 按钮；下载完成后切换为 `重启安装`。
- renderer 只通过 `window.ccr` 调用主进程。

## U3 自动更新 smoke 与文档索引

状态：已完成。

目标：

- 新增自动更新 smoke。
- 更新 `docs/README.md`。
- 新增自动更新状态机文档。
- 纳入 `ci:smoke`。

完成标准：

- 新增 `scripts/smoke-desktop-auto-update.mjs`。
- 新增 `smoke:desktop-auto-update`。
- `ci:smoke` 包含自动更新 smoke。

当前进展：

- 已新增自动更新 smoke。
- 已新增 [CCR Desktop 自动更新状态机](../architecture/desktop-auto-update-state-machine.md)。
- 已将自动更新 smoke 纳入 `ci:smoke`。

## U4 验证与下一阶段决策

状态：已完成。

目标：

- 运行自动更新 smoke。
- 运行 Desktop typecheck/build。
- 运行总 smoke。
- 运行 todo gate。
- 明确下一阶段进入真实远端发布演练。

完成标准：

- `npm.cmd run smoke:desktop-auto-update` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run desktop:build` 通过。
- `npm.cmd run ci:smoke` 通过。
- 当前 todo gate 允许收口。

当前进展：

- 已验证 `npm.cmd run smoke:desktop-auto-update` 通过。
- 已验证 `npm.cmd run typecheck:desktop` 通过。
- 已验证 `npm.cmd run desktop:build` 通过。
- 已验证 `npm.cmd run ci:smoke` 通过。
- 已验证 `git diff --check` 通过。
- 已追加验证顶栏更新提示：`typecheck:desktop`、`smoke:desktop-auto-update`、`desktop:build` 通过。
- 下一阶段建议进入真实远端发布演练。

## 后续记录（追加）

- 初始化：从 GitHub Actions 发布流水线继续进入自动更新状态机。当前只做本地状态机、主进程适配层、IPC 和 UI 入口，不真实下载或安装远端更新。
- 第 1 轮：完成 U0-U3。引入 `electron-updater`，新增 `updateState.ts` 和 `updateService.ts`，主进程接入 update IPC，preload 暴露白名单 API，设置页新增自动更新卡片，新增自动更新 smoke 与设计文档。当前等待验证。
- 第 2 轮：完成 U4 验证。`smoke:desktop-auto-update`、`typecheck:desktop`、`desktop:build`、`ci:smoke`、`git diff --check` 均通过。当前自动更新只在打包态启用，开发态显示 disabled，不会真实下载或安装远端更新。
- 第 3 轮：补充 Codex 风格顶栏更新提示。设置页仍作为完整自动更新管理入口；顶栏只在 `available/downloading/downloaded/installing/error` 这些需要用户注意的状态出现，按钮放在右侧，支持 `下载更新`、`重启安装`、失败后 `重试`。开发态 disabled、idle、not-available 不打扰主界面。

## 备注

- 当前状态：active
- 下一步需要：进入真实远端发布演练。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 自动更新状态机。
- 当前非目标：不真实下载更新、不真实安装更新、不静默强制更新、不做 Core runtime 独立热更新、不做 VS Code 插件。
