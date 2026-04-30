# CCR Desktop 日志与错误可观测方案

## 1. 目标

Desktop 第一版不能只靠屏幕上的错误卡排查问题。P15 的目标是让本地运行失败、App Server 启动失败、协议错误和打包态 runtime 问题都有可追踪日志。

第一版要做到：

- Desktop main process 有本地日志。
- App Server stderr 能落盘。
- App Server Client error 能落盘。
- renderer 日志页能展示最近摘要。
- renderer 不直接读文件，只能通过 preload 白名单读取。
- 日志必须脱敏，不能写入 token / refresh token / API key。

## 2. 日志目录

日志目录来自 Electron `userData`：

```text
app.getPath("userData")/logs/
```

当前文件：

```text
main.log
app-server.stderr.log
client-error.log
```

职责：

- `main.log`：Desktop 状态变化、notification 摘要、页面可观测事件。
- `app-server.stderr.log`：App Server 子进程 stderr 和退出事件。
- `client-error.log`：JSON-RPC client parse / protocol / timeout / process exit 等错误。

## 3. 安全边界

renderer 不能直接访问文件系统。

数据流：

```text
renderer 日志页
  -> preload window.ccr.getLogs()
  -> ipcMain ccr:get-logs
  -> main process readDesktopLogs()
  -> 返回最近日志摘要
```

这样 renderer 只拿到可展示文本，不拥有任意读文件权限。

## 4. 脱敏规则

写日志前统一经过 `redactLogText()`。

当前会脱敏：

- `Bearer ...`
- `accessToken`
- `refreshToken`
- `apiKey`
- `token`
- `authorization`
- `CLAUDE_CODE_CODEX_OAUTH_*`
- `CCR_CODEX_OAUTH_*`

后续如果接入更多 provider，要把新增凭据字段补进这里。

## 5. 事件摘要规则

`main.log` 不直接写完整 notification payload，而是写摘要：

- notification method
- turnId
- itemId
- permissionRequestId
- state message
- error message

这样既能排查事件顺序，又避免把完整 prompt、工具入参、模型输出长期落盘。

## 6. 第一版验证

验证入口：

```powershell
npm.cmd run typecheck:desktop
npm.cmd run desktop:build
npm.cmd run ci:smoke
```

打包态仍可用：

```powershell
npm.cmd run desktop:pack
npm.cmd run smoke:desktop-packaged
```

## 7. 后续增强

后续可以继续补：

- 日志文件大小上限与轮转。
- 一键打开日志目录。
- 日志导出包。
- 崩溃报告。
- update.log。
- 按 session / turnId 过滤日志。

但这些不应该让 renderer 获得直接文件系统访问权。
