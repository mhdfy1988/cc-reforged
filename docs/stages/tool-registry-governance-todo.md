# CCR 工具注册治理分期推进计划

状态：第 5 期第三轮已完成（T21-T27 MCP 管理面收口，下一步 `0.6.0` Skill / Plugin 扩展包治理）

更新时间：2026-05-21

本文是 `CcrToolRegistry` / 工具注册治理的阶段推进计划。它不替代 [工具能力治理修复清单](./tool-capability-repair-list.md)，而是把其中“工具能力注册表、ToolSearch、Desktop 工具展示、MCP / Skill / Plugin 接入”拆成可逐步落地的几期。

## 当前任务列表（实时）

- [x] T0：新增工具池检查脚本，固定第 0 期验收基线。
- [x] T1：新增只读 `CcrToolRegistry` 类型定义和构建函数。
- [x] T2：从现有 `getAllBaseTools()` 生成 registry entries，并补核心工具最小 metadata。
- [x] T3：增加 smoke 验证，证明 registry 不改变 `Tool[]` 输出。
- [x] T4：同步文档，标明第一批字段已经进入 registry。
- [x] T5：新增 `CcrToolAvailability`，集中判断工具是否真实可用。
- [x] T6：App Server 平台过滤改为基于 availability 查询。
- [x] T7：smoke / inspect 输出不可用工具原因。
- [x] T8：新增 `CcrToolSearchPolicy`，集中生成 ToolSearch 可搜索候选。
- [x] T9：`ToolSearchTool` 改为只返回 available 且 deferred 的候选工具。
- [x] T10：smoke 直接调用 `ToolSearchTool.call()`，验证 direct / internal 工具不会被搜出。
- [x] T11：Desktop 工具卡详情区接入 `detailKeys`，命中时优先展示“关键参数”。
- [x] T12：Desktop 主时间线隐藏逻辑接入 `showInMainTimeline`，并保留失败工具卡可见。
- [x] T13：补 `smoke:desktop-display-events`，覆盖 `detailKeys` 详情裁剪、内部工具隐藏和失败卡片保留。
- [x] T14：新增 `resolveLlmProviderCapabilityTools()`，把 `GenerateImage` 生图能力来源统一成 provider/model 快照。
- [x] T15：`GenerateImageTool` 的输入校验和实际调用改用同一份能力工具快照。
- [x] T16：App Server 配置快照、模型列表、模型可用性和 Desktop 模型页展示当前生图能力来源。
- [x] T17：补 smoke，覆盖 GLM / OpenAI / MiniMax 可用和 DeepSeek 不可用的生图能力工具判断。
- [x] T18：MCP 动态工具进入 registry，补服务名、工具名、来源、分类和默认 deferred 暴露策略。
- [x] T19：MCP 连接、认证、工具发现和调用失败状态进入 availability / inspect 输出。
- [x] T20：ToolSearch 和 Desktop 工具展示能消费 MCP 来源、健康状态、中文名 fallback 和失败原因。
- [x] T21：MCP 配置与安装位置基线，固定 user / project / enterprise / plugin / dynamic 等来源、优先级和写入规则。
- [x] T22：MCP 安装包模型，区分手动配置、远程 URL、stdio npm 包、本地目录、内置 preset 和 plugin-provided MCP。
- [x] T23：新增 MCP 管理 Core / App Server API，支持 list / inspect / add / update / remove / enable / disable / restart / test。
- [x] T24：新增 MCP install 工具或命令入口，支持受控下载安装、版本锁定、来源校验、权限确认和失败回滚。
- [x] T25：Desktop 新增 MCP 管理页，展示安装来源、运行状态、工具列表、认证状态、启用/禁用、安装/卸载和诊断入口。
- [x] T26：MCP 安装安全与数据边界，覆盖下载目录、缓存、lockfile、env/secret 脱敏、OAuth 凭据、企业策略和项目级信任。
- [x] T27：补 smoke / inspect，覆盖 MCP 配置合并、启停状态、安装清单、卸载残留、Desktop 管理页数据契约。

## 当前指针

已完成：第 5 期第一轮 Provider 生图能力工具化；第 5 期第二轮 MCP 运行时动态工具治理；第 5 期第三轮 T21 MCP 配置与安装位置基线；T22 MCP 安装包模型；T23 MCP 管理 Core / App Server API；T24 MCP install 受控入口；T25 Desktop MCP 管理页；T26 MCP 安装安全与数据边界；T27 smoke / inspect 契约验证。

当前正在做：第 5 期第三轮收口完成。

完成后下一项：进入 `0.6.0` Skill / Plugin 扩展包治理。

## 后续执行安排（2026-05-21）

按当前完成度，`0.5.x` 还不能直接跳到 Skill / Plugin。MCP 要先拆成两层收敛：第一层是运行时动态工具面，第二层是安装、配置和管理面。

```text
0.5.x 已完成：MCP 运行时动态工具治理
  -> 把现有 MCP runtime 接进 registry / availability / ToolSearch / Desktop 展示

0.5.x 已完成：MCP 安装与管理面治理
  -> 固定安装位置、配置来源、启停卸载、安装工具、Desktop 管理页和安全边界

0.6.0 主线：Skill / Plugin 扩展包治理
  -> 在 MCP 管理面基线之上处理 Skill / Plugin 的安装、启用、命名空间、版本和审计

0.7+ 后续：独立能力工具管理模块
  -> 显式组合主推理、视觉理解、生图、生视频、文件理解、语音等跨 provider 能力
```

### 借鉴落点总表

这次后续计划不是凭空拆任务，而是把 Codex 和 OpenClaw 的工具系统做法压成 CCR 的开发依据。

| 借鉴点 | 来源 | CCR 落点 | 对应任务 |
| --- | --- | --- | --- |
| 工具不是 prompt，而是结构化注册能力 | Codex / OpenClaw | 所有工具先进入 `CcrToolRegistryEntry`，再决定是否给模型、是否可调用、如何展示。 | T18、0.6 Skill / Plugin |
| 模型可见工具和运行时可执行工具分离 | Codex | registry 保存可执行工具；`direct / deferred / internal` 决定模型初始可见性。 | T18、T20 |
| MCP 工具转成普通工具 executor / registry entry | Codex | 复用 `src/services/mcp/client.ts`，只补 MCP -> registry adapter，不重写 transport。 | T18 |
| MCP 默认延迟发现，不把大量 schema 一次塞进上下文 | Codex | MCP 工具默认 `exposure = "deferred"`，通过 `ToolSearch` 发现。 | T18、T20 |
| ToolSearch 作为大工具集发现入口 | Codex / OpenClaw | MCP、Skill、Plugin 后续都复用同一个 `ToolSearch` 候选策略。 | T20、0.6 Skill / Plugin |
| MCP 是工具目录的一种来源，不是孤立功能 | OpenClaw | `source.kind = "mcp"`，和 provider / skill / plugin 共用 registry、availability、display。 | T18、T19、T20 |
| 工具状态必须可解释 | Codex runtime + OpenClaw 产品层 | 统一 `mcp_not_connected`、`mcp_needs_auth`、`mcp_connection_failed`、`mcp_disabled`、`mcp_discovery_failed`。 | T19 |
| UI 不猜裸工具名 | OpenClaw | Desktop / App Server 消费同一份 display metadata，展示服务名、中文名、状态和失败原因。 | T20 |
| 安装请求必须可确认、可拒绝、可追踪 | Codex plugin install / OpenClaw plugin governance | MCP 自下载安装不能静默落盘，必须走用户确认、来源记录、版本锁定和失败回滚。 | T24、T26 |
| 工具来源需要管理面 | OpenClaw 产品工具目录 | Desktop 必须能看到 MCP 来源、配置 scope、启用状态、认证状态、工具清单和诊断。 | T23、T25 |
| 插件和扩展工具默认不直接暴露 | OpenClaw | Skill / Plugin 默认 deferred，未启用或未安装只进诊断，不进可调用候选池。 | 0.6 Skill / Plugin |
| 能力工具要声明数据边界和来源 | OpenClaw 产品工具 + Codex hosted tool | 独立能力工具管理模块后置到 `0.7+`，先复用 registry / availability 基线。 | 0.7+ |

