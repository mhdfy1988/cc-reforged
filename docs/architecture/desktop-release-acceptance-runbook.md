# CCR Desktop 发布验收 Runbook

## 1. 目标

这份 Runbook 用来把 Desktop 从“能打包”推进到“可以被人工验收、公开发布和后续回归”的状态。

当前 `0.5.0` 已公开发布。真正执行安装器前，仍需要明确告知会影响当前机器的开始菜单、安装目录和 Desktop `userData`。

## 2. 当前产物

生成命令：

```powershell
npm.cmd run desktop:dist
```

产物目录：

```text
release/desktop/
```

当前 Windows x64 安装器命名固定为：

```text
CCR-<version>-win-x64.exe
```

命名里不再使用空格。原因是 `electron-builder` 生成 `latest.yml` 时会把下载 URL 写成连字符形式，如果磁盘文件仍然带空格，后续自动更新 metadata 会指向不存在的文件。

## 3. 自动校验

生成安装器后运行：

```powershell
npm.cmd run smoke:desktop-release-artifacts
```

该 smoke 会检查：

- `package.json` 的 `artifactName` 是否固定为无空格命名。
- `latest.yml` 的 `version` 是否等于 `package.json`。
- `latest.yml` 的 `path` 和 `files.url` 是否能在 `release/desktop/` 找到真实文件。
- installer 文件大小是否等于 `latest.yml` 中的 size。
- installer SHA512 是否等于 `latest.yml` 中的 sha512。
- `.blockmap` 是否存在。

这条 smoke 不放入普通 `ci:smoke`。它依赖 `desktop:dist` 已经生成安装器，不适合每次开发态 CI 都跑。

## 3.1 代码签名预检

当前默认安装器是 unsigned 包，这是短期有意策略，不要求购买代码签名证书。每次发布前仍运行：

```powershell
npm.cmd run smoke:desktop-signing-readiness
```

它会检查证书环境变量是否成对出现，并在 Windows 下读取安装器 Authenticode 状态。默认情况下，`NotSigned` 不会让发布失败。

未来如果已经有真实签名证书，并且某次发布需要强制签名时：

```powershell
$env:CCR_REQUIRE_SIGNED = '1'
npm.cmd run smoke:desktop-signing-readiness
```

如果安装器没有有效签名，该命令会失败。

## 3.2 GitHub Release 预检

GitHub Release 发布流程默认先生成本地发布清单：

```powershell
npm.cmd run release:desktop:check
```

如果需要查看将要执行的 GitHub CLI 命令：

```powershell
npm.cmd run release:desktop:dry-run
```

真正创建或恢复 GitHub Release 草稿时才运行：

```powershell
npm.cmd run release:desktop:draft
```

该命令会要求：

- 本机已安装并登录 GitHub CLI。
- 本地存在 `v<package.json version>` tag。
- 工作区干净，除非显式设置 `CCR_ALLOW_DIRTY_RELEASE=1`。
- 如果 release 已经部分创建，会复用已有 release 并逐个补齐缺失资产。

正式公开发布：

```powershell
npm.cmd run release:desktop:public
```

公开发布后验证自动更新 feed：

```powershell
npm.cmd run smoke:desktop-auto-update-feed
```

## 3.3 `0.5.0` 发布记录

`0.5.0` 已公开发布：

```text
https://github.com/mhdfy1988/cc-reforged/releases/tag/v0.5.0
```

发布资产：

- `CCR-0.5.0-win-x64.exe`
- `CCR-0.5.0-win-x64.exe.blockmap`
- `latest.yml`

SHA256：

| 文件 | SHA256 |
| --- | --- |
| `CCR-0.5.0-win-x64.exe` | `b93afa325a295c6eaf88fbe146cdf492b7d94ad9dbd1dabaf133643430782186` |
| `CCR-0.5.0-win-x64.exe.blockmap` | `5ba248675c6d7a0f67ecf96aeb92926d2cf733296dcff41138e5433057a46f01` |
| `latest.yml` | `98f4de5afc6bb6c43b5eadd12d060461fc825a83d5c99cf7a43a23ca46c3c55d` |

