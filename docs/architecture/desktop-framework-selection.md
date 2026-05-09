# CCR Desktop 客户端框架选型

## 1. 结论

CCR Desktop 不应该随便手写，也不应该自己从零造桌面壳。

第一版推荐：

```text
Electron + React + TypeScript
```

原因不是 Electron 最轻，而是它最贴合 CCR 当前阶段：

- CCR 现有核心是 Node / TypeScript / React / Ink 生态。
- Desktop 第一版重点是稳定启动 `ccr app-server`、处理 stdio、OAuth、文件系统、日志和配置。
- Electron 的主进程天然适合做本地进程管理、文件访问、窗口生命周期和系统集成。
- Electron 的 renderer 可以继续使用 React，复用现有前端知识和组件思路。
- 打包、自动更新、代码签名、Windows 安装包生态成熟。

不建议第一版使用 Tauri / Flutter / Avalonia / Wails 的主要原因：

- 它们不是不好，而是会引入新的主语言或运行时边界。
- 第一版真正的风险在 `App Server 协议 + Core 生命周期 + 权限流 + OAuth`，不是 UI 绘制性能。
- 现在先用 Electron 可以最快把 Desktop 作为 CCR 图形壳跑起来。

后续如果 Desktop 稳定、包体和内存成为主要矛盾，再评估 Tauri。

---

## 2. CCR Desktop 的真实约束

CCR Desktop 不是普通展示型客户端，它需要做本地 Agent 控制面：

```text
1. 启动和管理本地 ccr app-server 子进程。
2. 和 app-server 通过 stdio / JSON-RPC 通信。
3. 管理 workspace、session、日志、配置。
4. 触发 Codex OAuth 登录流程。
5. 读写 ~/.ccr 下的本地配置和状态。
6. 展示流式输出、工具调用、权限确认。
7. 管理 MCP 配置和 Playwright MCP。
8. 后续与 VS Code 插件协作。
9. 后续支持自动更新和版本回滚。
```

因此选型重点不是“谁最酷”，而是：

```text
本地进程管理能力
IPC 稳定性
Node 生态亲和度
Windows 可用性
打包与自动更新成熟度
安全边界是否可控
团队学习成本
第一版落地速度
```

---

## 3. 候选框架对比

| 框架 | 适合场景 | 优点 | 风险 / 代价 | CCR 第一版建议 |
| --- | --- | --- | --- | --- |
| Electron | Node / Web 技术栈、本地工具型客户端 | Node 集成强、生态成熟、VS Code / GitHub Desktop 等大量案例、打包工具成熟 | 包体大、内存占用高、安全配置要谨慎 | 推荐第一版 |
| Tauri | 轻量、安全、Rust 后端、WebView UI | 包体小、系统 WebView、Rust 后端安全边界好 | 要引入 Rust 壳；Node 子进程和 app-server 管理需要额外设计；WebView 跨平台差异 | 第二阶段评估 |
| Wails | Go 后端 + Web UI | Go 生态简单、可打包、适合 Go 项目 | CCR 不是 Go 项目，引入 Go 后端没有复用价值 | 不推荐第一版 |
| Flutter Desktop | 高一致性 UI、多端统一 | UI 体验强、跨平台桌面支持成熟 | Dart 生态与 CCR runtime 割裂；本地 app-server、Node、OAuth 管理要额外桥接 | 不推荐第一版 |
| Avalonia | .NET/XAML 桌面应用 | 原生桌面 UI 能力强、跨平台渲染一致 | C# / XAML 技术栈切换成本高；与 CCR Node 核心割裂 | 不推荐第一版 |
| Neutralinojs | 轻量 WebView 桌面壳 | 体积小、简单、可用 Web 技术 | 生态和复杂应用能力弱于 Electron/Tauri；长期维护和插件生态不如 Electron | 仅适合实验 |

---

## 4. 为什么第一版选 Electron

### 4.1 和 CCR 当前技术栈最贴合

当前 CCR 已经有：

```text
Node 24
TypeScript
React / Ink
npm 发布链路
本地 CLI
Codex OAuth
MCP / Playwright MCP
~/.ccr 用户目录
```

Electron 的主进程可以直接负责：

```text
spawn ccr app-server
监听 stdout / stderr
写日志
打开浏览器登录
管理窗口
托盘 / 通知
自动更新
```

renderer 继续用：

```text
React + TypeScript
```

这样不会在第一版同时引入 Rust / Go / Dart / C#。

### 4.2 和 App Server 方案天然匹配

推荐结构：

