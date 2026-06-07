# Goal：R0 流程冻结与证据文档

## 1. 目标

冻结当前 Skill、MCP、Plugin、Tool、Command 从来源到模型上下文或 tool schema 的真实流程，形成后续重构的证据基线。

本阶段不改运行时代码，只做源码证据索引、边界确认和 smoke 清单。

## 2. 为什么先做

当前问题不是“缺一个抽象”，而是多条链路已经各自形成事实：

- `skill_listing` 通过 attachment 把 Skill 名称和描述放进模型上下文。
- `skill_discovery` 通过搜索索引生成动态候选提示。
- `SkillTool` 调用后才展开完整 Skill 内容。
- MCP tool 通过 tool schema 暴露给模型。
- Plugin 贡献 child capability，但来源关系没有全链路稳定贯穿。

如果不先冻结当前流程，后续 R1-R3 容易把展示、注入、执行混起来。

## 3. 范围

本阶段确认并记录：

- Skill 来源：managed / user / project / bundled / dynamic / plugin / mcp。
- `skill_listing` 候选来源、过滤条件、预算策略、已发送集合。
- `skill_discovery` 候选来源、搜索字段、命中条件、触发入口。
- `SkillTool` validate / call / prompt expansion 链路。
- MCP tool 从 server discovery 到 `assembleToolPool()` 到 query tools 的链路。
- MCP resource attachment 链路。
- Plugin bundle 到 child Skill / MCP / Tool / Command 的来源关系现状。
- 与 `currentContextMessages`、ThreadDisplay、上下文预算 resolver 的边界。

## 4. 非目标

- 不改 `attachments.ts`。
- 不改 `SkillTool`。
- 不改 MCP client。
- 不改管理页。
- 不新增 capability model。
- 不移动现有代码。

## 5. 产物

新增或更新一份源码证据索引，建议路径：

```text
docs/references/extension-runtime-context-source-evidence.md
```

内容至少包含：

- 当前流程总图。
- 源码入口表。
- 每条路径的输入、输出、状态变化和副作用。
- 每条路径的当前过滤条件。
- 已确认问题和暂不处理问题。
- 后续 R1-R3 要消费的基线结论。

## 6. 验收标准

- 能明确回答“哪些能力能进 `skill_listing`”。
- 能明确回答“哪些能力能进 `skill_discovery`”。
- 能明确回答“Skill 是怎样被模型唤醒并展开的”。
- 能明确回答“MCP tool 为什么不是 Skill”。
- 能明确回答“Plugin 是能力合集，不是单一调用对象”。
- 能明确回答“本序列不改 `currentContextMessages`、ThreadDisplay 和 compact 预算链路”。

## 7. 验证命令

本阶段主要是文档和源码证据，不要求 build。

建议：

```powershell
git diff --check -- docs/references/extension-runtime-context-source-evidence.md docs/goals/2026-06-06-extension-runtime-r0-flow-freeze-evidence.md
```

如果补了 smoke 清单或脚本名，再补：

```powershell
npm.cmd run typecheck
```

## 8. 完成后下一步

进入 [R1 能力事实模型收敛](./2026-06-06-extension-runtime-r1-capability-facts.md)，把 R0 证据里的多来源对象收敛到统一能力事实模型。

## 9. 完成记录

完成状态：已完成（2026-06-06）。

产物：

- 新增 [扩展能力运行时与上下文源码证据索引](../references/extension-runtime-context-source-evidence.md)。
- 已记录 `skill_listing`、`skill_discovery`、`SkillTool` 展开、MCP tool schema、Plugin child capability 与既有上下文治理链路边界。

验证：

- `git diff --check`
