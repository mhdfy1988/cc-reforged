# Goal S-2：Skill 本地导入与兼容转换

## 1. 目标

S-2 的目标是把外部已有 skill 或旧 command 受控导入到 CCR 管理目录，让它们先变成标准 `SKILL.md` 包，再复用 S-1 已经打好的 `CcrSkillPackage -> SkillCommandAdapter -> PromptCommand` 运行链路。

S-2 不做“安装记录”和“启用 / 禁用管理”，只做导入与转换：

```text
本地来源
  -> SkillImportSource
  -> SkillImportCandidate
  -> SkillImportPlan
  -> 用户确认
  -> ~/.ccr/skills/imported/<name>/SKILL.md
  -> CcrSkillPackage
  -> 现有 Skill 运行时
```

这一阶段要解决的是“外部 skill 怎么进入 CCR 标准包目录”，不是“已安装 skill 如何治理生命周期”。

## 2. 为什么 S-2 这样拆

S-1 已经完成：

- `CcrSkillPackage` 领域模型。
- frontmatter / 兼容元数据归一。
- `CcrSkillPackage -> PromptCommand` 适配器。
- 文件型 `.claude/skills` 和 legacy command 的最小接入。

但用户从其他生态拿到 skill 时，来源不是统一的：

- 本地标准 skill 目录：`my-skill/SKILL.md`
- Codex skill：`.codex/skills/<name>/SKILL.md`
- OpenClaw skill：`skills/<name>/SKILL.md` 或 `.agents/skills/<name>/SKILL.md`
- Claude command：`.claude/commands/foo.md`

如果直接把这些路径塞进现有 loader，会产生三个问题：

- 来源目录分散，后续无法知道哪些是 CCR 导入并管理的。
- command 不是标准 skill，不能直接进入安装管理。
- 兼容字段、资源目录、冲突和风险没有导入计划，用户不知道会写哪里。

所以 S-2 必须先做“导入候选”和“导入计划”，写入 `~/.ccr/skills/imported/`，让后续 S-3 再基于这个稳定目录做安装记录和启用治理。

## 3. 范围

本阶段做：

- 定义本地 skill 导入来源类型。
- 发现 / 读取本地 `SKILL.md` 目录。
- 读取 Codex `agents/openai.yaml` 可选 UI 元数据。
- 识别 OpenClaw `metadata.openclaw` 兼容元数据。
- 把 Claude command `.md` 转换成标准 `SKILL.md`。
- 生成导入计划，展示来源、目标、冲突、转换动作和风险摘要。
- 用户确认后写入 `~/.ccr/skills/imported/<name>/`。
- 导入后可以通过 S-1 normalizer 解析为 `CcrSkillPackage`。
- 增加 smoke 覆盖本地 skill / Codex / OpenClaw / Claude command 四类导入。

本阶段不做：

- 不写 `installed.json`。
- 不写 `lock.json`。
- 不做启用 / 禁用状态。
- 不做卸载 / 修复。
- 不做远端 registry 下载。
- 不自动执行 OpenClaw `install` 元数据。
- 不自动扫描全盘目录。
- 不做 Desktop 完整管理页，只预留服务接口和 smoke。
- 不把导入目录静默加入现有 skill loader，除非有明确可控入口。

## 4. 目录与状态

S-2 使用 CCR 用户目录下的导入区：

```text
~/.ccr/
  skills/
    imported/
      <skill-name>/
        SKILL.md
        scripts/
        references/
        assets/
        .ccr-skill-import.json
```

`.ccr-skill-import.json` 是导入来源标记，不等于安装记录。

建议结构：

```ts
type CcrSkillImportMarker = {
  schemaVersion: 1
  name: string
  importedAt: string
  source: SkillImportSource
  sourcePath: string
  originVendor: 'agent-skills' | 'claude' | 'codex' | 'openclaw' | 'unknown'
  converted: boolean
  originalCommandPath?: string
}
```

不变式：

- `~/.ccr/skills/imported/` 只放 CCR 导入生成的副本。
- 导入不修改原始来源目录。
- 导入不写 installed / lock。
- 导入标记只用于溯源和诊断，不参与模型上下文。

## 5. 核心类型

建议新增目录：

```text
src/services/skills/
  importSource.ts
  importDiscovery.ts
  importConverter.ts
  importPlanner.ts
  importManager.ts
  importPaths.ts
```

S-1 的领域模型仍放在：

```text
src/skills/
```

这样区分：

- `src/skills/`：运行时领域模型与加载适配。
- `src/services/skills/`：安装 / 导入 / 管理服务。

### 5.1 `SkillImportSource`

```ts
type SkillImportSource =
  | { kind: 'local-skill-dir'; path: string }
  | { kind: 'codex-skill-dir'; path: string; openaiYamlPath?: string }
  | { kind: 'openclaw-skill-dir'; path: string }
  | { kind: 'claude-command'; path: string }
```

说明：

- `local-skill-dir` 必须包含 `SKILL.md`。
- `codex-skill-dir` 必须包含 `SKILL.md`，可选 `agents/openai.yaml`。
- `openclaw-skill-dir` 必须包含 `SKILL.md`，可选 `metadata.openclaw`。
- `claude-command` 是 `.md` 文件，需要转换成 `SKILL.md`。

