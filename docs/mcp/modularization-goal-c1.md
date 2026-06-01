# MCP 模块化 Goal C-1 设计

> 当前 MCP 模块化权威路线已迁移到 [`modularization-roadmap.md`](./modularization-roadmap.md)。本文保留 C 系列历史设计、执行结果和背景记录。

本文是 MCP 模块化第一步的边界说明。目标是先把“通用 MCP 能力”和“具体 MCP 预设”拆开，不改 Desktop / CLI / App Server 对外协议，也不迁移 `client.ts` 主流程。

## 目标

- 安装候选从单文件内联定义改为 registry + 单个 preset 模块。
- Playwright 作为第一个 preset，只暴露安装元数据和 server config 生成方法。
- `installManager` 继续只依赖统一 preset 查询接口，不感知 Playwright 细节。
- 记录后续 MCP client 拆分边界，避免下一轮把安装、连接、工具调用和具体 MCP 特例混在一起改。

## 当前边界盘点

| 模块 | 当前职责 | C-1 后归属 |
| --- | --- | --- |
| `client.ts` | MCP 连接、transport、工具 / 资源 / prompt 发现、工具调用、结果处理、错误归一化、特殊拦截 | 暂不迁移，后续 C-3 再拆 |
| `installManager.ts` | 安装计划、确认 token、写配置、安装记录、lock、卸载、风险摘要 | 通用安装层 |
| `installManifest.ts` | 安装 manifest schema、摘要、从 server config 推导 source kind | 通用安装协议层 |
| `config.ts` / `configInventory.ts` | MCP 配置读写、作用域、配置清单 | 通用配置层 |
| `playwrightPreset.ts` | Playwright npx / managed 安装、server config 构造 | Playwright 专属实现层 |
| `presets/registry.ts` | 内置安装候选注册、搜索、按 id 获取 | preset 注册层 |
| `presets/playwright.ts` | Playwright 安装候选元数据、manifest、server config adapter | Playwright preset 层 |
| `presets/context7.ts` | Context7 安装候选元数据、manifest、server config adapter | Context7 preset 层 |

## 目标目录

第一步采用兼容性目录，不大规模搬动旧文件：

```text
src/services/mcp/
  client.ts                    # 旧主流程，C-1 不迁移
  installManager.ts            # 通用安装流程
  installManifest.ts           # 通用安装 manifest
  installPresets.ts            # 兼容导出口
  playwrightPreset.ts          # Playwright 专属安装实现
  presets/
    types.ts                   # preset 类型
    registry.ts                # preset 注册与搜索
    playwright.ts              # Playwright preset 元数据
    context7.ts                # Context7 preset 元数据
  providers/
    playwright/
      install.ts               # Playwright npx / managed 安装与 server config
    context7/
      install.ts               # Context7 npx server config
```

后续迭代再考虑把 `client.ts` 拆成：

```text
src/services/mcp/core/
  connection.ts
  transports.ts
  tools.ts
  resources.ts
  prompts.ts
  resultProcessing.ts
  errors.ts
```

## 关键输入输出

- 输入：Desktop / App Server 调用 `searchCcrMcpInstallCandidates({ query })`。
- 中间：`installManager` 调用 `searchCcrMcpInstallPresets`，只拿通用 `CcrMcpInstallPreset`。
- 输出：候选包含 `manifest` 摘要、完整 `manifestInput`、展示名、描述、可信标记。
- 安装：`builtin-preset` 或 `stdio-npm-package` manifest 都通过 `resolveServerConfig` 得到统一 `McpServerConfig`。

## 不变式

- C-1 不改变 `search/install/plan/apply/uninstall` 对外返回结构。
- C-1 不改变 `playwright` preset 的 manifest 内容、默认 version、transport、权限和数据边界。
- C-1 不迁移 `client.ts`，不改变 MCP 工具发现和调用行为。
- 新增 MCP preset 时，只允许新增 `presets/<name>.ts` 并在 `presets/registry.ts` 注册；不再修改 `installManager.ts`。

## 下一步

