# Goal：R3 上下文注入计划抽出

## 1. 目标

抽出 `ContextInjectionPlanner`，统一决定本轮哪些扩展能力进入模型可见范围。

第一阶段聚焦 Skill：

```text
RuntimeCapability[]
  -> ContextInjectionPlanner
  -> skill_listing
  -> discoveryCandidates
  -> hidden reasons
  -> diagnostics
```

## 2. 为什么现在做

当前 `skill_listing` 和 `skill_discovery` 各自取数、各自过滤。结果是：

- managed Skill 是否进静态列表和动态发现开关耦合。
- project / plugin / dynamic Skill 被谁发现、为什么没发现不清楚。
- 未注入原因没有统一诊断。
- 上下文预算和已发送集合逻辑藏在 attachment 里。

R3 要把“本轮注入什么”变成一个独立计划，不再让 `attachments.ts` 直接发明来源白名单。

## 3. 范围

本阶段处理：

- 静态 Skill listing 候选。
- 动态 discovery 候选。
- hidden reasons。
- context budget。
- agent 维度已发送集合。
- resume 后 suppress / delta 语义。
- 与 `getAttachmentMessages()` 的边界。

## 4. 输入输出

输入：

```text
RuntimeCapability[]
TurnContext
ContextBudget
AgentContext
PreviouslyInjectedState
FeatureFlags
```

输出：

```text
ContextInjectionPlan
  staticSkillListing[]
  discoveryCandidates[]
  hidden[]
  diagnostics[]
  budgetUsage
```

## 5. 策略初始口径

静态列表：

- managed Skill：默认保留。
- bundled Skill：默认保留。
- MCP Skill：可保留，但必须受预算和 MCP Skill 闭环状态约束。
- project / user / plugin / dynamic Skill：默认进入 discoveryCandidates，是否进静态列表必须由策略显式决定。

动态发现候选：

- 只包含 runtimeVisible 且 modelInvocable 的 Skill。
- 不包含普通 Tool。
- 不包含普通 MCP tool。
- 不包含 Plugin bundle 自身。

预算：

- 消费统一上下文预算 resolver。
- 不自行按模型名估算窗口。
- 裁剪必须输出 diagnostics。

## 6. 非目标

- 不改变 SkillTool 展开协议。
- 不改 `currentContextMessages`。
- 不改 ThreadDisplay。
- 不实现新的语义检索。
- 不改变 MCP tool schema 暴露。

## 7. 验收标准

- `attachments.ts` 只消费 planner 输出，不再直接判断来源白名单。
- 每个未进入 `skill_listing` 的 Skill 都有 hidden reason。
- managed Skill 不因动态发现开关被静默丢失。
- Skill 展开后的 SKILL.md 不触发 discovery。
- 已发送集合仍按 agent 维度隔离。
- 上下文预算裁剪有 smoke 覆盖。

## 8. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:skill-static-listing-filter
npm.cmd run smoke:skill-turn-zero-discovery
npm.cmd run smoke:skill-internal-refactor
git diff --check
```

如新增 planner 专项 smoke，命名建议：

```text
smoke:extension-context-injection-planner
```

## 9. 完成后下一步

进入 [R4 动态发现闭环](./2026-06-06-extension-runtime-r4-discovery-loop.md)，让 turn-zero discovery 和 DiscoverSkills 都消费 R3 输出的 `discoveryCandidates[]`。

## 10. 完成记录

完成状态：已完成（2026-06-06）。

落地内容：

- 新增 `src/skills/skillContextInjectionPlanner.ts`，统一输出 `staticSkillListing`、`newStaticSkillListing`、`discoveryCandidates`、`hidden`、`diagnostics` 和 `budgetUsage`。
- `attachments.ts` 消费 planner 输出生成 `skill_listing`，不再直接判断来源白名单。
- `skillSearch/prefetch.ts` 消费 planner 的 `discoveryCandidates` 构建 turn-zero discovery 索引。
- 已发送集合仍按 agent id 隔离；resume suppress 只标记 planner 的静态列表项，不重复注入。
- Skill search 开启时，静态列表保留 bundled / managed / MCP；project / user / plugin / dynamic Skill 进入 discoveryCandidates，并保留隐藏原因。

验证：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:extension-context-injection-planner`
- `npm.cmd run smoke:skill-static-listing-filter`
- `npm.cmd run smoke:skill-discovery-index`
- `npm.cmd run smoke:skill-turn-zero-discovery`
- `npm.cmd run smoke:skill-internal-refactor`
- `git diff --check`
