# Goal B1：Skill ManagementService 瘦身

## 1. 目标

让 `managementService.ts` 回到应用编排层，只负责接请求、调用领域服务、返回 DTO，不再承载 digest、DTO 拼装和跨层细节。

## 2. 范围

本阶段做：

- 梳理 `managementService.ts` 当前职责。
- 将纯 DTO / digest helper 移出。
- 保留对外函数签名兼容。
- 不改变业务语义。

本阶段不做：

- 不抽安装事务。
- 不抽 runtime adapter。
- 不接统一 ExtensionCapability。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-management-service
npm.cmd run smoke:skill-management-api
git diff --check
```

## 4. 成功标准

- `managementService.ts` 只保留应用编排逻辑。
- 原 Skill 管理 API 返回结构不变。

## 5. 完成记录

2026-06-05 已完成：

- DTO / digest helper 移至 `src/services/skills/managementDtos.ts`。
- 管理持久化 helper 移至 `src/services/skills/managementStore.ts`。
- Skill capability 拼装移至 `src/services/skills/capabilityProvider.ts`。
- 验证通过：`npm.cmd run smoke:skill-management-service`、`npm.cmd run smoke:skill-management-api`。