对应到代码层，当前采用的借鉴关系是：

```text
Codex 值得学：工具运行时内核
  ToolDefinition / ToolExecutor / ToolRegistry / Direct vs Deferred / tool_search

OpenClaw 值得学：产品级工具目录
  catalog / profile / allow-deny / source / health / display metadata / plugin governance

CCR 当前先落：MCP 作为第一种动态工具来源
  MCP runtime -> CcrToolRegistry -> CcrToolAvailability -> ToolSearch -> Desktop/App Server display
```

### A. `0.5.x` 已完成：MCP 运行时动态工具治理

目标：不重写 MCP client，不改变 MCP 调用协议，只把 MCP 动态工具纳入统一工具治理。

执行顺序：

1. **MCP 现状基线**
   - 盘点 `src/services/mcp/client.ts`、`src/services/mcp/config.ts`、`src/services/mcp/types.ts`、`src/tools.ts#assembleToolPool()` 当前输出。
   - 固定一个无真实外部依赖的 MCP 动态工具样例，用于 registry / availability / ToolSearch smoke。
   - 验证当前 MCP 工具名称、`mcpInfo.serverName/toolName`、`alwaysLoad`、`shouldDefer` 的真实形态。

2. **T18：MCP 动态工具进入 registry**
   - 将 `mcp__<server>__<tool>` 工具映射成 `CcrToolRegistryEntry`。
   - 补 `source.kind = "mcp"`、`serverName`、`toolName`、`category = "mcp"`。
   - 默认 `exposure = "deferred"`；MCP 资源工具和认证工具继续按 `internal/control` 处理。
   - smoke 验证：MCP 样例进入 registry，但不改变原始 `Tool[]` 顺序和数量。

3. **T19：MCP 状态进入 availability**
   - 从 MCP 连接状态映射可用性：`connected`、`failed`、`needs-auth`、`disabled`、`pending`、`discovery-failed`。
   - 统一 reason code：`mcp_not_connected`、`mcp_needs_auth`、`mcp_connection_failed`、`mcp_disabled`、`mcp_discovery_failed`。
   - `inspect-app-server-tools` 输出 MCP server、工具名、状态和不可用原因。
   - smoke 验证：未连接 / 缺 server 信息的 MCP 工具不会被误判为可用。

4. **T20：ToolSearch / Desktop / App Server 消费 MCP metadata**
   - `ToolSearch` 只返回 `available=true` 且 `exposure=deferred` 的 MCP 工具。
   - 搜索结果带来源服务、展示名 fallback、分类和可用状态。
   - Desktop 工具卡展示“来源服务 + 工具中文名/兜底名 + 状态/失败原因”，不只展示裸 `mcp__...`。
   - App Server 后续工具 catalog / inspect 输出同一份 MCP metadata。

5. **验收与文档**
   - 更新 `docs/architecture/tool-registry-catalog.md` 的当前落地状态。
   - 更新 `docs/references/codex-openclaw-tool-system-source-evidence.md` 中 CCR 落点是否已实现。
   - 至少跑：`npm.cmd run typecheck`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:desktop-display-events`。
   - 如触及 App Server 输出，再补：`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`。

`0.5.x` MCP 收尾完成标准：

- MCP 动态工具能在 registry 中被查询。
- MCP 工具可用性不再只有“有/无”，而是能解释连接、认证、禁用和发现失败。
- ToolSearch 不会搜出不可用 MCP 工具。
- Desktop / App Server 不再只能展示裸 `mcp__server__tool`。
- 底层 MCP client、transport、认证和调用协议保持复用，不新增第二套 MCP 执行链。

这一段只解决“已经存在的 MCP server 连接后，工具如何进入模型工具面和 UI 展示”。它没有解决 MCP server 从哪里来、装在哪里、谁来安装、如何启停、如何卸载、界面怎么管理。

### A2. `0.5.x` 已完成：MCP 安装与管理面治理

历史目标：把 MCP 从“能连接的运行时工具”推进到“用户可管理的扩展能力”。这一段已经通过 T21-T27 收口，当前保留为第 5 期第三轮的设计依据、落地记录和验收边界。

启动前源码基线：

- 用户级 MCP 配置入口：`src/services/mcp/config.ts#getUserMcpFilePath()`，当前落点是 `CCR_CONFIG_DIR/mcp.json`，默认 `~/.ccr/mcp.json`。
- 项目级 MCP 配置入口：当前工作目录 `.mcp.json`。
- 企业托管 MCP 配置入口：`managed-mcp.json`。
- 当前配置 scope 已有：`local`、`user`、`project`、`dynamic`、`enterprise`、`claudeai`、`managed`。
- 当前 server config 已有形态：`stdio`、`sse`、`http`、`ws`、`sdk`、`claudeai-proxy`。
- 启动前已存在启停函数：`setMcpServerEnabled(name, enabled)`；统一管理 API 和 Desktop 管理页已在 T23 / T25 / T27 落地。

安装位置第一版口径：

```text
配置文件：
  用户级：${CCR_CONFIG_DIR:-~/.ccr}/mcp.json
  项目级：<workspace>/.mcp.json
  企业级：managed-mcp.json

自动下载安装包：
  ${CCR_CONFIG_DIR:-~/.ccr}/mcp/packages/<package-name>/<version>/

安装清单和锁定：
  ${CCR_CONFIG_DIR:-~/.ccr}/mcp/installed.json
  ${CCR_CONFIG_DIR:-~/.ccr}/mcp/lock.json

运行日志和诊断：
  ${CCR_CONFIG_DIR:-~/.ccr}/logs/mcp/<server-name>.log
```

第一版安装策略：

1. **手动配置先保留。**
   - 用户或项目可以继续写 `mcp.json` / `.mcp.json`。
   - 手动配置优先级高于插件自动注入和推荐安装。

2. **Agent 自下载安装必须显式确认。**
   - 模型不能静默下载、安装或改写 MCP 配置。
   - 安装前要展示来源、包名、版本、命令、写入位置、权限风险和数据边界。
   - 安装失败要能回滚配置和临时目录。

