# Goal A1：统一能力模型

## 1. 目标

定义扩展能力统一值对象 `ExtensionCapability`，包括能力类型、来源、状态、调用面、父子关系和诊断字段。

## 2. 范围

本阶段做：

- 新增 `src/services/capabilities/capabilityTypes.ts`。
- 定义 `ExtensionCapability`、`ExtensionCapabilityKind`、`ExtensionCapabilitySourceKind`、`ExtensionCapabilityStatus`。
- 定义 `ExtensionCapabilityInvocation`、`ExtensionCapabilityRelations`、`ExtensionCapabilityDiagnostic`。
- 补 model smoke，验证 schema / 类型结构和关键状态枚举。

本阶段不做：

- 不接入 Skill / MCP / Tool 真实数据。
- 不新增 App Server API。
- 不改 Desktop。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:capability-model
git diff --check
```

## 4. 成功标准

- 能力模型能表达 Skill、MCP server、MCP tool、Tool、Command、Plugin。
- 能力来源能表达 managed-skill、user-skill、project-skill、plugin、bundled、dynamic、mcp、provider、builtin、legacy。
- 状态能表达 available、installed、enabled、disabled、unavailable、needs-auth、failed、drifted、missing、invalid、hidden-by-conflict。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/services/capabilities/capabilityTypes.ts`。
- `ExtensionCapability` 已覆盖能力类型、来源、状态、调用面、父子关系和诊断。
- 验证通过：`npm.cmd run smoke:capability-model`。
