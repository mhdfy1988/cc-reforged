# Goal Series：扩展能力体系重构序列

## 1. 目标

本序列以 [CCR 扩展能力体系总览](../architecture/extension-capability-system.md) 为架构基线，把 Skill、MCP、Plugin、Tool、Command 的能力事实逐步收敛到统一 Capability Catalog。

本序列关注横向统一：

```text
Skill / MCP / Plugin / Tool / Command
  -> 各自保持执行边界
  -> 输出统一 ExtensionCapability
  -> 由 Capability Catalog 提供统一查询、展示和诊断口径
```

## 2. 为什么拆成序列

原始“扩展能力目录统一重构”目标太粗，容易一次改动跨 Skill、MCP、Tool、App Server 和 Desktop 多层。拆成 A1-A6 后，每个阶段都有独立产物和 smoke，可以先固定模型，再接入真实来源，最后开放统一查询入口。

## 3. 子 Goal

- [A1 统一能力模型](./2026-06-05-extension-capability-a1-model.md)
- [A2 Capability Catalog 聚合层](./2026-06-05-extension-capability-a2-catalog-core.md)
- [A3 Skill 接入统一能力目录](./2026-06-05-extension-capability-a3-skill-provider.md)
- [A4 MCP / Tool 接入统一能力目录](./2026-06-05-extension-capability-a4-mcp-tool-provider.md)
- [A5 Plugin 关系预留](./2026-06-05-extension-capability-a5-plugin-relations.md)
- [A6 统一查询入口收口](./2026-06-05-extension-capability-a6-api-closeout.md)

## 4. 非目标

- 不合并 Skill、MCP、Tool 的执行逻辑。
- 不重写现有 Skill / MCP 管理页。
- 不实现完整 Plugin 安装器。
- 不新增远端 registry。
- 不改变模型工具调用协议。
- 不改变 MCP 工具命名。

## 5. 成功标准

本序列完成时：

- `ExtensionCapability` 成为扩展能力统一值对象。
- Capability Catalog 有 provider 接口、聚合、排序、诊断和 DTO。
- Skill、MCP、Tool Registry 至少三类能力进入统一 catalog。
- Plugin parent-child 关系可以表达。
- Core / App Server / CLI 能查询统一能力目录。
- 原有 Skill / MCP 管理入口保持兼容。

## 6. 完成记录

2026-06-05 已完成 A1-A6 首轮实现：

- 新增统一 `ExtensionCapability` 值对象、Capability Catalog 聚合层和 DTO。
- Skill、MCP server、Tool / MCP tool、Plugin 关系预留均接入 provider。
- 新增 `core.capabilities.list()`、App Server `capabilities/list`、stdio client 方法和 CLI `capabilities list` 只读入口。
- 验证通过：`build`、新增 capability smoke、Skill / MCP / Tool 回归 smoke、`typecheck`、`git diff --check`。