3. **需要 MCP install 工具，但它不是普通业务工具。**
   - 形态可以是 CLI 命令、App Server API 和模型可调用管理工具的组合。
   - 模型侧工具名建议后续设计为 `McpInstall` / `McpManage`，默认 `internal/control`，必须经用户确认才能执行写入。
   - 第一版先支持：`install`、`uninstall`、`enable`、`disable`、`list`、`inspect`、`test`。

4. **Desktop 必须有 MCP 管理页。**
   - 至少展示：名称、scope、来源、transport、安装位置、启用状态、连接状态、认证状态、工具数量、失败原因。
   - 操作入口：启用、禁用、测试连接、认证、查看工具、查看日志、安装、卸载。
   - 企业 / managed / plugin-provided 来源不可随意卸载，只能显示来源和策略原因。

5. **安全边界单独验收。**
   - env、headers、OAuth token、client secret 必须脱敏。
   - project `.mcp.json` 需要信任提示，不能自动执行陌生 stdio 命令。
   - 自动下载只允许白名单来源或用户确认的明确 URL / package。
   - uninstall 只能删除安装清单拥有的目录，不能删除用户手写路径。

模型主动发现“缺某个能力，需要安装某个 MCP”的实现机制：

```text
用户意图 / 模型计划
-> 查询 CcrToolRegistry + CcrToolAvailability 当前可用能力
-> 命中能力缺口，例如“需要浏览器自动化，但没有可用浏览器 MCP”
-> 调用 MCP 搜索入口，只查可信 MCP catalog / 本地 preset / 已配置但不可用 server
-> 生成 McpInstallPlan，只描述候选、来源、版本、写入位置、权限和风险，不执行安装
-> 用户确认
-> McpManage.install 执行下载、写配置、锁版本、测试连接和工具发现
-> 新 MCP server 进入 registry / availability / ToolSearch / Desktop 管理页
```

第一版需要把这条链拆成四个受控入口：

| 入口 | 类型 | 做什么 | 不允许做什么 |
| --- | --- | --- | --- |
| `McpCapabilityResolver` | Core service | 根据用户意图、工具分类、别名和 availability 判断缺少哪类能力。 | 不访问网络，不写配置。 |
| `McpSearch` | 内部 / deferred 工具 | 搜索可信 MCP catalog、本地 preset、已配置但不可用的 MCP server。 | 不直接安装，不把未知来源默认标成可信。 |
| `McpInstallPlan` | 控制型工具 / API | 生成安装计划，列出包名、版本、transport、命令、写入位置、权限、数据边界、回滚方案。 | 不下载，不写入，不启动 stdio server。 |
| `McpManage` | 控制型工具 / API | 在用户确认后执行 install / uninstall / enable / disable / restart / test。 | 不能绕过确认，不能删除非安装清单归属目录。 |

不变式：

- 模型只能提出“需要某能力、建议安装某 MCP”和生成安装计划，不能静默下载或改配置。
- 真实写入由宿主执行，必须经过用户确认、权限策略和审计记录。
- 安装后的 MCP 必须重新进入 catalog、availability、ToolSearch 和 Desktop 管理页；不能只在当前会话临时可用。

执行顺序：

1. **T21：MCP 配置与安装位置基线**
   - 固定 user / project / enterprise / plugin / dynamic 来源合并顺序。
   - 输出 inspect：server name、scope、transport、config path、disabled/enabled、duplicate/suppressed。
   - 文档明确哪些文件可写，哪些只读。
   - 已落地：`src/services/mcp/configInventory.ts` 输出 MCP source inventory、安装目录、lockfile、日志目录和 server active/suppressed 状态；`inspect:app-server-tools` 已包含 `mcpConfigInventory`。

2. **T22：MCP 安装包模型**
   - 新增 `CcrMcpInstallManifest` 设计：name、source、version、transport、entry command、env schema、permissions、homepage、checksum。
   - 区分“远程 URL 配置”和“本地 stdio 包安装”。
   - 已落地：`src/services/mcp/installManifest.ts` 提供 `CcrMcpInstallManifestSchema`、六种 source kind、权限/env/checksum/dataBoundary 字段和现有 config 的 install kind 推断；smoke 覆盖 manifest 解析与推断。

3. **T23：MCP 管理 Core / App Server API**
   - `mcp/list`、`mcp/inspect`、`mcp/add`、`mcp/update`、`mcp/remove`、`mcp/enable`、`mcp/disable`、`mcp/restart`、`mcp/test`。
   - API 返回统一状态，供 CLI、Desktop、后续 VS Code 复用。
   - 已落地：Core 暴露 `list/inspect/add/update/remove/enable/disable/restart/test`，App Server JSON-RPC 暴露同名 `mcp/*` 方法，SDK 客户端补齐对应方法；`mcp/update` 已落到配置层原子更新，不再通过“先删后加”模拟。
   - 验证：`smoke:app-server` 和 `smoke:app-server-client` 使用临时 `CCR_CONFIG_DIR` 覆盖用户级 MCP 的 add / update / remove / enable / disable / restart / test，不触碰真实用户配置。

4. **T24：MCP install 工具 / 命令**
   - 先做受控命令或内部工具，不直接放进普通 ToolSearch 候选。
   - 拆出 `McpSearch`、`McpInstallPlan`、`McpManage` 三段：搜索候选、生成计划、确认后执行。
   - 安装前生成 plan，用户确认后才写文件和下载。
   - 安装后自动跑 `test` 和工具发现。
   - 已落地：`src/services/mcp/installManager.ts` 提供本地可信候选搜索、安装计划、确认 token、受控 apply、安装清单、锁文件和 installer-owned uninstall；App Server 暴露 `mcp/install/search`、`mcp/install/plan`、`mcp/install/apply`、`mcp/install/list`、`mcp/install/uninstall`，SDK 客户端同步补齐。
   - 第一版边界：暂不静默联网下载；stdio npm 来源先写受控 npx / 显式 serverConfig，并记录安装清单和 lockfile。真实包下载、checksum 强校验和目录删除保护继续放到 T26 安全边界收紧。

5. **T25：Desktop MCP 管理页**
   - 列表页 + 详情页 + 安装对话框。
   - 能查看每个 server 暴露的工具、资源、认证状态和最近失败原因。
   - 已落地：Desktop preload / main IPC 暴露 MCP inspect / enable / disable / restart / test / install search / plan / apply / list / uninstall；renderer 新增 MCP 管理页，展示 server 列表、配置来源、安装来源、启用状态、诊断结果、安装候选、安装计划、写入目标和 CCR installer-owned 卸载入口。
   - 第一版边界：工具 / 资源清单按运行时返回数据展示；当前 App Server `mcp/list` 仍以配置与 inventory 为主，完整运行时工具发现数据契约继续放到 T27 收紧。

