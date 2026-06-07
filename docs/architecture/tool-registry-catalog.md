# CCR 工具注册目录

这份文档用中文解释 CCR 当前代码里注册过的工具，方便排查“模型为什么看得到这个工具”“界面上这个工具是干嘛的”“某个工具为什么当前不可用”。

## 读法

- **工具名**：代码里暴露给模型的真实名称，必须和工具调用协议一致。
- **中文名**：面向用户和界面的推荐叫法。
- **类型**：工具的大致职责分类。
- **常规可见**：普通会话里是否属于基础工具池。最终是否真的给模型，还会受权限、平台、模式、MCP 连接状态和 feature gate 影响。
- **开启条件**：只有满足条件时才注册或暴露。

当前内置工具的源头是 `src/tools.ts` 的 `getAllBaseTools()`；普通会话会再经过 `getTools()` 过滤。App Server 的最终工具池统一由 `buildAppServerToolPool()` 生成，它会复用 `assembleToolPool()` 合并内置工具和 MCP 工具，再应用平台默认、权限过滤、active agent 数量和 MCP server runtime 状态。Capability Catalog 的 Tool provider 必须消费这份已解析工具池，不能自行回退到 `getAllBaseTools()` 猜测模型可见工具。

外部参考：Codex 与 OpenClaw 的工具注册、工具搜索、动态工具、插件工具和 UI 展示链路已整理到 [Codex / OpenClaw 工具系统源码对照索引](../references/codex-openclaw-tool-system-source-evidence.md)。后续改 CCR 工具治理时，先同时参考本目录和外部源码证据索引。

## 当前 registry 落地状态

当前已完成到第 5 期第三轮 T27，并在扩展能力 R15 中补齐 ToolSearch / Tool Registry / Capability Catalog 对齐：在不改模型协议和 App Server 事件协议的前提下，Desktop 工具卡已接入共享中文名、分类、`summaryKeys` 摘要 fallback、`detailKeys` 详情裁剪和 `showInMainTimeline` 主时间线隐藏建议；`GenerateImage` 的 provider 生图能力也已经有统一的 `provider/model/source/route/dataBoundary/message` 快照；MCP 动态工具进入 registry 后会带 `serverName/toolName`，默认按 deferred 暴露，能通过 availability 表达连接、认证、禁用、发现失败和调用失败状态；`ToolCapabilitySnapshot` 现在是 ToolSearch 候选策略和 Capability Catalog tool provider 的共享输入，避免同一个工具在搜索、目录和诊断里被重复解释；MCP 管理 API 已具备 list / inspect / add / update / remove / enable / disable / restart / test；MCP install 受控入口已具备 search / plan / apply / list / uninstall；Desktop 已新增 MCP 管理页承接配置查看、启停、检测、安装计划和 installer-owned 卸载；安装安全边界新增 scope 可写校验、包缓存 owner marker、lockfile/dataBoundary 审计记录、force 覆盖失败回滚和 secret 脱敏摘要；项目级 `.mcp.json` inventory 的 active 判断已与运行时“近目录覆盖父目录”保持一致；T27 已补配置合并、启停、安装清单、卸载残留、Desktop 管理页数据契约和 inspect 输出验证。

当前治理重点已经从“进入 Skill / Plugin 扩展包治理”推进到“外部扩展能力底层事实收口”。MCP 运行时工具面、管理 API、受控 install 入口、Desktop 管理页、安全边界和 T27 自动化验证已经收口；G1-G4 又补齐请求级能力运行环境、来源感知身份、Plugin / App / MCP 关系图、App registry 生命周期和 85 项反例矩阵。后续 Skill / Plugin 不应另造一套工具目录，而应复用 registry、availability、ToolSearch、Capability Catalog、Desktop 管理页和 installer-owned 安全边界的既有模式。

## MCP 管理面收口边界

T18-T20 只解决“连接后的 MCP 工具如何进入 registry、availability、ToolSearch 和 Desktop 工具卡展示”。T21-T27 已继续补齐安装位置、受控安装、管理 API、Desktop 管理页、安全边界和 smoke 契约。下面表格记录当前状态和后续增强点：