### 5.2 `SkillImportCandidate`

候选是“可展示、可计划”的读取结果，还不写文件。

```ts
type SkillImportCandidate = {
  candidateId: string
  source: SkillImportSource
  state: 'available' | 'invalid' | 'duplicate-name' | 'unsupported'
  stateMessage: string
  name: string
  displayName?: string
  description: string
  originVendor: 'agent-skills' | 'claude' | 'codex' | 'openclaw' | 'unknown'
  sourcePath: string
  targetName: string
  normalizedPreview?: CcrSkillPackage
  warnings: string[]
}
```

候选阶段允许失败，但失败必须显式：

- 找不到 `SKILL.md`。
- frontmatter 无法解析。
- `name` 非法。
- `description` 为空且无法 fallback。
- command 转换结果为空。
- 目标名称冲突。

### 5.3 `SkillImportPlan`

计划是写入前的确认对象。

```ts
type SkillImportPlan = {
  schemaVersion: 1
  planId: string
  candidateId: string
  name: string
  source: SkillImportSource
  originVendor: SkillImportCandidate['originVendor']
  targetDir: string
  writes: Array<{
    kind: 'skill-md' | 'resource' | 'import-marker'
    fromPath?: string
    toPath: string
    mode: 'copy' | 'write' | 'record'
  }>
  conversion: {
    required: boolean
    kind: 'none' | 'claude-command-to-skill'
    notes: string[]
  }
  conflicts: Array<{
    kind: 'target-exists' | 'name-conflict'
    message: string
  }>
  risks: string[]
  requiresConfirmation: true
  confirmation: {
    token: string
    message: string
  }
}
```

计划必须展示：

- 原始路径。
- 目标路径。
- 是否转换。
- 会写哪些文件。
- 是否覆盖已有导入。
- 是否包含脚本 / 可执行文件。
- 是否发现 OpenClaw install / requires 元数据。

### 5.4 `SkillImportResult`

```ts
type SkillImportResult = {
  schemaVersion: 1
  name: string
  targetDir: string
  skillFilePath: string
  markerPath: string
  package: CcrSkillPackage
  warnings: string[]
}
```

导入完成后必须重新从目标目录读取 `SKILL.md`，再走 S-1 normalizer 得到 `CcrSkillPackage`。不能直接相信计划阶段的内存对象。

## 6. 具体流程

### 6.1 导入本地标准 skill

输入：

```text
D:\skills\my-skill\
  SKILL.md
  scripts/
  references/
```

流程：

1. 校验目录存在。
2. 读取 `SKILL.md`。
3. 解析 frontmatter。
4. 走 `normalizeSkillPackage` 生成预览。
5. 枚举 `scripts/`、`references/`、`assets/`。
6. 生成目标路径：`~/.ccr/skills/imported/<name>/`。
7. 生成导入计划。
8. 用户确认。
9. 复制目录内容到目标目录。
10. 写 `.ccr-skill-import.json`。
11. 从目标目录重新读取并归一。

### 6.2 导入 Codex skill

输入：

```text
~/.codex/skills/imagegen/
  SKILL.md
  agents/openai.yaml
  assets/
```

特殊规则：

- `SKILL.md` 的 `name` / `description` 是运行时权威。
- `agents/openai.yaml` 只作为 UI 元数据进入 `CcrSkillPackage.interface`。
- 如果 `openai.yaml` 解析失败，候选仍可生成，但要给 warning。
- 导入时保留 `agents/openai.yaml` 原文件，便于后续重新审计。

### 6.3 导入 OpenClaw skill

输入：

```text
~/.agents/skills/image-lab/
  SKILL.md
  scripts/
```

特殊规则：

- `metadata.openclaw` 原样保留在 frontmatter / compatibility 中。
- `requires.env`、`requires.bins`、`install` 只进入风险摘要。
- 不自动执行 `install`。
- 如果声明网络、secret 或安装脚本，S-2 只提示，S-4 再做阻断策略。

### 6.4 转换 Claude command

输入：

```text
.claude/commands/foo.md
```

转换输出：

```text
~/.ccr/skills/imported/foo/
  SKILL.md
  .ccr-skill-import.json
```

转换规则：

- 文件名作为默认 `name`。
- 如果 frontmatter 有 `description`，保留。
- 如果没有 `description`，从正文第一段生成短描述。
- 正文原样进入 `SKILL.md` body。
- 默认补 `user-invocable: true`。
- 保留 `allowed-tools`、`argument-hint`、`arguments`、`model`、`effort`、`context`。
- 如果正文包含 `$ARGUMENTS`，追加兼容说明，但不改写原文语义。

转换示例：

```md
---
name: foo
description: 从原 command 自动生成的描述
user-invocable: true
---

原 command 正文
```

## 7. 冲突策略

第一版冲突只提示，不自动覆盖。

冲突类型：

- `target-exists`：`~/.ccr/skills/imported/<name>/` 已存在。
- `name-conflict`：当前可用 skill catalog 中已有同名 skill。
- `source-duplicate`：同一个源路径已经导入过。

