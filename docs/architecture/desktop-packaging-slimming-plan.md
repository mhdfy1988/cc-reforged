# CCR Desktop 安装包瘦身专项方案

## 目标

解决 CCR Desktop 0.4.0 安装阶段明显偏慢的问题。当前判断不是单纯下载慢，而是安装器在本机解压和写入大量散文件时变慢，尤其是 `app.asar.unpacked/node_modules` 与 `dist`。

第一版目标：

- 保持 CCR 仍然是 JS / TS 技术栈，不改 Rust。
- 保持 CLI / TUI 主链路不受影响。
- 保持 App Server 协议和 Desktop UI 业务逻辑不重写。
- 让 Desktop 安装包从“完整 Node 项目目录解包”改成“ASAR 为主，少量 native/vendor 解包”。
- 降低安装阶段写盘文件数，优先解决安装慢。

非目标：

- 第一版不做 MSIX。
- 第一版不把 Core 改成 Rust/native exe。
- 第一版不把在线安装器当作根因修复。
- 第一版不为了瘦身删除 provider 或工具能力。

## 当前基线

基于 0.4.0 本地打包产物：

- 安装器约 `139 MB`。
- `release/desktop/win-unpacked` 约 `506 MB`。
- 解包后约 `21027` 个文件。
- `resources/app.asar.unpacked` 约 `156 MB`，约 `20951` 个文件。
- `app.asar.unpacked/node_modules` 约 `126 MB`，约 `16767` 个文件。
- `app.asar.unpacked/dist` 约 `31 MB`，约 `4177` 个文件。

2026-05-09 P1-P4 实施后实测：

- 安装器从约 `132.46 MB` 降到约 `112.26 MB`。
- `win-unpacked` 文件数从 `21027` 降到 `142`。
- `app.asar` 从约 `6.18 MB` 增至约 `140.71 MB`，符合“JS 进入 ASAR”的目标。
- `app.asar.unpacked` 从约 `156.36 MB / 20951` 个文件降到约 `2.94 MB / 66` 个文件。
- `app.asar.unpacked/node_modules` 从约 `125.79 MB / 16767` 个文件降到约 `2.94 MB / 66` 个文件。

当前 `package.json` 的关键配置：

```json
"asar": true,
"asarUnpack": [
  "cli.js",
  "bun-bundle-loader.mjs",
  "dist/**/*",
  "vendor/**/*",
  "node_modules/**/*"
]
```

这相当于把 Desktop 运行时作为完整 Node 项目目录释放到磁盘。安装器需要写入大量小文件，Windows 安全扫描也会逐个介入。

当前 Desktop 打包态启动 App Server 的关键链路：

```text
CCR.exe
  -> process.execPath + ELECTRON_RUN_AS_NODE=1
  -> app.asar.unpacked/cli.js
  -> cli.js app-server --listen stdio
  -> dist + node_modules
```

因此只改 `asarUnpack` 会有启动失败风险，必须同步改打包态启动入口和验证脚本。

## 参考结论

公开 JS/Electron 项目的共同点不是“不要 node_modules”，而是：

```text
大部分 JS / node_modules 放入 app.asar
只有 .node / exe / dll / wasm / 真实路径资源放入 app.asar.unpacked 或 extraResources
```

已核对的参考：

- Electron 官方：ASAR 适合应用源码归档，但原生模块、需要真实路径执行的文件需要特殊处理。
- electron-builder：`asar` 默认开启；需要 unpack 的 node modules 可自动检测，`asarUnpack` 应用于必须解包的文件。
- Signal Desktop：`asarUnpack: ["**/*.node"]`，同时通过 `files` 清理测试、源码、map 和无关 build 文件。
- Element Desktop：`asarUnpack: "**/*.node"`，Web app 单独为 `webapp.asar`，native 由 `.hak/hakModules` 控制。
- Mattermost Desktop：先排除全部 `node_modules`，再白名单少数 native 模块，`asarUnpack` 只列 `.node`。
- Bitwarden Desktop：`asarUnpack: ["**/*.node"]`，额外真实资源走 `extraResources`。
- VS Code：生产依赖清理后生成 `node_modules.asar`，只对 `.node`、`ripgrep`、`node-pty`、`wasm` 等做例外。
- Codex：更进一步，将 Core/App Server 编成独立二进制，Electron 壳不依赖完整 Node 项目目录。

