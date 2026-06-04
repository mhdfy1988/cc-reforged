# Goal S-1：Skill 标准模型与现有运行时归一

## 1. 目标

S-1 的目标是把 CCR 当前散落在 `Command` / `PromptCommand` 里的 skill 语义抽成独立领域模型，并通过适配层继续接回现有 `SkillTool` 和 slash command 运行链路。

这一阶段不追求新增用户可见功能，而是先把后续 Skill 安装管理、导入兼容、安全扫描和 Desktop 管理面的地基打稳。

最终链路：

```text
外部 skill 来源
  -> SkillSourceLoader
  -> CcrSkillPackage
  -> SkillCatalog
  -> SkillCommandAdapter
  -> PromptCommand
  -> SkillTool / slash command
```

## 2. 为什么先做 S-1

当前 CCR 已经可以加载和调用 skill，但领域语义混在 `Command` 结构中：

- `loadSkillsDir.ts` 同时负责读取文件、解析 frontmatter、构造 command、处理 shell 注入、兼容旧 commands。
- `SkillTool` 面向 command，而不是面向独立 skill package。
- 后续如果直接加安装管理，会把安装来源、运行时调用、UI 展示和兼容转换继续写进同一条链路。

S-1 要解决的是边界问题：

- `CcrSkillPackage` 表达“一个 skill 是什么”。
- `SkillCatalog` 表达“当前有哪些 skill，如何查找、去重、过滤”。
- `SkillCommandAdapter` 表达“为了兼容现有运行时，如何把 skill 变成 PromptCommand”。

这样 S-2 导入、S-3 安装、S-4 安全扫描、S-5 Desktop 管理页都能依赖同一个领域模型。

## 3. 范围

本阶段做：

- 定义 `CcrSkillPackage` 及其运行时校验 schema。
- 定义 skill source、origin、resources、invocation、interface、compatibility 等子模型。
- 实现 frontmatter 归一函数。
- 实现 `CcrSkillPackage -> PromptCommand` 适配器。
- 实现 `SkillCatalog` 的基础查询、分组、排序、去重。
- 最小侵入接入现有 `.claude/skills` 加载路径。
- 用测试锁住现有 skill 行为不变。

本阶段不做：

- 不做 Desktop Skill 管理页。
- 不做安装 manifest。
- 不写 `~/.ccr/skills/installed.json`。
- 不做远端 registry。
- 不做安全扫描阻断。
- 不自动迁移 Claude / Codex / OpenClaw 目录。
- 不重构 `SkillTool` 主流程。
- 不一次性拆光 `loadSkillsDir.ts`。

## 4. 代码结构设计

建议新增 / 调整：

```text
src/skills/
  model.ts
  packageSchema.ts
  sourceTypes.ts
  normalizeSkillPackage.ts
  skillCatalog.ts
  skillCommandAdapter.ts
  skillResourceScanner.ts
  skillCompatibility.ts
  loadSkillsDir.ts
  bundledSkills.ts
```

### 4.1 `model.ts`

只放领域类型，不依赖 `Command`。

建议类型：

```ts
type CcrSkillPackage = {
  schemaVersion: 1
  id: string
  name: string
  displayName?: string
  description: string
  bodyPath: string | null
  body: string
  baseDir: string | null
  source: CcrSkillSource
  origin: CcrSkillOrigin
  resources: CcrSkillResources
  interface?: CcrSkillInterface
  invocation: CcrSkillInvocation
  compatibility: CcrSkillCompatibility
}
```

### 4.2 `packageSchema.ts`

所有外部输入进入领域模型前都要经过 schema。

第一版校验：

- `name` 非空。
- `description` 非空或有可控 fallback。
- `source` 必须是已知枚举。
- `invocation.modelInvocable` / `userInvocable` 必须有默认值。
- `resources` 路径不能逃逸 skill 根目录。

### 4.3 `sourceTypes.ts`

定义来源，不让字符串散落：

```ts
type CcrSkillSource =
  | 'policy'
  | 'user'
  | 'project'
  | 'managed'
  | 'plugin'
  | 'bundled'
  | 'mcp'
  | 'imported'
  | 'legacy-command'
```

注意：这里是 CCR 领域来源，不等同于现有 settings `SettingSource`。

### 4.4 `normalizeSkillPackage.ts`

只做纯归一，不读文件，不写文件，不访问全局状态。

输入：

- skill name
- markdown content
- parsed frontmatter
- source
- baseDir
- filePath
- loadedFrom
- optional interface metadata

输出：

- `CcrSkillPackage`

### 4.5 `skillCatalog.ts`

管理集合：

- `list()`
- `findByName(name)`
- `findById(id)`
- `groupBySource()`
- `filterModelInvocable()`
- `filterUserInvocable()`
- `dedupeByIdentity()`
- `sortForPrompt()`

第一版可以是轻量 class 或纯函数集合，不引入复杂状态管理。

### 4.6 `skillCommandAdapter.ts`

唯一允许把 `CcrSkillPackage` 转成 `PromptCommand` 的地方。

职责：

