# Goal B3：ManagementDto 展示适配抽出

## 1. 目标

将 Skill 管理接口里的 DTO / digest 转换集中到 `managementDtos.ts`，避免 service 和领域层混入展示字段裁剪。

## 2. 范围

本阶段做：

- 新增 `src/services/skills/managementDtos.ts`。
- 迁移 `addInspectionDigest`、`addCandidateDigest`、`addPlanDigest`。
- 迁移 security digest 转换。
- 明确 DTO 层不重新判断业务状态。

本阶段不做：

- 不改变 DTO 字段名。
- 不改变 Desktop 展示。
- 不改变 security scanner。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
git diff --check
```

## 4. 成功标准

- DTO 转换集中。
- `managementService.ts` 不再持有 digest helper。
- API 返回兼容。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/skills/managementDtos.ts`。
- `addInspectionDigest`、`addCandidateDigest`、`addPlanDigest` 和 security digest 转换已迁出 service。
- 验证通过：`npm.cmd run smoke:skill-management-service`、`npm.cmd run smoke:skill-management-api`。
