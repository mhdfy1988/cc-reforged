# Goal Series：R9-R12 能力目录一致性修复

## 1. 背景

R0-R8 已经把 Skill、MCP、Plugin、Tool、Command 的主链路拆成能力事实、运行时可见性、上下文注入、动态发现、调用适配和管理投影几个层次。但审核后仍发现几处一致性缺口：

- MCP runtime 子能力已经能进入部分模型上下文和发现链路，但 `capabilities/list` / `capabilities/management/list` 还没有稳定消费真实 MCP runtime snapshot。
- MCP Skill 被 MCP Prompt provider 排除，但 Skill provider 还没有完整接管 `loadedFrom === "mcp"` 的 MCP Skill。
- Skill runtime catalog 仍可能用 `name` 把 installed inspection 和 command 关联，同名能力会误挂 `installedRef`。
- `getSlashCommandToolSkills()` 仍保留旧过滤语义，SDK/system-init、REPL bridge 和 SkillTool 统计可能与 SkillTool runtime 候选不一致。
- Desktop Skill 页仍以安装记录为主，runtime-only / plugin-owned / mcp-owned Skill 不能稳定成为详情页主对象。

## 2. 总目标

修复 R0-R8 审核发现的一致性缺口，让 Capability Catalog 成为“看见、来源、归属、状态、诊断”的统一事实层；Skill、MCP、Tool、Plugin 的执行入口继续保持分离。

一句话口径：

```text
统一能力目录负责看见和解释，不负责替代 SkillTool、MCP runtime、Tool registry 或 Plugin lifecycle。
```

## 3. 不变式

- Capability Catalog 只统一能力事实，不统一执行模型。
- Skill 是工作流知识和上下文材料，不等同于 MCP Tool 或 builtin Tool。
- MCP Prompt 不自动变成 Skill；MCP Skill 必须由 `loadedFrom === "mcp"` 和 MCP Skill 资源适配明确标识。
- 安装事实必须用稳定安装身份关联，不能用 `name` 猜测。
- 管理页只消费管理投影，不在 Renderer 重新推导 runtime visibility。
- 旧过滤逻辑必须删除或显式隔离，不能 silent fallback 到旧路径。

## 4. 子 Goal

