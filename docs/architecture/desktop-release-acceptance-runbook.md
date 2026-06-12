# CCR Desktop 发布验收 Runbook

## 1. 目标

这份 Runbook 用来把 Desktop 从“能打包”推进到“可以被人工验收、公开发布和后续回归”的状态。

当前发布目标是 `0.6.3`。历史 `0.5.2` 已通过 GitHub Actions `Desktop Release` workflow 发布 unsigned Windows x64 安装器；后续版本继续沿用同一验收思路。真正执行安装器前，仍需要明确告知会影响当前机器的开始菜单、安装目录和 Desktop `userData`。

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

## 3.3 `0.5.2` 公开发布记录

`0.5.2` 已公开发布：

```text
https://github.com/mhdfy1988/cc-reforged/releases/tag/v0.5.2
```

发布时间：2026-05-31

发布路径：

```text
GitHub Actions Desktop Release
tag = v0.5.2
draft = false
signed = false
require_signed = false
```

发布验证：

- `NPM Release` 成功，npm `latest=0.5.2`。
- Desktop Release workflow 成功。
- `smoke:desktop-auto-update-feed` 远端自动更新 feed 验证成功。
- 发布 workflow 需要同时设置 `CCR_SMOKE_SKIP_HEADLESS_AUTH_GATE=1` 和 `ANTHROPIC_API_KEY=ci-smoke-placeholder`，后者只是无网络 smoke 的认证占位。

发布资产：

- `CCR-0.5.2-win-x64.exe`
- `CCR-0.5.2-win-x64.exe.blockmap`
- `latest.yml`

SHA256：

| 文件 | SHA256 |
| --- | --- |
| `CCR-0.5.2-win-x64.exe` | `b487ec3b92a6bfa37c8142500f2b1417564da94ea0b61d04fab5817b9026c4b3` |
| `CCR-0.5.2-win-x64.exe.blockmap` | `1f738e76171789cf4b76341f4b5310de0890580ed86d1603a37209c4ecd385d1` |
| `latest.yml` | `5763bcd36336b36e43de3780b2d5f0cdfa803fb0af61809a6f5d586a72b3680f` |

签名状态：

- 默认构建为 unsigned。
- `smoke:desktop-signing-readiness` 通过。
- 短期允许 Windows 显示未知发布者提示。

## 3.4 `0.5.1` 公开发布记录

`0.5.1` 已公开发布：

```text
https://github.com/mhdfy1988/cc-reforged/releases/tag/v0.5.1
```

生成时间：2026-05-22

本地验证：

```powershell
npm.cmd run ci:smoke
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run release:desktop:check
npm.cmd run smoke:desktop-github-actions-release
npm.cmd run smoke:desktop-packaged
```

发布资产：

- `CCR-0.5.1-win-x64.exe`
- `CCR-0.5.1-win-x64.exe.blockmap`
- `latest.yml`

SHA256：

| 文件 | SHA256 |
| --- | --- |
| `CCR-0.5.1-win-x64.exe` | `0ae0805da3d5703beea7b4e5c4212094058bf0820669690292c9b9c203288c10` |
| `CCR-0.5.1-win-x64.exe.blockmap` | `9b3a2529b464708a9e7069f08a68c72eb1b00e011f42bbe7ae9e7ef2dd7e4973` |
| `latest.yml` | `c0de4200054e9994b9055b813b16d33ff553d91d493e2a1b5d67727d9f9b913e` |

签名状态：

- 默认构建为 unsigned。
- `smoke:desktop-signing-readiness` 通过。
- 安装器 Authenticode 状态为 `NotSigned`，短期允许。

## 3.5 `0.5.0` 发布记录

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

当前推荐输入：

```text
tag = v0.5.2
draft = false
signed = false
require_signed = false
```

该 workflow 会复用本地发布脚本创建或恢复 release，上传安装器、`.blockmap` 和 `latest.yml`，公开发布后验证远端自动更新 feed。

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

## 4.1 Skill / MCP 管理页人工验收

这一组验收用于发布前确认 Desktop 管理页和 App Server 管理 API 的实际交互可用。自动 smoke 已覆盖协议和 Core 行为；这里重点看页面状态、按钮位置、确认区和错误展示。

详细用例见：

```text
docs/qa/skill-mcp-desktop-manual-test-cases.md
```

前置自动验证：

```powershell
npm.cmd run typecheck:desktop
npm.cmd run smoke:mcp-end-to-end
npm.cmd run smoke:skill-end-to-end
npm.cmd run smoke:skill-mcp-negative-boundaries
```

准备本地验收数据：

