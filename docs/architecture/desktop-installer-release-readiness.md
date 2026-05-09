# CCR Desktop 安装器与发布准备方案

## 1. 目标

P16 的目标是把 Desktop 从“能打出未安装目录”继续推进到“安装器、品牌、签名、更新通道都有明确边界”。

这一阶段仍然不做正式公开发布，原因是正式发布必须有代码签名、release note、hash、更新元数据和回滚策略配合。

## 2. 当前安装器方案

当前使用：

```text
electron-builder
Windows NSIS target
```

已有命令：

```powershell
npm.cmd run desktop:pack
npm.cmd run desktop:dist
```

产物目录：

```text
release/desktop/
```

Windows x64 安装器文件名固定为：

```text
CCR-Desktop-<version>-win-x64.exe
```

这里刻意不用 `productName` 占位，也不在文件名里放空格。原因是 `electron-builder` 的更新元数据会把下载 URL 写成连字符形式；如果磁盘文件仍然是 `CCR Desktop-*.exe`，`latest.yml` 会指向不存在的文件。

生成安装器后必须运行：

```powershell
npm.cmd run smoke:desktop-release-artifacts
```

它会校验 installer、blockmap、`latest.yml`、文件大小和 SHA512。

## 3. 应用名与用户目录

应用显示名：

```text
CCR Desktop
```

main process 已显式调用：

```ts
app.setName("CCR Desktop")
```

这样日志与 Desktop 自身状态会进入：

```text
%APPDATA%/CCR Desktop/
```

CCR Core 配置仍然保持：

```text
~/.ccr
```

不要把 Desktop `userData` 和 CCR Core 用户目录混在一起。

## 4. 图标策略

当前已提供占位 SVG：

```text
apps/desktop/assets/ccr-desktop-icon.svg
```

当前已经把它升级为 Desktop 图标源文件，并通过脚本生成打包资源：

```powershell
npm.cmd run desktop:icons
```

生成资源：

```text
apps/desktop/assets/generated/icon.png
apps/desktop/assets/generated/icon.ico
```

`electron-builder` 当前已接入：

```json
{
  "build": {
    "win": {
      "icon": "apps/desktop/assets/generated/icon.ico"
    },
    "nsis": {
      "installerIcon": "apps/desktop/assets/generated/icon.ico",
      "uninstallerIcon": "apps/desktop/assets/generated/icon.ico"
    }
  }
}
```

后续正式发布前仍建议补齐跨平台资源：

```text
apps/desktop/assets/generated/icon.icns
```

并做小尺寸人工验收。

品牌接入细节见：

```text
docs/architecture/desktop-branding-installer-plan.md
```

## 5. 未签名包与正式签名包

当前本机验证包是未签名包。

配置里临时关闭：

```json
{
  "signAndEditExecutable": false,
  "verifyUpdateCodeSignature": false
}
```

原因是普通 Windows 权限下，`electron-builder` 解压 `winCodeSign` 缓存时可能需要创建符号链接，容易失败。

默认 unsigned 包仍用：

```powershell
npm.cmd run desktop:dist
```

正式签名入口是：

```powershell
npm.cmd run desktop:dist:signed
```

该入口需要：

```text
WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD
```

或：

```text
CSC_LINK + CSC_KEY_PASSWORD
```

并会临时启用：

- `signAndEditExecutable`
- `verifyUpdateCodeSignature`
- `forceCodeSigning`

签名准备细节见：

```text
docs/architecture/desktop-code-signing-plan.md
```

## 6. 更新通道

第一版预留三个通道：

```text
stable
beta
nightly
```

当前实际只用：

```text
stable
```

Desktop 更新不能静默强制安装。建议后续状态机：

```text
idle
checking
available
downloading
downloaded
pending-restart
installing
failed
up-to-date
```

禁止立即安装的状态：

- turn 正在运行。
- 有待处理权限请求。
- App Server 正在执行工具。
- OAuth 登录流程正在进行。
- 正在写配置、session、transcript。

## 7. 发布前清单

正式公开发布前至少补齐：

- 正式图标。
- Windows 代码签名。
- `desktop:dist` 安装器验证。
- `smoke:desktop-release-artifacts` 通过。
- `smoke:desktop-branding` 通过。
- `smoke:desktop-signing-readiness` 在 `CCR_REQUIRE_SIGNED=1` 下通过。
- GitHub Release artifact。
- SHA256 校验。
- release note。
- auto update metadata。
- 回滚说明。
- smoke 验证截图或日志。

## 8. 当前边界

当前可以认为完成的是：

- 安装器工具链已接入。
- 未安装目录可以打包并运行内置 App Server。
- 日志目录和应用名已拆清。
- 图标有占位源文件。
- 未签名与正式签名边界已写清。
- 更新通道策略已有文档。

还不能认为完成的是：

- 正式签名发布。
- 自动更新。
- 图标最终设计。
- VS Code 插件接入。
