# CCR Desktop 自动更新状态机

## 1. 目标

这一阶段把 CCR Desktop 从“安装器可以发布”推进到“客户端可以感知新版本并按状态提示用户”的能力。

第一版目标不是静默强制更新，而是提示式更新：

```text
用户打开 Desktop
-> 用户在设置页点击检查更新
-> Desktop 读取 GitHub Release metadata
-> 有新版本则提示
-> 用户确认下载
-> 下载完成后用户确认重启安装
```

当前不做：

- 不在开发态真实检查远端更新。
- 不静默下载。
- 不静默安装。
- 不单独热更新 Core runtime。
- 不绕过 GitHub Release 发布链路。

## 2. 为什么用 electron-updater

Desktop 第一版已经采用 Electron 和 electron-builder。自动更新继续使用 `electron-updater`，原因是：

- 它和 electron-builder 生成的 `latest.yml` / `.blockmap` 是同一套生态。
- 支持 GitHub Releases 作为更新源。
- 支持 `update-available`、`download-progress`、`update-downloaded` 等事件。
- Windows NSIS 安装器是它的成熟路径。

但 CCR 不直接把 `electron-updater` API 暴露给 UI，而是包一层：

```text
electron-updater
-> DesktopUpdateService
-> DesktopUpdateState
-> preload IPC
-> Renderer 设置页
```

这样后续如果从 GitHub Release 换成对象存储或私有更新源，UI 和状态模型不用跟着重写。

## 3. 状态机

状态：

| 状态 | 中文含义 | 可触发操作 |
| --- | --- | --- |
| `disabled` | 当前不可用 | 无 |
| `idle` | 可检查更新 | 检查更新 |
| `checking` | 正在检查 | 等待事件 |
| `not-available` | 没有新版本 | 可再次检查 |
| `available` | 发现新版本 | 下载 |
| `downloading` | 正在下载 | 等待进度 |
| `downloaded` | 下载完成 | 重启安装 |
| `installing` | 正在安装 | 等待应用退出 |
| `error` | 更新失败 | 可重新检查 |

第一版状态转移：

```text
idle
-> checking
-> not-available
```

```text
idle
-> checking
-> available
-> downloading
-> downloaded
-> installing
```

异常路径：

```text
checking / downloading
-> error
-> idle 或重新 check
```

开发态路径：

```text
development mode
-> disabled
```

开发态可通过专用模拟入口临时切换到：

```text
available / downloading / downloaded / error
```

这条路径只用于肉眼验收顶栏提示、设置页状态和按钮交互，不访问真实 GitHub Release，也不触发真实安装器。

## 4. 关键输入输出

输入：

- `package.json` 的 `build.publish` GitHub 配置。
- GitHub Release 里的 `latest.yml`。
- 当前 Desktop 版本 `app.getVersion()`。
- 用户手动点击 `检查更新 / 下载 / 重启安装`。

输出：

- `DesktopUpdateState`。
- `ccr:event` 里的 `update` 事件。
- 设置页自动更新卡片。
- 主进程日志里的 update 状态摘要。

## 5. 第一版实现边界

### 开发态禁用

在 `electron-vite dev` 或未打包运行时，更新状态是：

```text
disabled: auto update is disabled in development mode
```

原因是开发态没有真实安装器、没有稳定 app identity，也不应该误触发下载和安装。

为了验证 UI，开发态额外提供状态模拟入口：

```text
设置页 -> 自动更新 -> 开发态模拟
```

模拟入口可以切换 `发现更新 / 下载中 / 已下载 / 失败 / 关闭模拟`。它复用同一份 `DesktopUpdateState` 和同一套 renderer 展示逻辑，但 `DesktopUpdateService` 会拦截真实 `checkForUpdates / downloadUpdate / installUpdate` 调用，不会调用 `electron-updater` 下载或退出安装。

### 打包态可用

只有 `app.isPackaged === true` 时才启用 `electron-updater`。

当前也支持环境变量禁用：

```powershell
$env:CCR_DESKTOP_DISABLE_UPDATES = '1'
```

### 手动下载

第一版设置：

```text
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
```

原因：

- Agent 可能正在执行任务。
- App Server 子进程需要先收尾。
- 用户需要知道更新会重启客户端。

### 安装前收尾

点击“重启安装”时：

```text
DesktopUpdateService.installUpdate()
-> closeManagedClient()
-> autoUpdater.quitAndInstall(false, true)
```

主进程用 `updateInstallInProgress` 避免 `before-quit` 再阻止 updater 退出。

## 6. IPC 边界

主进程 IPC：

| Channel | 作用 |
| --- | --- |
| `ccr:update-status` | 返回当前更新状态 |
| `ccr:update-check` | 检查更新 |
| `ccr:update-download` | 下载更新 |
| `ccr:update-install` | 重启并安装更新 |
| `ccr:update-dev-mock` | 开发态模拟更新状态 |

preload 只暴露白名单方法：

```text
getUpdateStatus()
checkForUpdates()
downloadUpdate()
installUpdate()
mockUpdateState()
```

renderer 不直接访问 `electron-updater`。

## 7. UI 第一版

自动更新入口放在设置页。

顶栏只在需要用户注意时出现轻量提示：

- `available`：展示新版本和 `下载更新`。
- `downloading`：展示下载进度。
- `downloaded`：展示 `重启安装`。
- `error`：展示失败原因和 `重试`。

显示内容：

- 当前更新状态。
- 当前版本。
- 发现的新版本。
- 下载进度。
- 错误信息。

按钮：

- 检查更新。
- 下载。
- 重启安装。

按钮是否可点击由主进程状态里的 `canCheck / canDownload / canInstall` 决定。

开发态设置页会额外显示“开发态模拟”按钮，用于不用真实 release 就预览上述顶栏状态；打包态不显示这组按钮。

## 8. 后续增强

后续可以继续做：

- 启动后延迟自动检查。
- 检查更新的频率限制。
- 远端 release note 展示。
- 下载取消。
- 更新失败重试策略。
- 和长任务状态联动：任务运行中只提示，不允许立即安装。
- 真实 GitHub Release E2E 验收。

## 9. 官方参考

- electron-builder publishing: https://www.electron.build/publish.html
- electron-updater API: https://www.electron.build/auto-update