```powershell
npm.cmd run fixtures:desktop-management-acceptance
```

该命令只写入系统临时目录，不修改 `~\.ccr`。输出里的路径用于下面的导入操作：

```text
skillDir=<本地 Skill 目录>
claudeCommand=<Claude command markdown 文件>
mcpLocalHttpManifest=<本地 HTTP MCP 安装清单>
mcpLocalStdioManifest=<本地 stdio MCP 安装清单>
skillInstallManifest=<Skill 安装清单>
```

### 4.1.1 MCP 管理页

验收步骤：

1. 打开 Desktop 的 MCP 管理页。
2. 确认顶部统计能显示 server、启用和安装记录数量。
3. 确认安装候选区能看到内置候选，例如 Context7、Sentry、Playwright。
4. 确认默认安装范围是用户全局，页面不展示无意义的范围切换。
5. 点击“导入 MCP 安装配置”，选择 `mcpLocalHttpManifest`。
6. 确认进入安装计划确认区，能看到名称、transport、URL、权限和数据边界摘要。
7. 勾选保存到常用安装配置后确认安装。
8. 刷新候选列表，确认保存后的配置能作为本地 manifest 候选出现。
9. 在详情或已安装记录中执行修复和卸载；卸载入口应位于详情 / 已安装语义下，不放在普通候选卡片上。
10. 重复导入 `mcpLocalStdioManifest`，确认 stdio 类型能生成安装计划。

通过标准：

- 已安装项和安装候选不会重复成两个同义卡片。
- 已安装候选只显示“已安装”状态，不提供重复安装主操作。
- 修复只针对 installer-owned 记录开放。
- 卸载不会删除手工导入的 manifest 文件。
- 错误区能显示字段、来源和下一步，不出现空白卡。

### 4.1.2 Skill 管理页

验收步骤：

1. 打开 Desktop 的 Skill 管理页。
2. 确认页面能显示已安装、候选、需处理和风险统计。
3. 点击“导入 Skill”，选择 `skillDir`。
4. 确认导入计划显示写入目标和来源类型，确认后候选列表出现 `desktop_acceptance_skill`。
5. 对该候选点击安装，确认安装计划显示安全摘要、安装来源和目标路径。
6. 安装后在详情页切换启用、模型自动调用、用户 slash 调用三个状态。
7. 刷新页面，确认三个状态仍与刚才选择一致。
8. 执行修复，确认 installed 状态保持正常。
9. 执行卸载，确认 installed 列表移除该 Skill，但 imported 来源仍可再次作为候选出现。
10. 再导入 `claudeCommand`，确认页面提示这是 command 转 Skill 的转换来源。
11. 导入或保存 `skillInstallManifest`，确认本地 manifest 会进入候选列表。

通过标准：

- 安装候选卡片只展示名称、短说明、来源和风险等级，不堆满路径和 finding。
- 详情页能看到来源、状态、安全摘要、资源和 `SKILL.md` 预览。
- high 风险需要用户勾选“我已了解高风险，继续安装”；critical 风险不能安装。
- 禁用状态与 runtime 可见性语义一致：页面不直接承诺“已注入上下文”，只展示管理状态和诊断。
- 修复 / 卸载都需要用户明确动作，不自动写入。

### 4.1.3 页面错误卡

验收步骤：

1. 导入一个缺少 `name` 或缺少 `serverConfig/url` 的 MCP manifest。
2. 导入一个没有 `SKILL.md` 的空目录。
3. 对已经卸载的记录尝试再次修复。
4. 在 App Server 未就绪时刷新页面。

通过标准：

- 错误卡必须说明来源是 MCP、Skill、App Server 还是 schema。
- 错误卡必须包含可读 message；有字段路径时展示字段路径。
- 不把协议错误伪装成安装成功。
- 不出现空白区域、重复解释文本或按钮挤压。

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

正式公开发布前先运行通用门禁：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:mcp-release
npm.cmd run smoke:skill-release
npm.cmd pack --dry-run
```

Desktop 发布前再运行 Desktop 门禁。`smoke:desktop-release-gate` 不依赖已经生成安装器，用来提前确认 Desktop 类型、页面验收 fixture 和 Skill / MCP 管理 API 前置链路：

```powershell
npm.cmd run smoke:desktop-release-gate
```

生成安装器后运行产物门禁：

```powershell
npm.cmd run desktop:dist
npm.cmd run smoke:desktop-release-artifacts
npm.cmd run smoke:desktop-signing-readiness
npm.cmd run release:desktop:check
```

正式公开发布前还必须补齐：

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
