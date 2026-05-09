# CCR Desktop 自动更新状态机 Todo

## 当前任务列表（实时）

- [x] U0 自动更新方案边界与成熟库选择
- [x] U1 更新状态机与主进程适配层
- [x] U2 preload / renderer 更新入口
- [x] U3 自动更新 smoke 与文档索引
- [x] U4 验证与下一阶段决策
- [x] U5 开发态更新状态模拟入口
- [ ] U6 真实打包更新联调

## 当前指针

- 进行中：U6 真实打包更新联调
- 当前正在做：开发态模拟入口已完成；下一步准备用真实 draft release metadata 验证打包态更新链路。
- 完成后下一项：Desktop 自动更新第一版收口

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

## U5 开发态更新状态模拟入口

状态：已完成。

目标：

- 在开发态不访问真实 GitHub Release 的前提下，模拟 `available / downloading / downloaded / error`。
- 用同一份 `DesktopUpdateState` 驱动设置页和顶栏提示。
- 打包态不显示模拟按钮，不绕过真实 `electron-updater` 链路。

完成标准：

- `DesktopUpdateService` 提供开发态专用 `applyDevelopmentMock(...)`。
- 主进程新增 `ccr:update-dev-mock` IPC。
- preload 暴露 `mockUpdateState(...)` 白名单方法。
- 设置页开发态显示“开发态模拟”按钮。
- 自动更新 smoke 覆盖模拟入口。

当前进展：

- 已新增开发态模拟状态：`发现更新 / 下载中 / 已下载 / 失败 / 关闭模拟`。
- 已确认模拟安装不会执行 `quitAndInstall(...)`，也不会关闭 App Server。
- 肉眼验证时发现 Desktop 空白页，根因是主进程 preload 路径指向 `out/preload/index.js`，但 `electron-vite` 实际输出 `out/preload/index.mjs`；已修正并加入 smoke 检查。
- 第二次空白页根因是 `react=19.2.4` 与 `react-dom=19.2.0` 版本不一致；已将两者精确锁定到 `19.2.4`，并加入 smoke 检查。
- 已新增开发态 renderer 诊断日志，记录 preload、console、页面挂载快照；打包态默认关闭，可用 `CCR_DESKTOP_RENDERER_DIAGNOSTICS=1` 临时开启。
- 已验证 `npm.cmd run typecheck:desktop`、`npm.cmd run smoke:desktop-auto-update` 和 `npm.cmd run desktop:build` 通过；本阶段早前已跑过 `npm.cmd run ci:smoke`。

## U6 真实打包更新联调

状态：待开始。

目标：

- 用真实打包产物和 draft release metadata 验证 `electron-updater` 能发现新版本。
- 确认顶栏、设置页、下载、下载完成、重启安装这些状态在打包态可用。
- 保持提示式更新，不做静默下载和静默安装。

完成标准：

- 生成一个低版本本地安装包作为“当前版本”。
- 生成一个更高版本 draft release 作为“可更新版本”。
- 打包态客户端能从 `idle -> checking -> available`。
- 点击下载后能进入 `downloading -> downloaded`。
- 安装动作前 App Server 收尾逻辑正常。

当前进展：

- 尚未开始；需要下一轮做真实打包更新联调。

## 后续记录（追加）

- 初始化：从 GitHub Actions 发布流水线继续进入自动更新状态机。当前只做本地状态机、主进程适配层、IPC 和 UI 入口，不真实下载或安装远端更新。
- 第 1 轮：完成 U0-U3。引入 `electron-updater`，新增 `updateState.ts` 和 `updateService.ts`，主进程接入 update IPC，preload 暴露白名单 API，设置页新增自动更新卡片，新增自动更新 smoke 与设计文档。当前等待验证。
- 第 2 轮：完成 U4 验证。`smoke:desktop-auto-update`、`typecheck:desktop`、`desktop:build`、`ci:smoke`、`git diff --check` 均通过。当前自动更新只在打包态启用，开发态显示 disabled，不会真实下载或安装远端更新。
- 第 3 轮：补充 Codex 风格顶栏更新提示。设置页仍作为完整自动更新管理入口；顶栏只在 `available/downloading/downloaded/installing/error` 这些需要用户注意的状态出现，按钮放在右侧，支持 `下载更新`、`重启安装`、失败后 `重试`。开发态 disabled、idle、not-available 不打扰主界面。
- 第 4 轮：补充开发态模拟入口。设置页只在 `runtimeMode=development` 时显示“开发态模拟”，可切换 `发现更新 / 下载中 / 已下载 / 失败 / 关闭模拟`，方便肉眼验收顶栏状态；打包态仍只走真实 `electron-updater`。
- 第 5 轮：修复开发态空白页。实际产物里 preload 是 `out/preload/index.mjs`，主进程原来写成 `index.js` 导致 `window.ccr` 未注入，renderer 初始化直接失败；已改为 `index.mjs`，并让 smoke 固化该检查。
- 第 6 轮：继续修复开发态空白页。preload 修复后页面仍空白，renderer 诊断日志显示真正的前端启动错误是 React 与 React DOM 版本不一致；已锁定 `react` / `react-dom` 到同一精确版本 `19.2.4`，重启后日志确认 `rootChildren=1` 且页面文本已渲染。

## 备注

- 当前状态：active
- 下一步需要：真实打包更新联调。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 自动更新状态机。
- 当前非目标：不真实下载更新、不真实安装更新、不静默强制更新、不做 Core runtime 独立热更新、不做 VS Code 插件。
