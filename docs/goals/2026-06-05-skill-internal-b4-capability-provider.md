# Goal B4：SkillCapabilityProvider 抽出

## 1. 目标

把 Skill capability 构造从 `skillRuntimeCatalog.ts` / `managementService.ts` 中剥离，形成独立 `SkillCapabilityProvider`，为扩展能力统一 catalog 接入做准备。

## 2. 范围

本阶段做：

- 新增 `src/services/skills/capabilityProvider.ts` 或迁移到 `src/services/capabilities/skillCapabilityProvider.ts`。
- 复用 installed package inspection。
- 复用 runtime catalog diagnostics。
- 保持 Skill 管理 API 中 `capabilities` 字段兼容。

本阶段不做：

- 不接 MCP / Tool provider。
- 不新增 capabilities/list API。
- 不改变 runtime catalog 优先级。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-capability-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-management-service
git diff --check
```

## 4. 成功标准

- Skill capability provider 独立。
- runtime catalog 专注排序和冲突诊断。
- management service 不直接拼 capability。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/skills/capabilityProvider.ts`。
- `managementService.ts` 通过 provider 获取 Skill 管理能力目录。
- 统一扩展能力目录仍由 `src/services/capabilities/skillCapabilityProvider.ts` 消费 Skill 事实。
- 验证通过：`npm.cmd run smoke:skill-capability-catalog`、`npm.cmd run smoke:skill-runtime-catalog-unified`、`npm.cmd run smoke:skill-release`。
