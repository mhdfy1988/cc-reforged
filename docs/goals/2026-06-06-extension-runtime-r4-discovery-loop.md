# Goal：R4 动态发现闭环

## 1. 当前状态

状态：已完成（2026-06-06）。

完成事实：

- `skillContextInjectionPlanner.discoveryCandidates` 是动态发现候选入口。
- turn-zero、inter-turn 和 `DiscoverSkills` 共用 `SkillDiscoveryService`。
- 检索结果输出 `capabilityId`、来源、`score`、`matchedFields` 和 `reason`。
- inter-turn 只在存在真实 tool result 信号时检索。
- session 发现状态优先记录 capability identity。
- 无查询或无命中时不会注入空的 `skill_discovery` attachment。

## 2. 目标

建立单一动态发现服务，让 turn-zero、inter-turn 和 `DiscoverSkills` 消费同一候选、同一检索实现和同一解释结果。

完整流程：

```text
ContextInjectionPlan.discoveryCandidates
  -> SkillDiscoveryCandidate projection
  -> SkillDiscoveryService
  -> DiscoveryResult[]
  -> turn-zero attachment / inter-turn attachment / DiscoverSkills output
  -> session discovered state
```

## 3. 输入与输出

输入：

```text
discoveryCandidates[]
query signal
cwd / workspace signal
recent user or tool-result signal
result limit
```

候选至少包含：

```text
capabilityId
name
displayName
description
whenToUse
sourceKind
parentPluginId?
runtimeVisible
modelInvocable
commandRef
```

输出：

```text
DiscoveryResult
  capabilityId
  name
  description
  sourceKind
  parentPluginId?
  score
  matchedFields
  reason
```

## 4. 实施范围

### R4.1 候选投影

- 给 `discoveryCandidates` 增加稳定 `capabilityId` 或等价 identity。
- 不在 `localSearch.ts` 再次独立判断 `disableModelInvocation` 和 `isEnabled()`。
- 同名不同来源候选不得先被 `Map<name, command>` 静默覆盖。

### R4.2 单一发现服务

- 抽出 `SkillDiscoveryService` 或等价服务。
- 统一负责建索引、查询、排序、结果限制和解释信息。
- turn-zero 与 `DiscoverSkills` 不再分别拼装搜索规则。

### R4.3 inter-turn 信号

- 删除当前 `null` 查询的无效 prefetch。
- 只有存在真实信号时才执行 inter-turn discovery，例如最新用户输入或明确允许的 tool result 摘要。
- 若本阶段不启用 inter-turn discovery，应显式关闭该路径并修正文档和注释，不保留看似运行的空实现。

### R4.4 发现状态

- session 内部优先记录 `capabilityId`。
- `discoveredSkillNames` 仅可作为 telemetry 或 legacy adapter。
- Skill 实际调用仍要重新经过运行时可见性校验。

## 5. 不变式

- 动态发现只处理 Skill，不把 Tool、MCP server 或 Plugin 当 Skill 返回。
- 命中不代表已调用。
- 已发现不绕过 `SkillTool` 校验。
- `runtimeVisible=false` 或 `modelInvocable=false` 的 Skill 不能进入结果。
- 无真实查询信号时不执行检索，也不注入空提示。
- 本阶段不改变 Skill 内容展开协议。

## 6. 非目标

- 不引入 embedding。
- 不引入 LLM rerank。
- 不做远程 Skill registry。
- 不重构会话消息物化或 ThreadDisplay。

## 7. 验收标准

- turn-zero、inter-turn 和 `DiscoverSkills` 只调用同一发现服务。
- inter-turn 不再传空查询伪装成自动发现。
- 同名不同来源候选不会在建索引前静默丢失。
- 结果包含 stable identity、来源和可解释匹配信息。
- session 发现状态能区分同名不同来源能力。
- 无输入、无候选、无命中都返回空结果且不注入 attachment。
- 发现后调用一个 Skill 时，`SkillTool` 仍重新消费统一运行时可见性。

## 8. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:extension-context-injection-planner
npm.cmd run smoke:skill-discovery-index
npm.cmd run smoke:skill-discover-tool
npm.cmd run smoke:skill-turn-zero-discovery
git diff --check
```

需要新增或扩展的 smoke：

- inter-turn 有真实信号时能命中。
- inter-turn 无信号时不查询。
- 同名不同来源候选保留 identity。
- discovery 结果不能包含模型调用已关闭的 Skill。

## 9. 完成后下一步

进入 [R5 MCP Skill 与 MCP Tool 边界闭环](./2026-06-06-extension-runtime-r5-mcp-skill-tool-boundary.md)。

## 10. 完成记录

- `skillDiscoveryService.ts` 统一建索引、查询、排序和解释结果。
- turn-zero、inter-turn 和 `DiscoverSkills` 共用同一 runtime catalog 与 discovery service。
- 候选、attachment 和 session 状态保留 stable `capabilityId`；名称仅保留兼容用途。
- inter-turn 只消费真实 tool result 信号，不再传空查询。
- 已补 discovery index、turn-zero、inter-turn 和 DiscoverSkills smoke。
