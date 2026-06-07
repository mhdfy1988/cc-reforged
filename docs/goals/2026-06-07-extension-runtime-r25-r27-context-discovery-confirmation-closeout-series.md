# Goal Series：R25-R27 上下文同源、发现去重与确认令牌收口

## 1. 背景

R17-R24 已经完成了统一能力目录、MCP 管理动作边界、Skill 安装事务、Tool 真实工具池和 App / Plugin 关系契约的主体收口。

但对 R17-R24 的复审又确认了 3 个没有完全钉牢的边界：

- Skill 管理目录已经支持 request-scoped `configHomeDir`，但真实 `skill_listing`、`skill_discovery` 和 `SkillTool` 执行入口仍可能回到默认 home。
- Skill discovery 的 visible / loaded / discovered 去重类型里有 canonical capability id，但实际记录和过滤仍偏 name。
- 能力管理动作的确认 token 仍是静态串，没有过期时间、状态摘要或 nonce。

本序列不扩大功能面，只补齐这 3 个 R17-R24 后的验收缺口。

一句话口径：

```text
R25-R27 负责让“管理页看得到、模型上下文看得到、SkillTool 真能调用、危险动作能安全确认”四件事使用同一份当前请求事实。
```

## 2. 总目标

把 Skill 的 request context、上下文可见性记录和管理动作确认都收束成可验证的运行时契约：

```text
当前请求
  -> SkillRuntimeRequestContext(cwd, configHomeDir, mcpCommands)
  -> runtime catalog / listing / discovery / SkillTool
  -> visibility ledger(visible, discovered, loaded)
  -> management action plan state digest + confirmation token
```

关键不变式：

- 如果入口已经给出 `configHomeDir`，后续 Skill runtime、上下文注入、discovery 和 SkillTool 不能静默回默认 home。
- `skill_listing`、`skill_discovery` 和 SkillTool 调用后的 loaded 状态必须记录 canonical capability id。
- 有 canonical capability id 时，discovery 去重不能只靠 name 隐藏不同来源的 Skill。
- catalog 查询仍保留完整清单语义；任务查询才应用 visible / discovered / loaded 去重。
- 危险管理动作 apply 时必须重新计算当前投影；确认 token 只能匹配同一目标、同一动作、同一状态摘要，并且有过期或一次性约束。

## 3. 审查问题总表

| 编号 | 严重级别 | 问题 | 归属 Goal |
| --- | --- | --- | --- |
| J01 | P2 | Skill 的真实上下文 / SkillTool 执行入口还没完全收到 request-scoped `configHomeDir` | R25 |
| J02 | P2 | visible / loaded / discovered 的 canonical ID 去重没有完整落地，name 过滤可能误伤同名不同来源 Skill | R26 |
| J03 | P3 | 管理动作确认 token 仍是静态串，没有状态摘要、过期时间或 nonce | R27 |

## 4. 子 Goal