- C-2：把更多安装 preset 注册机制补成可测试 registry，并准备第二个真实 preset 或 fixture preset。
- C-3：从 `client.ts` 抽通用连接、工具调用、结果处理和错误归一化 helper。
- C-4：把 Playwright 专属的 file URL 拦截、能力说明和安装文档进一步归到 Playwright adapter / preset 边界下。

## C-2 补强结果

C-2 在 C-1 目录基础上补了 registry 不变式：

- `createCcrMcpInstallPresetRegistry(...)` 可用于默认 registry 和测试 fixture registry。
- registry 创建时会校验 preset id 非空且不能重复；重复 id 快速失败，不允许后注册项静默覆盖前注册项。
- `list()` 返回副本，外部调用者不能修改 registry 内部 preset 数组。
- `search()` 统一搜索 preset id、manifest name、displayName、description 和 npm package name。
- `smoke:mcp-install-presets` 固定验证默认 Playwright 候选、包名搜索、空结果、list 防外部修改和重复 id 报错。

## C-3 第一刀

C-3 先抽低风险通用 helper，不迁移 MCP 连接主流程：

- 新增 `toolSafety.ts`，承载 MCP 工具调用前的安全判断。
- `isFileUrl(...)`、`getBlockedFileUrlForMcpTool(...)`、`createMcpFileUrlBlockedError(...)` 从 `client.ts` 移出。
- `client.ts` 仍负责调用流程、日志、重试和 session 过期处理，只在调用前使用 `toolSafety` 判断是否阻断。
- `smoke:mcp-tool-safety` 固定验证 `browser_navigate` 阻断 `file://`，同时允许 `http://localhost` 和非导航工具。

后续 C-3 可以继续按相同原则抽：

- 结果处理：`transformMCPResult` / `processMCPResult`。
- URL elicitation 解析：从 `McpError.data` 提取并校验 elicitations。
- 超时和进度日志 helper：只抽纯函数与可注入依赖部分。

## C-4 Playwright 归位

C-4 把 Playwright 专属安装实现归到 provider 边界：

- `providers/playwright/install.ts` 是 Playwright npx / managed 安装、server config 构造、managed manifest 路径的真实实现。
- `playwrightPreset.ts` 保留为兼容导出口，CLI 旧引用不需要立刻迁移。
- `presets/playwright.ts` 直接依赖 Playwright provider 实现，不再从兼容导出口反向引用。
- `smoke:mcp-playwright-provider` 固定验证新 provider 路径和旧兼容路径的 npx config 输出一致。

## 后续 Goal Roadmap

### Goal C-5：抽 MCP 结果处理模块

目标：从 `client.ts` 抽出 `resultProcessing`，让工具调用主流程只负责调用和错误分支，不继续承载结果转换、大输出落盘和图片特殊处理。

改动范围：

- 迁移 `transformResultContent(...)`。
- 迁移 `persistBlobToTextBlock(...)`。
- 迁移 `inferCompactSchema(...)`。
- 迁移 `transformMCPResult(...)`。
- 迁移 `processMCPResult(...)`。
- 迁移 `contentContainsImages(...)`。

验收：

- `client.ts` 只调用 `processMCPResult(...)`。
- 大结果持久化、图片不落 JSON、IDE server 跳过大结果处理行为不变。
- 新增 `smoke:mcp-result-processing`。
- `smoke:app-server-client` 通过。

执行结果：

- 新增 `resultProcessing.ts`，承载 MCP result content 转换、blob 落盘、大输出处理、schema 推断和图片内容判断。
- `client.ts` 只保留 `transformResultContent(...)` 和 `processMCPResult(...)` 的调用点。
- `smoke:mcp-result-processing` 覆盖 toolResult、structuredContent、content array、resource link、图片检测和非法结果报错。

### Goal C-6：抽 URL elicitation 解析与安全策略

目标：把 URL elicitation 的数据解析、校验和安全阻断从 `callMCPToolWithUrlElicitationRetry(...)` 中抽出；重试流程仍留在 `client.ts`。

改动范围：

- 从 `McpError.data` 提取 elicitations。
- 校验 `ElicitRequestURLParams`。
- 检查 URL elicitation 中的 `file://`。
- 抽 decline / cancel / hook response 文案 helper。