6. **T26：安装安全与清理**
   - lockfile、checksum、目录归属、卸载残留、secret 脱敏、项目级信任提示。
   - 已落地：
     - `createCcrMcpInstallPlan()` 新增 `security` 摘要，明确 `scopeWritable`、`projectTrustRequired`、`enterpriseExclusive/pluginOnly`、`dataBoundary`、checksum 声明、版本 pin 和 secret 面信息。
     - `applyCcrMcpInstallPlan()` 强制 `assertInstallScopeWritable()`，企业只读或插件托管策略下直接拒绝写入。
     - npm 包缓存目录采用 installer-owned 标记文件 `~/.ccr/mcp/packages/**/.ccr-mcp-install.json`；卸载时先校验“目录在包缓存根内 + owner marker 匹配”再删除，防止误删非托管目录。
     - install record / lockfile 记录 `packageOwnerMarkerPath` 与 `dataBoundary`，便于审计和后续诊断。
     - server config 的 `env/headers/oauth` 继续走脱敏摘要，避免在安装计划和安装清单里回显凭据明文。

7. **T27：验证**
   - smoke 覆盖配置合并、enable/disable、install dry-run、uninstall dry-run、Desktop 数据契约。
   - 已落地：
     - `smoke:tool-registry` 覆盖项目级 `.mcp.json` 配置合并，验证更近目录配置覆盖父级配置。
     - `smoke:app-server` 覆盖 `mcp/install/plan` 的安全摘要契约。
     - `smoke:app-server-client` 覆盖 MCP 启停状态、安装计划、确认安装、安装清单、卸载、安装清单/lockfile 残留清理和包目录 owner marker 删除。
     - `smoke:desktop-display-events` 覆盖 Desktop MCP 管理页的数据合并、安装记录、被覆盖状态、工具 annotation、候选 key 和 manifest 展示契约。
     - `inspect:app-server-tools` 保留最终工具池、availability、provider 能力工具和 `mcpConfigInventory` 可观测输出。

`0.5.x` MCP 管理面完成标准：

- 用户知道 MCP 装在哪里，配置写在哪里。
- 系统能区分手动配置、自动安装、项目配置、企业配置、插件注入和动态来源。
- Agent 不能静默安装 MCP；安装、卸载、启停都必须可确认、可审计、可回滚。
- Desktop 有 MCP 管理入口，至少能查看、启用/禁用、认证、测试连接、查看工具和诊断。
- 不可用 MCP server 不仅不进 ToolSearch，还能在管理页说明原因。

### B. `0.6.0` 主线：Skill / Plugin 扩展包治理

启动条件：`0.5.x` MCP 运行时工具面和安装管理面都收口后再启动，避免 MCP、Skill、Plugin 三条动态工具来源同时改。

第一轮范围：

1. Skill / Plugin 清单模型
   - 安装目录。
   - 元数据。
   - 启用状态。
   - 版本。
   - 来源。

2. Skill / Plugin 工具进入 registry
   - `source.kind = "skill"` / `source.kind = "plugin"`。
   - 默认 `exposure = "deferred"`。
   - 未启用或未安装时进入诊断，不进入可调用候选池。

3. 命名空间和冲突治理
   - 插件工具名、Skill 名、MCP server 名不能互相覆盖。
   - 重名时优先给出可解释冲突原因，而不是静默覆盖。

4. Desktop 能力展示
   - 展示当前会话真实可用能力。
   - 展示能力来源、启用状态、失败原因。
   - 不在第一版做完整插件市场。

`0.6.0` 完成标准：

- Skill / Plugin 不再只是散落提示词、本地目录或脚本。
- 动态工具来源统一到 registry / availability / ToolSearch。
- 用户能看见“这个能力从哪里来、是否启用、为什么不可用”。

### C. `0.7+` 后续：独立能力工具管理模块

这一块现在只保留方向，不进入 `0.5.x` 或 `0.6.0` 主线。

目标形态：

```text
主推理模型：deepseek
视觉理解：glm-api / glm-4.6v
图片生成：openai / gpt-image-1
视频生成：后续 video provider
语音 / 文件理解：后续按 provider 能力接入
```

第一版需要独立设计：

- 能力工具管理页。
- 主模型和能力工具的数据边界。
- 跨 provider 调用是否允许、何时提示用户、如何审计。
- 每个能力工具的 provider/model、费用风险、隐私边界和失败兜底。

暂缓原因：

- 当前 `GenerateImage` 能力快照已经够支撑 0.5.x。
- MCP、Skill、Plugin 先收住后，能力工具管理模块才能复用同一套 registry 和 availability。
- 现在过早做页面，容易把工具治理和模型编排两件事混在一起。

## 1. 背景

CCR 当前已经有可运行的工具系统，但它不是一个集中式注册内核。

当前真实链路大致是：

```text
src/tools/<ToolName>/*
  -> 单个工具实现

src/tools.ts#getAllBaseTools()
  -> 内置工具清单

src/tools.ts#getTools()
  -> 按模式 / 权限 / isEnabled 过滤

src/tools.ts#assembleToolPool()
  -> 内置工具 + MCP 工具合并

src/utils/api.ts#toolToAPISchema()
  -> 转模型可见 schema

src/services/tools/toolExecution.ts#runToolUse()
  -> findToolByName 后执行 tool.call(...)
```

这套链路能跑，但“工具定义、可见性、provider 能力、平台差异、UI 展示、ToolSearch、MCP 状态”分散在不同位置。随着 `GenerateImage`、MCP、Skill、Plugin、更多 provider 能力工具进入，继续分散会带来几个问题：

- 模型不知道当前到底哪些工具真实可用。
- ToolSearch 可能搜到不该暴露的工具。
- Desktop 工具卡只能靠事件字段和工具名猜展示。
- 工具中文名、分类、内部工具隐藏、错误说明没有统一来源。
- 后续 MCP / Skill / Plugin 会让工具数量膨胀，必须有 direct / deferred / internal 分层。

## 2. 总目标

新增一层轻量 `CcrToolRegistry`，先作为旁路元数据和工具池治理入口，逐步收敛为工具系统的统一目录。

长期目标：

```text
现有 Tool 实现
  -> CcrToolRegistry 收集和补充元数据
  -> CcrToolAvailability 判断当前是否可用
  -> CcrToolExposure 决定 direct / deferred / internal
  -> CcrToolDisplaySpec 提供中文展示和摘要规则
  -> 仍复用现有 toolToAPISchema / tool.call 执行链路
```

## 3. 不变式

第一期必须遵守下面几条硬约束：

1. **不重写现有工具。**
   - `src/tools/*` 里的 `call()`、`validateInput()`、`checkPermissions()`、`inputSchema`、`renderToolUseMessage()` 保持可复用。

2. **不改模型协议。**
   - 不改变模型请求里的 tool schema。
   - 不改变 `tool_use` / `tool_result` 消息结构。
   - 不改变 provider adapter 的工具格式转换。

3. **不改 App Server / Desktop 协议。**
   - 不改 App Server 事件字段。
   - 不改 Desktop `DisplayEvent` 结构。
   - 不改历史会话存储格式。

4. **不改变页面展示。**
   - 第一期不让 Desktop 主会话工具卡读取新 registry。
   - 不改工具卡布局、不隐藏新卡、不合并卡片。
   - 只允许在日志或调试输出中新增可选信息。