- 映射 `name`、`displayName`、`description`、`whenToUse`。
- 映射 `allowedTools`、`argumentHint`、`argumentNames`。
- 映射 `model`、`effort`、`context`、`agent`。
- 保留 `loadedFrom` / `source` 的现有行为。
- 生成 `getPromptForCommand`。

不允许：

- 在 adapter 里读安装记录。
- 在 adapter 里做安全扫描。
- 在 adapter 里做远端下载。

### 4.7 `skillResourceScanner.ts`

第一版只枚举资源，不判断风险：

- `scripts/`
- `references/`
- `assets/`

扫描结果进入 `CcrSkillPackage.resources`。实际读取仍由模型或工具按需执行。

### 4.8 `skillCompatibility.ts`

处理兼容字段：

- Claude / CCR frontmatter 字段映射。
- Codex `agents/openai.yaml` 预留接口。
- OpenClaw `metadata.openclaw` 预留接口。
- legacy command 标记。

S-1 只做字段保留和基础 vendor 识别，不做导入转换。

## 5. 设计模式

### 5.1 Adapter 模式

`CcrSkillPackage -> PromptCommand`。

目的：保护现有 `SkillTool`、slash command、权限和 hooks 链路，避免 S-1 变成运行时大重构。

### 5.2 Normalizer 模式

各种外部布局先归一成同一领域模型。

目的：后续 Claude / Codex / OpenClaw 兼容只扩 normalizer，不污染 `SkillTool`。

### 5.3 Catalog 模式

把 skill 集合行为集中管理。

目的：Desktop、安装管理、SkillTool、slash command 使用同一套排序、过滤和冲突规则。

### 5.4 Schema Boundary

frontmatter、yaml、未来 manifest 都是不可信输入。

目的：避免只依赖 TypeScript interface，让坏数据在运行中制造隐性 fallback。

## 6. 不变式

- `CcrSkillPackage` 不依赖 `Command`。
- `Command` 只能通过 adapter 从 `CcrSkillPackage` 生成。
- Skill 正文不进入 available skills 摘要。
- 支持资源只记录路径，不自动读入上下文。
- 外部 frontmatter 先校验再使用。
- 旧 commands 兼容可以保留，但不能成为新标准。
- 不添加静默 legacy fallback；无法归一时要产生明确 warning 或 error。
- 现有 `.claude/skills` 用户行为不能变化。
- `disable-model-invocation`、`user-invocable`、`context: fork` 语义不能变化。

## 7. 小 Goal 拆分

S-1 拆成 5 个小 goal：

1. [S-1.1 模型与 Schema 边界](./2026-06-02-skill-s1-1-model-schema.md)
2. [S-1.2 Frontmatter 归一与兼容元数据](./2026-06-02-skill-s1-2-normalizer.md)
3. [S-1.3 Command Adapter 等价适配](./2026-06-02-skill-s1-3-command-adapter.md)
4. [S-1.4 SkillCatalog 查询、分组和去重](./2026-06-02-skill-s1-4-catalog.md)
5. [S-1.5 Loader 最小接入与回归验证](./2026-06-02-skill-s1-5-loader-integration.md)
6. [S-1 Closeout：基础验证与来源覆盖](./2026-06-02-skill-s1-closeout.md)

## 8. 总体验收

S-1 完成时必须满足：

- 现有 `.claude/skills` 仍能自动被模型调用。
- 用户 `/skill-name` 仍能调用。
- `disable-model-invocation`、`user-invocable`、`context: fork` 语义不变。
- `allowed-tools`、`model`、`effort` 语义不变。
- `SkillTool` prompt 仍只展示摘要，不塞正文。
- 新增测试覆盖 normalizer、adapter、catalog。
- `loadSkillsDir.ts` 只做最小侵入接入，没有被一次性重写。
- 没有引入安装管理副作用。

## 9. 来源覆盖 Closeout

S-1 closeout 后，当前来源覆盖口径如下：

| 来源 | S-1 状态 | 说明 |
| --- | --- | --- |
| 用户 / 项目 / managed `.claude/skills/<name>/SKILL.md` | 已接入 | 通过 `normalizeSkillPackage -> toPromptCommand` 接入现有运行时 |
| `--add-dir` 发现的 `.claude/skills` | 已接入 | 复用文件型 skill 归一链路 |
| legacy `.claude/commands/*.md` | 已接入 | 作为 `legacy-command` 来源进入新模型 |
| bundled skill | 后续接入点 | 当前是程序化 `registerBundledSkill -> Command`，后续需要 `normalizeBundledSkillDefinition` |
| plugin skill | 后续接入点 | 需要先确认 plugin root、命名空间和启用策略 |
| MCP skill | 后续接入点 | 当前 `mcpSkills.ts` 是 unavailable stub，恢复 discovery 后再输出 `CcrSkillPackage` |

详细 closeout 记录见 [S-1 Closeout：基础验证与来源覆盖](./2026-06-02-skill-s1-closeout.md)。

## 10. 完成后下一步

S-1 完成后进入 S-2：Skill 导入与兼容转换。

S-2 才开始处理：

- 本地 `SKILL.md` 目录导入。
- Codex `.codex/skills` 导入。
- OpenClaw `skills/` / `.agents/skills` 导入。
- Claude command 转换为标准 skill。
