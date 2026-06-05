# Goal A6：统一查询入口收口

## 1. 目标

为统一能力目录补 Core / App Server / CLI 查询入口，并完成文档和 smoke 收口。

## 2. 范围

本阶段做：

- 新增 Core 能力查询入口，例如 `capabilities/list`。
- App Server 暴露对应 handler / client 方法。
- CLI 提供只读查询入口。
- Desktop 后续可消费该 API，本阶段不要求新增页面。
- 更新扩展能力体系文档、Skill 文档、MCP 文档和 Tool Registry 文档。

本阶段不做：

- 不新增 Desktop 能力总览页。
- 不改变已有 Skill / MCP 管理 API。
- 不改变模型上下文注入。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-catalog
npm.cmd run smoke:capability-api
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:mcp-end-to-end
git diff --check
```

## 4. 成功标准

- Core / App Server 能查询统一能力目录。
- CLI 能只读查看统一能力目录。
- 原 Skill / MCP 管理入口保持兼容。
- 文档入口清晰指向统一 Capability Catalog。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/core/capabilityCore.ts`，并挂载 `core.capabilities.list()`。
- App Server 新增 `capabilities/list` handler / protocol / stdio client 方法。
- CLI 新增 `capabilities list` 只读 JSON 查询入口。
- 验证通过：`npm.cmd run smoke:capability-catalog`、`npm.cmd run smoke:capability-api`、`npm.cmd run smoke:skill-management-api`。
