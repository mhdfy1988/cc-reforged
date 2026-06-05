# Goal：扩展能力目录统一重构

## 1. 目标

本阶段目标是以 [CCR 扩展能力体系总览](../architecture/extension-capability-system.md) 为架构基线，把当前分散在 Skill、MCP、Tool Registry 和后续 Plugin 入口里的“能力事实”收敛到统一 Capability Catalog。

目标不是把所有执行逻辑合成一个大 service，而是建立统一查询和展示口径：

```text
Skill / MCP / Plugin / Tool / Command
  -> 各自保持执行边界
  -> 统一输出 Capability
  -> Desktop / CLI / API 管理面消费 Capability Catalog
```

完成后，用户问“我现在有哪些能力”“某个能力来自哪里”“为什么不可用”“它属于哪个插件 / MCP / Skill”时，应能从一个 catalog 得到答案。

## 2. 为什么现在做

当前已经完成了三件基础工作：

- P1：Skill 安装 / 修复可靠性修复，安装记录和包目录可信度提高。
- P2：Skill 管理状态新增 `capabilities`，不再只列 installed records。
- P3：Skill installed package 检查收敛成共享 value object。

同时已经有两份长期架构文档：

- [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md)
- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)

此时继续只在 Skill 局部补 capability，会让 MCP、Plugin、Tool Registry 继续各自展示自己的能力，后续 Desktop 会出现多个“看起来类似但口径不同”的管理页。

本阶段要把“能力目录”提升为扩展能力体系的公共层。

## 3. 范围

本阶段做：

- 新增扩展能力统一模型，例如 `ExtensionCapability`。
- 新增统一 Capability Catalog service，例如 `src/services/capabilities/`。
- 将 Skill capability catalog 从 `skillRuntimeCatalog.ts` 或 Skill 管理 service 中拆出，接入统一 catalog。
- 将 MCP server / MCP tool 的当前管理事实映射为 capability。
- 将 Tool Registry entry / provider capability tool 映射为 capability。
- 为后续 Plugin 预留 plugin source 和 parent-child 关系，但不强行实现完整 Plugin 安装管理。
- App Server / Core 提供统一 capabilities 查询入口。
- Desktop 后续可从统一入口读取能力总览；本阶段至少固定 API / smoke 契约。
- 文档更新：扩展能力体系总览、Skill 架构、MCP 文档入口和 Tool Registry 文档中指向统一 catalog。

本阶段不做：

- 不把 Skill、MCP、Tool 的执行逻辑合并。
- 不重写 MCP 管理页。
- 不重写 Skill 管理页。
- 不实现完整 Plugin 安装器。
- 不新增远端 registry。
- 不改变模型工具调用协议。
- 不改变 MCP 工具命名 `mcp__server__tool`。

## 4. 统一模型

建议核心模型：

```ts
type ExtensionCapability = {
  schemaVersion: 1
  id: string
  name: string
  displayName: string
  description: string
  kind: 'skill' | 'mcp-server' | 'mcp-tool' | 'tool' | 'command' | 'plugin'
  source: {
    kind:
      | 'managed-skill'
      | 'user-skill'
      | 'project-skill'
      | 'plugin'
      | 'bundled'
      | 'dynamic'
      | 'mcp'
      | 'provider'
      | 'builtin'
      | 'legacy'
    label: string
    ref?: string
    pluginId?: string
    mcpServerName?: string
  }
  state: {
    installed: boolean
    enabled: boolean
    available: boolean
    runtimeVisible: boolean
    status:
      | 'available'
      | 'installed'
      | 'enabled'
      | 'disabled'
      | 'unavailable'
      | 'needs-auth'
      | 'failed'
      | 'drifted'
      | 'missing'
      | 'invalid'
      | 'hidden-by-conflict'
  }
  invocation: {
    modelInvocable: boolean
    userInvocable: boolean
    toolInvocable: boolean
  }
  relations: {
    parentPluginId?: string
    parentMcpServerName?: string
    installedRef?: string
    runtimeRef?: string
  }
  diagnostics: string[]
}
```

模型原则：

- `kind` 表示能力类型。
- `source.kind` 表示能力来源。
- `state.status` 表示管理面统一状态。
- `invocation` 表示谁能调用。
- `relations` 表示这个能力归属于哪个 plugin、MCP server 或安装记录。

## 5. 建议模块结构

新增：

```text
src/services/capabilities/
  capabilityTypes.ts
  capabilityCatalog.ts
  skillCapabilityProvider.ts
  mcpCapabilityProvider.ts
  toolCapabilityProvider.ts
  pluginCapabilityProvider.ts
  capabilityDtos.ts
```

职责：