默认策略：

- 不带 `force` 时计划 `installable/importable = false`。
- 带 `force` 时允许覆盖导入目录，但必须要求确认。
- 不修改用户原始 skill 目录。
- 不删除非 CCR owner marker 的目录。

## 8. 安全边界

S-2 只做轻量风险摘要，不做最终安全策略。

必须检测并展示：

- 是否存在 `scripts/`。
- 是否存在 `.ps1`、`.bat`、`.cmd`、`.sh`、`.js`、`.ts`、`.py`。
- OpenClaw `install` 是否声明。
- OpenClaw `requires.env` 是否声明。
- 资源路径是否逃逸。

不做：

- 不执行脚本。
- 不安装 npm / pip / binary。
- 不联网下载。
- 不静默授予 `allowed-tools` 权限。

## 9. 代码结构设计

### 9.1 `importPaths.ts`

职责：

- 计算 `~/.ccr/skills/imported`。
- 计算 marker 路径。
- 规范化目标 skill 名称。

### 9.2 `importDiscovery.ts`

职责：

- 从显式 `SkillImportSource` 读取候选。
- 解析 `SKILL.md` 和可选 `agents/openai.yaml`。
- 输出 `SkillImportCandidate` 或错误。

不做：

- 不递归扫描全盘。
- 不写文件。

### 9.3 `importConverter.ts`

职责：

- `local/codex/openclaw`：生成复制计划。
- `claude-command`：生成标准 `SKILL.md` 内容。
- 保留兼容 frontmatter 字段。

### 9.4 `importPlanner.ts`

职责：

- 候选转计划。
- 计算写入列表。
- 检查目标目录冲突。
- 生成确认 token。

### 9.5 `importManager.ts`

职责：

- 校验确认 token。
- 按计划复制 / 写文件。
- 写 `.ccr-skill-import.json`。
- 导入后重新读取目标目录并归一。

## 10. 小 Goal 拆分

S-2 建议拆成 5 个小 goal。

### S-2.1 导入模型、路径和 schema

目标：

- 定义 `SkillImportSource`、`SkillImportCandidate`、`SkillImportPlan`、`SkillImportResult`。
- 定义 import marker schema。
- 定义 `~/.ccr/skills/imported` 路径 helper。

验收：

- typecheck 通过。
- schema smoke 覆盖合法 / 非法 source。

### S-2.2 本地 `SKILL.md` 目录候选发现

目标：

- 支持显式导入本地标准 skill 目录。
- 读取 `SKILL.md`。
- 枚举资源目录。
- 输出 candidate 和 normalized preview。

验收：

- smoke 能用临时目录生成 local candidate。
- 缺少 `SKILL.md` 会返回明确错误。

### S-2.3 Codex / OpenClaw 兼容读取

目标：

- Codex：读取 `agents/openai.yaml` 并进入 interface preview。
- OpenClaw：识别 `metadata.openclaw`、`requires`、`install` 风险摘要。

验收：

- smoke 覆盖 Codex skill。
- smoke 覆盖 OpenClaw skill。
- `openai.yaml` 解析失败不会伪装成功，必须有 warning。

### S-2.4 Claude command 转换

目标：

- 支持 `.claude/commands/foo.md -> imported/foo/SKILL.md`。
- 保留 frontmatter 和正文。
- description 缺失时从正文 fallback。
- `$ARGUMENTS` 兼容提示。

验收：

- smoke 覆盖有 description 的 command。
- smoke 覆盖无 description 的 command。
- 转换结果能被 S-1 normalizer 解析。

### S-2.5 导入计划、确认和写入 imported

目标：

- candidate 生成 plan。
- 检查 target-exists / name-conflict。
- 用户确认后写入 imported 目录。
- 写 `.ccr-skill-import.json`。
- 导入后重新读取目标目录并生成 `CcrSkillPackage`。

验收：

- smoke 覆盖 local / codex / openclaw / command 四类导入。
- 未确认 token 时拒绝写入。
- 已存在目录时默认拒绝覆盖。
- `npm.cmd run smoke:skill-import` 通过。

## 11. 总体验收

S-2 完成时必须满足：

- 用户可以把本地标准 `SKILL.md` 目录导入到 `~/.ccr/skills/imported/`。
- 用户可以把 Codex skill 目录导入到 CCR。
- 用户可以把 OpenClaw skill 目录导入到 CCR。
- 用户可以把 Claude command 转换成标准 skill。
- 所有导入结果都能重新归一为 `CcrSkillPackage`。
- 导入不修改原始目录。
- 导入不写 installed / lock。
- 冲突和风险不静默吞掉，必须出现在 candidate / plan 中。
- smoke 覆盖四类导入和核心失败路径。

## 12. 完成后下一步

S-2 完成后进入 S-3：Skill 安装计划与记录。

S-3 才开始处理：

- `CcrSkillInstallManifest`。
- `installed.json`。
- `lock.json`。
- 启用 / 禁用状态。
- 卸载 / 修复。
- Desktop 安装确认体验。
