# Goal Series：R13-R16 能力管理动作、连接器与工具搜索闭环

## 1. 背景

R9-R12 负责修复 R0-R8 审核后发现的读侧一致性缺口：MCP runtime 子能力、Skill installedRef、slash Skill 入口和 Desktop Skill 管理页读模型。

这还不能算扩展能力体系完全收口。审核后仍有四类后续缺口：

- 管理投影已经声明 `allowedActions` / `actionRef`，但执行动作仍由 Desktop 页面直连 Skill / MCP 专用 IPC。
- App / Connector 已有 provider shape，但真实来源、鉴权状态和 Plugin 关系还没有稳定接入；如果没有真实来源，就不能写成当前可用能力。
- Tool Registry / ToolSearch 已有成熟链路，但 Capability Catalog 不一定消费当前 turn 的最终工具池和同一套暴露策略。
- 现有 smoke 多为局部 fixture，缺少从 workspace / configHome / runtime snapshot 到 App Server、Desktop 管理投影和上下文注入的端到端门禁。

## 2. 总目标

在 R9-R12 的读侧一致性完成后，继续把能力管理动作、App / Connector 来源、ToolSearch 工具暴露策略和端到端验证收成明确闭环。

一句话口径：

```text
Capability Catalog 负责统一看见；R13-R16 负责把“能不能操作、从哪里连接、如何暴露工具、怎样证明一致”补成可验收契约。
```

## 3. 不变式

- Skill 仍然是指令包和工作流知识，不变成 MCP Tool。
- MCP Tool 仍然是模型工具协议入口，不变成 Skill。
- Plugin 仍然是能力合集，只表达来源、归属和影响面，不吞并 child capability 的执行模型。
- Capability Catalog 仍是只读事实层；写操作必须走显式 action plan / apply 或领域 runtime，不允许 Renderer 私下推导归属后直接执行危险动作。
- App / Connector 未接入真实来源前，只能写成设计预留或 synthetic provider input，不能进入用户可用能力列表。
- ToolSearch、Tool Registry、Capability Catalog 对同一个工具的来源、可用性和暴露策略必须来自同一份快照或同一套策略对象。
- 旧入口可以保留为薄 adapter，但不能 silent fallback 到旧判断。

## 4. 子 Goal

