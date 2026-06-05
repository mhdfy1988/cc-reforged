# Goal A5：Plugin 关系预留

## 1. 目标

在不实现完整 Plugin 安装器的前提下，让 Capability Catalog 能表达 plugin parent-child 关系，为后续插件管理页和插件安装治理预留结构。

## 2. 范围

本阶段做：

- 新增 `pluginCapabilityProvider.ts` 的最小接口。
- `ExtensionCapability.relations.parentPluginId` 生效。
- fixture 覆盖 plugin 携带 Skill / MCP / Tool 的关系图。
- 子能力能显示来源为 plugin，并保留实际运行时类型。

本阶段不做：

- 不实现 plugin install / uninstall。
- 不设计远端插件市场。
- 不改插件缓存安装布局。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-catalog-plugin-relations
git diff --check
```

## 4. 成功标准

- Plugin 可以作为 capability 出现。
- Plugin 子能力可以关联 parent plugin。
- 后续 Plugin 管理页可以直接消费关系字段。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/capabilities/pluginCapabilityProvider.ts`。
- `relations.parentPluginId` 已纳入统一能力模型和 provider fixture。
- 验证通过：`npm.cmd run smoke:capability-catalog-plugin-relations`。
