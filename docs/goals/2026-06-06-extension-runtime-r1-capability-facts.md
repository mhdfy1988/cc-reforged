# Goal：R1 能力事实模型收敛

## 1. 目标

让 Capability Catalog 成为扩展能力事实的统一读入口，补齐 stable id、kind、source、owner、parent relation 和基础 diagnostics。

本阶段只处理“有哪些能力、来自哪里、与谁有关”，不决定本轮是否进入模型上下文，也不改变执行逻辑。

## 2. 为什么现在做

R0 会冻结当前多来源事实。R1 的任务是把这些事实收敛成统一读模型，避免后续 R2 / R3 继续从 `Command[]`、MCP appState、Plugin cache、管理记录各自取数。

## 3. 范围

能力事实层需要覆盖：

- Skill capability：
  - managed installed Skill
  - user / project Skill
  - bundled Skill
  - dynamic Skill
  - plugin Skill
  - mcp Skill，若当前未闭合则明确 diagnostic
- MCP capability：
  - MCP server
  - MCP tool
  - MCP resource
  - MCP prompt
- Tool capability：
  - builtin Tool
  - provider capability tool
  - MCP tool projection
- Plugin capability：
  - Plugin bundle
  - Plugin child Skill / MCP / Tool / Command / App 关系
- App / Connector capability：
  - connector 状态和来源关系

## 4. 输出模型要求

每条能力事实至少能表达：

```text
id
kind
name
displayName
description
source
owner
parentPluginId
parentAppId
installState
rawMetadata
diagnostics
```

约束：

- id 必须稳定，不能只用 display name。
- 同名不同来源能力不能静默合并。
- Plugin 和 child capability 不能互相替代。
- MCP tool 和 MCP Skill 不能共用一种 kind。
- Skill、Tool、MCP 的调用语义不能在事实层被抹平。

## 5. 非目标

- 不实现上下文注入计划。
- 不改 `skill_listing`。
- 不改 `skill_discovery`。
- 不改 SkillTool 执行。
- 不改 MCP tool 命名。
- 不重写管理页。

## 6. 验收标准

- `capabilities/list` 能列出 Skill / MCP / Tool / Plugin / App 的统一事实。
- 同一个 Plugin 贡献的 Skill / MCP / Tool 能通过 parent relation 追溯。
- MCP server、MCP tool、MCP prompt、MCP Skill 能区分。
- plugin Skill 能保留真实 plugin 来源，而不是只剩 `plugin/plugin` 这类弱标识。
- 同名冲突进入 diagnostics，不靠 `name.toLowerCase()` 直接吞掉。

## 7. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:capability-api
npm.cmd run smoke:capability-catalog-plugin-relations
git diff --check
```

如果实际 smoke 名称变化，以 `package.json` 当前脚本为准，并在完成记录里写明。

## 8. 完成后下一步

进入 [R2 运行时可见性 Resolver](./2026-06-06-extension-runtime-r2-runtime-visibility.md)，基于统一能力事实判断 runtimeVisible / modelInvocable / userInvocable / toolInvocable。

## 9. 完成记录

完成状态：已完成（2026-06-06）。

落地内容：

- `SkillRuntimeCapability` 增加 `parentPluginId`，plugin Skill 使用 `pluginInfo.repository` 作为稳定来源。
- Skill capability id 增加 plugin 维度，plugin child Skill 可通过 `relations.parentPluginId` 追溯。
- Capability kind 增加 `mcp-resource` / `mcp-prompt`，MCP resource 和普通 MCP prompt 可进入统一能力事实；`loadedFrom=mcp` 的 MCP Skill 不会被误归类为 MCP prompt。
- Capability Catalog 的运行时冲突键从全局 `name` 收敛为 `kind + name`，避免 Skill / MCP tool / Tool 同名时互相吞并。
- 同类同名冲突保留 capability 条目，并输出 `hidden-by-conflict` 与 `conflict-loser` 诊断。

验证：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:capability-api`
- `npm.cmd run smoke:capability-catalog-app-provider`
- `npm.cmd run smoke:capability-catalog-core`
- `npm.cmd run smoke:capability-catalog-plugin-relations`
- `npm.cmd run smoke:skill-internal-refactor`
- `git diff --check`
