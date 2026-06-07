# Goal Series：R28-R30 外部扩展复审收口

## 1. 背景

R25-R27 已经把 Skill request context、canonical visibility ledger 和能力管理确认 token 的主链路收住。

2026-06-07 再次按设计对外部扩展相关代码做了两轮复审，结论是主链路没有跑偏，但仍有 3 个边界需要补钉：

- `skill_listing` 静态首轮列表还在 `attachments.ts` 里用 `name` 合并 local Skill 和 MCP Skill，没有直接消费 `SkillRuntimeCatalog` 的优先级和诊断。
- 能力管理确认 token 的“何时消费”在设计文档和当前实现之间曾存在口径不一致；当前代码是 apply guard 通过后即消费，旧目标文档里曾保留“destructive action 成功后 token 失效”的表述。
- 新增的 `smoke:external-extension-matrix` 已能覆盖 77 个外部扩展用例，但还没有进入 release smoke group，发布闸门不会自动守住这组回归。

本序列不扩大能力面，只修复外部扩展链路的最后几类一致性缺口。

一句话口径：

```text
R28-R30 负责让“模型首轮看到的 Skill”和“SkillTool 实际调用的 Skill”同源，让危险管理动作确认 token 的生命周期只有一种明确语义，并把外部扩展回归矩阵纳入发布闸门。
```

## 2. 总目标

把外部扩展能力链路的展示事实、调用事实和危险动作确认事实补齐到同一套可验证契约：

```text
SkillRuntimeRequestContext
  -> SkillRuntimeCatalog
  -> skill_listing / skill_discovery / SkillTool
  -> visibility ledger

CapabilityManagementActionPlan
  -> confirmation token
  -> apply guard
  -> token lifecycle policy

ExternalExtensionSmokeMatrix
  -> release smoke group
  -> publication gate
```

关键不变式：

- `skill_listing` 不能在 `attachments.ts` 里重新发明 name-only 合并规则。
- 静态 listing、动态 discovery 和 SkillTool 必须消费同一套 runtime catalog priority。
- 同名冲突必须通过 runtime catalog diagnostic 解释，不能静默被数组顺序吞掉。
- 确认 token 的消费时机必须只有一种面向代码、文档、smoke 都一致的口径。
- 危险动作失败后是否允许复用 token 必须由明确策略决定，不能靠当前实现细节“碰巧如此”。
- 已经形成的外部扩展矩阵 smoke 必须进入至少一个发布闸门分组，不能只作为手动可选命令存在。

## 3. 审查问题总表

| 编号 | 严重级别 | 问题 | 归属 Goal |
| --- | --- | --- | --- |
| K01 | P2 | `skill_listing` 用 `uniqBy(..., "name")` 合并 local / MCP Skill，可能和 SkillTool runtime catalog 选择不同 Skill | R28 |
| K02 | P3 | 能力管理确认 token 的“成功后失效”和“校验通过即消费”两种口径并存，失败重试语义不清 | R29 |
| K03 | P3 | `smoke:external-extension-matrix` 已存在且通过，但没有进入 release smoke group，关键外部扩展回归不会自动挡住发布 | R30 |

## 4. 子 Goal

