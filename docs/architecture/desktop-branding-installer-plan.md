# CCR Desktop 品牌与安装器体验方案

## 1. 目标

这一阶段把 Desktop 从“工程可运行安装包”推进到“具备基础产品品牌识别的安装包”。

当前阶段只处理：

- Desktop 图标源文件。
- PNG / ICO 生成。
- Electron Builder 图标配置。
- 安装器品牌校验。

当前阶段不处理：

- 代码签名。
- 自动更新。
- GitHub Release。
- VS Code 插件。

## 2. 图标资源策略

图标单一设计源：

```text
apps/desktop/assets/ccr-desktop-icon.svg
```

生成目录：

```text
apps/desktop/assets/generated/
```

当前生成：

```text
icon.png
icon.ico
icon-16.png
icon-24.png
icon-32.png
icon-48.png
icon-64.png
icon-128.png
icon-256.png
```

SVG 作为人类可编辑源文件，`generated/` 作为打包使用的机器产物。

## 3. 为什么引入 sharp

本机没有稳定可用的 ImageMagick `magick`，Windows 自带 `convert.exe` 也不是图片转换工具。

因此当前引入：

```text
sharp
```

用途只限于开发期生成 Desktop 图标资源。它不是 CCR Core 运行时依赖，不参与模型调用、App Server 协议、权限系统或 CLI/TUI 主链路。

## 4. 生成命令

```powershell
npm.cmd run desktop:icons
```

`desktop:pack` 和 `desktop:dist` 会在打包前自动运行图标生成脚本，避免安装器使用旧图标。

## 5. 打包配置

Windows 应用图标：

```json
{
  "build": {
    "win": {
      "icon": "apps/desktop/assets/generated/icon.ico"
    }
  }
}
```

NSIS 安装器图标：

```json
{
  "build": {
    "nsis": {
      "installerIcon": "apps/desktop/assets/generated/icon.ico",
      "uninstallerIcon": "apps/desktop/assets/generated/icon.ico"
    }
  }
}
```

窗口运行态图标：

```text
BrowserWindow icon -> apps/desktop/assets/generated/icon.png
```

## 6. 验证命令

```powershell
npm.cmd run smoke:desktop-branding
```

它会检查：

- SVG 源文件存在且不再是 placeholder。
- `icon.png` 是有效 PNG。
- `icon.ico` 是有效 ICO。
- `build.win.icon` 指向生成的 `.ico`。
- NSIS installer / uninstaller icon 指向生成的 `.ico`。
- `productName` 仍然是 `CCR`。

## 7. 当前边界

当前已经比默认 Electron 图标前进了一步，但还不是最终品牌系统。

后续如果要正式发布，还需要：

- 视觉设计确认图标形态。
- 小尺寸图标人工检查。
- 开始菜单和卸载项截图验收。
- 代码签名后再次验证图标是否保留。
