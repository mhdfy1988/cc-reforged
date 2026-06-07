# Goal：R8 旧过滤逻辑收口

## 1. 当前状态

状态：已完成（2026-06-06）。

完成事实：

- `attachments.ts` 不再直接维护静态 Skill 来源白名单。
- turn-zero discovery 已消费 `ContextInjectionPlanner.discoveryCandidates`。
- `SkillTool.validateInput` 已通过 adapter 消费统一运行时可见性。
- planner、policy 和 SkillTool 共用 `resolveSkillCommandRuntimeEligibility()`。
- `localSearch.ts` 仅保留 discovery service 兼容导出。
- `getSkillToolCommands()` 仅负责读取、catalog 去重和 candidate adapter。
- legacy command、Plugin Skill、MCP prompt 和 MCP Skill 有显式 adapter kind 和 smoke。

## 2. 目标

完成扩展能力链路的 closeout：删除重复决策，只保留明确的来源 adapter、调用 adapter 和兼容 adapter。

```text
能力事实
  -> RuntimeVisibilityResolver
  -> ContextInjectionPlanner
  -> DiscoveryService / ToolPool / InvocationAdapter
  -> ManagementProjection
```

任何下游模块不得重新发明 enabled、runtimeVisible、modelInvocable、来源白名单或 parent state 规则。

## 3. Adapter 分类

允许保留：

- `Command -> SkillCapability` 来源 adapter。
- `SkillCapability -> SkillTool command` 调用 adapter。
- legacy slash command 显式兼容 adapter。
- MCP runtime object -> MCP capability adapter。

必须删除或隔离：

- 同一状态在多个模块重复判断。
- 通过名称猜来源或父级。
- catch 后静默回到旧实现。
- 页面、attachment、search 各自维护来源白名单。
- 把 unavailable stub 包装成成功空结果。

## 4. 实施范围

### R8.1 重复判断审计

- 建立“判断项 -> 唯一 owner -> 允许 adapter”清单。
- 精确审计 Skill listing、discovery、SkillTool、MCP tool pool、Plugin child 和管理投影。
- 每个剩余判断必须能说明为何不是重复领域规则。

### R8.2 Skill command 入口瘦身

- `getSkillToolCommands()` 退化为来源 adapter 或被更明确的接口替代。
- listing、discovery 和 SkillTool 使用同一 runtime catalog snapshot 或 typed projection。
- `localSearch.ts` 不再重新执行可见性判断。

### R8.3 legacy 边界

- PromptCommand 是技术承载对象，不再作为统一能力模型的主称呼。
- legacy command 保留显式命名、显式测试和触发条件。
- MCP prompt、MCP Skill、Plugin command 不因共用 `Command` 类型而串路。

### R8.4 失败语义与文档

- 删除 silent fallback。
- unavailable、invalid、conflict 和 stale 都保留结构化诊断。
- 清理与实际实现不一致的注释、系统提示和架构文档。

### R8.5 closeout

- 更新源码证据索引。
- 更新本序列和架构路线的完成记录。
- 更新 CHANGELOG / release note。
- 完成 Desktop 手工回归。

## 5. 不变式

- Capability Catalog 只表达事实和诊断，不执行能力。
- Context Injection Planner 只决定本轮候选，不展开 Skill 内容。
- DiscoveryService 只检索，不决定安装和启用状态。
- SkillTool 调用前必须重新校验当前运行时可见性。
- 管理投影只读，不替代领域写服务。
- 不保留静默 legacy fallback。

## 6. 非目标

- 不删除仍有用户依赖且已明确隔离的 legacy command。
- 不改变 MCP tool 既有命名规则。
- 不重构 `currentContextMessages` 或 ThreadDisplay。
- 不以 closeout 名义顺手重写无关模块。

## 7. 验收标准

- enabled、runtimeVisible、modelInvocable、来源策略和父子状态各有唯一 owner。
- listing、discovery、SkillTool 和管理投影不再各自复制同一过滤逻辑。
- `getSkillToolCommands()` 已成为薄 adapter，或被职责更清晰的接口替代。
- legacy command、MCP prompt、MCP Skill 和 Plugin command 有明确路由测试。
- 所有 fallback 都是显式开关或显式兼容入口，并有日志、测试和文档。
- 代码注释、系统提示、Goal 和架构文档与实际行为一致。
- 关键链路 smoke 和 Desktop 手工回归通过。

## 8. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run smoke:extension-runtime-visibility
npm.cmd run smoke:extension-context-injection-planner
npm.cmd run smoke:skill-static-listing-filter
npm.cmd run smoke:skill-discovery-index
npm.cmd run smoke:skill-discover-tool
npm.cmd run smoke:skill-turn-zero-discovery
npm.cmd run smoke:capability-api
npm.cmd run smoke:capability-catalog-plugin-relations
npm.cmd run smoke:skill-internal-refactor
git diff --check
```

## 9. 完成后下一步

做本序列 closeout，并确认没有把未来 backlog 写成当前能力。

## 10. 完成记录

- `resolveSkillCommandRuntimeEligibility()` 成为 command type、enabled、runtimeVisible 和 modelInvocable 的唯一 Skill 调用判定入口。
- planner 与 policy 只消费 eligibility；来源是否静态注入仍由 context injection policy 独立负责。
- `getSkillToolCommands()` 退化为 runtime catalog + typed candidate adapter。
- SkillTool 的本地与 MCP Skill 合并使用同一 catalog，不再在无 MCP 时返回未投影 commands。
- `getSkillCommandAdapterKind()` 显式区分 Skill、legacy command、Plugin Skill、MCP Skill，并排除普通 MCP Prompt。
- `localSearch.ts` 仅保留 discovery service 兼容导出，不再执行可见性过滤。
- 已补 command adapter 边界 smoke，固定 legacy、Plugin Skill、MCP Prompt、MCP Skill、disabled 和 model-off 路由。
