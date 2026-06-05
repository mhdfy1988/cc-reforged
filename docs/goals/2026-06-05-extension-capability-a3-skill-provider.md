# Goal A3：Skill 接入统一能力目录

## 1. 目标

将现有 Skill capability 映射迁移为统一 `SkillCapabilityProvider`，让 managed、project/user、plugin、bundled、dynamic、MCP skill 都通过统一 Capability Catalog 展示。

## 2. 范围

本阶段做：

- 新增 `src/services/capabilities/skillCapabilityProvider.ts`。
- 复用 Skill runtime catalog 和 installed package inspection。
- Skill 管理 API 保持原有 `installed` 返回，同时能力目录来自统一 catalog。
- 保留 Skill 运行时执行边界，不把 SkillTool prompt 逻辑搬进 capabilities service。

本阶段不做：

- 不改变 SkillTool prompt。
- 不改变 slash command 过滤。
- 不重写 Skill 管理页。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:capability-catalog-skill-provider
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
git diff --check
```

## 4. 成功标准

- Skill 能力进入统一 Capability Catalog。
- 原 Skill 管理状态兼容。
- 同名 Skill 的 kept / hidden 来源和 diagnostics 可见。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/capabilities/skillCapabilityProvider.ts`。
- Skill provider 复用 `getSkillRuntimeCatalogForCwd()` 和 installed package inspection。
- 验证通过：`npm.cmd run smoke:capability-catalog-skill-provider`、`npm.cmd run smoke:skill-capability-catalog`、`npm.cmd run smoke:skill-management-api`。
