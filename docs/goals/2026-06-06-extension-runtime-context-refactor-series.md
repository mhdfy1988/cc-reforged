# Goal Series：扩展能力运行时与上下文重构序列

## 1. 目标

本序列以 [CCR 扩展能力运行时与上下文重构路线](../architecture/extension-runtime-context-refactor-roadmap.md) 为架构基线，把 Skill、MCP、Plugin、Tool、Command 从“能力事实”到“模型上下文”和“实际调用”的链路拆成可逐步验收的阶段。

最终目标：

```text
能力事实
  -> 运行时可见性
  -> 上下文注入计划
  -> 动态发现
  -> 调用适配
  -> 管理展示
  -> 旧过滤逻辑收口
```

一句话口径：

```text
统一能力目录只统一看见和诊断，不抹平 Skill、MCP、Tool 的本质差异；模型上下文注入必须从统一运行时事实推导。
```

## 2. 为什么拆成序列

这次不是单点修复。当前链路里至少有几类不同问题：

- 管理页、Capability Catalog、Skill listing、Skill discovery、SkillTool 和 MCP tool pool 各自取数。
- `skill_listing` 和 `skill_discovery` 的候选策略散落在 attachment / command / search 模块里。
- Skill 是指令包，Tool 是可执行接口，MCP 是外部工具协议，不能为了统一展示而混成同一种调用语义。
- 之前已经完成的 `currentContextMessages`、ThreadDisplay 和上下文预算链路不能被本次重构误伤。

因此本序列按 R0-R8 拆分，每阶段只改一层，能独立验证，也能在任意阶段暂停。

R0-R8 完成后，审核发现仍有若干一致性缺口需要继续修复，后续设计见 [R9-R12 能力目录一致性修复](./2026-06-06-extension-runtime-r9-r12-consistency-repair-series.md)。

## 3. 子 Goal

- [R0 流程冻结与证据文档](./2026-06-06-extension-runtime-r0-flow-freeze-evidence.md)（已完成）
- [R1 能力事实模型收敛](./2026-06-06-extension-runtime-r1-capability-facts.md)（已完成）
- [R2 运行时可见性 Resolver](./2026-06-06-extension-runtime-r2-runtime-visibility.md)（已完成）
- [R3 上下文注入计划抽出](./2026-06-06-extension-runtime-r3-context-injection-planner.md)（已完成）
- [R4 动态发现闭环](./2026-06-06-extension-runtime-r4-discovery-loop.md)（已完成）
- [R5 MCP Skill 与 MCP Tool 边界闭环](./2026-06-06-extension-runtime-r5-mcp-skill-tool-boundary.md)（已完成）
- [R6 Plugin 能力合集关系贯穿](./2026-06-06-extension-runtime-r6-plugin-bundle-relations.md)（已完成）
- [R7 管理页切到统一读模型](./2026-06-06-extension-runtime-r7-management-unified-read-model.md)（已完成）
- [R8 旧过滤逻辑收口](./2026-06-06-extension-runtime-r8-legacy-filter-closeout.md)（已完成）

## 4. 非目标

- 不一次性重写 Skill、MCP、Plugin 管理页。
- 不把 Skill 当 Tool。
- 不把 MCP prompt 自动当 Skill。
- 不重构 `currentContextMessages` 会话物化链路。
- 不重构 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 展示链路。
- 不重新设计自动 compact 和上下文预算 resolver。
- 不改变 MCP tool 既有命名规则。
- 不改变模型工具调用协议。

## 5. 总体验收

本序列完成时：

- 扩展能力有统一事实来源和 stable id。
- Skill / MCP / Plugin / Tool / Command 的来源关系可追溯。
- `runtimeVisible`、`modelInvocable`、`userInvocable`、`toolInvocable` 有统一 resolver。
- `skill_listing`、`skill_discovery` 和 Tool schema 暴露从统一计划推导。
- Dynamic discovery 不再伪装成安装事实或执行事实。
- SkillTool 调用前重新消费统一运行时可见性。
- 管理页展示和模型运行时状态一致。
- 旧过滤逻辑被删除或显式隔离，不存在 silent fallback。

