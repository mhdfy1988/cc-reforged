# Goal：R6 Plugin 能力合集关系贯穿

## 1. 当前状态

状态：已完成（2026-06-06）。

完成事实：

- Plugin bundle capability。
- Plugin Skill 的 `parentPluginId`。
- Tool 和 App provider 对 `pluginId` 的关系字段支持。
- Plugin manifest 中各类组件数量的基础统计。
- loader、provider 和 child capability 共用 `PluginIdentityResolver`。
- Plugin MCP server 使用真实 `pluginSource`，不再借用 `installKind`。
- Plugin 禁用状态传播到所有已建模 child capability。
- 关系图和影响面由当前 catalog 事实重建，不保留 stale child snapshot。

## 2. 目标

让 Plugin 保持“能力合集”语义，并用稳定关系图贯穿能力事实、运行时状态、管理投影和生命周期。

```text
Plugin bundle
  -> Skill
  -> MCP server
     -> MCP tool / resource / prompt / Skill
  -> Tool
  -> Command
  -> Hook
  -> App
```

Plugin 本身不可被当作 Skill 或 Tool 调用；实际调用永远落到 child capability。

## 3. 输入与输出

输入：

```text
LoadedPlugin
plugin manifest
plugin runtime registry
plugin-contributed Skill / MCP / Tool / Command / Hook / App
```

输出：

```text
PluginBundleCapability
PluginChildRelation[]
PluginImpactProjection
  pluginId
  childCapabilityIds[]
  affectedRuntimeSurfaces[]
```

## 4. 实施范围

### R6.1 统一 Plugin identity

- 抽出唯一 `PluginIdentityResolver` 或等价接口。
- loader、Plugin provider、Skill provider、MCP provider、Tool provider 和 App provider 共用同一 identity。
- 禁止用 `installKind`、display name 或临时路径代替 `pluginId`。

### R6.2 child relation 投影

- Skill、MCP server、Tool、Command、Hook、App 都使用稳定 `parentPluginId`。
- Plugin MCP 的 tool/resource/prompt/Skill 同时保留 `parentPluginId` 和 `parentMcpServerName`。
- child capability id 不因页面、运行入口或加载顺序变化。

### R6.3 状态传播

- Plugin disabled 时，child capability 增加 `plugin-disabled`。
- Plugin load failed 时，child capability 不进入运行时，并保留 source diagnostic。
- Plugin 恢复时重新从当前 loader 事实生成 child，不复用 stale child snapshot。

### R6.4 生命周期与影响面

- disable、enable、upgrade、reload、uninstall 都能查询受影响 child capability。
- Capability Catalog 只表达事实和状态，不直接执行卸载或重载。
- 写操作仍由 Plugin 管理服务负责，关系图只提供影响面。

## 5. 不变式

- Plugin 和 child capability 不互相替代。
- child capability 可以有两级关系，例如 Plugin -> MCP server -> MCP tool。
- Plugin 状态传播由统一 resolver 计算，页面不得自行推导。
- Plugin 卸载后不得保留可调用的 stale child capability。
- 本阶段不把 Plugin bundle 放进模型 Skill listing 或 tool schema。

## 6. 非目标

- 不实现完整 Plugin marketplace 或安装器。
- 不重写 Skill / MCP 管理页面。
- 不把 Hook 强行建模成模型可调用能力。
- 不改变 child capability 自身的调用协议。

## 7. 验收标准

- 所有 Plugin child 使用同一个稳定 `pluginId`。
- Plugin MCP 不再通过 `installKind` 猜 parent relation。
- Plugin -> MCP server -> MCP child 的两级关系可查询。
- 禁用 Plugin 后，全部 child 都不可运行并带 `plugin-disabled`。
- 重新启用或升级 Plugin 后，child 从当前事实重建，不残留旧版本。
- 可生成 Plugin 影响面列表，供 R7 管理页展示和写操作确认使用。
- Plugin bundle 不进入 Skill listing，也不进入 tool schema。

## 8. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:capability-catalog-plugin-relations
npm.cmd run smoke:capability-api
npm.cmd run smoke:extension-runtime-visibility
git diff --check
```

需要新增或扩展的 smoke：

- Plugin identity 跨 provider 一致。
- Plugin disabled 向全部 child 传播。
- Plugin MCP 两级 parent relation。
- unload/reload 后没有 stale child capability。

## 9. 完成后下一步

进入 [R7 管理页切到统一读模型](./2026-06-06-extension-runtime-r7-management-unified-read-model.md)。

## 10. 完成记录

- 新增 `pluginIdentityResolver.ts`，Plugin、Skill、MCP、Tool 和 App provider 共用统一 identity。
- MCP server 保留真实 `pluginSource`，不再通过 `installKind` 猜 Plugin。
- Capability Catalog 支持 Plugin -> MCP Server -> MCP child 两级关系继承。
- Plugin disabled 和 MCP server unavailable 会传播到 child 的结构化隐藏原因。
- 新增 `pluginImpactProjection.ts`，可查询 child capability 与受影响运行时表面。
- 已扩展 Plugin relation smoke，覆盖 identity、禁用传播、两级关系和影响面。
