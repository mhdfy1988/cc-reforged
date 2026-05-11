# CCR Desktop 安装包瘦身专项 Todo

## 当前任务列表（实时）

- [x] PKG-00 包体基线复测与风险审计
- [x] PKG-01 ASAR 优先 POC
- [x] PKG-02 打包态 App Server 启动链路改造
- [x] PKG-03 精确 unpack 白名单与依赖清理
- [x] PKG-04 包布局 smoke 与安装计时验收
- [ ] PKG-05 在线安装器 nsis-web 评估
- [ ] PKG-06 JS runtime bundle 兜底方案评估
- [ ] PKG-07 发布、回滚与文档收口

## 当前指针

- 进行中：PKG-05 在线安装器 nsis-web 评估
- 当前正在做：P1-P4 已完成代码和自动化验收；真实安装计时不在本轮直接执行，避免覆盖用户当前本机安装态。
- 完成后下一项：PKG-05 在线安装器 nsis-web 评估

## 接下来安排

这个专项的主链路已经随 0.4.2 发布验证过，PKG-05 到 PKG-07 属于后续方案评估和文档收口，不阻塞当前 Desktop 使用。

整体顺序：项目级 settings 隔离完成后，先收本专项尾巴，再进入多供应商模型接入与多协议适配，最后回到 App Server P23。

- 第一段：完成 PKG-05，评估 `nsis-web` 在线安装器是否值得进入后续版本，不直接替换当前离线安装器。
- 第二段：完成 PKG-06，评估 JS runtime bundle 兜底方案，只输出边界、收益、风险和是否进入后续版本。
- 第三段：完成 PKG-07，回写发布、回滚、验收和文档索引，关闭本专项。

完成判定：

- 当前 ASAR 优先包结构保持稳定，`app.asar.unpacked` 不回退成完整 `node_modules`。
- `nsis-web` 和 runtime bundle 都有明确结论：采用、暂缓或放弃，并说明原因。
- 发布与回滚文档能解释 0.4.2 当前包结构、unsigned 策略、安装器大小和后续优化边界。
- `npm.cmd run smoke:desktop-package-layout`、`npm.cmd run smoke:desktop-packaged`、`npm.cmd run smoke:desktop-release-artifacts` 通过。

## 专项边界

目标：

- 解决 CCR Desktop 安装阶段慢的问题。
- 优先减少安装阶段写盘文件数。
- 学习 Codex / VS Code / Signal / Element / Bitwarden / Mattermost 的包结构经验。
- 保持 CCR 仍然是 JS / TS 技术栈。

不做：

- 不把 CCR 改成 Rust。
- 不先做 MSIX。
- 不先做在线安装器替代根因修复。
- 不重写 Core / App Server 协议。
- 不影响 CLI/TUI。

方案文档：

- [CCR Desktop 安装包瘦身专项方案](../architecture/desktop-packaging-slimming-plan.md)

## PKG-00 包体基线复测与风险审计

状态：已完成。

目标：

- 用脚本稳定输出当前打包产物大小和文件数。
- 识别哪些文件必须真实路径存在。
- 明确第一轮 `asarUnpack` 白名单。

完成标准：

- 有脚本或命令能输出：
  - installer 大小
  - win-unpacked 总大小 / 文件数
  - `app.asar` 大小
  - `app.asar.unpacked` 大小 / 文件数
  - `app.asar.unpacked/node_modules` 大小 / 文件数
  - top-level 大目录排行
- 形成第一版必须 unpack 清单。
- 明确不能直接删除的动态依赖风险。

当前已知基线：

- installer 约 `139 MB`。
- `win-unpacked` 约 `506 MB`，约 `21027` 个文件。
- `app.asar.unpacked` 约 `156 MB`，约 `20951` 个文件。
- `app.asar.unpacked/node_modules` 约 `126 MB`，约 `16767` 个文件。

本轮复测基线：

- installer：`138898269 bytes`，约 `132.46 MB`。
- `win-unpacked`：`530605581 bytes`，约 `506.02 MB`，`21027` 个文件。
- `app.asar`：`6484880 bytes`，约 `6.18 MB`。
- `app.asar.unpacked`：`163952999 bytes`，约 `156.36 MB`，`20951` 个文件。
- `app.asar.unpacked/node_modules`：`131898996 bytes`，约 `125.79 MB`，`16767` 个文件。
- 旧布局中 `app.asar.unpacked` 包含 `cli.js`、`dist`、`bun-bundle-loader.mjs`。

## PKG-01 ASAR 优先 POC

状态：已完成。

目标：

- 去掉全量 `node_modules/**/*` unpack。
- 让 `cli.js`、`dist`、大部分 `node_modules` 进入 `app.asar`。
- `app.asar.unpacked` 只保留 native/vendor 白名单。

第一轮候选：

```json
"asarUnpack": [
  "**/*.node"
]
```

实施结果：

- `cli.js`、`dist`、`bun-bundle-loader.mjs` 和大部分 `node_modules` 已进入 `app.asar`。
- `app.asar.unpacked` 只剩 native 相关 `.node` 解包内容。
- `vendor/**/*` 本轮未进入 unpack 白名单；当前没有发现必须全量真实路径释放的 vendor 诉求。

完成标准：

- `npm.cmd run desktop:pack` 成功。
- `app.asar.unpacked` 不再包含完整 `node_modules`。
- `app.asar.unpacked` 文件数显著下降。
- 如启动失败，记录具体缺失路径和真实路径诉求，而不是继续猜。

## PKG-02 打包态 App Server 启动链路改造

状态：已完成。

目标：

- 改造 packaged runtime，不再依赖 `resources/app.asar.unpacked` 作为完整运行目录。
- 优先测试从 `resources/app.asar/cli.js` 启动。
- 同步更新 packaged smoke。