```text
Electron Main Process
  -> 启动内置 ccr app-server --listen stdio
  -> 管理子进程生命周期
  -> 和 app-server 做 JSON-RPC 通信
  -> 通过安全 IPC 暴露给 renderer

Electron Renderer
  -> React UI
  -> workspace / chat / settings / MCP / logs
  -> 不直接访问 Node API
  -> 不直接读 token 文件
```

这和我们前面定的架构一致：

```text
Desktop 是壳
App Server 是 Core 的服务入口
Core 负责真实 Agent 能力
```

### 4.3 打包和发布链路成熟

Electron 官方推荐 Electron Forge 这类工具完成 package / make / installer。

第一版可走：

```text
npm workspace / apps/desktop
  electron-forge start
  electron-forge package
  electron-forge make
```

后续再补：

```text
Windows 代码签名
自动更新
GitHub Release
安装包校验
```

---

## 5. Electron 安全边界

Electron 不是“随便开 Node 权限给网页”。

第一版必须遵守：

```text
1. renderer 禁止 nodeIntegration。
2. renderer 启用 contextIsolation。
3. preload 只暴露白名单 API。
4. renderer 不能直接读写 ~/.ccr。
5. renderer 不能直接 spawn 子进程。
6. app-server 通信由 main process 托管。
7. 所有 IPC 入参做 schema 校验。
8. 不加载远程不可信页面。
9. token / refresh token 不传给 renderer。
10. 权限确认必须走 App Server 的 permission 流。
```

推荐分层：

```text
Renderer
  只负责 UI 和用户操作

Preload
  暴露 window.ccr API
  只做类型安全的桥接

Main
  管理本地文件、子进程、app-server、系统能力

App Server
  管理 CCR Core、session、tools、permissions、LLM
```

---

## 6. Tauri 是否值得考虑

值得，但不是第一版。

Tauri 的优点：

- 包体更小。
- 使用系统 WebView。
- Rust 后端适合做更强安全边界。
- 对长期产品化很有吸引力。

但 CCR 第一版会遇到这些问题：

- 我们需要稳定管理 Node/CCR app-server 子进程，Electron 主进程更直接。
- 如果 Tauri 后端用 Rust，前期要维护 Rust shell + Node core 双运行时。
- 如果只把 Tauri 当 WebView 壳，还是要额外处理和 Node core 的 sidecar 边界。
- Windows WebView2 通常没问题，但跨平台 UI 表现会比 Electron 更依赖系统 WebView 差异。

因此建议：

```text
第一版：
  Electron

第二阶段：
  如果包体/内存/安全成为主要矛盾，开 Tauri POC

长期：
  如果 CCR Core 未来 native 化，再重新评估 Tauri
```

---

## 7. 第一版 Desktop 工程形态

建议目录：

```text
apps/desktop/
  package.json
  electron.vite.config.ts
  src/
    main/
      main.ts
      appServerProcess.ts
      appServerClient.ts
      window.ts
      updater.ts
    preload/
      index.ts
      ccrApi.ts
    renderer/
      main.tsx
      app/
      pages/
        WorkspacePage.tsx
        ChatPage.tsx
        SettingsPage.tsx
        McpPage.tsx
        LogsPage.tsx
      components/
      styles/
```

第一版功能范围：

```text
1. 启动 Desktop。
2. Electron main 启动内置 ccr app-server。
3. renderer 调 initialize，显示 coreVersion / ccrHome。
4. 显示 auth/status。
5. 显示 config/get。
6. workspace/open。
7. 后续接 thread/start / turn/start。
```

---

## 8. 不建议的做法

不要这样做：

```text
Desktop renderer 直接 import CCR src 内部模块。
Desktop renderer 直接读 ~/.ccr/token。
Desktop 直接调用全局 npm ccr。
Desktop 直接复刻一套 LLM runtime。
VS Code 插件自己实现一套 Agent 核心。
Electron 里打开 nodeIntegration 让页面直接操作系统。
```

这些都会导致后续变成多套核心、多套配置、多套安全模型。

---

## 9. 最终建议

当前最稳路线：

```text
1. 先实现 ccr app-server --listen stdio。
2. Desktop 第一版选 Electron + React + TypeScript。
3. Electron main 管 app-server 子进程。
4. Electron renderer 只做 UI。
5. preload 暴露白名单 API。
6. 后续等 Desktop 跑稳，再考虑 Tauri POC。
```

升级管理不要在 Desktop 第一版里手写下载覆盖逻辑。后续 Desktop、Core、CLI、VS Code 插件和 MCP 的升级边界见：

- [CCR 升级管理策略](./upgrade-management-strategy.md)

一句话：

```text
不要随便写，也不要一开始追求最轻。
CCR Desktop 第一版要先追求可控、可调试、可发布。
Electron 是最合适的第一阶段工程壳。
```