- `capabilityTypes.ts`：统一模型和状态枚举。
- `capabilityCatalog.ts`：聚合 provider，排序、去重、诊断。
- `skillCapabilityProvider.ts`：把 Skill runtime/installed inspections 映射为能力。
- `mcpCapabilityProvider.ts`：把 MCP server、工具、连接状态映射为能力。
- `toolCapabilityProvider.ts`：把 Tool Registry、provider capability tool 映射为能力。
- `pluginCapabilityProvider.ts`：先输出已知 plugin source / 预留关系；完整安装管理后续补。
- `capabilityDtos.ts`：API / Desktop 展示字段裁剪。

现有模块调整：

```text
src/services/skills/
  capabilityCatalog.ts
    -> 迁移为 skillCapabilityProvider

src/skills/skillRuntimeCatalog.ts
  -> 保留运行时排序、去重、diagnostics
  -> 不承担总能力目录 DTO

src/services/tools/toolRegistry.ts
  -> 继续负责工具 registry
  -> 由 toolCapabilityProvider 读取并映射

src/services/mcp/
  -> 继续负责 MCP 配置、运行、安装和管理
  -> 由 mcpCapabilityProvider 读取并映射
```

## 6. 数据流

统一能力查询：

```text
Core capabilities/list
  -> CapabilityCatalog
  -> SkillCapabilityProvider
  -> McpCapabilityProvider
  -> ToolCapabilityProvider
  -> PluginCapabilityProvider
  -> CapabilityDto
```

Skill 管理页：

```text
SkillManagementService
  -> InstalledPackageInspection
  -> Skill-specific management DTO
  -> CapabilityCatalog skill subset
```

MCP 管理页：

```text
McpCore
  -> MCP server inventory
  -> MCP tool runtime state
  -> CapabilityCatalog mcp subset
```

Plugin 管理页后续：

```text
Plugin inventory
  -> plugin capability
  -> child skill/mcp/tool capabilities
  -> CapabilityCatalog relation graph
```

## 7. 排序与去重

Catalog 应同时支持两种视角：

- 全量能力视角：同名能力都列出，显示来源和冲突诊断。
- 运行时可见视角：按 runtime catalog 优先级只展示实际可调用的一项。

去重原则：

- `id` 必须唯一，不用纯 `name` 做主键。
- 同名不同来源不能直接覆盖。
- 被运行时隐藏的能力必须保留，状态为 `hidden-by-conflict`。
- Plugin 子能力必须保留 parent relation。

## 8. 状态归一

各领域状态映射：

| 领域 | 原状态 | 统一状态 |
| --- | --- | --- |
| Skill inspection | `installed` | `installed` / `enabled` |
| Skill inspection | `disabled` | `disabled` |
| Skill inspection | `drifted` | `drifted` |
| Skill inspection | `missing-*` | `missing` |
| Skill inspection | `invalid` | `invalid` |
| MCP server | connected | `enabled` / `available` |
| MCP server | disabled | `disabled` |
| MCP server | needs-auth | `needs-auth` |
| MCP server | failed | `failed` |
| Tool availability | available | `available` |
| Tool availability | unavailable | `unavailable` |
| Runtime conflict | skipped duplicate | `hidden-by-conflict` |

## 9. 验收用例

需要新增 smoke，至少覆盖：

- `capabilities/list` 返回 Skill、MCP server、MCP tool、builtin tool、provider capability 的统一能力项。
- 同名 Skill 来自 managed / plugin / bundled / MCP 时，全量能力视角都保留，运行时可见项按优先级确定。
- MCP server disabled / needs-auth / failed 映射到统一状态。
- Tool Registry 中 direct / deferred / internal 工具映射出 exposure 和 availability。
- Plugin source 能力可以作为 parent relation 出现在子能力上。
- Skill 管理页仍能拿到原来的 installed records，不被统一 catalog 反向破坏。
- MCP 管理页仍能拿到原来的 server 列表，不被统一 catalog 反向破坏。

建议命令：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-catalog
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:mcp-discovery-service
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:tool-registry
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
git diff --check
```

## 10. 成功标准

本阶段完成时：

- 有一个统一 `ExtensionCapability` 模型。
- 有一个统一 Capability Catalog 聚合入口。
- Skill、MCP、Tool Registry 至少三类能力进入统一 catalog。
- Plugin 关系字段和 provider 预留完成，不阻塞后续 Plugin 安装管理。
- Desktop / CLI / API 可以通过统一入口查询能力目录。
- Skill / MCP 原管理入口保持兼容。
- 运行时执行边界保持分离，没有把所有逻辑合成一个上帝 service。

## 11. 后续入口

本阶段完成后，后续可以继续设计：

- Plugin 安装、启用、禁用、卸载和子能力关系管理。
- Desktop 能力总览页。
- 能力搜索 / 推荐 / 缺口提示。
- 企业 trust policy 和能力审计。
- 远端 registry 和团队共享能力源。
