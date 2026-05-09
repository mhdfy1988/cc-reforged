# CCR 升级管理策略

## 1. 结论

CCR 后续升级管理不要手写一套“下载 exe 覆盖文件”的简易方案。

推荐采用成熟分层：

```text
Desktop 应用升级：
  使用 Electron 成熟更新链路
  第一版推荐 electron-builder + electron-updater

CCR Core 升级：
  第一版跟随 Desktop 安装包升级
  不做独立热更新

npm CLI 升级：
  继续使用 npm 发布和 npm install -g cc-reforged@latest

VS Code 插件升级：
  后续走 VS Code Marketplace / vsix 的标准扩展升级机制

App Server 协议升级：
  单独版本化 protocolVersion
  保证客户端和 Core 的兼容边界
```

第一版最稳口径：

```text
Desktop v0.1.0 内置 Core v0.2.0
Desktop v0.2.0 内置 Core v0.3.0

用户更新 Desktop，Core 跟着更新。
```

不要第一版就做：

```text
Desktop 不变，单独在线替换 Core runtime
```

原因是这会额外引入签名、回滚、协议兼容、正在运行任务中断、杀软拦截和 Windows 文件锁问题。

---

## 2. 升级对象拆分

CCR 后续至少有五类可升级对象：

| 对象 | 发布渠道 | 是否第一版自动更新 | 说明 |
| --- | --- | --- | --- |
| Desktop 安装包 | GitHub Release / 自建更新源 | 是 | 图形客户端本体和内置 Core |
| CCR Core runtime | 随 Desktop / npm 包 | 第一版不单独热更新 | 后续可做可回滚 runtime |
| npm CLI | npm registry | 用户手动或命令提示 | `npm.cmd install -g cc-reforged@latest` |
| VS Code 插件 | VS Code Marketplace / Open VSX / vsix | 由编辑器管理 | 插件只连接 App Server |
| MCP / Plugin / Skill | `~/.ccr` 或 npm / marketplace | 按各自机制 | Playwright MCP 可走 npx 或 managed |

核心原则：

```text
每类对象都有自己的版本和升级机制。
不要把所有东西混成一个“全局自动更新”。
```

---

## 3. Desktop 应用升级

### 3.1 推荐工具

如果第一版选 Electron，推荐：

```text
electron-builder
electron-updater
electron-log
```

原因：

- `electron-updater` 支持常见平台更新。
- `electron-builder` 能生成更新所需 metadata。
- 支持 GitHub Releases、S3、generic HTTP 等发布源。
- 支持进度事件、下载完成事件、错误事件。
- 支持 staged rollout。
- Windows 可用 NSIS 目标。
- macOS 自动更新要求签名，这一点必须提前纳入发布流程。

### 3.2 更新源选择

第一版推荐：

```text
GitHub Releases
```

原因：

- 当前项目已经有 GitHub 仓库。
- 适合早期公开发布。
- 不需要自建更新服务器。
- 可以和 tag / release notes / installer artifact 统一。

后续如果需要灰度、企业私有、区域加速，可演进：

```text
GitHub Releases
  -> 对象存储 S3 / OSS / R2
  -> 自建 update server
```

### 3.3 更新模式

建议第一版采用“提示式自动更新”：

```text
启动后检查更新
  -> 有新版本
  -> 通知用户
  -> 用户确认下载
  -> 下载完成
  -> 等当前 turn 空闲
  -> 提示重启安装
```

不建议第一版静默强制更新。

原因：

- Agent 可能正在执行长任务。
- 更新可能关闭 app-server 子进程。
- Windows 下安装器和文件锁容易打断用户体验。
- 用户需要知道 Core 也一起升级了。

### 3.4 不允许更新的时机

以下状态禁止立即安装更新：

```text
1. 当前有 turn 正在运行。
2. 有未处理的 permission/requested。
3. 正在写 session / transcript / config。
4. app-server 正在执行工具调用。
5. OAuth 登录流程正在进行。
```

