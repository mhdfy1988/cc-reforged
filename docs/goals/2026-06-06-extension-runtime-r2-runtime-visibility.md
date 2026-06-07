# Goal：R2 运行时可见性 Resolver

## 1. 目标

抽出统一运行时可见性 Resolver，集中判断扩展能力当前是否能成为运行时候选，以及模型、用户和工具通道是否可调用。

本阶段要统一这些概念：

```text
enabled
runtimeVisible
modelInvocable
userInvocable
toolInvocable
hiddenReasons
diagnostics
```

## 2. 为什么现在做

R1 只能回答“能力存在吗、来自哪里”。但上下文注入和执行更关心：

- 它现在完整吗？
- 它被用户启用了吗？
- 模型能不能主动调用？
- 用户能不能通过 slash command 调用？
- 它能不能作为 tool schema 暴露？
- 如果不能，原因是什么？

这些判断目前散落在管理服务、runtime catalog、command filter、attachment、SkillTool 和 MCP tool pool 中，需要先收拢。

## 3. 范围

第一阶段以 Skill 为主，兼顾 MCP / Tool 只读状态：

- Skill：
  - installed package 状态。
  - enabled。
  - modelInvocable。
  - userInvocable。
  - runtimeVisible。
  - conflict loser。
  - disabled / missing / drifted / invalid / unsupported reason。
- MCP / Tool：
  - server connected / failed / disabled。
  - tool denied / unavailable。
  - toolInvocable。
  - 只读输出，不在本阶段改 MCP 连接逻辑。
- Plugin：
  - child capability 继承或关联 plugin disabled / unavailable 状态。

## 4. 输出模型

建议输出：

```text
RuntimeCapability
  fact
  state
  runtimeVisible
  modelInvocable
  userInvocable
  toolInvocable
  hiddenReasons[]
  diagnostics[]
```

hidden reason 应至少覆盖：

```text
disabled
model-invocation-disabled
user-invocation-disabled
tool-denied
missing-package
missing-skill-md
missing-owner-marker
missing-lock
drifted
invalid
conflict-loser
unsupported-kind
source-unavailable
plugin-disabled
mcp-server-unavailable
```

## 5. 非目标

- 不改 Skill 标准格式。
- 不改变 SkillTool prompt 展开协议。
- 不实现新的 discovery。
- 不重写 Capability Catalog provider。
- 不改 Desktop UI。

## 6. 验收标准

- `modelInvocable=false` 不再被 UI 或诊断显示成 Skill 禁用。
- installed package 缺失、漂移、无 lock、无 owner marker 都有统一 hidden reason。
- disabled Skill 不进入 runtimeVisible。
- SkillTool、slash command、管理页能消费同一组运行时状态，或通过明确 adapter 读取同一 resolver 输出。
- Resolver 抛错时失败快并输出诊断，不 silent fallback 到旧判断。

## 7. 建议验证

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:skill-internal-refactor
npm.cmd run smoke:skill-runtime-helpers
npm.cmd run smoke:capability-api
git diff --check
```

如新增 resolver 专项 smoke，命名建议：

```text
smoke:extension-runtime-visibility
```

## 8. 完成后下一步

进入 [R3 上下文注入计划抽出](./2026-06-06-extension-runtime-r3-context-injection-planner.md)，用统一运行时可见性生成 `skill_listing`、`skill_discovery` 候选和隐藏原因。

## 9. 完成记录

完成状态：已完成（2026-06-06）。

落地内容：

- 新增 `src/services/capabilities/capabilityRuntimeVisibility.ts`，集中生成 `runtimeVisible`、`available`、`hiddenReasons` 和运行时 diagnostics。
- 新增 `src/skills/skillCommandRuntimeVisibility.ts`，让 SkillTool 的模型调用面校验通过 adapter 消费同一 resolver 语义。
- `ExtensionCapabilityState` 增加 `hiddenReasons`，用于表达禁用、缺包、漂移、缺 lock、缺 owner marker、模型调用关闭、工具不可调用、冲突 loser 等原因。
- Capability Catalog 构建时统一调用 resolver，再做同类运行时冲突处理。
- `modelInvocable=false` 只生成 `model-invocation-disabled`，不再被等同于 Skill 禁用；如果 `userInvocable=true`，该 Skill 仍可保持可用状态。

验证：

- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd run smoke:extension-runtime-visibility`
- `npm.cmd run smoke:skill-internal-refactor`
- `git diff --check`