- [R9 MCP runtime 子能力接入 Capability Catalog](#r9-mcp-runtime-子能力接入-capability-catalog)
- [R10 Skill installedRef 精确身份关联](#r10-skill-installedref-精确身份关联)
- [R11 slash Skill 入口收口](#r11-slash-skill-入口收口)
- [R12 Desktop Skill 管理页改用管理投影](#r12-desktop-skill-管理页改用管理投影)

## R9 MCP runtime 子能力接入 Capability Catalog

### 目标

让统一能力目录能从当前 MCP runtime snapshot 看见 MCP Server、MCP Tool、MCP Resource、MCP Prompt 和 MCP Skill，并把 server 禁用、连接失败、协议失败等状态传播到 child capability。

### 范围

- 从 `coreQueryTurnRunner` 中抽出可复用的 MCP runtime snapshot 读取入口。
- Capability Catalog 内部消费 MCP runtime snapshot，不通过 JSON-RPC `Command[]` 反查 MCP 子能力。
- Skill provider 接收 MCP Skill command 或 MCP Skill resource 适配结果，把 `loadedFrom === "mcp"` 的 Skill 归入 `kind: "skill"`。
- MCP provider 继续负责 server / resource / prompt；MCP Tool 复用 Tool provider 的 `mcp-tool` 分支，但事实来源必须是同一份 MCP runtime snapshot；普通 MCP Prompt 不进入 Skill 列表。
- `capabilities/list` 和 `capabilities/management/list` 消费同一份 runtime 子能力事实。

### 验收

- MCP snapshot 中存在 Tool / Resource / Prompt / Skill 时，`capabilities/management/list` 都能返回对应 child capability。
- 禁用 MCP server 后，child capability 带有明确 hidden reason，不伪装成已卸载。
- 普通 MCP Prompt 不会出现在 SkillTool / Skill 管理列表。
- 新增或更新 smoke 覆盖 MCP runtime 子能力管理投影。

### 完成记录（2026-06-06）

- 已从 `coreQueryTurnRunner` 抽出 `loadCcrMcpRuntimeSnapshot()`，对话运行时和 capability core 共享同一份 MCP runtime snapshot 读取入口。
- `capabilityCore` 已把 MCP runtime snapshot 显式转换成 Capability provider context，并把 MCP server runtime status、connected server 列表、MCP commands/resources/tools 一起传入目录构建。
- `McpCapabilityProvider` 已把 runtime client 状态并入 MCP server capability，支持 connected / failed / needs-auth / pending / disabled 状态进入父级可见性传播。
- `ToolCapabilityProvider` 已通过 capability core 传入的 MCP tools/statuses 投影 `mcp-tool`，继续复用现有工具可用性判断，不重复造 MCP Tool 映射。
- `SkillCapabilityProvider` 已接收 snapshot 中 `loadedFrom === "mcp"` 的 MCP Skill command；普通 MCP Prompt 仍只进入 `mcp-prompt`，不会进入 Skill 列表。
- 新增 `smoke:capability-management-mcp-runtime`，覆盖 MCP Tool / Resource / Prompt / Skill 进入管理投影、禁用 server 子能力 hidden reason、普通 MCP Prompt 不进入 Skill 管理列表。

验证命令：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:capability-management-mcp-runtime
npm.cmd run smoke:capability-catalog-mcp-tool-provider
npm.cmd run smoke:capability-management-projection
npm.cmd run smoke:mcp-skill-resource-adapter
npm.cmd run smoke:capability-api
```

## R10 Skill installedRef 精确身份关联

### 目标

消除用 `name` 关联安装事实和运行时 command 的误判，让 installed Skill 与 runtime Skill 通过稳定安装身份或 lock identity 精确关联。

### 范围

- 在 Skill command / runtime capability input 中补充 `installedSkillRef` 或等价稳定安装身份。
- managed Skill adapter 从 installed record / lock / owner marker 写入稳定身份。
- runtime catalog 只在身份匹配时挂 installed inspection；同名但不同来源的 Skill 不互相继承安装诊断。
- installed-only 记录仍作为安装包能力展示，但不伪造 runtime command。

### 验收

- 同名 managed Skill、user Skill、plugin Skill 同时存在时，只有真实安装包对应项带 installed inspection。
- installed-only 缺包 / drifted / missing 记录仍能在管理页看到，并显示为需要修复或不可用。
- Skill listing / discovery 不因为同名 installed record 误隐藏可用 runtime Skill。

### 完成记录（2026-06-06）

- 已在 `CommandBase` 增加 `installedSkillRef`，managed Skill runtime adapter 从安装 inspection 的 `lockKey` 写入稳定安装身份。
- `createSkillRuntimeCapabilityCatalog()` 已从按 `name` 匹配 installed inspection 改为按 `installedSkillRef -> lockKey` 精确匹配；user / plugin / dynamic / mcp Skill 不会因为同名 installed record 误挂 `installedRef`。
- duplicate runtime visibility 已从 `keptNames` 改为按 command 对象判断，避免同名 loser 被误判为 runtime visible。
- installed-only 记录只在没有对应 runtime command 挂载同一 `lockKey` 时生成；缺包、漂移、缺 lock 等安装包仍作为 installed-only 能力展示。
- `smoke:skill-capability-catalog` 已新增同名 user + installed-only、managed runtime、同名 managed loser 的身份关联回归。
- 修正 `smoke:skill-runtime-catalog` npm 脚本，给 dist 别名解析补上 `bun-bundle-loader`，避免验证入口在 Node 24 下失败。

验证命令：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:capability-catalog-skill-provider
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-static-listing-filter
```

## R11 slash Skill 入口收口

### 目标

把 slash command、SDK/system-init、REPL bridge、SkillTool 统计和模型可调用候选收敛到同一组运行时可见性判断。

### 范围

- 删除或显式隔离 `getSlashCommandToolSkills()` 内部旧过滤逻辑。
- 抽出 `listUserInvocableSkillCommands()` 或等价 adapter，条件应以 `prompt command + adapterKind + userInvocable + runtimeVisible` 为准。
- 模型候选继续以 `modelInvocable + runtimeVisible` 为准，不能拿用户可调用入口替代。
- SDK/system-init、REPL bridge 和 SkillTool 统计复用统一 adapter。
- 低层函数不吞空结果；需要兼容空列表的调用方在边界层显式处理。

### 验收

- `modelInvocable=false` 的 Skill 不进入模型候选，但仍可在用户可调用入口按策略显示。
- `userInvocable=false` 的 Skill 不出现在 slash command 列表，但不影响模型候选判断。
- system-init、REPL bridge、SkillTool 统计和实际 SkillTool validate 对同一 fixture 给出一致结果。

### 完成记录（2026-06-06）

- 已新增 `isUserInvocableSkillCommandCandidate()` 和 `listUserInvocableSkillCommands()`，用户可调用 Skill 入口统一使用 `prompt command + adapterKind + enabled + runtimeVisible + userInvocable` 判断。
- `getSlashCommandToolSkills()` 已删除旧的 `hasUserSpecifiedDescription / whenToUse / loadedFrom / disableModelInvocation` 组合过滤，改为复用 runtime catalog 和用户可调用 adapter。
- SkillTool 模型候选继续使用 `isSkillToolCommandCandidate()`，保持 `modelInvocable + runtimeVisible` 语义；用户入口和模型入口不再互相替代。
- REPL bridge 的 system/init skills、SkillTool info / analyzeContext 统计继续通过 `getSlashCommandToolSkills()` / `getSkillToolCommands()` 消费统一入口。
- 新增 `smoke:skill-slash-entry`，用真实 installed managed Skill 验证 `modelInvocable=false` 仍可出现在 slash skills，`userInvocable=false` 仍可出现在 SkillTool 模型候选。

验证命令：

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:skill-slash-entry
npm.cmd run smoke:skill-command-adapter-boundaries
npm.cmd run smoke:skill-static-listing-filter
npm.cmd run smoke:skill-discover-tool
```

## R12 Desktop Skill 管理页改用管理投影

### 目标

让 Desktop Skill 页从“安装记录列表”切换为“Skill capability 管理投影”，能展示 runtime-only、plugin-owned、mcp-owned 和 installed-only Skill，并根据管理归属给出允许动作。

### 范围

- Skill 列表主数据来自 `management.skills` 或等价 typed projection。
- 当前选中项使用 stable `capabilityId`，不再用安装记录 name 作为唯一主键。
- installed inspection 作为 enrichment 展示，不再决定列表是否存在。
- 操作按钮来自 `allowedActions` / `actionRef`，Renderer 不自行判断是否能修复、卸载、启用或禁用。
- runtime-only / plugin-owned / mcp-owned Skill 可只读展示；不可操作原因必须可解释。

### 验收

- managed installed Skill、user Skill、plugin Skill、MCP Skill、dynamic Skill 能在 Skill 页按来源展示。
- installed-only 缺包记录能展示为需要修复，不会把同名 runtime Skill 判成缺包。
- runtime-only Skill 不出现伪造修复或卸载操作。
- 页面展示的启用、模型可调用、用户可调用状态与 runtime visibility 诊断一致。

### 完成记录（2026-06-06）

- 已新增 `skillManagementViewProjection`，Desktop Skill 页的主 view item 从 `management.skills` 生成，选中项使用 `capabilityId`，installed inspection 只通过 `installedRef/actionRef` 做详情 enrichment。
- `SkillsPage` 左侧列表已统一渲染 managed installed、user、plugin、MCP、dynamic、installed-only Skill；列表启用开关、详情修复/卸载按钮和调用开关都读取 `allowedActions` / `actionRef`。
- runtime-only / plugin-owned / mcp-owned Skill 只显示来源、归属、运行时可见性和诊断，不再出现伪造 repair / uninstall 操作。
- Renderer 的 Skill install / import / enable / invocation / repair / uninstall 写操作后已同步刷新 `capabilityManagement`，避免页面主读模型停留在旧投影。
- 新增 `smoke:desktop-skill-management-projection`，覆盖同名 managed/user Skill 不误挂 installed inspection、installed-only 缺包可修复、runtime-only 无 fake 写操作、动态 Skill hidden reason 展示事实。

验证命令：

```text
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-skill-management-projection
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:capability-management-projection
npm.cmd run smoke:capability-management-mcp-runtime
```

## 5. 推荐执行顺序

按下面顺序执行，不建议跳步：

```text
R9 先把 MCP runtime 子能力补进统一目录
R10 再修 installedRef 身份关联，避免目录里混淆同名 Skill
R11 再收口 slash / SDK / REPL / SkillTool 入口
R12 最后让 Desktop Skill 页消费新的管理投影
```

原因：

- R9 先补事实来源，否则管理投影没有完整输入。
- R10 先保证 identity 正确，否则 UI 和入口收口都会继承误关联。
- R11 处理调用入口，避免 R12 展示后用户看到的状态和实际入口不一致。
- R12 最后改 UI，避免 Renderer 又重新补业务判断。

## 6. 总体验收

R9-R12 完成时：

- `capabilities/list` 和 `capabilities/management/list` 能解释 Skill / MCP / Plugin / Tool 的来源、归属、状态和诊断。
- Skill listing、Skill discovery、SkillTool、slash command、SDK/system-init 和 REPL bridge 不再各自维护旧过滤逻辑。
- MCP Skill、MCP Prompt、MCP Tool、MCP Resource 在目录和模型入口上语义分离。
- Desktop Skill 页不再只列安装记录，而是列 Skill capability；统一写操作入口在 R13 继续收口。
- 旧兼容入口要么变成薄 adapter，要么显式命名为 legacy，且有测试覆盖。

R9-R12 之后继续执行 [R13-R16 能力管理动作、连接器与工具搜索闭环](./2026-06-06-extension-runtime-r13-r16-management-action-connector-toolsearch-closeout-series.md)，补齐动作执行、App / Connector、ToolSearch 对齐和端到端 release gate。

建议验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-api`
- `npm.cmd run smoke:capability-catalog-core`
- `npm.cmd run smoke:capability-management-mcp-runtime`
- `npm.cmd run smoke:skill-runtime-identity`
- `npm.cmd run smoke:skill-slash-entry`
- `npm.cmd run smoke:desktop-skill-management-projection`
- `git diff --check`

## 7. 文档收口

每个子 goal 完成后必须同步更新：

- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)：更新“已接入 / 待收口”口径。
- [CCR 扩展能力运行时与上下文重构路线](../architecture/extension-runtime-context-refactor-roadmap.md)：标记对应 R 阶段状态。
- [扩展能力运行时与上下文源码证据索引](../references/extension-runtime-context-source-evidence.md)：补充新的入口、adapter 和 smoke 证据。
- 本文：在对应子 goal 下补完成记录和验证命令。