完成标准：

- `apps/desktop/src/main/index.ts` 的 packaged runtime 不再硬编码完整运行目录为 `app.asar.unpacked`。
- `scripts/smoke-desktop-packaged-app-server.mjs` 使用同一套 packaged runtime 规则。
- 打包态 App Server 可以通过 stdio 正常响应。

风险：

- OS 无法把 ASAR 内路径当作真实 cwd。
- 部分库可能要求真实路径。
- 如 POC 不稳定，切换到薄 Desktop entry 或 PKG-06 runtime bundle。

实施结果：

- packaged runtime 的 `cwd` 改为 `resources`。
- packaged runtime 的入口改为 `resources/app.asar/cli.js`。
- `scripts/smoke-desktop-packaged-app-server.mjs` 已同步使用同一套规则。
- 打包态 App Server stdio smoke 已通过。

## PKG-03 精确 unpack 白名单与依赖清理

状态：已完成。

目标：

- 将 unpack 范围收敛到 `.node`、`.exe`、`.dll`、`.wasm` 或必须真实路径访问的资源。
- 清理明显构建期依赖进入运行包的问题。

完成标准：

- 白名单有注释或文档说明每项为什么必须 unpack。
- `sharp` / `@img` 等构建期依赖完成归属判断。
- 不影响 provider、MCP、权限、历史会话、文件工具。

实施结果：

- `asarUnpack` 收敛为 `["**/*.node"]`。
- 移除 root `optionalDependencies` 中的 `@img/sharp-*`，避免图标构建期 native 包进入 Desktop 运行包。
- `package-lock.json` 已通过 `npm.cmd install --package-lock-only --ignore-scripts` 更新。
- 本轮未删除动态 provider、MCP、权限、历史会话、文件工具相关依赖。

## PKG-04 包布局 smoke 与安装计时验收

状态：已完成。

目标：

- 新增自动化校验，避免未来再次把完整 `node_modules` unpack 回来。
- 做一次真实安装时间对比。

完成标准：

- 新增 `smoke:desktop-package-layout` 或等价脚本。
- 校验 `app.asar.unpacked` 文件数上限。
- 校验不存在全量 `app.asar.unpacked/node_modules`。
- `desktop:dist`、`smoke:desktop-packaged-app-server`、`smoke:desktop-release-artifacts` 通过。
- 记录安装器启动、安装完成、首次 ready 时间。

实施结果：

- 新增 `smoke:desktop-package-layout`。
- `app.asar.unpacked` 阈值：文件数不超过 `1000`，大小不超过 `50 MB`。
- `app.asar.unpacked/node_modules` 阈值：文件数不超过 `500`，大小不超过 `30 MB`。
- 校验 `app.asar.unpacked` 中不得出现 `cli.js`、`dist`、`bun-bundle-loader.mjs`。
- `desktop:dist` 后安装器：`117712926 bytes`，约 `112.26 MB`。
- `app.asar`：约 `140.71 MB`。
- `app.asar.unpacked`：约 `2.94 MB`，`66` 个文件。
- `app.asar.unpacked/node_modules`：约 `2.94 MB`，`66` 个文件。
- `win-unpacked` 文件数从 `21027` 降到 `142`。
- 真实安装计时未在本轮直接执行，因为会覆盖或影响用户当前本机安装态；保留为用户真实升级路径手测项。

## PKG-05 在线安装器 nsis-web 评估

状态：待开始。

目标：

- 在包体散文件问题收敛后，评估是否增加 `nsis-web`。
- 做类似 Claude Code 小安装器下载 payload 的体验。

完成标准：

- 明确是否保留离线 installer。
- 明确 GitHub Release 资产命名和上传规则。
- 验证 `latest.yml`、blockmap、自动更新是否受影响。
- 验证断网或下载失败提示。

## PKG-06 JS runtime bundle 兜底方案评估

状态：待开始。

目标：

- 如果 ASAR 内启动受限制，再评估 Desktop 专用 JS runtime bundle。
- 保持 JS / TS，不改 Rust。

完成标准：

- 明确 bundle 入口。
- 明确 external/native/vendor 清单。
- CLI/TUI 不改。
- packaged App Server smoke 通过。

## PKG-07 发布、回滚与文档收口

状态：待开始。

目标：

- 形成可发布版本。
- 明确回滚策略。
- 更新发布文档和自动更新文档。

完成标准：

- 文档索引已更新。
- release checklist 已包含包布局 smoke。
- 如果新版安装异常，可回滚到 0.4.0 打包策略。

## 后续记录（追加）

- 初始化：从 0.4.0 自动更新真实安装体验暴露出的“下载后安装慢”问题拆出独立专项。当前根因优先判断为 `app.asar.unpacked` 中释放了完整 `node_modules + dist`，导致安装阶段写入两万多个文件。第一版先修包结构，不先做 Rust、MSIX 或在线安装器。
- 2026-05-09：完成 P1-P4 代码与自动化验收。旧布局 `app.asar.unpacked` 为 `156.36 MB / 20951` 个文件，新布局为 `2.94 MB / 66` 个文件；安装器从 `132.46 MB` 降到 `112.26 MB`。打包态 App Server 已验证可从 `resources/app.asar/cli.js` 启动，release artifact smoke 通过。

## 备注

- 当前状态：paused
- 暂停原因：用户本轮只要求先完成 P1-P4；剩余 PKG-05/06/07 属于后续发布体验和兜底方案，真实安装计时建议由用户在实际升级路径中测试。
- 当前仓库：`D:\agent_project\claude-code-reforged`
- 当前主线：Desktop 安装包瘦身与安装体验优化。
- 当前非目标：不改 Core 语言栈、不重写 App Server、不影响 CLI/TUI、不先替换发布渠道。
