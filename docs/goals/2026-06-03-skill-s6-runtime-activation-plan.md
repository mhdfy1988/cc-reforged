# Goal S-6：Skill 运行时启用治理与 installed package 接入

## 1. 目标

S-6 的目标是让 S-3 安装记录和 S-5 管理状态真正影响运行时：

```text
~/.ccr/skills/installed.json + lock.json + packages/
  -> InstalledSkillRuntimeLoader
  -> SkillCatalog
  -> SkillCommandAdapter
  -> getSkillToolCommands / slash commands
  -> SkillTool prompt / 用户显式调用
```

S-6 完成后，Desktop 写入的启用状态必须在模型上下文和 slash command 中生效。

## 2. 为什么 S-6 独立

S-1 到 S-4 已经建立模型、导入、安装和安全扫描。S-5 负责 Desktop 管理面。

但当前运行时仍主要依赖已有 `.claude/skills`、bundled、plugin、MCP 和 legacy command 链路。`~/.ccr/skills/packages/<name>/` 还没有作为正式运行时来源进入 `getSkillToolCommands`。

如果在 S-5 UI 里直接改 runtime，会导致：

- UI 写状态和模型上下文加载耦合。
- disabled 状态可能只在页面显示，不在模型上下文生效。
- installed package 与 user/project/plugin/bundled skill 的冲突处理不清楚。
- drifted / missing package 可能被静默跳过或静默回退旧路径。

S-6 单独做运行时治理，可以把“管理状态”变成“运行时事实”。

## 3. 范围

本阶段做：

- 新增 installed skill runtime loader。
- 从 `installed.json` / `lock.json` / owner marker 读取 CCR-owned packages。
- 对 installed package 重新归一为 `CcrSkillPackage`。
- 应用 `enabled`、`modelInvocable`、`userInvocable` 状态。
- 与现有 `.claude/skills`、bundled、plugin、MCP skill 合并进 `SkillCatalog`。
- 明确冲突优先级和诊断。
- 让 `getSkillToolCommands(cwd)` 能看到 enabled installed skill。
- 让 slash command 只看到 user-invocable installed skill。
- 让 disabled / drifted / missing / invalid 不进入模型上下文。
- 增加 smoke 覆盖 enabled / disabled / modelInvocable / userInvocable / drifted。

本阶段不做：

- 不做 Desktop UI。
- 不做远端 registry。
- 不做安全规则新增。
- 不自动修复 drifted package。
- 不执行 Skill 资源脚本。
- 不把安全报告全文塞入模型上下文。

## 4. 运行时来源

S-6 新增 CCR installed source：

```text
~/.ccr/skills/packages/<name>/SKILL.md
```

建议归一后：

```ts
CcrSkillPackage.source = 'managed'
CcrSkillPackage.origin.vendor = installed lock originVendor
CcrSkillPackage.origin.importedFrom = manifest.source.path
```

原因：

- `managed` 表示 CCR 管理目录，不是普通本地 imported source。
- vendor 仍然保留 Claude / Codex / OpenClaw / agent-skills 等来源。
- install manifest 和 installed record 不写进标准 `SKILL.md`。

## 5. 激活策略

S-6 不仅是读取文件，还要执行运行时 gating。

### 5.1 基础规则

```text
installedRecord.enabled = false
  -> 不进入 SkillTool prompt
  -> 不进入 slash command

installedRecord.modelInvocable = false
  -> 不进入 SkillTool prompt

installedRecord.userInvocable = false
  -> 不进入 slash command

inspection.status = drifted / missing-* / invalid
  -> 不进入运行时 catalog
  -> 进入诊断列表
```

### 5.2 安全策略

S-4 安全扫描报告用于 UI 和诊断，不默认把已成功安装的 high 风险 Skill 再次隐藏。

原因：

- high 风险安装已经在 S-4 apply 阶段要求显式 override。
- 运行时不应因为重扫报告而否定用户已确认的安装。
- drifted 后 package 已变化，必须按 integrity 风险隐藏。

第一版运行时安全 gating：

```text
status = installed / disabled
  -> 由 installed record 的 enabled/modelInvocable/userInvocable 决定

status = drifted / missing-* / invalid
  -> 隐藏，输出诊断
```

### 5.3 冲突优先级

如果多个来源有同名 skill，需要稳定排序：

```text
project skill
  > user skill
  > CCR installed managed skill
  > plugin skill
  > bundled skill
  > MCP generated skill
  > legacy command
```

说明：

