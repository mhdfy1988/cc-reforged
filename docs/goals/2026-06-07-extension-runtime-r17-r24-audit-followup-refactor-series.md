# Goal Series：R17-R24 审查问题修复与统一能力目录深化

## 1. 背景

R0-R16 已经把扩展能力体系从散落入口推进到 Capability Catalog、管理投影、统一动作入口、ToolSearch 对齐和端到端 smoke。

但 R13-R16 完成后的两轮代码审查确认：当前实现仍有几类边界没有钉牢，尤其是 Skill、MCP、Tool、App、Plugin 在“来源、运行时可见性、上下文注入、管理动作”之间仍可能出现错位。

本序列不是推翻 R0-R16，而是在其基础上把审查发现的问题拆成可执行的后续 goal。

一句话口径：

```text
R17-R24 负责把“统一能力目录”从能展示、能操作，继续推进到 identity 一致、来源可信、上下文同源、动作受所有权约束、测试可守住。
```

## 2. 总目标

让 Skill / MCP / Tool / App / Plugin 共享同一组能力事实和状态语义，但保持各自运行时边界：

```text
原始来源
  -> 统一能力模型
  -> 能力目录聚合
  -> 管理投影 / 上下文投影 / UI 投影
  -> 操作与验证
```

关键不变式：

- `installed`、`configured`、`enabled`、`available`、`runtimeVisible` 必须拆开，不能互相冒充。
- Skill 是上下文能力和工作流指令，不是 Tool 的别名。
- MCP 是外部服务连接和工具协议，不是 Skill 的别名。
- Plugin 是能力合集，不直接替代它携带的 Skill、MCP、Tool 或 App。
- 管理页展示的是能力目录投影，不是单纯安装记录。
- 上下文只消费运行时投影，不能靠安装记录猜。
- 管理动作必须受来源和所有权约束，不能让 runtime-only 或 plugin-owned 能力写本地配置。
- 能力 ID 必须有唯一生成器，管理页、discovery、listing、日志都用同一口径。

## 3. 审查问题总表

| 编号 | 严重级别 | 问题 | 归属 Goal |
| --- | --- | --- | --- |
| I01 | P1 | Skill `force` 计划阶段放行，但 apply 阶段仍按已存在目录失败 | R20 |
| I02 | P1 | Skill repair 先删除现有包，再构建候选；失败会把可用 Skill 变成缺包 | R20 |
| I03 | P1 | runtime-only / plugin-owned MCP 仍能拿到 `enable` / `disable` / `test` / `restart`，其中启停会写本地 MCP 配置 | R18 |
| I04 | P1 | runtime MCP server 被标成 `installed: true`，导致 ownership 误判为 installer-owned | R18 |
| I05 | P2 | Skill 管理页仍容易偏安装记录，不是完整运行时 Skill 能力目录 | R21 |
| I06 | P2 | Skill `runtimeDiagnostics` 依赖全局上一轮快照，可能 stale 或串 cwd / session | R21 |
| I07 | P2 | Skill lock 只校验 `SKILL.md`，没有覆盖 `scripts` / `references` / `assets` 等资源漂移 | R20 |
| I08 | P2 | Tool 能力目录和真实 app-server 工具池不同源 | R19 |
| I09 | P2 | App provider 类型支持 `authStatus`、`parentPluginId`、`providedToolIds` 等字段，但 app-server schema 不接 | R23 |
| I10 | P2 | 缺失父 Plugin 被当成 `plugin-disabled`，会错误隐藏子能力 | R17 / R23 |
| I11 | P2 | Skill 管理目录 ID 和上下文 discovery ID 不是同一种格式 | R17 / R22 |
| I12 | P2 | Skill `configHomeDir` 只传给安装检查，runtime catalog 仍读全局 home | R21 |
| I13 | P2 | DiscoverSkills 提示说会过滤已可见 / 已加载 Skill，但实现没有返回前过滤 | R22 |
| I14 | P2 | Skill 动态发现仍受 `EXPERIMENTAL_SKILL_SEARCH` 默认关闭和 `USER_TYPE === 'ant'` 限制，但设计讨论已把它当稳定入口 | R22 |
| I15 | P3 | 安装检查和运行时检查重复，missing / drifted / disabled / invalid 容易再次漂移 | R20 / R24 |
| I16 | P3 | MCP server 没有 runtime client 时被标成 enabled / available，语义上更像“配置存在”而非“运行时可用” | R18 |
| I17 | P3 | 管理动作确认 token 偏静态，后续开放更多外部调用时容易被过期确认复用 | R24 |