验收：

- `callMCPToolWithUrlElicitationRetry(...)` 只保留重试编排、hook 调用和 UI 等待流程。
- 解析和文案 helper 有独立 smoke。
- AskUserQuestion / permission 回答链路不受影响。

执行结果：

- 新增 `urlElicitation.ts`，承载从 `McpError.data` 提取 URL elicitations、字段校验、`file://` 查找和非 accept 文案生成。
- `callMCPToolWithUrlElicitationRetry(...)` 保留重试编排、hook 调用、用户等待和 retry loop。
- `smoke:mcp-url-elicitation` 覆盖合法/非法 elicitation 过滤、file URL 识别、hook/user 拒绝文案。

### Goal C-7：抽 MCP 工具调用运行时 helper

目标：把单次 `callMCPTool(...)` 内的通用运行时辅助拆出，让主函数更接近“准备 -> SDK 调用 -> 结果处理 -> 错误分类”。

改动范围：

- timeout 计算。
- timeout error 构造。
- progress interval 文案。
- `isError` result 解析。
- tool duration 格式化。
- auth / session expired 判断包装。

验收：

- `callMCPTool(...)` 只保留流程编排。
- 401、session expired、tool isError、timeout 行为不变。
- 新增 `smoke:mcp-tool-runtime`。
- `smoke:app-server-client` 通过。

执行结果：

- 新增 `toolRuntime.ts`，承载工具超时时间解析、timeout error 构造、耗时格式化、`isError` 结果文本提取和 HTTP session closed 判断。
- `callMCPTool(...)` 保留 SDK 调用、日志、auth/session 副作用和 cache 清理。
- `smoke:mcp-tool-runtime` 覆盖默认/显式 timeout、duration、tool error 解析和 HTTP connection closed 判断。

### Goal C-8：抽 tools / resources / prompts 发现模块

目标：把 MCP server 能力发现和 CCR 工具包装从 `client.ts` 拆出去。

改动范围：

- list tools。
- list resources。
- list prompts。
- `MCPTool` / `ReadMcpResourceTool` / `ListMcpResourcesTool` 包装。
- tool name normalize / build 相关流程。

验收：

- `getMcpToolsCommandsAndResources(...)` 行为不变。
- 已配置 MCP server 继续加载 tools / resources / prompts。
- `smoke:app-server-client` 和工具发现 smoke 通过。

执行结果：

- 新增 `discoveryAdapters.ts`，先承载发现结果到 CCR 结构的纯转换逻辑。
- 迁移 resource server 标记、prompt command 包装、prompt command name、tool search hint、tool prompt 截断和 SDK skip-prefix 判断。
- SDK 请求、连接缓存、tool call 闭包和权限逻辑仍保留在 `client.ts`。
- `smoke:mcp-discovery-adapters` 覆盖资源映射、prompt command 包装、tool 搜索提示、描述截断和 skip-prefix 判断。

### Goal C-9：抽 transport / connection factory

目标：把 stdio / HTTP / SSE / websocket / SDK transport 创建和连接前配置组装从 `client.ts` 独立出来。

改动范围：

- stdio transport。
- SSE transport。
- streamable HTTP transport。
- websocket transport。
- SDK control transport。
- headers / proxy / mTLS / OAuth 组装。

验收：

- 连接状态、auth required、disabled server、startup timeout 行为不变。
- 不改变 MCP config schema。
- `smoke:app-server-client` 通过。

执行结果：

- 新增 `transportFactory.ts`，先承载低风险 transport 构造辅助：stdio launch config 解析、stdio transport 创建、Node `ws` 客户端 / WebSocket transport 创建、SDK control transport 创建。
- `client.ts` 仍保留连接生命周期、auth、proxy/OAuth 选项组装、startup timeout、stderr 收集和 reconnect/error 分类，不在本轮迁移状态机。
- `smoke:mcp-transport-factory` 覆盖 stdio shell prefix、环境变量合并、stdio transport 创建和 SDK control transport 创建。
- HTTP / SSE 的 auth、proxy、step-up detection 选项组装暂不迁移，留给后续更小的 connection factory 迭代。

