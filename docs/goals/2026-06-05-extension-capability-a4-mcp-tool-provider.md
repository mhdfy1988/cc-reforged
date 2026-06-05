# Goal A4：MCP / Tool 接入统一能力目录

## 1. 目标

将 MCP server、MCP tool、Tool Registry entry 和 provider capability tool 映射进统一 Capability Catalog。

## 2. 范围

本阶段做：

- 新增 `mcpCapabilityProvider.ts`。
- 新增 `toolCapabilityProvider.ts`。
- MCP server 状态映射为 capability。
- MCP 动态工具映射为 capability，并保留 server relation。
- Tool Registry entry 映射为 capability，带 availability / exposure。
- Provider capability tool 映射为 capability。

本阶段不做：

- 不改变 MCP 连接运行时。
- 不改变 ToolSearch 策略。
- 不改变 Desktop MCP 管理页。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-catalog-mcp-tool-provider
npm.cmd run smoke:mcp-discovery-service
npm.cmd run smoke:mcp-tool-runtime
npm.cmd run smoke:tool-registry
git diff --check
```

## 4. 成功标准

- MCP server disabled / needs-auth / failed 能映射统一状态。
- MCP tool 带 parent MCP server relation。
- Tool Registry direct / deferred / internal 能映射 capability exposure。
- Skill / MCP / Tool 能力可以在一个 catalog 中并存。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/capabilities/mcpCapabilityProvider.ts` 和 `toolCapabilityProvider.ts`。
- MCP server 读取配置清单映射能力；Tool / MCP tool 复用 Tool Registry 与 availability。
- 验证通过：`npm.cmd run smoke:capability-catalog-mcp-tool-provider`、`npm.cmd run smoke:mcp-tool-runtime`、`npm.cmd run smoke:tool-registry`。
