# MCP 模块化路线图

本文是 MCP 模块化的当前权威路线文档。它只记录当前状态、已完成阶段、下一轮可执行 goal、验证命令和边界，不替代具体实现文档。

历史背景详见 [`modularization-goal-c1.md`](./modularization-goal-c1.md)。新增 MCP preset/provider 的通用规范详见 [`integration-standard.md`](./integration-standard.md)。

## 当前状态

MCP 模块化已经完成第一轮 C 系列收口：

- 安装候选已从单文件定义改为 preset registry。
- 内置 preset 已有 Playwright 和 Context7。
- Playwright / Context7 的 provider 实现已从通用 installer 中隔离。
- `installManager` 仍是安装计划、确认、写配置、记录安装和卸载的唯一业务入口。
- Desktop MCP 页面已能展示多个安装候选，并显示状态、来源、transport、数据边界和权限标签。
- CLI 已有 `ccr mcp search/install/status/uninstall/repair`，默认 dry-run，显式 `--yes` 后才写配置或卸载。
- `client.ts` 已抽出若干低风险模块：`toolSafety`、`resultProcessing`、`urlElicitation`、`toolRuntime`、`discoveryAdapters`、`transportFactory`。

当前最大剩余问题：

- `client.ts` 仍承载 remote transport 选项组装、连接生命周期、startup timeout、stderr、onerror/onclose、reconnect 和 discovery 请求编排。
- 真实 remote-url preset 还未接入，当前 preset 仍以 stdio npm package 为主。
- installer 还不能明确标记安装记录与当前配置是否漂移。
- Desktop 管理体验已有多候选列表，但 scope、repair、reinstall、drift 状态和候选详情还不完整。
- 文档入口仍有历史滚动文档，后续需要 closeout。

## 已完成 C 系列

```text
C-1  安装 preset registry 第一版
C-2  registry 不变式与搜索补强
C-3  toolSafety
C-4  Playwright provider 归位
C-5  resultProcessing
C-6  urlElicitation
C-7  toolRuntime
C-8  discoveryAdapters
C-9  transportFactory 第一刀
C-10 Context7 第二 preset
C-11 Desktop 多 preset 候选展示
C-12 CLI install / uninstall / status / repair
```

## 后续推荐顺序

```text
D-1 -> D-2 -> D-4 -> D-3 -> D-5 -> D-6 -> D-7
```

推荐先做 D-1，因为它直接减少 `client.ts` 中 remote transport 的耦合；D-2 紧随其后，用真实 remote preset 验证 D-1 没有只服务本地 stdio。D-4 放在 D-5 前面，是为了让 Desktop 管理体验有可靠的 status / repair 状态源。

## Goal D-1：深化 remote transport / connection factory

目标：继续从 `client.ts` 抽出 HTTP / SSE / claude.ai proxy 的连接前配置组装，让 `client.ts` 只保留连接生命周期和错误状态机。

改动范围：

- SSE transport options 组装。
- HTTP streamable transport options 组装。
- claude.ai proxy transport options 组装。
- headers / proxy / OAuth provider / step-up detection / timeout fetch 组合。
- 只迁移“选项构造”，暂不迁移 `client.connect(...)`、startup timeout、stderr、onerror/onclose 和 reconnect。

关键输入输出：

- 输入：server name、server config、session ingress token、OAuth provider、proxy / mTLS 环境。
- 输出：可传给 `SSEClientTransport` / `StreamableHTTPClientTransport` 的 options，以及日志安全摘要。

不变式：

- 不调整 MCP config schema。
- 不改变 auth required、OAuth token、session ingress token、proxy、mTLS、step-up detection 行为。
- 不引入静默 fallback。
- 不改 Desktop / CLI。

验收：

- `client.ts` 中 `new SSEClientTransport(...)` / `new StreamableHTTPClientTransport(...)` 调用减少到使用 helper 的结果。
- 新增 `smoke:mcp-remote-transport-options` 或等价 smoke，覆盖 headers 合并、proxy option、session token/OAuth 优先级。
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:app-server-client`

执行结果（2026-06-01）：

- 新增 `src/services/mcp/remoteTransportOptions.ts`，承载 `buildSseClientTransportOptions`、`buildSseIdeClientTransportOptions`、`buildHttpClientTransportOptions`、`buildClaudeAiProxyTransportOptions`、`wrapFetchWithTimeout` 和 claude.ai proxy fetch 401 retry。
- `client.ts` 的 SSE / HTTP / claude.ai proxy 分支改为消费 helper 结果，连接生命周期、auth failure 分类、startup timeout、stderr、onerror/onclose 和 reconnect 仍留在 `client.ts`。
- 新增 `smoke:mcp-remote-transport-options`，覆盖 HTTP session ingress 与 OAuth 优先级、SSE event source header 覆盖顺序、Authorization 日志脱敏和 Streamable HTTP Accept 注入。
- 已验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:mcp-remote-transport-options`、`npm.cmd run smoke:app-server-client`。

