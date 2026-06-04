# Goal S-1.2：Frontmatter 归一与兼容元数据

## 1. 目标

实现把当前已解析的 skill frontmatter、Markdown 正文、路径信息归一成 `CcrSkillPackage` 的纯函数。

这一阶段不读文件、不接 loader，只把“解析结果”变成“标准模型”。

## 2. 范围

新增建议文件：

```text
src/skills/normalizeSkillPackage.ts
src/skills/skillCompatibility.ts
src/skills/skillResourceScanner.ts
```

实现：

- `normalizeSkillPackage(input): CcrSkillPackage`
- `detectSkillVendor(input): CcrSkillOrigin['vendor']`
- `normalizeSkillInvocation(...)`
- `normalizeSkillInterface(...)`
- `scanSkillResources(baseDir): CcrSkillResources`

## 3. 输入设计

归一函数输入建议：

```ts
type NormalizeSkillPackageInput = {
  skillName: string
  markdownContent: string
  frontmatter: FrontmatterData
  source: CcrSkillSource
  loadedFrom: LoadedFrom
  filePath: string | null
  baseDir: string | null
  hasUserSpecifiedDescription: boolean
  openaiYaml?: unknown
  compatibilityHints?: {
    vendor?: CcrSkillOrigin['vendor']
    importedFrom?: string
    legacyCommand?: boolean
  }
}
```

注意：`LoadedFrom` 只是从旧链路传入的兼容信息，不能成为新模型的主 source。

## 4. 字段映射

| frontmatter | CcrSkillPackage 字段 |
| --- | --- |
| `name` | `displayName`，不覆盖稳定 `name` |
| `description` | `description` |
| `when_to_use` | `invocation.whenToUse` 或 compatibility 扩展 |
| `allowed-tools` | `invocation.allowedTools` |
| `argument-hint` | `invocation.argumentHint` |
| `arguments` | `invocation.argumentNames` |
| `disable-model-invocation` | `invocation.modelInvocable = false` |
| `user-invocable` | `invocation.userInvocable` |
| `context: fork` | `invocation.context = 'fork'` |
| `model` | `invocation.model` |
| `effort` | `invocation.effort` |
| `agent` | `invocation.agent` |

## 5. 兼容策略

### 5.1 Claude / CCR

当前 `.claude/skills` 直接视为 `vendor = claude` 或 `ccr`。如果无法判断，默认 `agent-skills`。

### 5.2 Codex

S-1.2 只预留 `openaiYaml` 输入和字段映射，不做目录导入。

可映射：

- `interface.display_name -> interface.displayName`
- `interface.short_description -> interface.shortDescription`
- `interface.icon_small -> interface.iconSmall`
- `interface.icon_large -> interface.iconLarge`
- `interface.brand_color -> interface.brandColor`
- `interface.default_prompt -> interface.defaultPrompt`

### 5.3 OpenClaw

S-1.2 只保留 `metadata.openclaw` 到 `compatibility.rawFrontmatter`，不执行 install metadata。

## 6. 非目标

- 不读取 `agents/openai.yaml` 文件。
- 不解析 OpenClaw install spec。
- 不执行 shell。
- 不改变 `parseSkillFrontmatterFields` 现有行为。
- 不接入 `loadSkillsDir.ts`。

## 7. 验收标准

- 同一个 frontmatter 能得到稳定 `CcrSkillPackage`。
- `disable-model-invocation` 映射后模型不可调用。
- `user-invocable: false` 映射后用户不可 slash 调用。
- `context: fork` 映射后保留 fork 语义。
- Codex `openaiYaml` 可选输入能进入 `interface`。
- OpenClaw metadata 不丢失。

## 8. 建议测试

- 标准 `name + description`。
- 带 `allowed-tools` 的 Claude skill。
- `disable-model-invocation` / `user-invocable` 布尔字段。
- `context: fork`。
- Codex `openaiYaml` interface 字段。
- OpenClaw `metadata.openclaw.requires` 原样保留。