## 6. 推荐执行顺序

第一批先执行 R0-R3：

```text
R0 先冻结事实
R1 再统一能力事实
R2 再统一运行时可见性
R3 再把上下文注入计划抽出来
```

R4-R8 已根据 R0-R3 的落地对象按以下顺序完成：

```text
R4 先闭合 Skill 发现服务和真实输入信号
R5 再冻结 MCP Skill 来源契约和四类调用边界
R6 再贯穿 Plugin identity、父子关系和状态传播
R7 再让 Desktop 消费统一管理投影
R8 最后删除重复决策并完成 closeout
```

不允许跳过 R4-R6 直接在页面里拼统一状态，否则会把领域判断重新散落到 Renderer。

## 7. 当前完成记录

2026-06-06 已完成第一批 R0-R3：

- R0：新增源码证据索引 `docs/references/extension-runtime-context-source-evidence.md`。
- R1：补齐 plugin Skill 来源关系，新增 MCP resource / prompt 事实投影，Capability Catalog 同类冲突改为 `kind + name`。
- R2：抽出 `capabilityRuntimeVisibility` 与 Skill command adapter，统一 `hiddenReasons` 和运行时诊断。
- R3：抽出 `skillContextInjectionPlanner`，`skill_listing` 和 turn-zero `skill_discovery` 消费同一注入计划。

2026-06-06 已完成 R4-R8：

- R4：turn-zero、inter-turn 和 `DiscoverSkills` 共用发现服务，候选与会话状态使用 stable capability id。
- R5：按 Draft SEP-2640 资源约定接入 MCP Skill，普通 MCP Prompt 不进入 SkillTool，失败只降级 MCP Skill 子能力。
- R6：统一 Plugin identity，贯穿 Plugin -> MCP Server -> child capability 两级关系和禁用状态传播。
- R7：新增 `capabilities/management/list`，Desktop 管理页开始消费统一只读管理投影；审核发现 Skill 页仍需在 R12 切到 Skill capability 主数据。
- R8：模型可调用性收敛到 `skillCommandRuntimeVisibility`，`getSkillToolCommands()` 成为薄 adapter，并用 smoke 固定 legacy、Plugin Skill、MCP Prompt、MCP Skill 路由边界；审核发现 slash / SDK / REPL 入口仍需在 R11 收口。

验证：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:capability-api`
- `npm.cmd run smoke:capability-catalog-app-provider`
- `npm.cmd run smoke:capability-catalog-core`
- `npm.cmd run smoke:capability-catalog-plugin-relations`
- `npm.cmd run smoke:extension-runtime-visibility`
- `npm.cmd run smoke:extension-context-injection-planner`
- `npm.cmd run smoke:skill-static-listing-filter`
- `npm.cmd run smoke:skill-discovery-index`
- `npm.cmd run smoke:skill-turn-zero-discovery`
- `npm.cmd run smoke:skill-internal-refactor`
- `git diff --check`

## 8. 审核发现与后续修复

R0-R8 是主链路阶段完成，不代表所有一致性缺口已经 closeout。2026-06-06 审核后，后续修复范围已经拆成 [R9-R12 能力目录一致性修复](./2026-06-06-extension-runtime-r9-r12-consistency-repair-series.md)：

- R9：补齐 MCP runtime 子能力进入 `capabilities/list` / `capabilities/management/list` 的事实来源。
- R10：把 Skill installed inspection 从 `name` 关联改成稳定安装身份关联。
- R11：收口 slash command、SDK/system-init、REPL bridge 和 SkillTool 统计的旧过滤逻辑。
- R12：Desktop Skill 页从安装记录列表切到 Skill capability 管理投影。