## Goal D-2：补真实 remote MCP preset

目标：新增一个真实 remote-url MCP preset，验证 registry / installManager / Desktop / CLI 不只适配 stdio npm package。

候选优先级：

1. Sentry remote MCP：优先验证 HTTP remote preset、OAuth / headers 边界。
2. 其他低权限 HTTP/SSE MCP：如果 Sentry 凭据或官方入口不稳定，则选择更低风险候选。

改动范围：

- 新增 `presets/<remote>.ts` 或 `providers/<remote>/install.ts`。
- manifest 使用 `source.kind = 'remote-url'`。
- 明确 `transport`、权限、数据边界和 homepage。
- Desktop 候选卡正确显示远端来源、transport、权限和数据边界。
- CLI `mcp search/install/status/uninstall` 能处理 remote preset。

关键输入输出：

- 输入：remote MCP 官方 URL、认证方式、权限和数据边界。
- 输出：remote preset manifest、server config preview、安装计划和卸载记录。

不变式：

- 不在 preset 里硬编码用户密钥。
- 如果 remote preset 需要用户 OAuth，不在本 goal 完整实现 OAuth wizard，只描述当前边界并保持 install plan 明确。
- 不影响 Playwright / Context7。

验收：

- 搜索能找到第三个候选。
- plan 能生成 remote server config preview。
- dry-run 和 `--yes` install/uninstall smoke 使用临时 `CCR_CONFIG_DIR` 覆盖。
- 文档写清楚凭据、远端数据边界和是否需要 OAuth/header。

执行结果（2026-06-01）：