此时只允许：

```text
下载更新
标记 pending
等空闲后提示重启安装
```

---

## 4. Core runtime 升级

### 4.1 第一版策略

第一版 Core 不单独热更新。

```text
Desktop 升级 = Core 升级
npm CLI 升级 = npm 包升级
```

这样最简单、最可控。

### 4.2 后续可更新 runtime

当 App Server 协议稳定后，可以加入独立 runtime 管理。

建议目录：

```text
~/.ccr/
  runtimes/
    ccr-core/
      0.2.0/
      0.3.0/
      current.json
      failed.json
```

`current.json` 示例：

```json
{
  "activeVersion": "0.3.0",
  "fallbackVersion": "0.2.0",
  "protocolVersion": "0.1",
  "source": "desktop-updater",
  "verifiedAt": "2026-04-28T00:00:00.000Z"
}
```

runtime manifest 示例：

```json
{
  "name": "ccr-core",
  "version": "0.3.0",
  "protocolVersion": "0.1",
  "minDesktopVersion": "0.2.0",
  "minNodeVersion": "24.0.0",
  "platform": "win32-x64",
  "entry": "bin/ccr-core.js",
  "sha256": "...",
  "signature": "...",
  "releaseChannel": "stable"
}
```

### 4.3 独立 runtime 升级流程

```text
检查更新
  -> 下载到 ~/.ccr/tmp/runtime-downloads/<version>
  -> 校验 sha256
  -> 校验签名
  -> 解压到 ~/.ccr/runtimes/ccr-core/<version>.staging
  -> 运行 health check
  -> 原子重命名为 <version>
  -> 更新 current.json
  -> 下次启动使用新 runtime
```

health check 至少包含：

```text
ccr-core --version
ccr-core app-server --health-check
initialize
config/get
auth/status
model/list
```

失败时：

```text
删除 staging
记录 failed.json
继续使用当前 activeVersion
```

启动失败时：

```text
activeVersion 启动失败
  -> 回退 fallbackVersion
  -> fallback 失败
  -> 使用 Desktop 内置 Core
```

### 4.4 为什么不第一版做 runtime 热更新

因为第一版会同时面临：

- Core 尚未拆成稳定包。
- App Server 协议还未稳定。
- runtime 包签名和校验体系还没建。
- Windows 文件锁和杀软风险较高。
- 正在运行会话如何迁移还没定义。
- 用户排查会变复杂：到底是 Desktop 版本问题，还是 runtime 版本问题。

所以第一版先让 Desktop 绑定 Core。

---

## 5. App Server 协议升级

`App Server` 必须独立有协议版本。

```text
coreVersion = 0.3.0
desktopVersion = 0.2.0
protocolVersion = 0.1
```

协议兼容规则：

```text
1. 小版本只允许新增字段和新增 capability。
2. 客户端遇到未知字段必须忽略。
3. 服务端遇到未知 capability 不能假装支持。
4. 删除字段或改变语义必须升级 major。
5. initialize 必须返回 protocolVersion 和 server capabilities。
6. 客户端必须在 initialize 阶段判断是否兼容。
```

兼容判断示例：

```text
Desktop 支持 protocol 0.1.x
App Server 返回 protocol 0.1
  -> 允许连接

App Server 返回 protocol 0.2
  -> 如果只是兼容新增能力，可允许

App Server 返回 protocol 1.0
  -> 默认拒绝，提示更新 Desktop
```

---

## 6. 发布通道

建议从一开始就预留发布通道：

```text
stable
beta
nightly
```

第一版实际只用：

```text
stable
```

后续通道含义：

| 通道 | 用途 | 用户 |
| --- | --- | --- |
| `stable` | 稳定版 | 默认用户 |
| `beta` | 提前体验 | 愿意承担风险的用户 |
| `nightly` | 高频开发版 | 开发者 / 内测 |

更新检查要带上当前通道：