对 CCR 的结论：

- 第一阶段应学 Signal / Element / Bitwarden / VS Code 的 ASAR 策略。
- 第二阶段再评估 `nsis-web` 在线安装器。
- 第三阶段才考虑 JS runtime bundle 或独立运行产物。

## 总体方案

### P1：ASAR 优先

目标：

- `cli.js`、`dist`、大部分 `node_modules` 进入 `app.asar`。
- `app.asar.unpacked` 只保留必须是真实文件的内容。

预期结构：

```text
resources/
  app.asar
  app.asar.unpacked/
    node_modules/
      <少量 native 模块>
    vendor/
      <必须真实路径执行或读取的资源>
```

关键改动点：

- `package.json` 的 `build.asarUnpack` 从全量目录改为精确白名单。
- `apps/desktop/src/main/index.ts` 的 packaged runtime 不再把 `cwd` 指向 `app.asar.unpacked`。
- `scripts/smoke-desktop-packaged-app-server.mjs` 同步验证新的打包态启动方式。

第一轮候选配置：

```json
"asarUnpack": [
  "**/*.node"
]
```

`vendor/**/*` 本轮没有继续全量 unpack。如果后续新增外部二进制或必须真实路径访问的资源，再用更小粒度加入白名单。

### P2：打包态 App Server 启动改造

当前打包态启动依赖：

```text
cwd = resources/app.asar.unpacked
args = cli.js app-server --listen stdio
```

新方案先做 POC：

```text
cwd = resources
args = resources/app.asar/cli.js app-server --listen stdio
env  = ELECTRON_RUN_AS_NODE=1
```

如果 Electron 的 run-as-node 可以稳定加载 ASAR 内的 `cli.js` 和依赖，则保留该方案。

P1-P4 实测结果：该方案已通过 packaged App Server smoke。打包态入口为：

```text
resources/app.asar/cli.js
```

运行目录为：

```text
resources
```

如果遇到真实路径限制，则进入 P2b：

- 新增一个很薄的 Desktop packaged entry。
- 入口仍然复用现有 App Server 逻辑。
- 只把该入口和必要资源作为真实文件释放。
- 不复制 Core 业务逻辑。

### P3：依赖与资源清理

目标：

- 清理明显不需要进入 Desktop 运行包的构建期依赖。
- 不删除 CLI/TUI 所需能力。
- 不因为包体优化破坏 provider、权限、MCP、历史会话。

优先审计对象：

- `sharp` / `@img`：如果只用于图标构建，应移出 Desktop 运行包。
- source map、README、测试目录、示例目录、源码头文件等。
- 仅构建期使用的脚本依赖。
- 只被 CLI 发布或 npm 包使用、Desktop App Server 不直接需要的资源。

约束：

- 生产依赖迁移前必须确认引用路径。
- 对动态 import / require 的依赖不得凭猜删除。
- 每次清理必须跑 packaged App Server smoke。

本轮已处理：

- `sharp` 仍保留在开发依赖中，用于 `scripts/build-desktop-icons.mjs`。
- root `optionalDependencies` 中的 `@img/sharp-*` 已移除，避免构建期 native 包作为运行时 payload 进入 Desktop 包。
- 本轮没有裁剪动态 provider、MCP、权限、历史会话、文件工具相关依赖。

### P4：安装体验与在线安装器

在 P1-P3 之后再评估在线安装器。

原因：

- `nsis-web` 可以降低初始下载器体积。
- 但如果 payload 仍然有两万多个散文件，安装阶段仍然慢。
- 所以在线安装器不是第一刀。

候选方案：

```json
"win": {
  "target": [
    { "target": "nsis", "arch": ["x64"] },
    { "target": "nsis-web", "arch": ["x64"] }
  ]
}
```

需要验证：

- GitHub Release 是否能正确发布 `.nsis.7z` payload。
- `latest.yml` 与自动更新是否受影响。
- 断网场景是否有清晰提示。
- 是否仍保留完整离线安装包作为兜底。

### P5：JS runtime bundle 兜底