- [R28 Skill 静态 listing 接 SkillRuntimeCatalog](#r28-skill-静态-listing-接-skillruntimecatalog)
- [R29 管理动作确认 token 消费语义定型](#r29-管理动作确认-token-消费语义定型)
- [R30 外部扩展矩阵纳入发布闸门](#r30-外部扩展矩阵纳入发布闸门)

## R28 Skill 静态 listing 接 SkillRuntimeCatalog

状态：已完成（2026-06-07）。

### 目标

让 `skill_listing` 静态首轮列表和 `SkillTool` 实际调用入口使用同一份 `SkillRuntimeCatalog`，消除 `attachments.ts` 里的 name-only 合并旁路。

### 对应问题

- K01：`attachments.ts` 当前用 `uniqBy([...localCommands, ...mcpSkills], "name")`，而 SkillTool 已经使用 `createSkillRuntimeCatalog([...localCommands, ...mcpSkills])`。
- 当 legacy command 和 MCP Skill 同名时，静态 listing 可能保留 local / legacy 项，但 SkillTool 实际会按 runtime priority 选择 MCP 项。
- listing 路径不会得到 duplicate-name diagnostic，后续排查只能看到“模型看到”和“实际调用”不一致。

### 范围

- 抽出共享 helper，例如 `loadSkillRuntimeCatalogForRequestContext(...)` 或等价函数，统一完成：
  - local Skill commands 加载
  - MCP Skill commands 注入
  - `createSkillRuntimeCatalog(...)`
  - duplicate diagnostics 返回
- `attachments.ts` 的 `skill_listing` 改为消费 runtime catalog 的 `commands`，不再直接 `uniqBy(..., "name")`。
- `SkillTool` 继续消费同一个 helper，避免 helper 只服务 listing。
- `skillSearch/prefetch.ts` 如已有 catalog 构建，也要确认与新 helper 的优先级和诊断口径一致。
- visible ledger 仍记录 canonical capability id；如果 listing 被 duplicate priority 隐藏，应能通过 diagnostic 或 smoke 解释。

### 非目标

- 不改变 SkillTool 按 `name` 调用的外部协议。
- 不改变现有 Skill runtime priority 排序。
- 不把 MCP prompt 自动变成 Skill。
- 不重写动态 discovery 检索策略。

### 验收

- `skill_listing`、`skill_discovery` 和 SkillTool validate / call 使用同一套 runtime catalog priority。
- 同名 legacy command + MCP Skill fixture 下，静态 listing 和 SkillTool 实际命中的 Skill 一致。
- duplicate-name diagnostic 在 listing / SkillTool 至少一处可观测，不能被静默丢掉。
- `attachments.ts` 不再出现 local + MCP Skill 的 name-only 合并旁路。
- 已有 request-scoped `configHomeDir` A/B 隔离 smoke 仍通过。

### 建议验证

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:skill-request-context-e2e`
- `npm.cmd run smoke:skill-runtime-catalog`
- `npm.cmd run smoke:skill-visibility-ledger`
- 新增或扩展 `smoke:skill-listing-runtime-catalog-alignment`

### 完成记录

- 新增 `src/skills/skillRuntimeCatalogLoader.ts`，统一加载 request-scoped model-invocable Skill runtime catalog。
- `skill_listing`、`SkillTool` 和 `skill_discovery` 已改为消费同一套 runtime catalog priority；`attachments.ts` 不再保留 local / MCP 的 name-only merge 旁路。
- `skillSearch/prefetch.ts` 对共享 loader 使用运行时懒加载，避免 `commands.ts` 与 discovery 模块初始化时形成 ESM require cycle。
- 新增 `smoke:skill-listing-runtime-catalog-alignment`，覆盖 legacy command 与 MCP Skill 同名时静态 listing 和 discovery 都保留 runtime catalog 选中的 MCP 项。

## R29 管理动作确认 token 消费语义定型

状态：已完成（2026-06-07）。

### 目标

把能力管理确认 token 的生命周期口径定死，并让代码、文档和 smoke 使用同一语义。

推荐定型口径：

```text
确认 token 是一次性的 apply-attempt token。
当服务端使用当前投影重新生成 plan，并通过 token / 过期时间 / state digest 校验后，本次确认即被消费。
底层动作成功时 token 已不可复用；底层动作失败时也不复用旧 token，而是要求 UI 或调用方重新 plan。
```

选择这个口径的原因：

- 危险动作一旦跨过 apply guard，就已经进入可能产生副作用的边界。
- 底层失败可能是部分副作用、远端状态变化、文件写入中断或真实无副作用错误；没有统一回滚信号前，不应默认允许旧确认重放。
- 重新 plan 可以重新读取当前 `cwd/configHomeDir`、ownership、allowedActions 和状态摘要，符合能力管理动作的安全边界。

### 对应问题

- K02：R27 目标文档中曾同时出现“成功后 token 失效”和“校验通过后标记已使用”两种表述。
- 当前实现虽然更接近 apply-attempt token，但函数命名、文档和 smoke 没有把失败重试语义讲清楚。

### 范围

- 在管理动作确认 token 代码附近补清楚语义，避免后续误改成“失败后复用旧 token”。
- 如果函数名或参数名容易误导，做轻量命名或注释收口；不需要重写整个 action service。
- smoke 增加“guard 通过后底层动作失败，旧 token 不可复用，调用方需要重新 plan”的用例。
- 本阶段更新 R25-R27 goal 文档中“destructive action 成功后 token 失效”的旧口径，改成“apply attempt 被接受后 token 失效”。
- 更新架构路线中确认 token 生命周期说明。

### 非目标

- 不实现跨进程持久化 token。
- 不实现失败动作自动重试。
- 不为每种 Skill / MCP 管理动作设计细粒度回滚协议。
- 不改变前端二次确认交互。
- 不新增管理动作类型。

### 验收

- 代码、goal 文档、架构文档对 token 消费时机使用同一口径：apply attempt accepted 后消费。
- 过期 token、状态漂移 token、重复 token 仍然失败。
- guard 通过但底层 action 抛错后，同一个 token 再次 apply 会失败。
- UI / API 调用方可以从错误响应或文档语义知道：失败后应重新 plan，而不是复用旧 token。
- release smoke 覆盖 token 不可预测、过期、状态漂移、重复使用、blocked plan 和底层失败后的不可复用。

### 建议验证

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:capability-management-confirmation-token`
- `npm.cmd run smoke:capability-management-actions`
- `npm.cmd run smoke:extension-capability-management-e2e`

### 完成记录

- `canApplyCapabilityManagementAction(...)` 已补充 apply-attempt token 语义注释：guard 接受后即消费 token，后续域动作失败也必须重新 plan。
- `smoke:capability-management-confirmation-token` 已增加 guard 通过后旧 token 不可复用的用例。
- R25-R27 goal 文档和本 roadmap 中的旧“成功后失效”口径已同步为“apply attempt 被接受后失效”。

## R30 外部扩展矩阵纳入发布闸门

状态：已完成（2026-06-07）。

### 目标

把已经存在的外部扩展矩阵 smoke 纳入 release smoke group，让 Skill / MCP / Plugin / Tool / Capability Catalog / 管理动作这些跨域回归在发布前自动执行。

### 对应问题

- K03：`package.json` 已有 `smoke:external-extension-matrix`，且当前自测通过 77 个用例。
- `scripts/run-release-smoke-group.mjs` 的 `skill`、`skill-internal`、`mcp`、`desktop` 等分组还没有包含该矩阵。
- 这会导致外部扩展关键边界只在手动调用时被验证，发布前可能漏跑。

### 范围

- 决定 `smoke:external-extension-matrix` 应进入哪些 release group。
  - 推荐至少加入 `skill` 和 `mcp`，因为矩阵同时覆盖 Skill listing / discovery / SkillTool、MCP tool、Plugin relation、Tool snapshot 和能力管理动作。
  - 如需控制 desktop release gate 时长，Desktop 组可只保留现有端到端 smoke，不强制加入该矩阵。
- 更新 `scripts/run-release-smoke-group.mjs`，确保发布前会自动执行外部扩展矩阵。
- 更新 release gate / goal 文档，说明该矩阵是外部扩展跨域回归，不替代真实 Desktop 手工验收。
- 自测矩阵用例数仍必须不少于 50；当前基线为 77。

### 非目标

- 不把矩阵拆成 77 个 npm script。
- 不让矩阵启动真实 Desktop、真实 MCP 进程或真实网络连接。
- 不用矩阵替代已有领域 smoke；它只作为跨域不变式补充。
- 不在本阶段修复 R28 / R29 的业务逻辑。

### 验收

- `run-release-smoke-group.mjs` 中至少一个发布前分组包含 `smoke:external-extension-matrix`。
- `npm.cmd run smoke:external-extension-matrix` 继续通过，并打印不少于 50 个用例。
- 被选中的 release group 能顺序执行到该矩阵；如果前置 step 失败，应保留既有 fail-fast 行为。
- 文档明确该矩阵覆盖外部扩展跨域不变式：Capability Catalog、Skill、MCP、Plugin、Tool、管理动作。

### 建议验证

- `npm.cmd run smoke:external-extension-matrix`
- `npm.cmd run smoke:skill-release`
- `npm.cmd run smoke:mcp-release`
- `git diff --check`

### 完成记录

- `smoke:external-extension-matrix` 已加入 `mcp`、`skill` 和 `skill-internal` release smoke group。
- `smoke:skill-runtime-dynamic-catalog`、`smoke:skill-runtime-mcp-catalog` 和 `smoke:skill-runtime-catalog-unified` 已统一走 `bun-bundle-loader`，避免 release group 执行 dist alias 时找不到 `src` 包。
- `smoke:mcp-release` 和 `smoke:skill-release` 已完整跑到 `smoke:external-extension-matrix`，矩阵保持 77 cases 通过。

## 5. 推荐执行顺序

```text
R28 -> R29 -> R30
```

原因：

- R28 先修模型上下文和 SkillTool 事实不一致，这是用户可感知的 P2 行为问题。
- R29 再统一 token lifecycle，这是安全语义和文档一致性问题，不影响 Skill 唤醒主链路。
- R30 最后把新增矩阵纳入 release gate，确保 R28 / R29 以及外部扩展既有边界后续不再靠手动记忆验证。

## 6. 总体验收

R28-R30 完成时：

- 静态 `skill_listing`、动态 `skill_discovery` 和 `SkillTool` 不再各自决定同名 Skill 优先级。
- local / MCP / legacy 同名冲突能通过 runtime catalog 解释，不靠 name-only merge 静默吞掉。
- 管理动作确认 token 的消费时机在代码、文档、smoke 中一致。
- 失败后的危险动作重试策略明确：重新 plan，重新确认。
- `smoke:external-extension-matrix` 纳入发布闸门，外部扩展跨域不变式不再只是手动自测。

完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:skill-listing-runtime-catalog-alignment`
- `npm.cmd run smoke:skill-request-context-e2e`
- `npm.cmd run smoke:capability-management-confirmation-token`
- `npm.cmd run smoke:external-extension-matrix`
- `npm.cmd run smoke:mcp-release`
- `npm.cmd run smoke:skill-release`
- `git diff --check`