5. **对外返回仍是 `Tool[]`。**
   - `getTools()` / `assembleToolPool()` 第一阶段仍返回原来的 `Tool[]`。
   - 注册层只作为内部查询和过滤依据。

## 4. 分期路线

### 第 0 期：现状冻结与验收基线

目标：先把当前工具池行为固定下来，后续每期都能知道有没有无意改动。

范围：

- 增加或完善工具池检查脚本。
- 打印当前 App Server 实际工具池。
- 记录内置工具、MCP 工具、`shouldDefer`、`alwaysLoad`、平台过滤结果。
- 保留当前 Windows App Server 行为：
  - 默认启用 `PowerShellTool`。
  - App Server 过滤 `Bash`。
  - 无 active agent definitions 时过滤 `AgentTool`。

建议落点：

- `scripts/inspect-app-server-tools.mjs`
- 或扩展已有 smoke：`scripts/smoke-runtime.mjs`

验收：

- Windows 本机能看到最终工具池包含 `PowerShell`，不包含 `Bash`。
- 能看到 `GenerateImage` 是 `alwaysLoad`。
- 能看到哪些工具是 `shouldDefer`。
- 不改变现有工具执行、协议和 Desktop 展示。

### 第 1 期：旁路 `CcrToolRegistry` 第一版

目标：建立注册表目录，但不改变现有行为。

范围：

- 新增 `CcrToolRegistry` 或等价模块。
- 从 `getAllBaseTools()` 读取现有 `Tool[]`。
- 为工具补旁路元数据：
  - 工具名。
  - 别名。
  - 中文名。
  - 分类。
  - 来源：builtin / mcp / provider / internal。
  - 当前 exposure 建议：direct / deferred / internal。
  - 展示建议：是否控制型工具、是否适合主聊天流展示。
- 暂时不把 Desktop 展示接到 registry。
- 暂时不改变 `toolToAPISchema()` 输出。

建议数据结构：

```ts
type CcrToolRegistryEntry = {
  name: string
  aliases?: string[]
  displayName: string
  category:
    | 'file'
    | 'runtime'
    | 'web'
    | 'agent'
    | 'media'
    | 'mcp'
    | 'control'
    | 'internal'
  source: {
    kind: 'builtin' | 'mcp' | 'provider' | 'skill' | 'plugin' | 'dynamic'
    providerId?: string
    serverId?: string
    pluginId?: string
  }
  exposure: 'direct' | 'deferred' | 'internal'
  display: {
    showInMainTimeline: boolean
    summaryKeys?: string[]
    detailKeys?: string[]
  }
  tool: Tool
}
```

验收：

- `getAllBaseTools()` 结果和改造前工具名集合一致。
- `getTools()` / `assembleToolPool()` 返回的 `Tool[]` 与改造前一致。
- `GenerateImage`、`TodoWrite`、`ToolSearch`、`PowerShell`、`Bash`、`Agent`、MCP 工具能在 registry 中查询到元数据。
- typecheck / build / 工具池 smoke 通过。
- Desktop 主会话 UI 不变化。

### 第 2 期：工具可用性与平台过滤收敛

目标：把“当前工具是否真实可用”的判断收进 registry。

范围：

- 新增 `CcrToolAvailability`。
- 明确不可用原因：
  - 平台不支持。
  - feature gate 未开启。
  - provider 不支持。
  - MCP 未连接。
  - agent definitions 未加载。
  - 当前权限模式禁止。
- 让 App Server 的平台过滤逐步从散落函数迁到 registry 查询。
- 保持对外仍返回 `Tool[]`，不改协议。

重点样板：

- `Bash`：Windows App Server 无 POSIX shell 时 unavailable。
- `PowerShell`：Windows 默认 available。
- `Agent`：无 active agent definitions 时 unavailable。
- `GenerateImage`：当前 provider 无 `generateImage()` 时 available=false 或保留工具但 validateInput 友好失败，需要单独定策略。
- MCP 工具：server 未连接时不进入最终工具池。

验收：

- App Server 最终工具池和 registry availability 结果一致。
- ToolSearch 使用最终 available 工具池。
- 不可用工具能给出开发可读的原因。
- 不改变模型协议和 Desktop 主会话展示。

### 第 3 期：ToolSearch 与 deferred 工具治理

目标：工具多起来后，让模型只看到该看的工具，并能按需发现。

范围：

- 以 registry 的 `exposure` 作为 direct / deferred / internal 的来源。
- `ToolSearch` 只搜索 available 且 deferred 的工具。
- `internal` 工具不进入模型搜索结果。
- 控制型工具，例如 `TodoWrite`、计划草稿、内部状态工具，不作为普通业务工具刷屏。
- MCP 工具默认 deferred，除非 `alwaysLoad` 或用户显式配置。

验收：

- [x] 不可用 `Bash` / `Agent` 不会被 ToolSearch 搜出来。
- [x] `GenerateImage` 作为 direct/alwaysLoad 样板继续可见。
- [x] `TodoWrite` 不再因为 ToolSearch 或工具结果形成普通主聊天噪声。
- [x] 工具搜索和调用链路保持现有协议格式。

### 第 4 期：Desktop 工具展示元数据接入

目标：开始让 UI 从 registry/display spec 获得中文展示和摘要规则，但只做低风险字段。

范围：

- 新增 `CcrToolDisplaySpec`。
- Desktop 工具卡可读：
  - 中文名。
  - 工具分类。
  - 摘要字段。
  - 详情字段。
  - 是否主聊天展示。
- 第一轮只替换 fallback 文案，不改布局。
- 长诊断、重复信息、控制型工具隐藏仍按单独 UI goal 推进。

验收：

- 工具卡能显示“生成图片 / PowerShell 命令 / 读取文件”等中文名。
- 原始工具名仍可在详情区看到。
- 页面布局不因为接入 display spec 发生大变化。
- 截图回归确认主会话工具卡没有明显错位。

### 第 5 期：Provider 能力工具化

目标：把 provider 辅助能力纳入工具目录，而不是只靠 prompt。

范围：

- `GenerateImage` 作为第一条 provider 能力工具样板。
- 后续可加入：
  - 图片理解工具。
  - 视频理解工具。
  - 文件理解工具。
  - 语音合成工具。
- 同供应商能力优先，例如：
  - `glm-api` 主模型 + `glm-image` 生图。
  - OpenAI / Codex OAuth hosted image generation。
  - MiniMax `image-01`。
- 跨供应商能力工具必须显式配置，不默认自动跨供应商。
- 独立“能力工具管理模块”先后置到 `0.7+`：
  - 示例目标：`deepseek` 负责主推理、`glm-api / glm-4.6v` 负责视觉理解、`openai / gpt-image-1` 负责图片生成。
  - 页面上需要独立展示主模型、能力工具、实际 provider/model 和数据边界。
  - 当前第五期不做完整管理页，只保留 `GenerateImage` 生图能力快照作为地基。

验收：

- [x] 当前 provider 不支持生图时，工具返回友好错误。
- [x] 支持生图 provider 继续通过同一个 `GenerateImage` 入口生成标准 `generatedArtifact`。
- [x] 模型页 / 诊断能说明当前能力来自哪个 provider/model。