| 问题 | 当前状态 | 后续落点 |
| --- | --- | --- |
| MCP 装在哪里 | T21 已固定配置和安装基线：用户级 `~/.ccr/mcp.json`、项目级 `.mcp.json`、企业 `managed-mcp.json`，自动下载目录 `~/.ccr/mcp/packages`，安装清单 `~/.ccr/mcp/installed.json`，锁文件 `~/.ccr/mcp/lock.json`，日志 `~/.ccr/logs/mcp`。 | T22 继续补安装包 manifest |
| 手动安装还是 Agent 自下载安装 | T22 已建立安装包 manifest，能区分手动配置、远程 URL、stdio npm 包、本地目录、内置 preset 和 plugin-provided MCP；T24 已提供宿主受控 search / plan / apply 入口。 | 已完成基础入口 |
| 是否有 MCP install 工具 | T24 已完成受控入口：`mcp/install/search`、`mcp/install/plan`、`mcp/install/apply`、`mcp/install/list`、`mcp/install/uninstall`。T25/T26 已接入 Desktop 管理页和安装安全边界。 | 已完成 |
| 是否有 MCP 管理 API | T23 已完成 Core / App Server / SDK 客户端 API：`mcp/list`、`mcp/inspect`、`mcp/add`、`mcp/update`、`mcp/remove`、`mcp/enable`、`mcp/disable`、`mcp/restart`、`mcp/test`。 | 已完成 |
| 是否有 Desktop MCP 管理界面 | T25 已新增 MCP 管理页：server 列表、配置来源、安装来源、启用状态、检测 / 重启、安装候选、安装计划、写入目标、安装记录和卸载入口；T27 已补数据合并和格式化契约 smoke。 | 已完成 |
| 启用 / 禁用 | T25 已接入 Desktop 管理页按钮，底层走 T23 的 `mcp/enable` / `mcp/disable`；T27 已补 App Server / SDK smoke。 | 已完成 |
| 安装 / 卸载 | T25 已接入 Desktop 安装搜索、安装计划、确认安装、安装记录和 installer-owned 卸载。T26 新增包目录归属校验和 owner marker 验证后删除，T27 补安装清单、lockfile 和包目录残留清理 smoke。 | 已完成 |
| 查看工具 / 资源 / 日志 | Desktop 管理页已预留工具 / 资源展示区，按运行时返回数据展示；T27 已补 Desktop 数据契约 smoke。运行时连接管理若后续提供更完整工具/资源/日志 feed，可继续扩展 `mcp/list` 数据源。 | 后续增强 |
| 安全边界 | T26 已补安装安全摘要：scope 可写校验、项目/企业策略提示、checksum 声明状态、dataBoundary 审计记录、OAuth/headers/env 脱敏摘要、owner marker 清理保护和失败回滚；T27 已补 smoke。 | 已完成 |
| 模型主动发现缺能力并建议安装 MCP | T24 已落地 search / plan / apply / list / uninstall 的宿主受控链路；完整能力缺口自动推荐可以在后续 Skill / Plugin / 能力工具治理中继续扩展。 | 后续增强 |

后续实现“模型发现缺能力”的路径必须是宿主受控流程：

```text
registry / availability 确认当前缺少能力
-> MCP catalog 搜索候选
-> 生成安装计划
-> 用户确认
-> 宿主执行安装 / 写配置 / 测试连接
-> MCP 工具重新进入 registry、availability、ToolSearch 和 Desktop 管理页
```

这里的关键边界是：模型可以发起搜索和安装建议，但不能直接下载、改配置、启动陌生 stdio server 或删除文件。

已落地代码：

