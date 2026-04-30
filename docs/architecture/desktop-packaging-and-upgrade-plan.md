# CCR Desktop 打包与升级准备方案

## 1. 目标

这一阶段的目标不是马上做完整自动更新，而是先把 Desktop 从“开发模式能跑”推进到“可以形成稳定安装产物”的工程状态。

第一版要解决：

- Desktop 使用成熟 Electron 打包工具，不自己手写安装器。
- 打包产物内置当前 CCR Core / App Server runtime。
- 打包后启动 App Server 时，不误用用户全局 npm `ccr`。
- 明确 Windows 安装包、用户数据目录、日志目录、签名、升级和回滚边界。
- 给后续自动更新预留配置，但不第一版静默强制更新。

## 2. 方案结论

第一版采用：

```text
electron-vite
  负责 main / preload / renderer 构建

electron-builder
  负责 Desktop package / installer

Desktop 安装包
  内置当前仓库构建出的 dist / cli.js / vendor

App Server
  由 Electron main process 启动内置 runtime
```

暂不引入：

- 独立 Core runtime 热更新。
- Desktop 不变、在线替换 Core 的机制。
- 静默强制更新。
- 多客户端共享 daemon。

## 3. 为什么选 electron-builder

CCR Desktop 第一版的核心风险不在“安装器怎么画得漂亮”，而在：

- Windows 本地可安装。
- 支持 asar 和 asarUnpack。
- 能把内置 runtime 和 UI 一起打包。
- 后续能接 GitHub Releases / generic HTTP 更新源。
- 能生成更新元数据。
- 生态成熟，问题可查。

`electron-builder` 能覆盖这些通用工程能力，所以这里不自己写安装器、不自己写下载覆盖逻辑。

## 4. 当前工程命令

开发模式：

```powershell
npm.cmd run desktop:dev
```

只构建 Electron 三段代码：

```powershell
npm.cmd run desktop:build
```

打包成未安装目录，适合本机快速验证：

```powershell
npm.cmd run desktop:pack
```

生成正式安装产物：

```powershell
npm.cmd run desktop:dist
```

验证已打出的未安装目录能启动内置 App Server：

```powershell
npm.cmd run smoke:desktop-packaged
```

发布保护：

```text
默认 --publish never
只有显式设置 CCR_DESKTOP_PUBLISH=1 时，才允许 electron-builder 进入 publish 流程。
```

这样可以避免本地验证时误触发 GitHub Release 发布。

## 5. 打包产物结构

第一版 package 配置在根 `package.json` 的 `build` 字段中。

关键字段：

```json
{
  "appId": "dev.ccr.desktop",
  "productName": "CCR Desktop",
  "directories": {
    "output": "release/desktop"
  },
  "asar": true,
  "asarUnpack": [
    "cli.js",
    "bun-bundle-loader.mjs",
    "dist/**/*",
    "vendor/**/*",
    "node_modules/**/*"
  ],
  "win": {
    "signAndEditExecutable": false,
    "verifyUpdateCodeSignature": false
  }
}
```

`node_modules/**/*` 当前也放入 `asarUnpack`。原因是 Desktop main process 会在打包态用 `ELECTRON_RUN_AS_NODE=1` 启动内置 `cli.js app-server --listen stdio`，这个子进程走普通 Node 模块解析，不能可靠从 `app.asar` 里读取运行时依赖。

这会让第一版包体偏大，但边界清楚、可运行。后续优化方向是把 Core runtime 单独 bundle 成更小的 `resources/core/`，再缩小 unpack 范围。

当前先关闭 Windows `signAndEditExecutable`，原因是普通 Windows 权限下 `electron-builder` 解压 `winCodeSign` 缓存可能需要创建符号链接，容易触发权限错误。

这只是第一版本机未签名包策略。正式公开发布前必须恢复签名 / 可执行文件元数据 / 图标 / update signature 这一整条链路，并在发布机或 CI 上配置能创建符号链接的环境。

打包输出默认写到：

```text
release/desktop/
```

该目录是构建产物，不进入 git。

## 6. 内置 runtime 路径规则

这是 P14 最关键的不变式：Desktop 打包后不能再依赖用户全局 npm `ccr`。

开发态：

```text
runtimeRoot = CCR_DESKTOP_REPO_ROOT ?? process.cwd()
command = CCR_DESKTOP_NODE_COMMAND ?? node
args = cli.js app-server --listen stdio
```