如果要模拟旧版本升级，例如从 `0.4.0` 升到当前版本：

```powershell
$env:CCR_DESKTOP_UPDATE_FROM_VERSION = '0.4.0'
npm.cmd run smoke:desktop-auto-update-feed
```

正式发布优先走 GitHub Actions：

```text
GitHub -> Actions -> Desktop Release -> Run workflow
```

第一版推荐输入：

```text
tag = v0.5.0
draft = true
signed = false
require_signed = false
```

该 workflow 会复用本地发布脚本创建 draft release 并上传安装器、`.blockmap` 和 `latest.yml`。

## 4. 人工安装验收

执行前确认：

```powershell
npm.cmd run desktop:icons
npm.cmd run smoke:desktop-branding
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run release:desktop:check
npm.cmd run smoke:desktop-github-actions-release
npm.cmd run smoke:desktop-packaged
```

人工安装步骤：

1. 打开 `release/desktop/CCR-<version>-win-x64.exe`。
2. 确认安装器显示应用名为 `CCR`。
3. 选择当前用户安装，不要求管理员权限。
4. 完成安装后从开始菜单或桌面快捷方式启动。
5. 确认主窗口可打开，并显示 App Server 就绪。
6. 确认窗口、任务栏、开始菜单或卸载项不再显示默认 Electron 图标。
7. 打开日志页，确认没有 token / refresh token / API key 明文。
8. 关闭窗口后确认没有残留 `CCR.exe cli.js app-server --listen stdio` 子进程。

如果当前机器已经安装过旧版本，安装前先记录：

```powershell
Get-Process | Where-Object { $_.ProcessName -like '*CCR*' }
```

## 5. 卸载验收

卸载前先关闭 CCR。

人工卸载步骤：

1. 从 Windows “应用和功能”卸载 `CCR`。
2. 确认安装目录被移除。
3. 确认 `%APPDATA%\CCR\logs` 不被安装器强制删除。
4. 确认 `~\.ccr` 不被卸载流程删除。

当前 NSIS 配置为：

```json
{
  "deleteAppDataOnUninstall": false
}
```

所以卸载后保留日志和用户配置是预期行为。

## 6. 回滚验收

当前策略是 Desktop 整包升级，Core 跟随 Desktop 安装包，不做独立 Core 热更新。

回滚步骤：

1. 卸载当前版本。
2. 安装旧版本安装器。
3. 启动后检查 App Server `protocolVersion` 是否被 Desktop 接受。
4. 确认 `~\.ccr` 中的配置和 OAuth 凭据没有被覆盖。

如果旧版本不能识别新配置字段，预期行为应该是忽略未知字段，而不是删除用户配置。

## 7. 正式发布前门禁

正式公开发布前必须补齐：

- 正式图标 `.ico / .png / .icns`。
- `smoke:desktop-branding` 通过。
- `smoke:desktop-signing-readiness` 通过；短期允许 unsigned。
- GitHub Release artifact。
- `release:desktop:check` 通过。
- SHA256 或 SHA512 校验记录；unsigned 发布必须在 release note 中保留 SHA256。
- release note。
- 自动更新 metadata 验证。
- 安装、卸载、回滚人工验收记录。

## 7.1 unsigned 发布验收口径

短期不购买代码签名证书，所以验收口径是：

- 安装器可以是 `NotSigned`。
- Release 说明必须列出安装器、`.blockmap`、`latest.yml` 的 SHA256。
- 用户如果遇到 Windows 未知发布者 / SmartScreen 提示，应以 GitHub Release 地址和 SHA256 校验确认来源。
- `package.json` 中 `verifyUpdateCodeSignature: false` 保持不变；自动更新依赖 GitHub Release HTTPS 和 `latest.yml` sha512。
- 只有显式设置 `CCR_REQUIRE_SIGNED=1` 时，未签名才算失败。

## 8. 当前已知边界

当前完成的是：

- 安装器产物可生成。
- 打包态内置 App Server 可 smoke。
- 产物 metadata 可自动校验。
- 发布前人工验收步骤已明确。

当前还没有完成的是：

- 付费代码签名。
- VS Code 插件接入。