- `src/services/tools/toolRegistry.ts`：新增只读 `CcrToolRegistry`，从现有 `Tool[]` 生成 registry entries；MCP 动态工具会归一化 `serverName/toolName`，并在缺少 `mcpInfo` 时从 `mcp__<server>__<tool>` 名称兜底解析。
- `src/services/tools/toolAvailability.ts`：新增 `CcrToolAvailability`，集中判断工具是否真实可用，并返回不可用原因；MCP 动态工具支持 `connected`、`needs-auth`、`failed`、`disabled`、`pending`、`discovery-failed`、`call-failed` 状态。
- `src/services/tools/toolCapabilitySnapshot.ts`：新增共享工具能力快照，把 registry entry、availability 和 searchable 结果放在同一层，供 ToolSearch 与 Capability Catalog 共同消费。
- `src/services/tools/toolSearchPolicy.ts`：新增 `CcrToolSearchPolicy`，集中决定哪些工具允许被 `ToolSearch` 搜索；当前候选来自 `ToolCapabilitySnapshot.searchable=true`。
- `src/services/tools/appServerToolFilters.ts`：抽出 App Server 平台过滤，供运行时和检查脚本复用。
- `src/services/tools/appServerToolPool.ts`：抽出 App Server 最终工具池 builder，供 turn runner 和 Capability Catalog 共用，确保工具目录和模型实际工具集合一致。
- `src/services/llm/providerCapabilityTools.ts`：新增 provider 能力工具快照，当前覆盖 `GenerateImage` 生图能力来源、同供应商边界和不可用提示。
- `src/services/mcp/configInventory.ts`：新增 MCP 配置与安装位置 inventory，输出 enterprise、claude.ai、plugin、user legacy、user file、project、local、dynamic 来源的优先级、读写路径、可写性、安装目录、lockfile、日志目录和 server active/suppressed 状态。
- `src/services/mcp/installManifest.ts`：新增 `CcrMcpInstallManifest` 运行时 schema 和安装来源分类，覆盖手动配置、远程 URL、stdio npm 包、本地目录、内置 preset、plugin-provided MCP，并记录 entry、envSchema、permissions、homepage、checksum 和 dataBoundary。
- `src/services/mcp/config.ts#updateMcpConfig()`：新增 MCP 配置层更新入口，按 user / project / local scope 原子写回，避免管理 API 用“先删后加”模拟更新。
- `src/services/mcp/installManager.ts`：新增 MCP install 受控入口，覆盖候选搜索、安装计划、确认 token、受控 apply、安装清单、锁文件和 installer-owned uninstall。
- `apps/desktop/src/main/index.ts` / `apps/desktop/src/preload/index.ts`：Desktop 暴露 MCP inspect、启用、禁用、重启、检测、安装搜索、安装计划、确认安装、安装列表和卸载 IPC。
- `apps/desktop/src/renderer/src/components/pages/McpPage.tsx`：新增 MCP 管理页，展示 server 列表、详情、配置来源、运行状态、工具/资源区、诊断结果、安装候选、安装计划、写入目标和 CCR 安装记录。
- `apps/desktop/src/renderer/src/domain/displayTypes.ts` / `apps/desktop/src/renderer/src/styles.css`：补 Desktop MCP 管理页数据契约和响应式布局样式。
- `src/core/mcpCore.ts`：新增 MCP 管理 Core API，覆盖 list / inspect / add / update / remove / enable / disable / restart / test，并复用 config inventory 与 install kind 推断。
- `src/app-server/handlers/mcpHandlers.ts` / `src/app-server/router.ts` / `src/app-server/client/stdioAppServerClient.ts`：App Server 和 SDK 客户端暴露 `mcp/*` 管理方法，供 Desktop、CLI 和后续 VS Code 复用。
- `src/core/configCore.ts` / `src/core/modelCore.ts`：App Server 配置快照、模型列表和模型可用性返回 `capabilityTools`。
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`：从共享展示目录读取中文名、分类、摘要字段、详情字段和主时间线展示建议。
- `src/tools/ToolSearchTool/ToolSearchTool.ts`：ToolSearch 结果新增 `match_details` 和不可用 MCP server 摘要，MCP 匹配结果可带来源、展示名、可用性和失败原因。
- `apps/desktop/src/renderer/src/components/chat/ToolCard.tsx`：详情区优先使用 `detailKeys` 展示关键参数，避免把完整输入噪音铺开。
- `apps/desktop/src/renderer/src/domain/displayEvents.ts`：主时间线隐藏逻辑优先消费 `showInMainTimeline`，失败工具调用仍保持可见。
- `apps/desktop/src/renderer/src/components/pages/ModelsPage.tsx`：模型页展示当前 provider 的生图能力工具来源。
- `scripts/inspect-app-server-tools.mjs`：打印当前 App Server 最终工具池、`alwaysLoad`、`shouldDefer`、MCP 工具、平台过滤结果和 `mcpConfigInventory`。
- `scripts/smoke-tool-registry.mjs`：验证 registry 不改变基础工具顺序和数量，并覆盖 `GenerateImage`、`TodoWrite`、内部 MCP 资源工具、Windows App Server 过滤、provider 生图能力工具快照、MCP 配置 inventory、MCP install manifest、可用性原因、MCP 动态工具 identity、`ToolSearchTool.call()` 候选策略，以及同一个 MCP tool 在 `ToolCapabilitySnapshot`、ToolSearch 和 Capability Catalog 中的来源/可用性/暴露策略一致。
- `scripts/smoke-desktop-display-events.mjs`：验证 Desktop 工具卡能消费 `summaryKeys/detailKeys/showInMainTimeline`，并保留失败内部工具卡可见。

当前 registry 字段：

| 字段 | 中文含义 | 当前用途 |
| --- | --- | --- |
| `name` | 工具真实名称 | 和模型工具调用协议保持一致。 |
| `aliases` | 工具别名 | 支持 `GenerateImage` 通过 `image_generation` 查询。 |
| `displayName` | 中文名 | Desktop `toolEvents` 已接入 fallback，工具卡默认展示统一中文名。 |
| `category` | 工具分类 | 当前包括文件、运行时、网络、代理、多模态、MCP、控制、内部。 |
| `source.kind` | 工具来源 | 当前区分 `builtin`、`provider`、`mcp`，为后续 Skill / Plugin 预留。 |
| `source.serverName` / `source.toolName` | MCP 来源标识 | MCP 动态工具从 `mcpInfo` 或 `mcp__<server>__<tool>` 名称兜底解析，供 ToolSearch、Desktop 和 inspect 统一展示。 |
| `exposure` | 暴露策略 | 当前按现有 `alwaysLoad`、`shouldDefer`、MCP 和内部工具推导 `direct` / `deferred` / `internal`。 |
| `display.showInMainTimeline` | 是否适合主聊天流展示 | Desktop 主时间线隐藏逻辑已接入；失败工具调用仍保持可见。 |
| `summaryKeys` / `detailKeys` | 摘要/详情字段建议 | `summaryKeys` 已用于没有专门摘要逻辑的工具；`detailKeys` 已用于工具详情区关键参数裁剪。 |
| `match_details` | ToolSearch 匹配详情 | ToolSearch 可返回匹配工具的展示名、分类、来源和 availability，用于后续 App Server / Desktop 统一展示。 |

当前 availability 已覆盖：

| 工具 | 不可用条件 | 原因码 |
| --- | --- | --- |
| `Bash` | Windows App Server 下没有 POSIX shell 运行环境 | `platform_unsupported` |
| `PowerShell` | 非 Windows 平台 | `platform_unsupported` |
| `Agent` | App Server 未加载 active agent definitions | `agent_definitions_missing` |
| `GenerateImage` | 当前 provider 明确不支持生图 | `provider_unsupported` |
| MCP 动态工具 | 指定 MCP server 未连接或缺少 server 信息 | `mcp_not_connected` |
| MCP 动态工具 | MCP server 需要认证 | `mcp_needs_auth` |
| MCP 动态工具 | MCP server 连接失败 | `mcp_connection_failed` |
| MCP 动态工具 | MCP server 已禁用 | `mcp_disabled` |
| MCP 动态工具 | MCP server 工具发现失败 | `mcp_discovery_failed` |
| MCP 动态工具 | MCP 工具最近一次调用失败 | `mcp_call_failed` |

当前 provider 能力工具快照已覆盖：

| 能力工具 | 支持 provider/model | 数据边界 | 不支持时 |
| --- | --- | --- | --- |
| `GenerateImage` 生图 | `glm-api / glm-image`、`openai / gpt-image-1`、`codex-oauth / 当前 hosted image generation 模型`、`minimax / image-01`、`minimax-cn / image-01` | `same_provider`，不自动跨供应商 | 返回 `provider_unsupported` 友好提示，并在模型页 / 诊断说明不可用原因 |

当前 Windows App Server 基线：

- 基础工具池：25 个。
- 普通启用后的内置工具池：21 个。
- App Server 最终工具池：19 个。
- 最终工具池包含：`PowerShell`、`GenerateImage`、`TodoWrite`、`Read`、`Edit`、`Write`、`Glob`、`Grep` 等。
- Windows App Server 平台过滤只移除：`Agent`、`Bash`；Capability Catalog 中的 Tool 能力也消费同一份过滤后的 app-server tool pool。
- 不可用原因：`Bash=platform_unsupported`，`Agent=agent_definitions_missing`。

当前 ToolSearch 候选策略：

- 候选必须同时满足：`exposure=deferred` 且 `available=true`。
- `direct` 工具不通过 `ToolSearch` 搜索，例如 `GenerateImage`、`TodoWrite`、`Read`、`Glob`、`PowerShell`。
- `internal` 工具不通过 `ToolSearch` 搜索，例如 `ToolSearch`、`ListMcpResourcesTool`、`ReadMcpResourceTool`。
- 当前 Windows App Server 可搜索候选为：`AskUserQuestion`、`EnterPlanMode`、`EnterWorktree`、`ExitPlanMode`、`ExitWorktree`、`NotebookEdit`、`TaskOutput`、`TaskStop`、`WebFetch`、`WebSearch`。

## 基础工具

这些工具是当前基础工具池的主要成员。它们不是每一轮都必然出现，但属于 CCR 普通能力面。

| 中文名 | 工具名 | 别名 | 类型 | 常规可见 | 用途说明 |
| --- | --- | --- | --- | --- | --- |
| 子代理 | `Agent` | `Task` | 任务协作 | 是 | 把一部分工作交给后台子代理执行。适合并行调查、长任务、代码修改子任务。 |
| 任务输出 | `TaskOutput` | `AgentOutputTool`, `BashOutputTool` | 任务协作 | 是 | 读取后台任务的真实输出。只能使用后台任务返回的 `task_id`，不能让模型自己编。 |
| Shell 命令 | `Bash` | 无 | 命令执行 | 是 | 执行通用 shell 命令。Windows 场景下更推荐后续走 `PowerShell` 或更高层文件工具。 |
| 文件匹配 | `Glob` | 无 | 文件检索 | 是 | 按文件名模式查找文件，例如查找某类扩展名或目录下的文件。 |
| 文本搜索 | `Grep` | 无 | 文件检索 | 是 | 在项目里搜索文本、符号、错误信息或配置字段。 |
| 退出计划模式 | `ExitPlanMode` | 无 | 计划审批 | 是 | 模型完成计划后发起确认，用户批准后才进入执行。 |
| 读取文件 | `Read` | 无 | 文件操作 | 是 | 读取本地文件内容。适合源码阅读、配置查看、文档检查。 |
| 修改文件 | `Edit` | 无 | 文件操作 | 是 | 修改已有文件的一段内容。适合小范围补丁。 |
| 写入文件 | `Write` | 无 | 文件操作 | 是 | 新建或覆盖写入文件。需要权限和 UI 展示清楚，避免隐藏写入行为。 |
| Notebook 编辑 | `NotebookEdit` | 无 | 文件操作 | 是 | 编辑 Jupyter Notebook。 |
| 网页读取 | `WebFetch` | 无 | 网络读取 | 是 | 读取指定 URL 的网页内容。 |
| 待办更新 | `TodoWrite` | 无 | 控制型工具 | 是，且 `alwaysLoad` | 更新模型内部任务清单。它不应像普通业务工具一样占据主聊天流。 |
| 生成图片 | `GenerateImage` | `image_generation` | 多模态生成 | 是，且 `alwaysLoad` | 调用当前 provider 的真实生图能力，返回统一生成物协议，供 Desktop 缩略图和预览使用。 |
| 网络搜索 | `WebSearch` | 无 | 网络搜索 | 是 | 搜索互联网。是否可用取决于当前运行时和 provider 能力。 |
| 停止任务 | `TaskStop` | `KillShell` | 任务协作 | 是 | 停止正在运行的后台任务或 shell 任务。 |
| 问用户问题 | `AskUserQuestion` | 无 | 用户确认 | 是 | 需要用户做选择或确认时使用。 |
| 技能 | `Skill` | 无 | 能力扩展 | 是 | 加载或使用本地 Skill，让模型获得专门工作流能力。 |
| 进入计划模式 | `EnterPlanMode` | 无 | 计划审批 | 是 | 让模型主动进入只规划、不执行的模式。 |
| 进入工作树 | `EnterWorktree` | 无 | 工作区隔离 | 是 | 进入隔离 worktree 执行任务，降低互相污染风险。 |
| 退出工作树 | `ExitWorktree` | 无 | 工作区隔离 | 是 | 从隔离 worktree 退出。 |
| 给子代理发消息 | `SendMessage` | 无 | 多代理通信 | 是 | 给已经启动的子代理或队友发送消息。 |
| 发送用户消息 | `SendUserMessage` | `Brief` | 控制型工具 | 是 | 内部用于简短回传消息，旧名是 `Brief`。 |
| MCP 资源列表 | `ListMcpResourcesTool` | 无 | MCP 资源 | 基础清单中存在，普通 `getTools()` 会过滤 | 列出 MCP server 提供的资源。通常不是普通聊天主工具。 |
| MCP 资源读取 | `ReadMcpResourceTool` | 无 | MCP 资源 | 基础清单中存在，普通 `getTools()` 会过滤 | 读取 MCP server 提供的资源。通常不是普通聊天主工具。 |

## 条件工具和实验工具

这些工具在代码里有入口，但只有满足开关、平台或运行模式时才会进入工具池。右侧大写名称通常是环境变量或 feature gate。

| 中文名 | 工具名 | 类型 | 开启条件 | 用途说明 |
| --- | --- | --- | --- | --- |
| 工具搜索 | `ToolSearch` | 工具治理 | `ENABLE_TOOL_SEARCH` 或默认策略允许；非 Anthropic 代理环境默认可能关闭 | 工具太多时不一次性塞给模型，而是按需搜索和加载工具，主要用于节省上下文。 |
| PowerShell 命令 | `PowerShell` | 命令执行 | Windows；external 默认需 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` | Windows 专用命令工具。比把 PowerShell 命令塞进 `Bash` 更准确。 |
| 配置工具 | `Config` | 内部配置 | `USER_TYPE=ant` | Anthropic 内部配置查看或修改工具，外部 CCR 一般不用。 |
| Tungsten 工具 | `TungstenTool` | 内部终端 | `USER_TYPE=ant` | Anthropic 内部终端/会话面板相关工具。 |
| REPL 执行环境 | `REPL` | 内部执行 | `USER_TYPE=ant` | 内部 REPL 执行环境，会隐藏部分原始命令工具。 |
| 后台 PR 建议 | `SuggestBackgroundPRTool` | 内部协作 | `USER_TYPE=ant` | Anthropic 内部建议后台 PR 的工具。 |
| 创建任务 | `TaskCreate` | 任务协作 | Todo V2 开启 | 更结构化地创建后台任务。 |
| 读取任务 | `TaskGet` | 任务协作 | Todo V2 开启 | 读取结构化后台任务状态。 |
| 更新任务 | `TaskUpdate` | 任务协作 | Todo V2 开启 | 更新结构化后台任务状态。 |
| 列出任务 | `TaskList` | 任务协作 | Todo V2 开启 | 列出结构化后台任务。 |
| 创建队伍 | `TeamCreate` | 多代理协作 | agent swarm 开启 | 创建多 agent 团队或队友集合。 |
| 删除队伍 | `TeamDelete` | 多代理协作 | agent swarm 开启 | 删除多 agent 团队。 |
| 创建定时任务 | `CronCreate` | 自动化 | `AGENT_TRIGGERS` | 创建定时任务。 |
| 删除定时任务 | `CronDelete` | 自动化 | `AGENT_TRIGGERS` | 删除定时任务。 |
| 列出定时任务 | `CronList` | 自动化 | `AGENT_TRIGGERS` | 查看定时任务。 |
| 远程触发 | `RemoteTrigger` | 自动化 | `AGENT_TRIGGERS_REMOTE` | 从远程事件触发任务。 |
| 监控工具 | `MonitorTool` | 自动化 | `MONITOR_TOOL` | 监控目标、状态或条件。 |
| 等待工具 | `Sleep` | 自动化 | `PROACTIVE` 或 `KAIROS` | 让任务等待一段时间后继续。 |
| 发送用户文件 | `SendUserFile` | 文件/消息 | `KAIROS` | 给用户发送文件。 |
| 推送通知 | `PushNotification` | 通知 | `KAIROS` 或 `KAIROS_PUSH_NOTIFICATION` | 发送系统或远程通知。 |
| 订阅 PR 活动 | `SubscribePR` | GitHub 协作 | `KAIROS_GITHUB_WEBHOOKS` | 订阅 Pull Request 事件。 |
| 工作流工具 | `WorkflowTool` | 工作流 | `WORKFLOW_SCRIPTS` | 执行预定义工作流脚本，把固定流程变成工具。 |
| 历史片段工具 | `SnipTool` | 上下文治理 | `HISTORY_SNIP` | 截取或摘取历史上下文片段。 |
| 列出同伴 | `ListPeersTool` | 多代理通信 | `UDS_INBOX` | 列出同伴、节点或通信对象。 |
| 语言服务 | `LSP` | 代码智能 | `ENABLE_LSP_TOOL` | 接入语言服务，获取诊断、符号、跳转等代码信息。 |
| 溢出测试工具 | `OverflowTestTool` | 测试 | `OVERFLOW_TEST_TOOL` | 测试超长输出、溢出和截断展示。 |
| 上下文检查 | `CtxInspectTool` | 调试 | `CONTEXT_COLLAPSE` | 查看上下文压缩、裁剪和状态。 |
| 终端捕获 | `TerminalCaptureTool` | 调试 | `TERMINAL_PANEL` | 捕获终端面板内容。 |
| 计划执行校验 | `VerifyPlanExecutionTool` | 计划审批 | `CLAUDE_CODE_VERIFY_PLAN=true` | 检查计划是否按预期执行。 |
| 测试权限工具 | `TestingPermissionTool` | 测试 | `NODE_ENV=test` | 测试权限弹窗和权限流程。 |