- 新增 Sentry hosted remote MCP preset：`src/services/mcp/providers/sentry/install.ts` 固化 `https://mcp.sentry.dev/mcp`，`src/services/mcp/presets/sentry.ts` 使用 `source.kind = 'remote-url'`、`transport = 'http'`。
- 认证边界：preset 不保存用户 token、不要求静态 header；首次连接由 Sentry hosted MCP / MCP SDK auth provider 触发 OAuth。stdio/self-hosted token 模式不属于本 goal。
- 数据边界：`dataBoundary = 'remote-service'`，权限声明包含 `network` 和 `oauth`；安装计划会显式提示远端服务数据边界。
- CLI / registry 已能搜索、dry-run plan、`--yes` install 和 uninstall `sentry`，使用临时 `CCR_CONFIG_DIR` 验证，不污染用户配置。
- 已验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:mcp-install-presets`、`npm.cmd run smoke:mcp-cli-install`、`npm.cmd run smoke:app-server-client`。

## Goal D-3：拆 discovery service

目标：把 tools / resources / prompts 的 SDK 请求、错误处理和 CCR wrapper 创建从 `client.ts` 继续拆出，`discoveryAdapters.ts` 只保留纯转换。

改动范围：

- list tools / resources / prompts 请求编排。
- `MCPTool`、`ReadMcpResourceTool`、`ListMcpResourcesTool` 创建。
- tool name normalize / build / search hint / prompt text 组合。
- discovery 错误日志和单 server 局部失败处理。

关键输入输出：

- 输入：已连接 MCP server、server config、连接缓存、命名策略。
- 输出：CCR tools、commands、resources、prompts 和局部诊断。

不变式：

- 不改 `MCPTool` 运行时调用语义。
- 不改权限判断。
- 不改变工具名对外格式。
- 不把 discovery 失败静默吞掉。

验收：

- `getMcpToolsCommandsAndResources(...)` 主体明显变薄，调用新的 `discoverMcpServerCapabilities(...)` 或同等入口。
- discovery service 有独立 smoke，覆盖工具、资源、prompt、skip-prefix、重复名称和局部失败。
- 现有 `smoke:mcp-discovery-adapters` 保留。
- `smoke:app-server-client` 通过。

执行结果（2026-06-01）：

- 新增 `src/services/mcp/discoveryService.ts`，承载 `tools/list`、`resources/list`、`prompts/list` 的 SDK 请求、错误日志、prompt command 获取和默认资源工具补齐。
- `discoveryAdapters.ts` 继续保持纯转换：工具搜索提示、prompt 文案、resource server 字段和 prompt command shape 不包含 SDK 请求。
- `client.ts` 的 `fetchToolsForClient` 改为消费 `listMcpToolDefinitionsForClient(...)`；`fetchResourcesForClient` / `fetchCommandsForClient` 改为委托 discovery service，并继续保留 cache key 与旧导出名兼容。
- 本轮刻意不迁移 MCPTool `call(...)` 闭包；权限、URL elicitation、session retry、进度事件和 Claude-in-Chrome / Computer Use override 仍留在 `client.ts`，避免改变工具运行时语义。
- 新增 `smoke:mcp-discovery-service`，覆盖 tools/resources/prompts SDK 请求、prompt command 执行和默认资源工具补齐；已验证 `npm.cmd run build`、`npm.cmd run smoke:mcp-discovery-service`、`npm.cmd run smoke:mcp-discovery-adapters`、`npm.cmd run smoke:app-server-client`。

## Goal D-4：安装安全与配置漂移校验

目标：让 MCP installer 能明确识别“安装记录”和“当前配置”是否一致，提升 repair/status 的可信度。

改动范围：

- install record 与当前 `McpServerConfig` 的签名对比。
- CLI / Desktop status 显示 installed / configured / drifted / missing-config。
- repair 对 drifted / missing-config 的语义明确。
- secret/env/header 风险摘要统一。
- unpinned version、checksum missing、remote boundary 风险文案复核。

关键输入输出：

- 输入：`installed.json`、当前 MCP config、manifest、server config signature。
- 输出：installed / configured / drifted / missing-config / needs-repair 状态。

不变式：

- 不自动覆盖用户手动改动，除非用户显式确认。
- 不把旧配置作为静默 fallback。
- status 只报告事实，不替用户修复。

验收：

- 新增 drift smoke：安装 Context7 后手动改配置，再 status 能显示 drifted。
- repair dry-run 能说明会写回哪份 config。
- `smoke:mcp-cli-install` 扩展覆盖 status drift / repair。
- Desktop 候选或已安装列表能展示需修复状态。

执行结果（2026-06-01）：

- `installManager` 的安装记录摘要新增 `configStatus`，通过安装记录中的期望 `serverConfig` 与当前活动 MCP config 的签名对比，输出 `configured`、`drifted` 或 `missing-config`。
- `listCcrMcpInstalledServers()` 新增 `statusSummary`，CLI/App Server/Desktop 共享同一个安装状态事实，不再由 UI 猜测配置是否一致。
- Desktop MCP 页面在标题、详情和已安装列表展示“配置一致 / 配置漂移 / 配置缺失”，缺失或漂移只报告事实，不自动覆盖用户配置。
- smoke 覆盖 `sentry` remote preset 的 install -> remove config -> `missing-config` -> repair -> `configured`，以及 App Server install list 的 `configStatus` / `statusSummary`。
- 已验证：`npm.cmd run typecheck`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run smoke:mcp-cli-install`、`npm.cmd run smoke:app-server-client`、`npm.cmd run desktop:build`。

## Goal D-5：Desktop MCP 管理体验补齐

目标：把 Desktop MCP 页面从“多候选可见”推进到“可实际管理多个 MCP preset”。

改动范围：

- 安装 scope 选择。
- 候选详情视图。
- 已安装记录的 drift / missing-config / needs-repair 展示。
- reinstall / repair / uninstall 操作入口。
- 空搜索、无结果、安装失败、卸载失败状态。
- 长来源 URL / 长 package name 的移动端和窄窗口布局。

关键输入输出：

- 输入：install search、install plan、installed status、server inventory。
- 输出：候选详情、安装计划确认、repair/uninstall 操作和状态反馈。

不变式：

- Desktop 不复制 installManager 的风险判断，只展示 plan / status 结果。
- 不把说明性文案铺满页面，保持操作界面密集但可扫描。
- 不把未确认的 repair/install 自动写入配置。

验收：

- Playwright、Context7、remote preset 都能在候选列表和详情中显示正确。
- 用户能从 Desktop 发起 install、repair、uninstall。
- `typecheck:desktop`
- `desktop:build`
- 补一个 Desktop 状态或纯函数 smoke，固定候选排序、标签和状态映射。

执行结果（2026-06-01）：