### Goal C-10：补第二个真实 MCP preset

目标：用新的 registry / provider 结构接入第二个真实 preset，验证扩展模型不是只服务 Playwright。

候选优先级：

1. `context7`：文档检索类，适合代码协作。
2. `sentry`：HTTP remote MCP，可验证 remote-url preset。
3. `github`：价值高但权限更重，放后面更稳。

验收：

- 新增 `providers/<name>/install.ts` 或独立 preset 文件。
- 搜索能找到第二个候选。
- plan / apply / uninstall 路径可用。
- 文档说明权限和数据边界。

执行结果：

- 新增 `providers/context7/install.ts`，封装 `@upstash/context7-mcp` 的 npx stdio server config，Windows 使用 `npx.cmd`。
- 新增 `presets/context7.ts` 并注册到 `presets/registry.ts`，Context7 与 Playwright 共享同一套搜索、计划、应用和卸载入口。
- Context7 preset 权限边界：启动本地 stdio 进程，并访问 Context7 远端文档服务；API key 属于官方推荐项，但当前 preset 不强制配置密钥。
- `smoke:mcp-install-presets` 固定默认 registry 同时包含 Playwright 和 Context7。
- `smoke:mcp-context7-provider` 覆盖 Context7 包引用、server config、搜索、transport、权限和数据边界；plan / apply / uninstall 仍由 `installManager` 统一路径和 `smoke:app-server-client` 覆盖。

### Goal C-11：Desktop 多 preset 管理体验

目标：让 MCP 页面适配多个 preset，而不是只围绕 Playwright 的单候选体验。

改动范围：

- preset 分类 / 排序。
- 候选详情。
- 权限 / 风险展示。
- 已安装 / 可安装 / 需修复状态统一。
- 空搜索和无结果状态。

验收：

- Playwright 和第二 preset 都展示正确。
- 安装计划弹窗信息完整。
- smoke 或桌面状态测试覆盖候选列表。

执行结果：

- Desktop MCP 安装候选列表改为多 preset 扫描式卡片：可安装候选优先排序，已安装 / 已配置候选自动后置。
- 候选卡展示状态、安装类型、transport、来源、数据边界、可信标记和权限标签；Playwright 与 Context7 不再只显示一行描述。
- 安装确认弹窗继续复用原 plan 结构，避免 Desktop 复制安装风险判断。
- `smoke:app-server-client` 增加空搜索断言，固定服务端候选列表同时包含 Playwright 和 Context7。
- `typecheck:desktop` 覆盖 Desktop 页面类型状态。

### Goal C-12：CLI install / uninstall / status / repair

目标：把 Desktop 的安装计划能力补成 CLI 管理命令，并复用 `installManager`，不复制安装逻辑。

命令建议：

```text
ccr mcp search [query]
ccr mcp install <preset>
ccr mcp uninstall <name>
ccr mcp status
ccr mcp repair <name>
```

验收：

- CLI 能复用 `installManager`。
- 默认需要确认，支持明确 flag 跳过交互。
- smoke 覆盖 search / plan / apply / uninstall / status。

执行结果：

- 新增 `ccr mcp search [query]`，通过 `searchCcrMcpInstallCandidates(...)` 查询 preset 候选。
- 新增 `ccr mcp install <preset>`，默认只打印 plan，不写配置；传 `--yes` 后调用 `applyCcrMcpInstallPlan(...)` 写入配置，支持 `--scope`、`--name` 和 `--force`。
- 新增 `ccr mcp status`，读取 CCR installer 记录，不启动 MCP server 做健康检查。
- 新增 `ccr mcp uninstall <name>`，默认 dry-run；传 `--yes` 后调用 `uninstallCcrMcpInstalledServer(...)`。
- 新增 `ccr mcp repair <name>`，当前支持内置 preset 重新生成配置，默认 dry-run，传 `--yes` 后强制应用。
- `smoke:mcp-cli-install` 使用临时 `CCR_CONFIG_DIR` 通过 `cli.js` 端到端覆盖 search、dry-run plan、apply、status、repair dry-run、uninstall dry-run 和 uninstall。

