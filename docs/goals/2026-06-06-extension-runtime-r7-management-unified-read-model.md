# Goal：R7 管理页切到统一读模型

## 1. 当前状态

状态：已完成（2026-06-06）。

完成事实：

- app-server 同时提供原始 `capabilities/list` 和 typed `capabilities/management/list`。
- Skill 页面保留安装写流程，并补充统一投影中的全部 Skill capability。
- MCP 页面保留原有检测与安装写流程，子能力关系来自统一投影。
- Plugin 页面展示 bundle、child capability 和影响面。
- Renderer 不重新计算 runtime visibility、父子传播和 management ownership。

## 2. 目标

新增统一管理投影层，让 Skill、MCP、Plugin 和 Capability 页面共享同一能力事实和运行时状态；安装、修复、启停、卸载等写操作继续走现有领域服务。

```text
Capability Catalog
  + Skill install inspection
  + MCP inventory / test / install inspection
  + Plugin management facts
  -> ManagementProjectionService
  -> typed app-server DTO
  -> Desktop pages
```

## 3. 架构决策

- `capabilities/list` 保留为原始能力目录和诊断接口。
- 新增 `capabilities/management/list` 或等价的 typed management endpoint。
- 管理投影在 Core/app-server 侧完成，Renderer 不重新计算 runtime visibility。
- DTO 可以携带 `actionRef` 和 `allowedActions`，但写操作不搬进 projection service。

## 4. 输入与输出

输入：

```text
ExtensionCapabilityCatalog
installed inspection
runtime inventory
management ownership
current workspace / config home
```

输出：

```text
SkillManagementItem[]
McpManagementItem[]
PluginManagementItem[]
CapabilityManagementSummary
```

每个 item 至少包含：

```text
capabilityId
kind
name
displayName
source
relations
state
invocation
hiddenReasons
diagnostics
managementOwnership
actionRef?
allowedActions[]
```

## 5. 实施范围

### R7.1 ManagementProjectionService

- 在服务层集中 join 能力事实和安装/运行记录。
- 用 stable capability id 关联，不以显示名称作为主键。
- 区分 installer-owned、手工配置、runtime-only 和 plugin-owned。

### R7.2 app-server 协议

- 增加 typed schema、client 方法和 handler。
- 返回 Skill、MCP、Plugin 分组视图及总览。
- 协议中保留诊断，不把错误压成单个状态字符串。

### R7.3 Skill 页面

- 列出所有 Skill capability，而不只列 installer-owned Skill。
- managed / user / project / plugin / bundled / dynamic / mcp 来源可见。
- 只有具备 management ownership 的项目显示修复、卸载等动作。
- “能力启用”和“模型调用/用户调用”保持独立状态，不互相冒充。

### R7.4 MCP 页面

- 展示 MCP server 及其 tool、resource、prompt、Skill child。
- 保留检测、重启、卸载等现有写操作。
- server unavailable 与 child unavailable 使用统一诊断。

### R7.5 Plugin 与 Capability 页面

- Plugin 页面展示 bundle、child capability 和影响面。
- Capability 总览用于跨类型检索和诊断，不复制各管理页的写操作。

## 6. 不变式

- 管理页展示不决定模型上下文注入。
- 页面不得重新实现 runtime visibility、冲突或父子状态传播。
- 没有安装记录的 runtime capability 仍可以展示，但不能伪造卸载动作。
- raw capability catalog 和 management projection 分层，不互相替代。
- 写操作继续调用 Skill、MCP、Plugin 各自的领域服务。

## 7. 非目标

- 不做大规模视觉改版。
- 不重写安装、修复、启停和卸载事务。
- 不在 Renderer 建第二套 Capability Catalog。
- 不把所有能力塞进同一张无差别列表。

## 8. 验收标准

- Skill 页面能看到 managed、user、project、plugin、bundled、dynamic 和 MCP Skill。
- MCP 页面能看到 server、tool、resource、prompt 和 MCP Skill，并保持类型区别。
- Plugin 页面能看到 bundle、child 和来源关系。
- 页面状态、`capabilities/list` 与实际模型运行时状态一致。
- installed record 存在但 runtime 不可见时，页面显示明确原因。
- runtime-only 能力没有安装动作，installer-owned 能力保留现有写操作。
- Renderer 不再自行拼接关键运行时状态或父子关系。

## 9. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run smoke:capability-api
npm.cmd run smoke:skill-internal-refactor
git diff --check
```

需要新增或扩展的 smoke：

- management projection schema。
- runtime-only Skill 可见但无卸载动作。
- Plugin child 在 Skill/MCP 页面显示统一来源。
- hidden reason 从 Core 到 Desktop 不丢失。

Desktop 手工验证：

```text
Skill 管理页
MCP 管理页
Plugin 管理页
Capability 总览
```

## 10. 完成后下一步

进入 [R8 旧过滤逻辑收口](./2026-06-06-extension-runtime-r8-legacy-filter-closeout.md)。

## 11. 完成记录

- 新增 `ManagementProjectionService`，统一输出 Skill、MCP、Plugin 分组、总览、来源、关系、诊断、归属和允许动作。
- 新增 typed `capabilities/management/list` Core / App Server / client / Desktop bridge。
- Skill 页面在安装记录之外展示 runtime-only、Plugin、dynamic、bundled 和 MCP Skill。
- MCP 详情按 `parentMcpServerName` 展示 Tool、Resource、Prompt 和 MCP Skill 子能力。
- Plugin 页面从占位页改为 bundle、child capability、运行时状态和影响面视图。
- 手工 MCP 配置保持 `manual-config`，不会伪造 installer-owned 卸载动作。
- 已补 management projection 与 capability API smoke。