- [R25 Skill request context 贯穿到注入与 SkillTool](#r25-skill-request-context-贯穿到注入与-skilltool)
- [R26 Skill visibility ledger 与 canonical 去重](#r26-skill-visibility-ledger-与-canonical-去重)
- [R27 能力管理确认 token 状态绑定](#r27-能力管理确认-token-状态绑定)

## R25 Skill request context 贯穿到注入与 SkillTool

状态：已完成（2026-06-07）。

### 目标

让 Skill 管理目录、`skill_listing`、`skill_discovery` 和 `SkillTool` 执行入口全部消费同一个当前请求上下文。

### 对应问题

- J01：Capability API 已经能按 `configHomeDir` 列 Skill，但真实注入和 SkillTool 调用仍可能读默认 home。
- R21 的“运行时目录同源”在管理目录和 provider 层完成，但还没有贯穿到上下文附件和最终调用入口。

### 范围

- 抽出 `SkillRuntimeRequestContext` 或等价 helper，统一表达：
  - `cwd`
  - `configHomeDir`
  - 当前 AppState 中的 MCP Skill commands
- `ToolUseContext` 或其 options 增加当前请求的 `configHomeDir` 来源；App Server / QueryEngine 负责写入。
- `getSkillToolCommands(cwd)` 改为支持 `{ configHomeDir }`，并让旧签名成为薄 adapter。
- `SkillTool` 的 prompt、validate、permission、call 都从同一个 request context 取 Skill commands。
- `attachments.ts` 的 `skill_listing` 和 `skillSearch/prefetch.ts` 的 discovery catalog 都传入同一个 `configHomeDir`。
- 清理或标注仍只能读默认 home 的 legacy 调用点，避免静默 fallback。

### 非目标

- 不重写 `getClaudeConfigHomeDir()`。
- 不改变 Skill 安装目录结构。
- 不改变 SkillTool 展开 `SKILL.md` 的消息协议。
- 不重写 Desktop Skill 页面。

### 验收

- 指定临时 `configHomeDir=A` 时，管理目录、listing、discovery 和 SkillTool 都只看到 A 的 managed/user Skill。
- 指定临时 `configHomeDir=B` 时，不会串到 A 或默认 home。
- `SkillTool.validateInput()` 和 `SkillTool.call()` 能调用管理目录中同一个 canonical capability 对应的 Skill。
- smoke 覆盖 capability list、`skill_listing`、`DiscoverSkills`、SkillTool validate/call 四条路径的 configHome 同源。
- 旧 `getSkillToolCommands(cwd)` 调用点要么传入上下文，要么被明确标记为兼容 adapter。

### 建议验证

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-catalog-skill-provider`
- 新增 `npm.cmd run smoke:skill-request-context-e2e`
- `npm.cmd run smoke:skill-runtime-tool-context`

### 完成记录

- 新增 `SkillRuntimeRequestContext`，统一承载当前请求 `cwd/configHomeDir/mcpCommands`。
- `ToolUseContext.options.configHomeDir` 已由 QueryEngine 和 Core turn runner 写入。
- `getSkillToolCommands(cwd, { configHomeDir })` 已成为 SkillTool / listing / discovery 共享入口；旧 `getSkillToolCommands(cwd)` 保留为默认 home 兼容 adapter。
- `attachments.ts`、`skillSearch/prefetch.ts`、`DiscoverSkills` 和 `SkillTool.validateInput()` / `SkillTool.call()` 已消费同一 request context。
- `smoke:skill-request-context-e2e` 覆盖 configHome A/B 隔离、discovery catalog、`DiscoverSkills`、SkillTool validate/call 和 loaded capability id 记录。

## R26 Skill visibility ledger 与 canonical 去重

状态：已完成（2026-06-07）。

### 目标

把 `visible`、`discovered`、`loaded` 三类上下文可见性记录从 name-based 补齐为 canonical capability id based，避免同名不同来源 Skill 被误过滤。

### 对应问题

- J02：类型里已有 `visibleSkillCapabilityIds` / `loadedSkillCapabilityIds`，但 listing 只写 name。
- `SkillTool.call()` 成功展开后没有写 loaded 状态。
- discovery filter 同时把 name 当强过滤条件，可能隐藏不同 capability id 的同名 Skill。

### 范围

- 抽出 `SkillVisibilityLedger` 或等价 helper，统一提供：
  - `recordVisibleSkill(candidate)`
  - `recordDiscoveredSkill(candidate)`
  - `recordLoadedSkill(command | capability)`
  - `isSkillAlreadySurfaced(candidate, mode)`
- `skill_listing` 记录 name 的同时必须记录 capability id；记录来源应来自 `SkillContextInjectionPlan` 或 `resolveSkillCommandRuntimeVisibility()`。
- `DiscoverSkillsTool` 与自动 `skill_discovery` 记录 discovered name 和 capability id。
- `SkillTool` inline、fork、remote 成功加载后写入 loaded name 和 capability id。
- discovery 任务查询优先按 capability id 去重；name fallback 只允许用于没有 capability id 的 legacy entry，不允许隐藏另一个不同 capability id。
- 保持 catalog 查询完整返回，不应用 visible / discovered / loaded 过滤。

### 非目标

- 不引入 embedding 或 LLM rerank。
- 不允许模型按 capability id 直接调用 Skill；SkillTool 仍按 Skill name 调用并走 runtime 校验。
- 不改变 duplicate-name runtime priority 规则；同名冲突的可调用性仍由 runtime catalog 决定。

### 验收

- 已 listing 的 Skill 在任务 discovery 中不会重复出现。
- 已 discovered 的 Skill 在同一会话后续任务 discovery 中不会重复出现。
- SkillTool 成功加载某个 Skill 后，该 Skill 不再被 discovery 重复推荐。
- 同名不同来源但 capability id 不同的 discovery entry 不会被 name-only 误过滤；如果 runtime catalog 判定其中一个不可调用，应通过 `runtimeVisible=false` 或 diagnostic 解释，而不是由 ledger 静默吞掉。
- smoke 覆盖 visible-id、discovered-id、loaded-id、same-name-different-source 和 catalog query 不过滤。

### 建议验证

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:skill-discover-tool`
- `npm.cmd run smoke:skill-turn-zero-discovery`
- `npm.cmd run smoke:skill-inter-turn-discovery`
- 新增 `npm.cmd run smoke:skill-visibility-ledger`

### 完成记录

- 新增 `SkillVisibilityLedger`，统一提供 `recordVisibleSkill`、`recordDiscoveredSkill`、`recordLoadedSkill` 和 `isSkillAlreadySurfaced`。
- `skill_listing` 现在用 `SkillContextInjectionPlan` / runtime visibility 记录 visible name 与 canonical capability id。
- `DiscoverSkillsTool` 和自动 `skill_discovery` 现在通过 ledger 写入 discovered name 与 capability id。
- `SkillTool` inline / fork / remote 成功加载后写入 loaded 状态；本地 prompt command 会写入 canonical capability id。
- discovery 任务查询有 capability id 时只按 capability id 去重，name fallback 只用于没有 capability id 的 legacy entry；catalog query 不套 visible / discovered / loaded 过滤。
- `smoke:skill-visibility-ledger` 覆盖 visible-id、loaded-id、同名不同来源不误过滤和 catalog query 完整返回。

## R27 能力管理确认 token 状态绑定

状态：已完成（2026-06-07）。

### 目标

把危险能力管理动作的确认 token 从静态字符串改成绑定当前 plan 状态的短期确认凭据。

### 对应问题

- J03：当前 token 仍是 `capability-action:${capabilityId}:${action}:${actionRef}`。
- 如果后续开放更多外部调用，静态 token 可能被过期确认复用。
- R24 只把管理动作纳入 smoke，没有真正修复 I17。

### 范围

- 为管理动作 plan 生成 `planId`、`issuedAt`、`expiresAt` 和 `stateDigest`。
- `stateDigest` 至少绑定：
  - `capabilityId`
  - `action`
  - `actionRef`
  - `managementOwnership`
  - `allowedActions`
  - 关键状态字段：`enabled`、`configured`、`runtimeConnected`、`installed`、`available`、`status`
  - 当前 `cwd` / `configHomeDir` 或等价上下文标识
- confirmation token 使用 opaque nonce；nonce 与 plan digest、过期时间保存在短期内存 store 中，或使用等价的可验证短期签名方案。
- apply 阶段重新计算 management projection 和 plan，再校验：
  - token 存在
  - token 未过期
  - token 对应同一 plan digest
  - apply attempt 被 guard 接受后 token 失效
- blocked plan 不发放可 apply 的 confirmation token。

### 非目标

- 不实现跨进程持久化 token。
- 不实现 OAuth / App connector 授权流程。
- 不改变前端二次确认交互，只改变 token 语义和 apply 校验。
- 不扩大管理动作种类。

### 验收

- 同一个 capability/action/actionRef 每次 plan 生成的 token 不再是静态可预测字符串。
- 过期 token apply 失败。
- capability 状态变化后，旧 token apply 失败。
- actionRef / ownership / allowedActions 变化后，旧 token apply 失败。
- apply attempt 被 guard 接受后 token 不能再次复用；底层动作失败后也要重新 plan。
- smoke 覆盖 token 过期、状态漂移、actionRef 不匹配、重复使用和 blocked plan。

### 建议验证

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:capability-management-mcp-runtime`
- 新增 `npm.cmd run smoke:capability-management-confirmation-token`

### 完成记录

- 管理动作 plan 已生成 `planId`、`issuedAt`、`expiresAt`、`stateDigest`。
- `stateDigest` 绑定 capability id、action、actionRef、management ownership、allowedActions、关键状态字段以及当前 `cwd/configHomeDir`。
- confirmation token 已改为短期 opaque nonce，并写入进程内 token store；blocked plan 不再发放可 apply token。
- apply 阶段重新计算当前 management projection 和 plan，并校验 token 存在、未过期、state digest 一致且未被使用。
- confirmation token 在 apply guard 校验通过后标记已使用，重复使用会失败。
- `smoke:capability-management-confirmation-token` 覆盖 token 不可预测、过期、状态漂移、actionRef 不匹配、重复使用、blocked plan 和 guard 通过后底层动作失败不可复用。

## 5. 推荐执行顺序

```text
R25 -> R26 -> R27
```

原因：

- R25 先统一 request context，否则 R26 记录的 visible / loaded / discovered 仍可能来自不同 home。
- R26 再修上下文可见性 ledger，确保模型看到、发现、加载后的状态同源且可去重。
- R27 最后收危险动作确认语义，避免管理动作在扩展入口增加后留下安全债。

## 6. 总体验收

R25-R27 完成时：

- 指定 `configHomeDir` 的 Skill 在管理目录、上下文 listing、动态 discovery 和 SkillTool 调用中同源。
- visible / discovered / loaded 都有 canonical capability id 记录。
- discovery 不再用 name-only 误过滤不同 capability id 的 Skill。
- 管理动作确认 token 有状态绑定、过期约束和复用约束。
- release gate 纳入 R25-R27 的关键 smoke。

完成结论：

- 已完成。R25-R27 的代码、smoke、release group 和文档均已收口。

建议验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `git diff --check`
- `npm.cmd run smoke:skill-request-context-e2e`
- `npm.cmd run smoke:skill-visibility-ledger`
- `npm.cmd run smoke:capability-management-confirmation-token`
- `npm.cmd run smoke:skill-internal-refactor`

已执行验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:skill-request-context-e2e`
- `npm.cmd run smoke:skill-visibility-ledger`
- `npm.cmd run smoke:capability-management-confirmation-token`
- `npm.cmd run smoke:skill-discover-tool`
- `npm.cmd run smoke:skill-turn-zero-discovery`
- `npm.cmd run smoke:skill-inter-turn-discovery`
- `npm.cmd run smoke:skill-runtime-tool-context`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:capability-management-mcp-runtime`
- `npm.cmd run smoke:capability-catalog-skill-provider`
- `npm.cmd run smoke:skill-internal-refactor`

## 7. 文档收口要求

每个子 goal 完成后必须同步更新：

- [CCR 扩展能力体系总览](../architecture/extension-capability-system.md)
- [CCR 扩展能力运行时与上下文重构路线](../architecture/extension-runtime-context-refactor-roadmap.md)
- [CCR Skill 系统整体架构](../architecture/skill-system-architecture.md)
- 本文对应子 goal 的完成记录
- `CHANGELOG.md` 只记录已完成项，不记录计划项

如果实现时发现其中任一项需要扩大到 UI 或协议破坏性变更，必须先拆新 goal，不要把额外范围塞进本序列。