- workspace / user 显式文件优先。
- CCR installed 是用户通过管理面安装的全局能力，优先级高于 bundled。
- 冲突不能静默吞掉，必须进入 diagnostics。

## 6. 代码结构

建议新增：

```text
src/skills/installedSkillLoader.ts
src/skills/skillRuntimeCatalog.ts
src/skills/skillActivationPolicy.ts
```

建议职责：

### 6.1 `installedSkillLoader.ts`

读取 installed records：

```text
read installed.json
read lock.json
inspect owner marker
load packages/<name>/SKILL.md
normalizeSkillPackage
return package + diagnostics
```

不做：

- 不写 installed record。
- 不修复文件。
- 不静默 fallback 到 imported source。

### 6.2 `skillActivationPolicy.ts`

输入：

```text
CcrSkillPackage
CcrSkillInstalledRecord
InstalledSkillInspection
```

输出：

```text
modelInvocable: boolean
userInvocable: boolean
runtimeVisible: boolean
diagnostics: []
```

### 6.3 `skillRuntimeCatalog.ts`

合并来源：

```text
existing loaded skills
installed managed skills
diagnostics
```

输出：

```text
SkillCatalog
diagnostics
```

## 7. 接入点

需要核对和接入：

```text
src/commands.ts
src/constants/prompts.ts
src/tools/SkillTool/prompt.ts
src/skills/loadSkillsDir.ts
src/skills/skillCatalog.ts
src/skills/skillCommandAdapter.ts
src/utils/analyzeContext.ts
src/utils/attachments.ts
```

原则：

- 尽量在统一 catalog 层接入，不在每个调用点复制 installed skill 读取逻辑。
- `SkillTool` 和 slash command 使用同一份 runtime catalog，再按 model/user invocation 过滤。
- 不把 installed skill 正文提前塞进模型上下文。

## 8. 状态例子

### 第 1 轮：安装并启用

```text
installed.json:
  enabled = true
  modelInvocable = true
  userInvocable = true

runtime:
  SkillTool prompt 可见
  slash command 可见
```

### 第 2 轮：禁用

```text
Desktop 写入 enabled = false

runtime:
  SkillTool prompt 不可见
  slash command 不可见
```

### 第 3 轮：只禁止模型自动调用

```text
modelInvocable = false
userInvocable = true

runtime:
  SkillTool prompt 不可见
  slash command 可见
```

### 第 4 轮：漂移

```text
checksum drifted

runtime:
  不进入 catalog
  diagnostics 显示 drifted
  Desktop 可提示修复
```

## 9. 子 Goal 拆分

### S-6.1 InstalledSkillRuntimeLoader

目标：

- 读取 installed / lock / package owner marker。
- 只加载 installer-owned package。
- 归一成 `CcrSkillPackage`。
- 返回 diagnostics。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run typecheck
```

### S-6.2 激活策略

目标：

- 实现 enabled/modelInvocable/userInvocable gating。
- drifted / missing / invalid 不进入 runtime catalog。

验收：

```text
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run typecheck
```

### S-6.3 Runtime Catalog 合并与冲突诊断

目标：

- 合并现有 loader 和 installed loader。
- 明确同名冲突优先级。
- 输出 diagnostics。

验收：

```text
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run typecheck
```

### S-6.4 SkillTool / slash command 接入

目标：

- `getSkillToolCommands(cwd)` 消费 runtime catalog。
- slash command 消费 user-invocable filtered catalog。
- 保留上下文预算和正文按需加载策略。

验收：

```text
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run typecheck
```

### S-6.5 缓存、变更检测与文档收口

目标：

- installed record 变更后刷新 runtime catalog。
- 修复/卸载/启用/禁用后不需要重启才能生效。
- 补 closeout 文档。

验收：

```text
npm.cmd run build
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run typecheck
git diff --check
```

## 10. 成功标准

S-6 完成时：

- installed package 可以被运行时加载。
- disabled skill 不会出现在模型 SkillTool prompt。
- `modelInvocable=false` 不会出现在模型 SkillTool prompt。
- `userInvocable=false` 不会出现在 slash command。
- drifted / missing / invalid 不会进入运行时 catalog。
- 同名冲突有稳定优先级和诊断。
- 运行时不会静默 fallback 到 imported source 或旧 package。

## 11. 后续入口

S-6 完成后，Skill 第一版闭环基本成立：

```text
标准化 -> 导入 -> 安装 -> 安全扫描 -> Desktop 管理 -> 运行时生效
```

后续可以再设计：

- S-7 远端 registry / 常用安装配置市场。
- S-8 企业策略 / trust policy。
- S-9 Skill 使用统计和推荐。