```json
{
  "channel": "stable",
  "desktopVersion": "0.2.0",
  "coreVersion": "0.3.0",
  "platform": "win32-x64"
}
```

---

## 7. 回滚策略

Desktop 安装包回滚：

```text
第一版：
  用户手动安装旧版本

后续：
  更新源提供 previous stable
  但不默认自动降级
```

Core runtime 回滚：

```text
保留最近 2-3 个已验证版本
启动失败自动回退
失败版本写入 failed.json
```

配置回滚：

```text
任何 schema migration 前先备份
备份路径：
  ~/.ccr/backups/config/<timestamp>/
```

配置迁移不允许破坏旧版本：

```text
老版本遇到未知字段忽略
新版本负责迁移旧 schema
必要时写 migration log
```

---

## 8. 更新 UI

Desktop 设置页建议提供：

```text
当前版本：
  Desktop v0.2.0
  Core v0.3.0
  App Server protocol v0.1

更新通道：
  stable / beta / nightly

按钮：
  检查更新
  下载更新
  重启安装
  查看 release notes
  导出更新日志
```

状态：

```text
checking
available
downloading
downloaded
pending-restart
installing
failed
up-to-date
```

关键原则：

```text
用户应该能看懂现在升级的是 Desktop、Core、协议还是插件。
```

---

## 9. CLI 升级策略

npm CLI 升级继续走 npm：

```powershell
npm.cmd install -g cc-reforged@latest
```

CLI 可提供提示：

```text
当前版本 0.2.0，latest 0.3.0
运行 npm.cmd install -g cc-reforged@latest 升级。
```

但不要在 CLI 里默认自动升级自己。

原因：

- npm 权限和代理复杂。
- 用户可能通过 pnpm / bun / npm 安装。
- 自动修改全局环境风险高。

---

## 10. VS Code 插件升级策略

VS Code 插件走编辑器标准升级机制。

插件本身不内置完整 Core，因此它升级时主要更新：

- UI。
- 命令。
- App Server 协议客户端。
- runtime discovery 策略。

如果插件发现本地 `ccr app-server` 太旧：

```text
提示用户：
  当前 CCR Core 版本不支持本插件。
  请选择：
    1. 打开 Desktop 更新
    2. 通过 npm 安装/升级 cc-reforged
    3. 指定新的 ccr 路径
```

---

## 11. MCP / Plugin / Skill 升级策略

这类扩展不要混进 Desktop 自更新。

建议单独管理：

```text
ccr mcp update <name>
ccr plugin update <name>
ccr skill update <name>
```

Playwright MCP 特别规则：

```text
npx 模式：
  由 npm/npx 自己解析版本
  适合快速体验

managed 模式：
  安装到 ~/.ccr/mcp/servers/playwright/
  manifest 记录 installedVersion
  支持 repair / update / uninstall
```

---

## 12. 第一版建议落地

第一阶段只做：

```text
1. Desktop 使用 electron-builder/electron-updater 方案。
2. Desktop 安装包内置固定 Core。
3. 更新时整体更新 Desktop + Core。
4. App Server initialize 返回 coreVersion / protocolVersion。
5. 设置页显示版本信息。
6. 不做独立 Core 热更新。
```

第二阶段再做：

```text
1. beta / nightly 通道。
2. staged rollout。
3. runtime manifest。
4. Core 独立下载、校验、health check、回滚。
5. 多客户端共享 daemon 的版本协调。
```

---

## 13. 需要提前遵守的不变式

```text
1. 更新不能打断正在运行的 turn。
2. 更新不能绕过权限确认。
3. 更新不能把 token 打到日志。
4. 更新不能让 Desktop 和 Core 版本关系不可观测。
5. 更新失败必须可回退或保持旧版本可用。
6. 配置 migration 必须备份。
7. App Server 协议必须版本化。
8. renderer 不直接执行更新和文件替换。
9. 只有 main process 负责更新控制。
10. Core runtime 独立热更新必须先有签名校验和 health check。
```