打包态：

```text
runtimeRoot = process.resourcesPath/app.asar.unpacked
command = process.execPath
env.ELECTRON_RUN_AS_NODE = 1
args = cli.js app-server --listen stdio
```

含义：

- 开发态仍然使用仓库根目录的 `cli.js` 和 `dist/`。
- 打包态使用安装包里被 `asarUnpack` 解出的 `cli.js`、`dist/` 和 `vendor/`。
- 打包态通过 Electron 自己的可执行文件加 `ELECTRON_RUN_AS_NODE=1` 来运行 Node 脚本，避免要求用户机器额外安装 Node。

## 7. 用户数据目录

Desktop 自己的应用状态应走 Electron 标准 `userData`：

```text
Windows: %APPDATA%/CCR Desktop
```

CCR Core 的长期配置仍走 CCR 用户目录：

```text
~/.ccr
```

两者职责不同：

- `userData`：窗口状态、Desktop UI 偏好、日志缓存、更新状态。
- `~/.ccr`：provider/model 配置、OAuth 凭据、MCP 配置、plugin/skill/managed mcp 安装。

Desktop 不应该私自迁移或复制 `~/.ccr` token。

## 8. 日志目录

第一版先保留 renderer 日志页展示最近事件。

后续落盘建议：

```text
userData/logs/main.log
userData/logs/app-server.stderr.log
userData/logs/update.log
```

日志规则：

- 不写 token / refresh token。
- App Server stderr 和 Desktop main 日志分开。
- 权限请求只记录工具名、风险级别、结果，不记录敏感入参全文。
- 出错时 UI 可以一键打开日志目录，但 renderer 不直接读写日志文件。

## 9. 更新策略

第一版策略：

```text
Desktop 整包升级，Core 跟随 Desktop 升级。
```

不做：

```text
Desktop 不变，单独下载并替换 Core runtime。
```

原因：

- App Server 协议还在快速演进。
- Core runtime 尚未形成独立签名包。
- Windows 文件锁、杀软和回滚复杂度高。
- 正在运行的 turn / permission / tool call 需要空闲点才能安全切换。

后续自动更新建议：

```text
检查更新
  -> 用户确认下载
  -> 下载完成
  -> 等当前 turn 空闲
  -> 提示重启安装
```

禁止立即安装的状态：

- turn 正在运行。
- 有待处理权限请求。
- 正在执行工具调用。
- OAuth 登录流程正在进行。
- 正在写配置、session 或 transcript。

## 10. 回滚策略

第一版回滚：

```text
用户手动安装旧版本 Desktop。
```

后续增强：

```text
保留最近可用版本信息
启动失败写 failed state
Core 独立 runtime 成熟后再做自动 fallback
```

配置迁移不变式：

- migration 前备份。
- 新版本负责兼容旧 schema。
- 老版本遇到未知字段应尽量忽略。
- token 与 OAuth 文件不被 migration 覆盖。

## 11. 签名与发布边界

Windows 第一版可以先生成未签名安装包用于自测。

正式公开分发前必须补：

- Windows 代码签名证书。
- 安装包 hash。
- GitHub Release artifact 校验。
- release note。
- 自动更新 metadata。

macOS 后续如果支持，必须考虑：

- Developer ID 签名。
- notarization。
- auto update 与签名绑定。

## 12. 第一版完成标准

P14 第一版完成应满足：

- `desktop:pack` 可以构建未安装目录。
- `smoke:desktop-packaged` 可以通过打包态 `CCR Desktop.exe + ELECTRON_RUN_AS_NODE=1` 启动内置 App Server，并完成 `initialize / shutdown`。
- Desktop main process 有开发态 / 打包态 runtime 路径选择规则。
- 打包配置明确包含 `out/`、`dist/`、`cli.js`、`vendor/`。
- `release/desktop/` 不进入 git。
- 文档明确安装包、用户数据、日志、升级和回滚边界。
- `ci:smoke` 仍通过。

## 13. 后续增强

下一阶段可以继续补：

- App 图标与 Windows installer branding。
- `electron-updater` 集成。
- 更新检查 UI。
- 日志落盘。
- 崩溃报告。
- 版本兼容检查。
- release workflow。

但这些都不应该阻塞第一版 Desktop 主链路。