## 已完成推进顺序

```text
C-5 -> C-6 -> C-7 -> C-8 -> C-9 -> C-10 -> C-11 -> C-12
```

## 后续 Goal Roadmap D 系列

D 系列目标是从“安装和入口可用”继续推进到“连接、发现、安全、管理体验和文档收口都清晰”。每个 goal 都必须独立验证，不把连接状态机、preset、Desktop UI 和发布收口混在同一轮里做。

### Goal D-1：深化 remote transport / connection factory

目标：继续从 `client.ts` 抽出 HTTP / SSE / claude.ai proxy 的连接前配置组装，让 `client.ts` 只保留连接生命周期和错误状态机。

改动范围：

- SSE transport options 组装。
- HTTP streamable transport options 组装。
- claude.ai proxy transport options 组装。
- headers / proxy / OAuth provider / step-up detection / timeout fetch 组合。
- 只迁移“选项构造”，暂不迁移 `client.connect(...)`、startup timeout、stderr、onerror/onclose 和 reconnect。

验收：

- `client.ts` 中 `new SSEClientTransport(...)` / `new StreamableHTTPClientTransport(...)` 调用减少到使用 helper 的结果。
- auth required、OAuth token、session ingress token、proxy、mTLS、step-up detection 行为不变。
- 新增 `smoke:mcp-remote-transport-options` 或等价 smoke，覆盖 headers 合并、proxy option、session token/OAuth 优先级。
- `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server-client` 通过。

边界：

- 不调整 MCP config schema。
- 不引入静默 fallback。
- 不在本 goal 改 Desktop / CLI。

### Goal D-2：补真实 remote MCP preset

目标：新增一个真实 remote-url MCP preset，验证 registry / installManager / Desktop / CLI 不只适配 stdio npm package。

候选：

1. Sentry remote MCP：优先验证 HTTP remote preset、OAuth / headers 边界。
2. 其他低权限 HTTP/SSE MCP：如果 Sentry 凭据或官方入口不稳定，则选择更低风险候选。

改动范围：

- 新增 `presets/<remote>.ts` 或 `providers/<remote>/install.ts`。
- manifest 使用 `source.kind = 'remote-url'`，明确 `transport`、权限、数据边界和 homepage。
- Desktop 候选卡正确显示远端来源、transport、权限和数据边界。
- CLI `mcp search/install/status/uninstall` 能处理 remote preset。

验收：

- 搜索能找到第三个候选。
- plan 能生成 remote server config preview。
- dry-run 和 `--yes` install/uninstall smoke 使用临时 `CCR_CONFIG_DIR` 覆盖。
- 文档写清楚凭据、远端数据边界和是否需要 OAuth/header。

边界：

- 不在 preset 里硬编码用户密钥。
- 如果 remote preset 需要用户 OAuth，不在本 goal 完整实现 OAuth wizard，只描述当前边界并保持 install plan 明确。

### Goal D-3：拆 discovery service

目标：把 tools / resources / prompts 的 SDK 请求、错误处理和 CCR wrapper 创建从 `client.ts` 继续拆出，`discoveryAdapters.ts` 只保留纯转换。

改动范围：

- list tools / resources / prompts 请求编排。
- `MCPTool`、`ReadMcpResourceTool`、`ListMcpResourcesTool` 创建。
- tool name normalize / build / search hint / prompt text 组合。
- discovery 错误日志和单 server 局部失败处理。

验收：

- `getMcpToolsCommandsAndResources(...)` 主体明显变薄，调用新的 `discoverMcpServerCapabilities(...)` 或同等入口。
- discovery service 有独立 smoke，覆盖工具、资源、prompt、skip-prefix、重复名称和局部失败。
- 现有 `smoke:mcp-discovery-adapters` 保留。
- `smoke:app-server-client` 通过。

边界：

- 不改 `MCPTool` 运行时调用语义。
- 不改权限判断。
- 不改变工具名对外格式。

### Goal D-4：安装安全与配置漂移校验