### 第 5 期第二轮：MCP 运行时动态工具治理

目标：把 MCP 提前纳入 `0.5.x` 工具治理收尾，因为 MCP 动态工具会直接改变模型实际可见工具池。

范围：

- MCP 动态工具进入 registry。
- MCP 工具统一具备：
  - 服务名。
  - 工具名。
  - 来源。
  - 连接 / 认证 / 工具发现状态。
  - display spec。
  - direct/deferred/internal 策略。
- MCP 工具默认 deferred，除非已有 `alwaysLoad` 或用户显式配置。
- MCP 资源工具和认证工具继续按 internal / control 处理，不作为普通业务工具刷屏。
- ToolSearch 能按来源、分类、关键字检索 MCP 动态工具。
- Desktop 工具卡能展示 MCP 来源服务、工具中文名 fallback、健康状态和失败原因。

验收：

- MCP 工具不再只靠 `mcp__server__tool` 名字散落展示。
- 未连接、未认证、工具发现失败、调用失败能给出可观察原因。
- App Server inspect / smoke 能覆盖至少一个 MCP 动态工具样例。
- 不改变 MCP 工具调用协议，不重写 MCP client，只收敛注册、可用性、搜索和展示元数据。

### 第 5 期第三轮：MCP 安装与管理面治理

目标：把 MCP 从“连接后能用”推进到“用户能安装、查看、启停、卸载和诊断”。

范围：

- MCP 安装位置和配置来源。
- 手动配置与 Agent 自动下载安装的边界。
- MCP install / manage 工具或命令入口。
- Core / App Server MCP 管理 API。
- Desktop MCP 管理页。
- 安装、卸载、启用、禁用、认证、测试连接、查看工具和查看日志。
- 安全边界：来源校验、版本锁定、secret 脱敏、项目级信任、卸载保护。

不在本轮做：

- 完整插件市场。
- Skill / Plugin 统一扩展包安装。
- 多 provider 能力工具编排页。

验收：

- 手动配置和自动安装的 MCP server 都能进入统一 catalog。
- Desktop 能看到每个 MCP server 的安装来源、配置 scope、启用状态、连接状态、工具清单和失败原因。
- 模型或 Agent 发起安装时必须走用户确认，不能静默下载或改配置。
- 模型能基于 registry / availability 发现能力缺口，并通过 MCP 搜索和安装计划提出可确认的安装建议。
- 卸载只删除安装清单归属的文件，不删除用户手工目录或企业托管配置。

### 第 6 期：Skill / Plugin 统一扩展入口

目标：为 `0.6.0` 主线准备可安装、可启用、可审计的扩展包治理。

范围：

- Skill 暴露的工具进入 registry。
- Plugin 工具进入 registry。
- 动态工具统一具备：
  - 来源。
  - 健康状态。
  - 权限分组。
  - display spec。
  - direct/deferred 策略。
- 参考 OpenClaw 的 plugin optional 机制：插件工具默认不暴露，显式启用后才出现。

验收：

- Skill / Plugin 工具不再各自散落注册。
- Desktop 能看见外部工具来源和可用状态。
- ToolSearch 能按来源、分类、关键字检索动态工具。

## 5. 里程碑建议

| 版本线 | 建议范围 | 交付标准 |
| --- | --- | --- |
| `0.5.x` | 第 0 期到第 4 期、第 5 期第一轮 | 工具目录、可用性、ToolSearch、Desktop 展示和 `GenerateImage` 能力快照形成闭环。 |
| `0.5.x` 收尾一 | 第 5 期第二轮 MCP 运行时动态工具治理 | MCP 作为工具治理本体提前处理；先收敛注册、可用性、搜索和展示元数据，不重写 MCP client。 |
| `0.5.x` 收尾二 | 第 5 期第三轮 MCP 安装与管理面治理 | 固定 MCP 配置、安装目录、启停卸载、管理 API、Desktop 管理页和安全边界。 |
| `0.6.0` | 第 6 期 Skill / Plugin 扩展包治理 | 处理 Skill / Plugin 的安装、启用、命名空间、版本和审计；MCP 运行时和管理面基线应已在 `0.5.x` 收住。 |
| `0.7+` | 独立能力工具管理模块 | 支持显式组合主推理、视觉理解、生图、生视频、文件理解、语音等跨 provider 能力工具。 |

## 6. 与现有文档的关系

- [CCR 工具注册目录](../architecture/tool-registry-catalog.md)：记录当前已有工具和中文说明。
- [Provider 能力工具化后续方向](../architecture/provider-capability-tools-future.md)：记录 provider 辅助能力工具化的长期设计。
- [CCR Provider 工具协议统一化标准](../architecture/provider-tool-protocol-normalization.md)：记录 provider 工具协议翻译边界。
- [Codex / OpenClaw 工具系统源码对照索引](../references/codex-openclaw-tool-system-source-evidence.md)：记录 Codex 和 OpenClaw 的外部源码证据。
- [CCR 工具能力治理修复清单](./tool-capability-repair-list.md)：记录具体缺陷和修复项。

## 7. 第一批具体任务

第 0 期和第 1 期可以拆成这些小任务：

1. 新增工具池检查脚本，打印当前最终工具池。
2. 新增 registry 类型定义和只读构建函数。
3. 从 `getAllBaseTools()` 生成 registry entries。
4. 为核心工具补最小 metadata：
   - `GenerateImage`
   - `TodoWrite`
   - `ToolSearch`
   - `PowerShell`
   - `Bash`
   - `Agent`
   - `Read/Edit/Write`
   - MCP 工具
5. 增加 smoke：registry 生成不改变 `Tool[]` 输出。
6. 文档同步：更新工具注册目录，标明哪些字段已经进入 registry。

第一批完成后，再决定是否进入第 2 期可用性收敛。

## 后续记录（追加）