## 动态工具和内部工具

| 中文名 | 工具名形态 | 来源 | 用途说明 |
| --- | --- | --- | --- |
| MCP 动态工具 | `mcp__<服务名>__<工具名>` | MCP server 连接后动态生成 | MCP server 提供什么工具，CCR 就按服务名和工具名生成对应模型工具。浏览器、插件、外部系统工具后续都应走这条路。 |
| MCP 认证工具 | `mcp__<服务名>__authenticate` | MCP server 需要 OAuth 时临时生成 | 让模型知道某个 MCP server 存在但需要认证，并能发起授权流程。认证完成后会被真实 MCP 工具替换。 |
| MCP 工具模板 | `mcp` | `MCPTool` 模板 | 代码里的基础模板，不直接作为普通用户工具出现；真实名称会被替换为 `mcp__...`。 |
| 结构化输出 | `StructuredOutput` | JSON schema / 非交互运行时 | 内部结构化输出工具，用于让模型按 schema 返回 JSON。不是普通聊天工具。 |
| 评审产物工具 | `ReviewArtifactTool` | `REVIEW_ARTIFACT` | 评审产物相关的实验/内部工具，主要和权限卡交互有关。 |
| 浏览器工具旧入口 | `WebBrowserTool` | 已退休 | 旧 WebBrowserTool 路径已设为 `null`；浏览器自动化后续统一走 MCP，优先 Playwright MCP。 |

