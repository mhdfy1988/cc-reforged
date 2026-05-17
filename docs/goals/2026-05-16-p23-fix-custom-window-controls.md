# Goal: P23-FIX 自绘窗口标题栏与窗口控制按钮

## 目标

把 Windows Desktop 从“左侧自绘标题栏 + 右侧 Electron 原生 `titleBarOverlay`”调整为“完整自绘标题栏和窗口控制按钮”。

第一版目标是解决两个真实体验问题：

- 顶部右侧窗口控制区和左侧标题栏线条、底色不一致。
- 图片预览遮罩无法覆盖 Electron 原生窗口控制按钮。

## 为什么现在做

图片附件已经支持点击预览，但真机发现右上角最小化 / 最大化 / 关闭按钮仍浮在预览遮罩之上。根因是它们来自 Electron `titleBarOverlay`，不是 renderer DOM。

Electron 官方文档说明，`titleBarOverlay` 打开后窗口控制区会暴露在默认位置，DOM 不能使用它下面的区域。因此要让预览遮罩完全覆盖右上角，只能把窗口控制按钮也变成 renderer 自绘元素。

## 范围

1. BrowserWindow：
   - 去掉 `titleBarOverlay`。
   - 保留 `titleBarStyle: 'hidden'`。
   - 不切到 `frame: false`，避免扩大窗口边框、阴影和 resize 行为风险。
2. main/preload：
   - 新增最小化、最大化/还原、关闭窗口 IPC。
   - 新增窗口最大化状态查询和状态广播。
3. renderer：
   - `WindowTitlebar` 增加最小化 / 最大化还原 / 关闭按钮。
   - 拖拽区域保留 `-webkit-app-region: drag`。
   - 按钮区域明确 `-webkit-app-region: no-drag`。
   - 最大化状态改变后按钮文案和 title 能同步。
4. 图片预览：
   - 自绘按钮应被普通遮罩层覆盖。
   - 图片预览仍保留自身轻量关闭按钮。

## 非目标

- 不重做整体导航和聊天布局。
- 不改自动更新、托盘、系统菜单和快捷键。
- 不做跨平台 macOS traffic lights 方案。
- 不引入新的标题栏第三方库。
- 不打包发布。

## 验收标准

- 右上角不再出现 Electron 原生 overlay 控制区。
- 顶部标题栏底色和分割线统一。
- 自绘按钮可执行最小化、最大化/还原、关闭。
- 拖拽标题栏仍能移动窗口。
- 最大化状态下按钮能显示“还原”语义。
- 图片预览遮罩能覆盖标题栏自绘按钮，只露出图片预览自己的关闭按钮。
- 不影响当前聊天、模型选择、附件图片预览和日志页面。

## 验证命令

```powershell
npm.cmd run desktop:build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:desktop-display-events
git diff --check
```

真机验证：

- 启动开发版 Desktop。
- 拖动标题栏移动窗口。
- 点击最小化。
- 点击最大化，再点击还原。
- 点击图片缩略图打开预览，确认右上角只出现图片预览自己的关闭按钮。
- 关闭窗口。

## 本轮进展

状态：自动验证已完成，待真机目视确认。

已完成：

- `BrowserWindow` 已移除 `titleBarOverlay`，继续保留 `titleBarStyle: 'hidden'`。
- main/preload 已新增窗口状态、最小化、最大化/还原、关闭窗口 IPC。
- `WindowTitlebar` 已增加自绘窗口控制按钮。
- 按钮区域已设置 `-webkit-app-region: no-drag`，标题栏其余区域保留拖拽。
- 图片预览关闭按钮继续作为预览自身控件，不再依赖系统 overlay。

待完成：

- 开发版 Desktop 真机验证。

已完成验证：

- `npm.cmd run desktop:build`
- `npm.cmd run typecheck -- --pretty false`
- `npm.cmd run smoke:desktop-display-events`
- `git diff --check`

额外验证：

- 已运行 `npm.cmd run typecheck:desktop -- --pretty false`。
- 本轮新增代码最初暴露 `DesktopWindowState` 命名冲突，已改为 `DesktopWindowControlState`。
- 复跑后不再出现本轮相关错误；剩余失败仍为既有 `MACRO`、`Bun`、可选原生依赖和缺失类型包问题。