- Desktop MCP 安装区新增安装范围选择，候选 install plan 会按用户选择写入 `user` / `project` / `local` scope。
- 已安装列表新增需修复入口：当 `configStatus.needsRepair` 为 true 时展示“修复”按钮；点击后弹出确认，再调用 App Server repair。
- App Server / Desktop preload / Desktop main 新增 `mcp/install/repair` / `repairMcp` 链路，repair 复用内置 preset、显式确认后以 `force` 方式恢复配置，不支持非内置 preset 的静默猜测。
- Desktop 已安装记录继续展示配置一致、配置漂移、配置缺失；修复后会刷新安装记录和 MCP snapshot。
- 已验证：`npm.cmd run typecheck`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run smoke:app-server-client`、`npm.cmd run desktop:build`。

## Goal D-6：MCP 文档 closeout

目标：把当前 C 系列滚动文档整理成清晰的 MCP 模块化权威入口，避免后续接续时误读“C-1 设计”。

改动范围：

- `README.md` 指向本路线图作为当前权威入口。
- `modularization-goal-c1.md` 加 redirect note 或保留为历史章节。
- 更新 `integration-standard.md`，说明新增 preset/provider 的最小步骤。
- 更新 `verification-runbook.md`，加入 CLI install smoke、Desktop build、remote preset 验证。

关键输入输出：

- 输入：当前代码状态、C 系列结果、D 系列 roadmap、验证命令。
- 输出：清晰文档入口、历史文档定位、后续实现阅读顺序。

不变式：

- 不在文档 closeout 里改代码行为。
- 不把未完成 D 系列写成已完成。
- 不继续保留“只有 Playwright”的旧口径。

验收：

- 文档按“当前状态 / 已完成 / 下一轮 D 系列 / 验证命令 / 新增 preset 流程”组织。
- 搜 `Goal C-1 设计` 不再作为唯一入口误导后续实现。
- 文档不出现旧的单 Playwright 口径。

执行结果（2026-06-01）：

- `docs/mcp/README.md` 新增“当前权威状态”，明确本路线图是 MCP 模块化权威入口，C-1 文档只保留历史滚动记录。
- README 当前状态更新为 Playwright、Context7、Sentry remote 三个内置候选，并记录 Desktop 支持 scope 选择、配置修复和 installer-owned 卸载。
- `integration-standard.md` 更新新增 preset/provider 的标准步骤，明确 remote-url manifest、权限、数据边界、registry 接入和 smoke 要求。
- `verification-runbook.md` 新增 installer / Desktop 回归命令组，覆盖 preset registry、CLI install、discovery service、remote transport options、App Server 和 Desktop build。
- 本 goal 只改文档，不改运行逻辑；验证沿用 D-5 已通过的 `typecheck`、`typecheck:desktop`、`build`、`smoke:app-server-client`、`desktop:build`。

## Goal D-7：MCP 变更提交与发布前收口

目标：在 D 系列关键实现完成后做一次提交前 closeout，确认源码、dist、docs、smoke 和 CHANGELOG 的提交范围。

改动范围：

- `git status` 变更盘点。
- 确认 dist 是否按项目规则提交。
- 跑完整 MCP 相关 smoke。
- 更新 CHANGELOG。
- commit / push。

关键输入输出：

- 输入：当前工作区、验证命令结果、CHANGELOG、发布或提交目标。
- 输出：干净提交、明确 commit message、远端分支同步。

不变式：

- 不混入无关 UI / ThreadDisplay / model runtime 改动。
- 不在验证失败时强行提交。
- 不丢弃用户未确认的工作区变更。

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

执行结果（2026-06-01）：

- 已盘点工作区：变更集中在 MCP 模块化源码、Desktop MCP 管理、App Server repair API、CLI installer、smoke、docs、CHANGELOG 和对应 dist 产物。
- 已验证：`git diff --check`、`smoke:mcp-install-presets`、`smoke:mcp-cli-install`、`smoke:mcp-discovery-service`、`smoke:mcp-remote-transport-options`、`smoke:mcp-discovery-adapters`、`smoke:mcp-result-processing`、`smoke:mcp-tool-runtime`、`smoke:mcp-tool-safety`、`smoke:mcp-transport-factory`、`smoke:mcp-url-elicitation`、`smoke:mcp-playwright-provider`、`smoke:mcp-context7-provider`、`smoke:app-server-client`。
- 提交范围包含 D-1 到 D-6 的执行结果，准备以 MCP 模块化 closeout 提交。

## 每轮执行规则

- 每个 D 系列 goal 都必须单独启动 goal、单独验证、单独记录执行结果。
- 改 `src` 后，如果 smoke 运行的是 `dist`，必须先 `npm.cmd run build`。
- 涉及 Desktop UI 时至少跑 `typecheck:desktop`；如果布局或 bundle 相关，跑 `desktop:build`。
- 涉及 CLI install/apply/uninstall 时使用临时 `CCR_CONFIG_DIR`，不能污染用户真实配置。
- 涉及 remote MCP 时先确认官方入口和认证方式，不凭印象写 URL 或权限边界。