目标：让 MCP installer 能明确识别“安装记录”和“当前配置”是否一致，提升 repair/status 的可信度。

改动范围：

- install record 与当前 `McpServerConfig` 的签名对比。
- CLI / Desktop status 显示 installed / configured / drifted / missing-config。
- repair 对 drifted / missing-config 的语义明确。
- secret/env/header 风险摘要统一。
- unpinned version、checksum missing、remote boundary 风险文案复核。

验收：

- 新增 drift smoke：安装 Context7 后手动改配置，再 status 能显示 drifted。
- repair dry-run 能说明会写回哪份 config。
- `smoke:mcp-cli-install` 扩展覆盖 status drift / repair。
- Desktop 候选或已安装列表能展示需修复状态。

边界：

- 不自动覆盖用户手动改动，除非用户显式确认。
- 不把旧配置作为静默 fallback。

### Goal D-5：Desktop MCP 管理体验补齐

目标：把 Desktop MCP 页面从“多候选可见”推进到“可实际管理多个 MCP preset”。

改动范围：

- 安装 scope 选择。
- 候选详情视图。
- 已安装记录的 drift / missing-config / needs-repair 展示。
- reinstall / repair / uninstall 操作入口。
- 空搜索、无结果、安装失败、卸载失败状态。
- 长来源 URL / 长 package name 的移动端和窄窗口布局。

验收：

- Playwright、Context7、remote preset 都能在候选列表和详情中显示正确。
- 用户能从 Desktop 发起 install、repair、uninstall。
- `typecheck:desktop` 和 `desktop:build` 通过。
- 补一个 Desktop 状态或纯函数 smoke，固定候选排序、标签和状态映射。

边界：

- Desktop 不复制 installManager 的风险判断，只展示 plan / status 结果。
- 不把说明性文案铺满页面，保持操作界面密集但可扫描。

### Goal D-6：MCP 文档 closeout

目标：把当前 C 系列滚动文档整理成清晰的 MCP 模块化权威入口，避免后续接续时误读“C-1 设计”。

改动范围：

- 新增或重命名为 `docs/mcp/modularization-roadmap.md`。
- `README.md` 指向新的权威入口。
- `modularization-goal-c1.md` 加 redirect note 或保留为历史章节。
- 更新 `integration-standard.md`，说明新增 preset/provider 的最小步骤。
- 更新 `verification-runbook.md`，加入 CLI install smoke、Desktop build、remote preset 验证。

验收：

- 文档按“当前状态 / 已完成 / 下一轮 D 系列 / 验证命令 / 新增 preset 流程”组织。
- 搜 `Goal C-1 设计` 不再作为唯一入口误导后续实现。
- 文档不出现旧的单 Playwright 口径。

边界：

- 不在文档 closeout 里改代码行为。
- 不把未完成 D 系列写成已完成。

### Goal D-7：MCP 变更提交与发布前收口

目标：在 D 系列关键实现完成后做一次提交前 closeout，确认源码、dist、docs、smoke 和 CHANGELOG 的提交范围。

改动范围：

- `git status` 变更盘点。
- 确认 dist 是否按项目规则提交。
- 跑完整 MCP 相关 smoke。
- 更新 CHANGELOG。
- commit / push。

验收：

- 工作区只包含本轮预期变更。
- 必要验证通过：
  - `npm.cmd run typecheck`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run build`
  - `npm.cmd run desktop:build`
  - MCP 相关 smoke
  - `smoke:app-server-client`
- commit message 清楚说明 MCP modularization / installer / Desktop / CLI 范围。

边界：

- 不混入无关 UI / ThreadDisplay / model runtime 改动。
- 不在验证失败时强行提交。

## 后续推荐推进顺序

```text
D-1 -> D-2 -> D-4 -> D-3 -> D-5 -> D-6 -> D-7
```

推荐先做 D-1，因为它直接减少 `client.ts` 中 remote transport 的耦合；D-2 紧随其后，用真实 remote preset 验证 D-1 没有只服务本地 stdio。D-4 放在 D-5 前面，是为了让 Desktop 管理体验有可靠的 status / repair 状态源。
