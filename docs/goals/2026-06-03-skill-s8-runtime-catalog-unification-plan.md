# Goal S-8：Skill 运行时 Catalog 统一

## 1. 目标

S-8 的目标是把 local skill、managed installed skill、plugin / bundled skill、dynamic skill 和 MCP skill 的运行时合并与冲突诊断收敛到统一 catalog。

当前已经有 `SkillRuntimeCatalog`，但仍存在分散合并：

```text
getCommands(cwd)
  -> 合并本地 / plugin / bundled / managed skill
  -> dynamic skill 后段单独追加

SkillTool
  -> 再把 AppState.mcp.commands 中的 MCP skill 手动 uniqBy 合并
```

S-8 完成后，SkillTool、slash command、上下文分析和 Desktop 诊断应能看到同一套运行时来源、优先级和 duplicate diagnostics。

## 2. 为什么独立做

S-6 已经让 installed managed skill 进入运行时，S-7 会继续补来源扩展。此时如果不统一 catalog，会出现：

- 同名冲突在不同入口表现不一致。
- MCP skill 和 local skill 冲突时没有完整诊断。
- dynamic skill 只在 `getCommands()` 后段追加，优先级不进入统一规则。
- SkillTool 可见列表和 slash command 可见列表可能不一致。
- 后续做 CLI / Desktop 诊断时需要重复推断。

S-8 专门解决“运行时事实只有一个”的问题。

## 3. 范围

本阶段做：

- 定义统一 `SkillRuntimeSource` / `SkillRuntimeCommandRef`。
- 让 dynamic skill 进入 `SkillRuntimeCatalog` 排序与诊断。
- 让 MCP skill 进入统一 catalog，而不是 SkillTool 内部 `uniqBy`。
- 输出 duplicate、hidden、disabled、unavailable 等诊断。
- `getSkillToolCommands` 和 slash command 消费同一 catalog，再按 model/user invocation 过滤。
- Desktop / App Server 可读取 runtime catalog diagnostics。
- smoke 覆盖 local / managed / dynamic / MCP 冲突。

本阶段不做：

- 不改变 MCP 工具调用协议。
- 不改变 `mcp__server__tool` 工具命名。
- 不做远端 registry。
- 不做 Skill 搜索推荐。
- 不把所有 Skill 正文塞进上下文。

## 4. 统一来源模型

建议运行时来源顺序：

```text
project
user
managed
plugin
bundled
dynamic
mcp
legacy-command
```

优先级原则：

- 用户显式放在项目 / 用户目录的 Skill 优先。
- CCR managed installed skill 优先于 plugin / bundled。
- dynamic skill 是会话中被文件操作发现的临时来源，优先级低于显式安装。
- MCP skill 来自外部服务，应进入诊断，但不压过本地 Skill。
- legacy command 保持最后，避免旧命令静默遮蔽标准 Skill。

## 5. 建议代码结构

```text
src/skills/skillRuntimeCatalog.ts
src/skills/skillRuntimeSources.ts
src/skills/skillRuntimeDiagnostics.ts
scripts/smoke-skill-runtime-catalog-unified.mjs
```

现有接入点：

```text
src/commands.ts
src/tools/SkillTool/SkillTool.ts
src/hooks/useMergedCommands.ts
src/components/skills/SkillsMenu.tsx
src/app-server/handlers/skillHandlers.ts
src/core/skillCore.ts
```

## 6. 迭代拆分

### S-8.1 Catalog 输入模型

目标：

- 给所有 command 来源包装统一 runtime ref。
- 记录 source、loadedFrom、originPath、modelInvocable、userInvocable。
- 不改变外部 `Command` 基础结构。

验收：

```powershell
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run typecheck -- --pretty false
```

### S-8.2 Dynamic skill 纳入 catalog

目标：

- `getDynamicSkills()` 不再在 `getCommands()` 尾部单独做简单去重。
- dynamic skill 进入同一排序和 duplicate diagnostics。
- 缓存刷新逻辑保持有效。

验收：

```powershell
npm.cmd run smoke:skill-runtime-dynamic-catalog
npm.cmd run smoke:skill-runtime-catalog
```

### S-8.3 MCP skill 纳入 catalog

目标：

- SkillTool 不再自己 `uniqBy([...localCommands, ...mcpSkills], 'name')`。
- MCP prompt skill 通过统一入口参与排序。
- 冲突时输出 kept / skipped 诊断。

验收：

```powershell
npm.cmd run smoke:skill-runtime-mcp-catalog
npm.cmd run smoke:skill-runtime-tool-context
```

### S-8.4 Runtime diagnostics 暴露

目标：

- App Server / Desktop 能读取 runtime diagnostics。
- 诊断至少包含 duplicate name、被隐藏来源、保留来源、原因。
- 不把诊断混入模型 prompt 正文。

验收：

```powershell
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-runtime-catalog-unified
```

### S-8.5 文档与回归

目标：

- 更新 Skill 运行时文档。
- 更新 CHANGELOG。
- 固定 local / managed / dynamic / MCP 冲突矩阵。

验收：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
git diff --check
```

## 7. 成功标准

S-8 完成时：

- SkillTool 和 slash command 使用同一 runtime catalog。
- dynamic skill 不再绕开 catalog 诊断。
- MCP skill 不再由 SkillTool 私下去重。
- 同名冲突有稳定优先级和可展示诊断。
- Desktop 可查看 runtime catalog 诊断，不需要自行推断冲突。

## 8. 后续入口

S-8 完成后进入 S-9：补 Skill CLI 管理，让 Desktop / App Server 已有管理能力在命令行可用。

## 9. 完成记录

状态：已完成。

落地内容：

- `src/skills/skillRuntimeCatalog.ts` 作为统一运行时 catalog，输出保留 command、duplicate diagnostics 和 latest diagnostics。
- `src/commands.ts` 让 `getCommands()` 中的 local、managed、plugin、bundled 和 dynamic skill 统一进入 runtime catalog；dynamic skill 不再在尾部单独追加。
- `src/tools/SkillTool/SkillTool.ts` 让 MCP skill 通过 `getMcpSkillCommands()` 后进入同一 runtime catalog；SkillTool 不再用私有 `uniqBy` 合并 MCP skill。
- `src/services/skills/managementService.ts` 在 Skill 管理状态里暴露 `runtimeDiagnostics`，供 App Server / Desktop 读取。
- `src/skills/loadSkillsDir.ts` 为 dynamic skill 标记 `loadedFrom: 'dynamic'`，避免它因 `source: projectSettings` 被误判成本地项目 skill。
- legacy `.claude/commands/*.md` 明确排在标准 Skill、dynamic skill 和 MCP skill 之后，避免旧命令静默遮蔽标准 Skill。

补充 smoke：

- `smoke:skill-runtime-catalog`
- `smoke:skill-runtime-dynamic-catalog`
- `smoke:skill-runtime-mcp-catalog`
- `smoke:skill-runtime-catalog-unified`
- `smoke:skill-runtime-tool-context`
- `smoke:skill-management-api`

验证记录：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-dynamic-catalog
npm.cmd run smoke:skill-runtime-mcp-catalog
npm.cmd run smoke:skill-runtime-catalog-unified
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-management-api
```