- [R13 统一管理动作契约与执行入口](#r13-统一管理动作契约与执行入口)
- [R14 App / Connector 来源与鉴权状态接入](#r14-app--connector-来源与鉴权状态接入)
- [R15 ToolSearch / Tool Registry 与 Capability Catalog 对齐](#r15-toolsearch--tool-registry-与-capability-catalog-对齐)
- [R16 端到端 smoke、release gate 与文档收口](#r16-端到端-smokerelease-gate-与文档收口)

## R13 统一管理动作契约与执行入口

### 目标

把管理页“能显示哪些动作”和“真正执行动作”的边界说清并收口。`allowedActions` / `actionRef` 只作为展示和预检依据；真正写操作通过统一的能力管理动作入口分发到 Skill / MCP 领域服务。

### 范围

- 新增或定型能力管理动作请求对象，例如：
  - `capabilityId`
  - `action`
  - `actionRef`
  - `params`
  - `confirmed`
- 新增 action plan / apply 语义，危险动作必须先 plan 或确认。
- 覆盖当前已有 Skill 动作：启用、禁用、模型调用、用户调用、修复、卸载、inspect。
- 覆盖当前已有 MCP server 动作：启用、禁用、检测、重启、修复、卸载、inspect。
- Plugin 在本阶段只做 inspect / impact 展示；禁用 Plugin 或卸载 Plugin 若没有成熟生命周期入口，不在本阶段伪造。
- Renderer 不再根据 installed record / scope / owner 自己决定是否能修复或卸载，而是消费管理投影和 action plan。

### 非目标

- 不重写 Skill / MCP 的底层领域服务。
- 不把 Skill 和 MCP 的写入逻辑合并成一个巨大 service。
- 不新增远端 registry、自动下载或无确认写配置。
- 不改变模型工具调用协议。

### 具体流程

```text
Desktop 选择 capability + action
-> App Server 接收 capability management action plan
-> 读取当前 management projection
-> 校验 allowedActions、ownership、actionRef 和确认要求
-> 生成 CapabilityActionPlan
-> 用户确认后 apply
-> Action Router 分发到 Skill / MCP 现有领域服务
-> 刷新 runtime snapshot 与 management projection
-> 返回 CapabilityActionResult
```

### 关键输入输出

输入：

- 当前 workspace / configHome。
- 当前 `CapabilityManagementProjection`。
- 用户选择的 `capabilityId`、`action`、可选参数和确认状态。

输出：

- `CapabilityActionPlan`：动作名称、目标能力、写入范围、风险提示、是否需要确认。
- `CapabilityActionResult`：执行状态、刷新后的关键状态、失败诊断。

### 状态变化

- `allowedActions` 从“按钮显示依据”升级为“动作预检依据”。
- `actionRef` 从“页面临时参数”升级为“领域服务 adapter 入参”。
- Skill / MCP 原有 IPC 可以保留，但应变成新动作入口的薄 adapter 或明确标记为 legacy。

### 验收

- Runtime-only / plugin-owned / manual-config 能力不会出现伪造的 repair / uninstall。
- Renderer 不再重复实现 installer-owned / plugin-owned / runtime-only 的危险动作判断。
- 禁用、修复、卸载等危险动作必须有 plan 或确认。
- Skill / MCP 页面执行动作后，`capabilities/management/list` 刷新状态一致。
- 有 smoke 覆盖 action plan 拒绝非法动作、允许合法动作、失败诊断和刷新结果。

### 完成记录（2026-06-06）

- 新增 `src/services/capabilities/managementActionService.ts`，把 `capabilityId + action + actionRef + params` 定型为统一动作请求，并生成 action plan、确认 token 和 apply guard。
- App Server 新增 `capabilities/management/action/plan` 与 `capabilities/management/action/apply`，执行时重新读取当前 `CapabilityManagementProjection`，再分发到 Skill / MCP 领域服务。
- Desktop Skill / MCP 管理动作已改为通过统一 capability action plan / apply 执行；页面只消费 `allowedActions/actionRef`，不再按 installed record 自行判断危险动作归属。
- 新增 `smoke:capability-management-actions`，覆盖非法动作、actionRef 不匹配、未确认危险动作失败、Skill 状态刷新和 MCP restart/disable 真实 App Server 路径。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-actions`

## R14 App / Connector 来源与鉴权状态接入

### 目标

把 App / Connector 从 synthetic provider input 变成明确来源模型。若当前仓库没有真实 connector registry 或 plugin app manifest，则必须把文档口径降级为“设计预留”，不能继续写成当前用户可用能力。

### 范围

- 审计当前 plugin manifest、App Server auth status、Desktop 连接状态和 provider capability 是否已有 App / Connector 来源。
- 定义 `AppConnectorSnapshot` 或等价 DTO。
- 接入真实来源时，至少表达：
  - `appId`
  - `displayName`
  - `connected`
  - `enabled`
  - `authStatus`
  - `parentPluginId`
  - `providedToolIds` / `providedMcpServerNames` / `providedSkillIds`
- 如果没有真实来源，则保留 `createAppCapabilityProvider({ apps })` 作为测试和未来 adapter，但总览文档标明它不是当前用户可见能力来源。

### 非目标

- 不实现完整 OAuth。
- 不引入新的外部连接器市场。
- 不把 App / Connector 直接当 Tool 暴露给模型。
- 不让 App / Connector 绕过 Plugin / MCP / Tool 的既有安全边界。

### 具体流程

```text
Connector source audit
-> 若存在真实来源：生成 AppConnectorSnapshot
-> AppCapabilityProvider 转成 app capability
-> Capability Catalog 展示连接 / 鉴权 / 来源关系
-> Plugin impact 展开 child app 与其贡献能力

若不存在真实来源：
-> AppCapabilityProvider 保留为预留 adapter
-> 文档和 smoke 标明 synthetic input only
-> Desktop 不展示虚假的 App / Connector 当前能力
```

### 关键输入输出

输入：

- Plugin manifest / plugin loader 结果。
- Auth status / connector registry。
- Host-provided app snapshot。

输出：

- App / Connector capability。
- App 与 Plugin、Tool、MCP、Skill 的来源关系。
- 明确的 unavailable / needs-auth / disabled 诊断。

### 状态变化

- App / Connector 不再只靠调用方手动传 `apps`。
- 文档中的“当前已接入”必须和真实来源一致。
- 无真实来源时，App / Connector 被归类为设计预留。

### 验收

- `capabilities/list` 不会凭空出现用户没有安装或没有连接的 App。
- 已连接 App 显示 `enabled / connected`，未授权 App 显示 `needs-auth`。
- Plugin 携带的 App 能通过 `parentPluginId` 追溯。
- 没有真实来源时，文档、CLI、Desktop 和 smoke 都不宣称 App / Connector 当前可用。

### 完成记录（2026-06-06）

- 当前仓库没有真实 connector registry；R14 没有伪造用户可用 App / Connector。
- `appCapabilityProvider` 定型 `AppConnectorSnapshot` 预留 DTO，支持 `authStatus`、`parentPluginId`、`providedToolIds`、`providedMcpServerNames`、`providedSkillIds`。
- `createAppCapabilityProvider()` 仍只消费显式 host-provided / test-provided `apps` 输入；无输入时不会在 `capabilities/list` 中生成 App capability。
- `smoke:capability-catalog-app-provider` 补充默认空来源断言和 snapshot 字段断言。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-catalog-app-provider`

## R15 ToolSearch / Tool Registry 与 Capability Catalog 对齐

### 目标

让 Capability Catalog、Tool Registry 和 ToolSearch 对同一个工具使用同一套来源、可用性和暴露策略。管理页、工具搜索和最终模型工具池不能分别解释同一个工具。

### 范围

- 定义当前 turn 或当前 App Server runtime 的 `ToolCapabilitySnapshot`。
- Capability Catalog 的 Tool provider 消费当前最终工具池，而不是只默认读取 `getAllBaseTools()`。
- 统一表达：
  - builtin tool
  - provider capability tool
  - MCP dynamic tool
  - deferred tool
  - internal tool
- ToolSearch 的候选策略、`match_details` 和 Capability Catalog 的 source / availability 对齐。
- release smoke 至少覆盖一个 MCP tool、一个 provider tool、一个 deferred tool 和一个 internal tool。

### 非目标

- 不改变工具调用协议。
- 不改变 MCP tool 命名规则。
- 不实现 plugin-provided tool 的完整安装生命周期；若当前只有元数据预留，只记录来源预留。
- 不把 Skill 当 ToolSearch 候选。

### 具体流程

```text
App Server / turn runtime 组装最终工具池
-> Tool Registry 生成 registry entries
-> Availability / ToolSearch policy 计算可用性和暴露策略
-> Capability Catalog 生成 tool capability
-> ToolSearch 复用同一策略返回 match_details
-> Desktop / CLI / debug 输出同一套来源和状态
```

### 关键输入输出

输入：

- 当前 `Tool[]`。
- provider capability snapshot。
- MCP server runtime status。
- runtime target、platform、context budget 和 ToolSearch mode。

输出：

- Tool capability 列表。
- ToolSearch 候选列表。
- 统一的 `direct / deferred / internal` 暴露策略。
- 统一 availability reason。

### 状态变化

- `ToolCapabilityProvider` 不再只代表静态基础工具。
- MCP runtime tool 在 ToolSearch 和 Capability Catalog 中的来源、serverName、toolName 一致。
- provider capability tool 的可用性和模型页展示口径一致。

### 验收

- `capabilities/list` 与 ToolSearch 对同一个 MCP tool 的 `serverName/toolName/availability` 一致。
- `ToolSearchTool` 不返回 internal tool 或不可用 tool，且原因能在管理/诊断中解释。
- `GenerateImage` 等 provider capability tool 的可用性在模型页、Tool Registry 和 Capability Catalog 中一致。
- release smoke 包含真实工具池路径，不只测手写 fixture。

### 完成记录（2026-06-06）

- 新增 `src/services/tools/toolCapabilitySnapshot.ts`，把 Tool Registry entry、availability 和 ToolSearch searchable 结果收成同一份快照。
- `toolSearchPolicy` 改为消费 `createCcrToolCapabilitySnapshot()`，`ToolSearch` 候选只来自 `searchable=true`。
- `toolCapabilityProvider` 改为消费同一份 snapshot，再投影为 Capability Catalog 的 tool / mcp-tool capability。
- `smoke:tool-registry` 增加 `tool_capability_snapshot_aligns_toolsearch_and_catalog`，校验同一个 MCP tool 在 snapshot、ToolSearch 和 Capability Catalog 中的 serverName/toolName/exposure/availability 一致。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:tool-registry`

## R16 端到端 smoke、release gate 与文档收口

### 目标

把 R9-R15 的成果用端到端验证和文档口径收住，避免局部 smoke 都通过但实际 Desktop / App Server / 上下文注入仍然不一致。

### 范围

- 新增端到端 smoke，覆盖临时 workspace / configHome 下的：
  - managed installed Skill
  - project / user Skill
  - runtime-only Skill
  - MCP server 和 MCP child capability
  - provider tool
  - ToolSearch candidate
  - Plugin relation fixture
  - App / Connector 真实来源或明确预留状态
- release group 增加统一能力目录和管理动作关键 smoke。
- 更新源码证据索引、总览文档、Skill 文档、MCP 文档和 goal 完成记录。
- 清理陈旧文案：不能再说 App / Connector 当前可用，除非 R14 已接真实来源。

### 非目标

- 不要求真机安装所有外部 MCP。
- 不要求端到端 smoke 覆盖所有 UI 像素。
- 不用 smoke 代替人工验收；Desktop 关键交互仍可保留手工 checklist。

### 具体流程

```text
构造临时 workspace / configHome
-> 写入 Skill / MCP / Plugin / Tool fixture
-> 启动或调用 App Server 能力查询入口
-> 拉取 capabilities/list 与 capabilities/management/list
-> 校验上下文注入、ToolSearch、管理动作 plan/apply 和诊断一致性
-> 更新 release smoke group
-> 更新文档和 goal 完成记录
```

### 关键输入输出

输入：

- 临时配置目录。
- fixture Skill / MCP / Plugin / App / Tool 数据。
- App Server JSON-RPC 请求。

输出：

- 端到端 smoke 报告。
- release gate 更新。
- 文档完成记录。

### 状态变化

- 局部 fixture smoke 仍保留，但不再作为唯一一致性证明。
- release gate 能覆盖“真实当前路径”。
- 文档从“计划描述”更新为“当前事实 + 后续 backlog”。

### 验收

- `npm.cmd run smoke:extension-capability-management-e2e` 或等价脚本覆盖真实 App Server 路径。
- release smoke group 包含 R13-R16 的关键门禁。
- `docs/architecture/extension-capability-system.md`、`docs/architecture/extension-runtime-context-refactor-roadmap.md` 和本 goal series 状态一致。
- `docs/references/extension-runtime-context-source-evidence.md` 记录新的入口、adapter 和 smoke 证据。
- `git diff --check` 通过。

### 完成记录（2026-06-06）

- 新增 `smoke:extension-capability-management-e2e`，串联能力管理动作、App provider 预留、Plugin relation 和 ToolSearch / Catalog 对齐 smoke。
- release smoke group 已纳入 `smoke:capability-management-actions`、`smoke:extension-capability-management-e2e`，Desktop gate 额外纳入 `smoke:desktop-skill-management-projection`。
- 文档同步更新总览、roadmap、工具注册目录、源码证据索引和 goals README。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:capability-catalog-app-provider`
- `npm.cmd run smoke:tool-registry`
- `npm.cmd run smoke:desktop-skill-management-projection`
- `npm.cmd run smoke:extension-capability-management-e2e`

## 5. 推荐执行顺序

按下面顺序执行，不建议跳步：

```text
R13 先把动作入口收口，避免 R12 后 UI 继续私下猜 owner
R14 再处理 App / Connector，避免总览把预留能力写成已落地
R15 再统一工具池、ToolSearch 和 Capability Catalog
R16 最后补端到端 smoke、release gate 和文档 closeout
```

原因：

- R13 先定义写操作边界，后续页面和插件能力不会继续扩散旧 IPC 判断。
- R14 先澄清连接器来源，避免 Plugin 能力合集文档继续 overclaim。
- R15 处理工具通道，避免工具治理和能力目录继续并行解释。
- R16 用真实路径验证前面所有收口，防止只靠局部 fixture。

## 6. 总体验收

R13-R16 完成时：

- Desktop 能通过统一能力动作入口执行已支持的 Skill / MCP 管理动作。
- App / Connector 要么有真实来源和鉴权状态，要么被明确标记为预留，不进入用户可用能力列表。
- ToolSearch、Tool Registry、Capability Catalog 对工具来源、availability 和 exposure 的解释一致。
- release gate 能覆盖 App Server 当前 workspace / configHome 的真实能力管理路径。
- 文档不再把未落地能力写成当前已实现。

建议验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-api`
- `npm.cmd run smoke:tool-registry`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:capability-catalog-app-provider`
- `npm.cmd run smoke:extension-capability-management-e2e`
- `npm.cmd run smoke:desktop-release-gate`
- `git diff --check`

## 7. 文档收口

每个子 goal 完成后必须同步更新：

- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)：同步当前已接入、预留和后续 backlog。
- [CCR 扩展能力运行时与上下文重构路线](../architecture/extension-runtime-context-refactor-roadmap.md)：标记对应 R 阶段状态。
- [CCR 工具注册目录](../architecture/tool-registry-catalog.md)：同步 ToolSearch / Tool Registry / Capability Catalog 对齐结果。
- [扩展能力运行时与上下文源码证据索引](../references/extension-runtime-context-source-evidence.md)：补充新的入口、adapter 和 smoke 证据。
- 本文：在对应子 goal 下补完成记录和验证命令。