## 4. 子 Goal

- [R17 统一能力模型与 ID 契约](#r17-统一能力模型与-id-契约)
- [R18 MCP 管理动作边界收口](#r18-mcp-管理动作边界收口)
- [R19 Tool 能力目录接真实工具池](#r19-tool-能力目录接真实工具池)
- [R20 Skill 安装事务与 repair 收口](#r20-skill-安装事务与-repair-收口)
- [R21 Skill 运行时目录同源](#r21-skill-运行时目录同源)
- [R22 Skill 上下文注入与动态发现收口](#r22-skill-上下文注入与动态发现收口)
- [R23 App / Plugin 外部扩展关系契约](#r23-app--plugin-外部扩展关系契约)
- [R24 测试、文档与发布闸门](#r24-测试文档与发布闸门)

## R17 统一能力模型与 ID 契约

### 目标

把 Capability identity、source、relations、state 和 ownership 的基础语义定死，避免管理页、discovery、listing、日志各自生成不同 ID 或状态。

### 对应问题

- I10：缺失父 Plugin 被误判为 disabled。
- I11：Skill 管理目录 ID 和 discovery ID 不一致。
- `installed`、`configured`、`enabled`、`available`、`runtimeVisible` 混用。
- App / Plugin / Skill / MCP 的 `source`、`relations`、`ownership` 口径不统一。

### 范围

- 抽出统一 `CapabilityIdentity` / `CapabilitySource` / `CapabilityState` 契约。
- 抽出 `createCapabilityId(...)`，Skill / MCP / Tool / App / Plugin 全部通过它生成 ID。
- 明确 `parent-plugin-missing` 和 `plugin-disabled` 是两种状态。
- 统一 `source.kind`、`relations`、`managementOwnership` 的推导规则。

### 非目标

- 不改变具体 Skill / MCP / Tool 的执行方式。
- 不重写 Desktop 页面。
- 不新增 Plugin 安装器。

### 验收

- 同一个 Skill 在管理目录、静态 listing、动态 discovery 里 ID 一致。
- 缺失父 Plugin 不会被误判成禁用，只产生诊断。
- 同名不同来源能力仍可稳定区分。
- 新增 smoke 覆盖 canonical ID 和 parent missing 语义。

### 完成记录（2026-06-07）

- 新增 `capabilityIdentity.ts`，提供 `createCapabilityId()` 和 `createSkillCapabilityId()`。
- `skillCapabilityProvider` 与 `skillCommandRuntimeVisibility` 已改为使用同一个 Skill capability ID 生成器。
- Capability Catalog 对缺失父 Plugin 不再添加 `plugin-disabled`，改为保留能力当前可见性并追加 `parent-plugin-missing` 诊断。
- `smoke:extension-runtime-visibility` 已覆盖 canonical Skill ID 和 parent plugin missing 语义。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:extension-runtime-visibility`
- `npm.cmd run smoke:skill-discover-tool`

## R18 MCP 管理动作边界收口

### 目标

修掉 MCP 侧 P1：运行时或插件来源的 MCP 不能被管理页当成本地安装配置随意启停、修复或卸载。

### 对应问题

- I03：runtime-only / plugin-owned MCP 仍能拿到会写配置的管理动作。
- I04：runtime MCP server 被标成 `installed: true`。
- I16：无 runtime client 时的 enabled / available 语义不清。

### 范围

- MCP server 拆出 `configured` 与 `runtimeConnected`。
- MCP action matrix 按 ownership 收口：
  - `runtime-only`：只允许 inspect / runtime diagnostics。
  - `plugin-owned`：默认只 inspect，生命周期交给 Plugin 或宿主。
  - `manual-config`：允许 enable / disable / test / restart，但不允许 repair / uninstall。
  - `installer-owned`：允许 repair / uninstall。
- app-server apply 阶段重新校验 ownership，不能只信前端传来的 action。

### 非目标

- 不重写 MCP client。
- 不改变 MCP tool 命名规则。
- 不实现 Plugin MCP 的完整生命周期。

### 验收

- runtime-only MCP 不出现 repair / uninstall，也不能 enable / disable 写配置。
- plugin-owned MCP 不被管理页直接改本地 MCP 配置。
- manual-config 与 installer-owned 的按钮、plan、apply 行为符合 action matrix。
- smoke 覆盖 action matrix 和非法动作拒绝。

### 完成记录（2026-06-07）

- `ExtensionCapabilityState` 增加 `configured` 与 `runtimeConnected`，MCP server 能区分配置事实和运行时连接事实。
- runtime-only MCP server 不再被标记为 `installed: true`，管理归属为 `runtime-only`。
- `managementProjectionService` 的 MCP action matrix 已按 ownership 收口：runtime-only / plugin-owned 只允许 `inspect`，manual-config / installer-owned 才允许启停、检测和重启，只有 installer-owned 允许 repair / uninstall。
- MCP server 没有 runtime client 时不再被标成 available，而是 `unavailable` 并给出 runtime snapshot 诊断。
- smoke 已覆盖 runtime-only、plugin-owned、manual-config 的 allowed actions 和非法动作 plan 拒绝。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-projection`
- `npm.cmd run smoke:capability-management-mcp-runtime`
- `npm.cmd run smoke:capability-management-actions`

## R19 Tool 能力目录接真实工具池

### 目标

让“能力目录里看到的 Tool”和“模型实际可用 Tool”同源。

### 对应问题

- I08：Tool 能力目录用静态 `getAllBaseTools()` 加 MCP tools，真实对话入口使用 app-server 平台默认工具、权限过滤和最终工具池。

### 范围

- 抽出 app-server tool pool builder，目录和 turn runner 共用。
- Tool provider 不再默认自己猜工具池；真实路径必须传入已解析工具池。
- 测试 fixture provider 与真实 provider 隔离。

### 非目标

- 不改变模型工具调用协议。
- 不把 Skill 放进 ToolSearch。
- 不重写 Tool Registry。

### 验收

- app-server 能力目录中的工具集合和 turn runner 实际工具集合一致。
- 平台默认工具、MCP 工具、权限过滤都能被 smoke 验证。
- ToolSearch、Tool Registry、Capability Catalog 对同一工具的来源和可用性一致。

### 完成记录（2026-06-07）

- 新增 `buildAppServerToolPool()`，统一封装 `assembleToolPool()` 与 `filterAppServerPlatformTools()`。
- app-server turn runner 和 `capabilityCore` 已共用 `buildAppServerToolPool()`，工具目录不再绕过平台默认、MCP 状态和可用性过滤。
- `ToolCapabilityProvider` 不再在缺少显式工具池时回退到 `getAllBaseTools()`；真实路径必须由调用方传入已解析 tool pool，测试 fixture 也显式传入。
- `capabilityCore` 会把 `runtime: app-server`、`activeAgentCount`、`connectedMcpServerNames`、`mcpServerStatuses` 和已解析 `tools` 一起传给能力目录 provider。
- 新增 smoke 对齐 app-server tool pool 与 capability catalog 中的 `tool` / `mcp-tool` 能力集合，并覆盖 connected / needs-auth MCP tool、Windows Bash/PowerShell 平台默认过滤。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:app-server-tool-pool-capability-alignment`
- `npm.cmd run smoke:tool-registry`
- `npm.cmd run smoke:capability-catalog-mcp-tool-provider`

## R20 Skill 安装事务与 repair 收口

### 目标

修掉 Skill 安装和 repair 的高风险行为，避免修复失败破坏用户已安装 Skill。

### 对应问题

- I01：`force` planner / apply 语义不一致。
- I02：repair 先删现有包再构建候选。
- I07：lock 只校验 `SKILL.md`，资源漂移检测不完整。
- I15：安装检查和运行时检查重复，后续容易语义漂移。

### 范围

- 引入 `InstallTransaction`：
  - 先构建候选到临时目录。
  - 校验 manifest / safety / package tree。
  - 通过后再原子替换 installer-owned 目录。
- `force` 的 planner / apply 语义对齐。
- lock 扩展到 `SKILL.md + scripts + references + assets`。
- repair 不允许先删后建，必须先准备候选再替换。
- 把 missing / drifted / disabled / invalid 等检查收敛成共享 inspection value object。

### 非目标

- 不改变 Skill 标准格式。
- 不引入远端 registry。
- 不重写所有 Skill 管理 UI。

### 验收

- force 安装能成功覆盖合法 owner 目录。
- repair 失败不会破坏现有可用 Skill。
- 修改 scripts / assets 能被 drift 检测出来。
- install inspector 和 runtime loader 对同一缺陷给出同一类诊断。

### 完成记录（2026-06-07）

- 当前实现已包含 `installTransaction.ts`，安装 apply 会先复制到 staging，再校验 installer-owned 目录并用 backup/rename 替换。
- `force` 计划和 apply 已对齐：合法 owner 目录可覆盖，非 owner 目录即使 force 也会拒绝。
- repair 已改为先从 manifest 构建候选、重新做 live load / security scan / packageTree hash，再通过 install transaction 替换；源路径缺失时不会删除或破坏现有 package。
- lock 已记录 `packageTree`，installed inspection 会检测 `SKILL.md` 与 package tree 漂移。

验证：

- `npm.cmd run smoke:skill-install-reliability`
- `npm.cmd run smoke:skill-package-tree-integrity`
- `npm.cmd run smoke:skill-install-inspector`
- `npm.cmd run smoke:skill-management-service`

## R21 Skill 运行时目录同源

### 目标

让 Skill 管理页和上下文注入读同一个 cwd / configHome / session 视图。

### 对应问题

- I05：Skill 管理页偏安装记录，不是完整运行时 Skill 能力目录。
- I06：runtime diagnostics 可能 stale 或串 cwd。
- I12：`configHomeDir` 只传给安装检查，runtime catalog 读全局 home。

### 范围

- `getSkillRuntimeCatalogForCwd` 增加 `configHomeDir` 或等价 request context。
- Skill runtime catalog 每次按当前 request / cwd / configHome 计算。
- diagnostics 从当前 catalog 生成，不复用全局上一轮快照。
- 管理页列出 user / managed / project / plugin / bundled / dynamic / MCP Skill，并显示来源。

### 非目标

- 不改变 SkillTool 展开 SKILL.md 的协议。
- 不改变 Skill 搜索排序。
- 不重写安装事务；安装事务由 R20 处理。

### 验收

- 指定 configHome 时，管理页和上下文 Skill 一致。
- 切换 cwd 后 diagnostics 不串。
- installed index 缺失不影响 runtime 能力目录展示。
- user / managed / project / plugin / bundled / dynamic / MCP Skill 都能进入统一视图。

### 完成记录（2026-06-07）

- `getSkillRuntimeCatalogForCwd()` 增加 `configHomeDir` 参数，并向下传给 `getSkills()` / `getSkillDirCommands()`。
- `getSkillDirCommands()` 的 memoize key 已包含 `configHomeDir`。
- installed managed Skill loader 已改为按传入 `configHomeDir` 调用 `loadInstalledSkillRuntimePackages()`。
- Skill management capability catalog 和 Skill capability provider 已统一传递当前 request 的 `cwd/configHomeDir`。
- 修复 `parseCcrSkillInstalledIndex()` / `parseCcrSkillLockIndex()` 默认对象复用问题，避免不同 configHome 的空 index 共享同一个可变 record map。
- `smoke:capability-catalog-skill-provider` 已覆盖双 configHome 隔离：查询 B home 时不会带出 A home 的 Skill。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-catalog-skill-provider`
- `npm.cmd run smoke:skill-capability-catalog`
- `npm.cmd run smoke:desktop-skill-management-projection`
- `npm.cmd run smoke:skill-install-schema`

## R22 Skill 上下文注入与动态发现收口

### 目标

把 Skill 到模型上下文的路径讲清楚、做准确，并统一静态 listing、动态 discovery、SkillTool 的边界。

### 对应问题

- I11：discovery ID 与管理目录 ID 不一致。
- I13：DiscoverSkills 提示说会过滤，实际没有过滤。
- I14：Skill 搜索仍是实验开关和 ant-only 口径。
- 用户看到 Skill 已安装，但模型上下文里不一定能看到或唤醒。

### 范围

- 明确两条上下文路径：
  - 静态首轮 listing：适合少量高置信 Skill。
  - 动态 discovery：按当前任务召回 Skill。
- discovery 返回前过滤已 visible / 已 loaded / 已 discovered 的 Skill。
- feature gate 做产品决策：正式启用并文档化，或 UI / 文档不把它当稳定能力。
- 静态 listing 和动态 discovery 共用同一个 runtime catalog 与 canonical ID。

### 非目标

- 不引入 embedding 或 LLM rerank。
- 不把 Skill 变成 tool schema。
- 不绕过 SkillTool 的最终调用校验。

### 验收

- 模型不会重复看到同一个 Skill。
- feature off 时不会出现 discovery 提示。
- 用户安装的 Skill 能解释清楚为什么进或不进上下文。
- DiscoverSkills 返回的 capability ID 可以在管理目录定位同一个能力。

### 完成记录（2026-06-07）

- `EXPERIMENTAL_SKILL_SEARCH` 已默认启用，`isSkillSearchFeatureEnabled()` 不再限制 `USER_TYPE === 'ant'`；仍可通过 `CC_REFORGED_DISABLE_FEATURES=EXPERIMENTAL_SKILL_SEARCH` 关闭。
- `DiscoverSkillsTool` 与自动 `skill_discovery` 统一通过 runtime discovery catalog 返回 canonical Skill capability ID。
- discovery 任务查询返回前会过滤 `visibleSkillNames` / `loadedSkillNames` / `discoveredSkillNames` 及对应 capability ID；catalog 查询保留完整清单语义。
- `skill_listing` 注入时会记录 transcript-visible Skill 名称，供后续 discovery 过滤使用。
- 自动 turn-zero discovery 对普通任务只提醒最相关的一个 Skill，避免弱相关结果污染后续动态发现；显式 `DiscoverSkills` 仍按 `max_results` 返回多个候选。
- 中文检索去掉单字 token 匹配，保留整段和二字词匹配，避免 `排查` / `检查` 这类单字重合造成误召回。
- 拆掉 feature 默认开启后暴露的顶层循环依赖：`DiscoverSkillsTool -> prefetch`、`prefetch -> commands`、`commands -> localSearch` 均改为按需加载。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:skill-discover-tool`
- `npm.cmd run smoke:skill-turn-zero-discovery`
- `npm.cmd run smoke:skill-inter-turn-discovery`
- `npm.cmd run smoke:extension-context-injection-planner`
- `npm.cmd run smoke:skill-search-feature-gate`

## R23 App / Plugin 外部扩展关系契约

### 目标

让外部扩展能按统一能力目录上报关系，不被协议层挡掉，并稳定表达 Plugin 作为能力合集的父子关系。

### 对应问题

- I09：App provider 支持字段和 app-server schema 不一致。
- I10：缺失父 Plugin 和父 Plugin 禁用没有区分。
- Plugin 作为能力合集的关系还没稳定表达。

### 范围

- app-server `CapabilitiesListParamsSchema.apps` 补齐 provider 字段。
- Plugin provider 输出自己的 capability，App / MCP / Skill / Tool 子能力用 `parentPluginId` 关联。
- 聚合层只在父 Plugin 明确 disabled / unavailable 时隐藏子能力。
- missing parent 作为 diagnostic，不作为 disabled。

### 非目标

- 不实现完整 OAuth。
- 不实现 Plugin marketplace。
- 不把 App / Connector 直接当 Tool 暴露给模型。

### 验收

- 外部 app connector 可以上报 auth 状态和提供的能力关系。
- Plugin 禁用时子能力隐藏；Plugin 未加载时不误判禁用。
- smoke 覆盖 app schema、plugin relation、missing parent。

### 完成记录（2026-06-07）

- `CapabilitiesListParamsSchema.apps` 已补齐 `authStatus`、`parentPluginId`、`providedToolIds`、`providedMcpServerNames`、`providedSkillIds`。
- `AppCapabilityProvider` 已能通过 app-server 参数接收外部 connector 的认证状态、父 Plugin 关系和其提供的 Tool / MCP / Skill 能力引用。
- Plugin provider 继续输出 Plugin 自身 capability，子能力通过 `parentPluginId` 关联；缺失父 Plugin 已由 R17 作为 diagnostic 处理，不再误判为禁用。
- `smoke-capability-catalog-plugin-relations` 增加 app schema + app capability relation 覆盖。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-catalog-plugin-relations`
- `npm.cmd run smoke:capability-catalog-core`

## R24 测试、文档与发布闸门

### 目标

把 R17-R23 的边界变成可验证门禁，不再靠口头约定。

### 对应问题

- I15：检查逻辑重复，需要防止后续再次漂移。
- I17：管理动作确认 token 后续需要更强的状态绑定。
- 上述所有边界目前 smoke 覆盖不足。

### 范围

新增或补齐 smoke：

- MCP action matrix。
- Skill canonical ID。
- Skill configHome 同源。
- Tool catalog 等于真实 tool pool。
- Plugin parent missing / disabled 区分。
- DiscoverSkills 去重过滤。
- Skill install transaction failure 不破坏现有包。
- packageTree drift 检测。

同步文档：

- 总架构文档更新能力流。
- Skill 专题文档补“安装目录”和“上下文能力”区别。
- MCP 专题文档补 configured / runtime / action ownership。
- Plugin 文档补“插件是能力合集，不等于单个工具”。
- CHANGELOG 只记录已完成项，不放模板占位。

### 非目标

- 不用 smoke 代替必要的手工 Desktop 验收。
- 不要求一次覆盖所有外部真实服务。
- 不在本阶段继续扩大功能范围。

### 验收

- release smoke group 包含 R17-R23 的关键门禁。
- `git diff --check` 通过。
- 总架构、roadmap、goal README 和专题文档状态一致。
- 后续发布前能通过一条固定 release gate 证明能力目录、上下文和管理动作没有回归。

### 完成记录（2026-06-07）

- `smoke:skill-release` 和 `smoke:skill-internal-refactor` 已补入 R17-R23 关键门禁：
  - Skill 安装事务、packageTree drift、Capability Catalog、configHome 同源。
  - Skill discovery 去重、feature gate、runtime visibility。
  - app-server tool pool 与 Capability Catalog 对齐。
  - App / Plugin 外部关系 schema 与 parent relation。
  - MCP runtime-only / plugin-owned 管理动作边界。
- 补齐 `smoke-capability-management-actions` 的测试凭据隔离，避免依赖本机真实 Anthropic / OAuth 登录状态。
- `smoke-capability-management-mcp-runtime` 已按 R19 后的新语义更新：disabled MCP server 保留管理投影，disabled MCP tool 不进入最终 app-server tool pool。
- 文档已同步：
  - `CHANGELOG.md`
  - `docs/goals/README.md`
  - `docs/architecture/extension-capability-system.md`
  - `docs/architecture/extension-runtime-context-refactor-roadmap.md`
  - `docs/architecture/skill-system-architecture.md`
  - `docs/architecture/tool-registry-catalog.md`
  - `docs/mcp/README.md`

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `git diff --check`
- `npm.cmd run smoke:skill-internal-refactor`

## 5. 推荐执行顺序

按下面顺序推进：

```text
R17 -> R18 -> R20 -> R21 -> R22 -> R19 -> R23 -> R24
```

原因：

- R17 先定模型和 ID，否则后续继续补丁式修。
- R18 立刻修 MCP P1，避免错误动作写配置。
- R20 修 Skill 安装 / repair，避免破坏用户已安装包。
- R21 / R22 再收 Skill 运行时目录和上下文注入。
- R19 把 Tool 目录接真实工具池。
- R23 接外部 App / Plugin 关系。
- R24 最后补 smoke、文档和 release gate。

## 6. 总体验收

R17-R24 完成时：

- 同一个能力在管理目录、上下文注入、discovery、日志中使用同一 canonical ID。
- runtime-only / plugin-owned / manual-config / installer-owned 的管理动作边界清晰。
- Skill 管理页和模型上下文来自同一个 runtime catalog 视图。
- Tool 能力目录和真实模型工具池同源。
- App / Plugin 外部扩展关系可以通过协议表达。
- 两轮审查列出的 P1 / P2 / P3 问题都有代码修复或显式后续记录。

建议验证：

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:capability-management-mcp-runtime`
- `npm.cmd run smoke:skill-discover-tool`
- `npm.cmd run smoke:extension-capability-management-e2e`
- `npm.cmd run smoke:desktop-release-gate`
- `git diff --check`

## 7. 文档收口要求

每个子 goal 完成后必须同步更新：

- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)
- [CCR 扩展能力运行时与上下文重构路线](../architecture/extension-runtime-context-refactor-roadmap.md)
- [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md)
- [MCP 文档入口](../mcp/README.md)
- [Skill 文档入口](../skills/README.md)
- 本文对应子 goal 的完成记录

如果实现范围改变，必须先更新本文的问题映射或拆新 goal，不要把未完成项写进 CHANGELOG 已发布内容。

## 8. 完成后复审新增后续

R17-R24 完成后复审发现 3 个剩余缺口，已拆入新的后续 goal series：

- [R25-R27 上下文同源、发现去重与确认令牌收口](./2026-06-07-extension-runtime-r25-r27-context-discovery-confirmation-closeout-series.md)

对应关系：

- R25：补齐 Skill request-scoped `configHomeDir` 到 `skill_listing`、`skill_discovery` 和 SkillTool。
- R26：补齐 visible / discovered / loaded 的 canonical capability id ledger，降低 name-only 误过滤风险。
- R27：补齐能力管理动作确认 token 的状态摘要、过期和 nonce 约束。