- 第 1 轮（2026-05-21）：完成第 0/1 期第一批落地。新增 `scripts/inspect-app-server-tools.mjs` 固定 App Server 工具池基线；新增 `src/services/tools/toolRegistry.ts`，把现有 `Tool[]` 转成只读 registry entries；新增 `scripts/smoke-tool-registry.mjs` 验证 registry 不改变工具顺序和数量；抽出 `src/services/tools/appServerToolFilters.ts` 复用 Windows App Server 对 `Bash` / `Agent` 的过滤规则。验证结果：Windows 下最终 App Server 工具池为 19 个，包含 `PowerShell` / `GenerateImage`，平台过滤只移除 `Agent` / `Bash`。
- 第 2 轮（2026-05-21）：完成第 2 期最小闭环。新增 `src/services/tools/toolAvailability.ts`，集中返回工具可用性和不可用原因；`filterAppServerPlatformTools()` 改为从 availability 查询过滤工具；`scripts/inspect-app-server-tools.mjs` 和 `scripts/smoke-tool-registry.mjs` 输出/验证 App Server 下 `Bash=platform_unsupported`、`Agent=agent_definitions_missing`，并覆盖 `GenerateImage=provider_unsupported` 的能力边界判断。外部协议、Desktop 展示和 `Tool[]` 调用链保持不变。
- 第 3 轮（2026-05-21）：完成第 3 期最小闭环。新增 `src/services/tools/toolSearchPolicy.ts`，以 registry `exposure` + availability 生成 ToolSearch 可搜索候选；`ToolSearchTool` 不再回退到完整工具池，`select:GenerateImage`、`select:TodoWrite`、`select:ToolSearch` 都不会返回，`select:WebFetch` 仍正常返回。`scripts/smoke-tool-registry.mjs` 直接调用 `ToolSearchTool.call()` 覆盖这条链路。工具调用协议和 Desktop 展示未变化。
- 第 4 轮（2026-05-21）：完成第 4 期第一轮。新增 `src/services/tools/toolDisplayCatalog.ts` 作为共享工具展示目录；`src/services/tools/toolRegistry.ts` 与 `apps/desktop/src/renderer/src/domain/toolEvents.ts` 统一从该目录读取中文名/分类元数据。Desktop 工具卡保持原布局，仅替换展示 fallback 口径，不改 App Server/模型协议。验证：`npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:tool-registry` 通过。
- 第 5 轮（2026-05-21）：完成第 4 期第二轮。审查并修复第一轮中的分类缺口：`GenerateImage` 不再落到 `unknown`，`WebFetch/WebSearch` 使用 `web` 分类，`TaskOutput` 使用 `agent` 分类；`getCcrToolDisplayMetadata()` 增加 trim 容错。Desktop `toolEvents` 对没有专门摘要逻辑的工具启用 `summaryKeys`，例如 `TaskOutput`、`WebFetch` 可生成中文摘要；`scripts/smoke-desktop-display-events.mjs` 增加对应断言。验证：`npm.cmd run typecheck`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:tool-registry` 通过；`npm.cmd run typecheck:desktop` 仍因既有 `MACRO` / `Bun` / 可选依赖类型缺失失败，未出现本轮文件相关错误。
- 第 6 轮（2026-05-21）：完成第 5 期第一轮。新增 `src/services/llm/providerCapabilityTools.ts`，把 `GenerateImage` 的生图能力统一表达为 `provider/model/source/route/dataBoundary/message` 快照；`GenerateImageTool` 的友好失败和实际调用共用该快照。App Server `config/get`、`model/list`、`model/availability` 以及 Desktop 模型页能说明当前生图能力来自哪个 provider/model。smoke 覆盖 `glm-api -> glm-image`、`openai -> gpt-image-1`、`minimax -> image-01` 和 `deepseek` 不支持生图。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:desktop-display-events`、`git diff --check` 通过；`npm.cmd run typecheck:desktop` 仍因既有 `MACRO` / `Bun` / 可选依赖类型缺失失败，未出现本轮新增文件相关错误。
- 第 7 轮（2026-05-21）：根据产品节奏调整，把独立“能力工具管理模块”后置到 `0.7+`。目标保留为显式组合 `deepseek` 主推理、`glm-api / glm-4.6v` 视觉理解、`openai / gpt-image-1` 生图等能力工具；当前第五期不继续做完整管理页，优先保持生图能力快照和诊断口径稳定。
- 第 8 轮（2026-05-21）：根据工具治理边界重新调整版本线，把 MCP 动态工具治理从 `0.6.0` 提前到 `0.5.x` 收尾。原因是 MCP 动态工具会直接改变模型实际可见工具池，属于 registry / availability / ToolSearch / Desktop 展示的核心治理范围；Skill / Plugin 仍保留到 `0.6.0`，重点处理安装、启用、命名空间、版本和审计。
- 第 9 轮（2026-05-21）：完成 T18。`src/services/tools/toolRegistry.ts` 的 MCP 动态工具条目现在会归一化 `source.kind=mcp`、`source.serverName`、`source.toolName`，在缺少 `mcpInfo` 时可从 `mcp__<server>__<tool>` 名称兜底解析；MCP 工具默认 `exposure=deferred`，显示名兜底为 `MCP <server> / <tool>`。`scripts/smoke-tool-registry.mjs` 新增 MCP identity 断言，覆盖 `mcpInfo` 和名称兜底两条路径。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:desktop-display-events` 通过。下一项切到 T19：把 MCP 连接、认证、禁用、工具发现失败状态接入 availability / inspect。
- 第 10 轮（2026-05-21）：完成 T19。`src/services/tools/toolAvailability.ts` 新增 MCP server 状态模型，支持 `connected`、`failed`、`needs-auth`、`pending`、`disabled`、`discovery-failed`、`call-failed`，并映射为 `mcp_not_connected`、`mcp_needs_auth`、`mcp_connection_failed`、`mcp_disabled`、`mcp_discovery_failed`、`mcp_call_failed` 等 reason code；`src/services/tools/appServerToolFilters.ts` 透传 `connectedMcpServerNames` / `mcpServerStatuses`，inspect 复用 availability summary 时可输出 MCP 状态。`scripts/smoke-tool-registry.mjs` 新增 MCP 状态断言，覆盖连接、认证、连接失败、禁用、发现失败、调用失败和 pending。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./scripts/inspect-app-server-tools.mjs`、`npm.cmd run smoke:desktop-display-events` 通过。下一项切到 T20：让 ToolSearch 和 Desktop 展示消费 MCP 来源、健康状态、中文名 fallback 和失败原因。
- 第 11 轮（2026-05-21）：完成 T20。`src/services/tools/toolDisplayCatalog.ts` 支持动态识别 `mcp__<server>__<tool>`，提供 `MCP <server> / <tool>` 展示名、`category=mcp` 和 `sourceKind=mcp`；`src/tools/ToolSearchTool/ToolSearchTool.ts` 的输出新增 `match_details`，可返回匹配工具展示名、分类、来源、MCP server/tool 和 availability，同时在无匹配时输出 unavailable MCP server 摘要；`apps/desktop/src/renderer/src/domain/toolEvents.ts` 的 MCP 工具卡和 `mcp_progress` 进度事件能展示 MCP 服务名、工具名和输入摘要。smoke 覆盖 MCP ToolSearch match details、needs-auth server reason、Desktop MCP 工具卡和 MCP progress。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:desktop-display-events` 通过。至此第 5 期第二轮 MCP 运行时动态工具治理收口，但 MCP 安装与管理面尚未完成。
- 第 12 轮（2026-05-21）：根据 MCP 产品边界复核，确认 T18-T20 只覆盖“已存在 MCP server 的工具注册、可用性、ToolSearch 和 Desktop 工具卡展示”，没有覆盖 MCP 安装位置、手动配置与自动下载安装、MCP install 工具、启用/禁用、安装/卸载、Desktop 管理页、日志诊断和安全边界。因此新增第 5 期第三轮 T21-T27，继续留在 `0.5.x`，收住 MCP 管理面后再进入第 6 期 Skill / Plugin。
- 第 13 轮（2026-05-21）：补齐“模型发现缺能力，需要安装 MCP”的实现依据。文档明确这不是模型自由下载安装，而是 `McpCapabilityResolver -> McpSearch -> McpInstallPlan -> 用户确认 -> McpManage.install` 的宿主受控链路；模型只能提出能力缺口和安装建议，真实下载、写配置、启动 stdio server、卸载删除都必须经过用户确认、策略校验和审计记录。同步更新工具目录和 Codex / OpenClaw 源码对照索引，作为 T24 / T27 后续实现依据。
- 第 14 轮（2026-05-21）：完成 T21 MCP 配置与安装位置基线。新增 `src/services/mcp/configInventory.ts`，结构化输出 enterprise、claude.ai、plugin、user legacy、user file、project、local、dynamic 等来源的 scope、优先级、读路径、写路径、是否可写、只读原因和 server active/suppressed 状态；固定自动安装目录为 `~/.ccr/mcp/packages`，安装清单为 `~/.ccr/mcp/installed.json`，锁文件为 `~/.ccr/mcp/lock.json`，日志目录为 `~/.ccr/logs/mcp`。`scripts/inspect-app-server-tools.mjs` 新增 `mcpConfigInventory` 输出，`scripts/smoke-tool-registry.mjs` 覆盖 source inventory 和安装路径。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run inspect:app-server-tools` 通过。下一项切到 T22：MCP 安装包模型。
- 第 15 轮（2026-05-21）：完成 T22 MCP 安装包模型。新增 `src/services/mcp/installManifest.ts`，提供 `CcrMcpInstallManifestSchema`、`createCcrMcpInstallManifest()`、`summarizeCcrMcpInstallManifest()` 和 `inferCcrMcpInstallKindFromConfig()`；安装来源明确分为 `manual-config`、`remote-url`、`stdio-npm-package`、`local-directory`、`builtin-preset`、`plugin-provided`，manifest 包含 transport、entry、envSchema、permissions、homepage、checksum 和 dataBoundary。`configInventory` 的 server 输出新增 `installKind`。smoke 覆盖六种 manifest source kind 和现有 config 推断。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry` 通过。下一项切到 T23：MCP 管理 Core / App Server API。
- 第 16 轮（2026-05-21）：完成 T23 MCP 管理 Core / App Server API。新增 Core 侧 `inspectCoreMcpServer()`、`addCoreMcpServer()`、`updateCoreMcpServer()`、`removeCoreMcpServer()`、`setCoreMcpServerEnabled()`、`restartCoreMcpServer()`、`testCoreMcpServer()`；App Server 新增 `mcp/inspect`、`mcp/add`、`mcp/update`、`mcp/remove`、`mcp/enable`、`mcp/disable`、`mcp/restart`、`mcp/test`，SDK 客户端同步补齐方法。`src/services/mcp/config.ts#updateMcpConfig()` 提供配置层原子更新，避免 Core 先删后加。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run inspect:app-server-tools` 通过。下一项切到 T24：MCP install 工具或命令入口。
- 第 17 轮（2026-05-21）：完成 T24 MCP install 受控入口。新增 `src/services/mcp/installManager.ts`，实现可信候选搜索、安装计划生成、确认 token、受控 apply、安装清单 `~/.ccr/mcp/installed.json`、锁文件 `~/.ccr/mcp/lock.json` 和 installer-owned uninstall；App Server 新增 `mcp/install/search`、`mcp/install/plan`、`mcp/install/apply`、`mcp/install/list`、`mcp/install/uninstall`，SDK 客户端同步补齐方法。第一版不静默联网下载，stdio npm 来源先通过受控 npx / 显式 serverConfig 写入配置并记录 lock，真实下载校验和包目录删除留给 T26。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run inspect:app-server-tools`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client` 通过。下一项切到 T25：Desktop MCP 管理页。
- 第 18 轮（2026-05-21）：完成 T25 Desktop MCP 管理页。`apps/desktop/src/main/index.ts` / `apps/desktop/src/preload/index.ts` 暴露 MCP inspect、启用、禁用、重启、检测、安装搜索、安装计划、确认安装、安装列表和卸载 IPC；`apps/desktop/src/renderer/src/components/pages/McpPage.tsx` 从原始 JSON 展示升级为 server 列表、详情、配置来源、工具/资源占位、诊断结果、安装候选、安装计划、写入目标和已安装记录管理页；`displayTypes.ts` 和 `styles.css` 补 Desktop 数据契约与布局样式。`src/services/mcp/installManager.ts` 的搜索候选补 `manifestInput`，让 Desktop 能从候选直接生成安装计划。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run desktop:build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:desktop-display-events` 通过。下一项切到 T26：MCP 安装安全与数据边界。
- 第 19 轮（2026-05-21）：完成 T26 MCP 安装安全与数据边界。`src/services/mcp/installManager.ts` 新增安装安全摘要 `security` 和风险映射，安装执行前强制 scope 可写校验；npm 包缓存目录改为 installer-owned 标记文件策略，卸载时先校验“目录归属 + owner marker 匹配”再删除；install record / lockfile 补 `packageOwnerMarkerPath` 与 `dataBoundary` 记录；安装计划和记录摘要继续对 `env/headers/oauth` 做凭据脱敏。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run inspect:app-server-tools`、`npm.cmd run typecheck:desktop` 通过。下一项切到 T27：补 smoke / inspect 契约验证并收口第 5 期第三轮。
- 第 20 轮（2026-05-21）：按 T21-T26 二次复核修补两处缺口。第一，`configInventory` 的项目级同名 server active 判断改为“更近 `.mcp.json` 覆盖父级 `.mcp.json`”，与运行时 `getMcpConfigsByScope('project')` 的合并语义保持一致，并在 `smoke:tool-registry` 增加 `mcp_config_inventory_project_nearest_file_wins`。第二，`installManager` 的 `force=true` 覆盖安装改为同 scope `updateMcpConfig()`，失败时恢复旧配置；卸载时若配置删除失败，只有“配置已不存在”才继续清理安装记录，其他写入失败会中断，避免留下还在生效但失去 installer 记录的配置。`smoke:app-server-client` 补安装安全摘要、owner marker 路径和 `packageRemoved=owner_marker_verified` 断言。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:app-server`、`npm.cmd run typecheck:desktop`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run inspect:app-server-tools` 通过。
- 第 21 轮（2026-05-21）：完成 T27 smoke / inspect 契约验证收口。`apps/desktop/src/renderer/src/components/pages/McpPage.tsx` 导出 MCP 管理页数据合并与格式化 helper，安装计划展示补 `数据边界` 和 `包缓存`；`displayTypes.ts` 补 `packageOwnerMarkerPath` 与 install `security` 契约。`scripts/smoke-desktop-display-events.mjs` 新增 Desktop MCP 管理页数据契约断言，覆盖 server/inventory/install 合并、被覆盖状态、安装记录、工具 annotation、manifest 和候选 key。`scripts/smoke-app-server.mjs` 补安装计划安全摘要断言；`scripts/smoke-app-server-client.mjs` 补安装清单、lockfile、包目录 owner marker 卸载残留清理断言。验证：`npm.cmd run typecheck -- --pretty false`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run smoke:tool-registry`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run inspect:app-server-tools`、`git diff --check` 通过。至此第 5 期第三轮 T21-T27 MCP 管理面收口，下一步进入 `0.6.0` Skill / Plugin 扩展包治理。
