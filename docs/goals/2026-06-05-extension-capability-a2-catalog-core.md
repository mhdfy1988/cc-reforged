# Goal A2：Capability Catalog 聚合层

## 1. 目标

实现统一 Capability Catalog 聚合层，先使用 mock provider 固定 provider 接口、排序、去重、诊断和 DTO 输出。

## 2. 范围

本阶段做：

- 新增 `src/services/capabilities/capabilityCatalog.ts`。
- 定义 capability provider 接口。
- 支持全量能力视角和 runtime visible 视角。
- 支持同名能力保留来源并输出 conflict diagnostics。
- 新增 `capabilityDtos.ts`，只做展示字段裁剪，不做业务判断。

本阶段不做：

- 不接 Skill / MCP / Tool 真实 provider。
- 不暴露 App Server API。
- 不改已有管理页。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-catalog-core
git diff --check
```

## 4. 成功标准

- Catalog 能聚合多个 provider。
- 同名不同来源不会互相覆盖。
- 被隐藏能力保留为 `hidden-by-conflict`。
- DTO 层不重新推断状态。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/capabilities/capabilityCatalog.ts` 和 `capabilityDtos.ts`。
- Catalog 已支持 provider 聚合、runtime visible 视图、同名冲突诊断和 summary。
- 验证通过：`npm.cmd run smoke:capability-catalog-core`。