如果 P1-P2 受动态加载或真实路径限制影响较大，再做 runtime bundle。

目标形态：

```text
resources/
  app.asar
  ccr-app-server-runtime.mjs
  app.asar.unpacked/
    少量 native/vendor
```

约束：

- 仍然是 JS / TS，不改 Rust。
- bundle 只改变 Desktop 打包产物形态，不复制 Core 逻辑。
- CLI/TUI 继续走现有 `cli.js`。

### P6：代码签名 / MSIX / 更正式分发

这是发布成熟度问题，不作为安装慢根因修复。

后续可做：

- 代码签名，降低安全拦截和 SmartScreen 风险。
- MSIX / AppX 评估。
- winget 发布。
- 企业安装策略。

## 验收指标

第一阶段目标：

- `app.asar.unpacked` 文件数从约 `20951` 降到 `500` 以下。
- `app.asar.unpacked/node_modules` 不再包含完整 `node_modules`。
- 安装包仍可正常启动 Desktop。
- packaged App Server smoke 通过。
- 历史会话、权限卡片、文件写入、设置页、自动更新检查入口不回归。

P1-P4 自动化验收结果：

- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run desktop:pack` 通过。
- `npm.cmd run desktop:dist` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run smoke:desktop-package-layout` 通过。
- `npm.cmd run smoke:desktop-packaged` 通过。
- `npm.cmd run smoke:desktop-release-artifacts` 通过。

真实安装耗时未在本轮直接执行，原因是运行安装器会影响用户当前本机安装态；建议用户走旧版自动更新到新版的真实路径时记录该指标。

建议新增或增强 smoke：

- `smoke:desktop-package-layout`：校验 `app.asar.unpacked` 文件数、大小、是否存在全量 `node_modules`。
- `smoke:desktop-packaged-app-server`：按真实 packaged runtime 启动 App Server。
- `smoke:desktop-release-artifacts`：继续校验 installer / blockmap / latest.yml。

人工验收：

- 旧版升级到新版。
- 冷启动首次打开。
- 新建会话并执行一次文件读取。
- 执行一次写文件权限流程。
- 打开历史会话弹窗。
- 检查更新入口不报 404。

安装时间记录：

- 安装器启动时间。
- 进入进度条时间。
- 安装完成时间。
- 首次启动到 App Server ready 时间。

## 风险与处理

### 风险 1：ASAR 内路径不是 OS 真实路径

表现：

- `child_process.spawn` 无法执行 ASAR 内文件。
- 某些库要求真实文件路径。

处理：

- JS 入口优先通过 Electron run-as-node 加载 ASAR 内脚本。
- 二进制、`.node`、必须真实路径读取的资源继续 unpack。
- 失败时切换到 P2b 或 P5。

### 风险 2：动态 require / import 被错误裁剪

表现：

- 开发态正常，打包态缺模块。

处理：

- 先做包布局 POC，不同时做大规模依赖删除。
- 每次清理一个依赖组。
- 用 packaged smoke 兜底。

### 风险 3：CLI/TUI 被误伤

表现：

- npm 包或命令行入口找不到文件。

处理：

- Desktop 打包配置与 npm `files` 分开看。
- 不修改 CLI/TUI 启动入口。
- `ci:smoke` 保留 CLI/TUI 覆盖。

### 风险 4：自动更新资产变化

表现：

- `latest.yml` 指向不一致。
- `nsis-web` 额外 payload 未上传。

处理：

- P1-P3 先不改 target。
- P4 单独做在线安装器评估。
- 每次 release 前跑 `release:desktop:check` 和 artifact smoke。

## 推荐推进顺序

第一轮只做：

1. PKG-00：复测包体，生成机器可读包布局报告。
2. PKG-01：ASAR 优先 POC，去掉全量 `node_modules/**/*` unpack。
3. PKG-02：修正 packaged runtime 启动方式。
4. PKG-03：补 package layout smoke。
5. PKG-04：人工安装计时验收。

第二轮再做：

1. 清理构建期依赖和无关资源。
2. 评估 `nsis-web`。
3. 评估 runtime bundle。

一句话策略：

先把“上万散文件解包”改掉，再谈在线安装器和更高级分发。