MCP 和 Codex / OpenClaw 的专项对照记录放在 [Codex / OpenClaw 工具系统源码对照索引](../references/codex-openclaw-tool-system-source-evidence.md) 的“MCP 专项对照”章节；本目录只保留 CCR 当前工具面的摘要和治理落点。

## 对 UI 和文案的建议

面向用户时，不建议直接展示纯英文工具名。界面可以按下面的顺序展示：

1. 优先展示中文名，例如“生成图片”“读取文件”“PowerShell 命令”。
2. 在详情或调试区展示工具名，例如 `GenerateImage`、`Read`、`PowerShell`。
3. 条件工具需要展示不可用原因，例如“当前未启用 `CLAUDE_CODE_USE_POWERSHELL_TOOL`”。
4. 控制型工具不要像普通业务工具一样刷主聊天流，例如 `TodoWrite`、`ToolSearch`、`StructuredOutput`。
5. MCP 工具要展示来源服务，例如“浏览器 MCP / 点击元素”，不要只展示 `mcp__browser__click`。

## 当前治理重点

- Windows 下命令执行应优先让模型看到真实可用的 `PowerShell` 或更高层工具，避免 PowerShell 命令误进 `Bash`。
- `GenerateImage` 必须作为统一生图入口暴露，不能让模型自己猜写 SVG、写文件或调用 shell。
- `ToolSearch` 搜索结果必须来自 available 且 deferred 的候选池，不能搜出 direct、internal、被过滤或不可用的工具。
- MCP 动态工具作为 `0.5.x` 收尾重点，必须跟连接健康状态绑定，未连接、未认证或依赖缺失时不要伪装成可用。
- MCP 管理面继续留在 `0.5.x`：必须明确配置文件、安装目录、自动下载安装边界、启停卸载、管理 API、Desktop 管理页和安全策略。
- Agent 不能静默安装或卸载 MCP；任何下载、写配置、执行 stdio server 的动作都必须可确认、可审计、可回滚。
- Desktop 工具卡应能解释工具中文名、真实工具名、来源、状态和失败原因。
