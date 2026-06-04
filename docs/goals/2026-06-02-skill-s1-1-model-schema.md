# Goal S-1.1：Skill 模型与 Schema 边界

## 1. 目标

新增 CCR 内部 skill 领域模型和运行时校验 schema。这个小 goal 只建立类型边界，不接入现有 loader，不改变用户行为。

## 2. 范围

新增建议文件：

```text
src/skills/model.ts
src/skills/sourceTypes.ts
src/skills/packageSchema.ts
```

定义：

- `CcrSkillPackage`
- `CcrSkillSource`
- `CcrSkillOrigin`
- `CcrSkillResources`
- `CcrSkillInterface`
- `CcrSkillInvocation`
- `CcrSkillCompatibility`
- 对应 zod schema

## 3. 关键设计

### 3.1 领域模型不依赖 Command

`model.ts` 不能 import `Command`、`PromptCommand`、`ToolUseContext`。

允许依赖：

- 普通 TypeScript 类型
- schema 类型
- path 字符串

不允许依赖：

- `src/commands.ts`
- `src/tools/SkillTool/*`
- `src/types/command.ts`

### 3.2 Source 和 Origin 分开

`source` 表示 CCR 当前从哪里加载：

```text
user / project / managed / plugin / bundled / mcp / imported / legacy-command
```

`origin.vendor` 表示外部格式来源：

```text
agent-skills / claude / codex / openclaw / ccr / unknown
```

两者不能混用。例如一个 Codex skill 被用户导入到 `~/.ccr/skills/imported` 后：

```text
source = imported
origin.vendor = codex
```

### 3.3 Invocation 表示调用策略

`invocation` 至少包含：

```ts
{
  modelInvocable: boolean
  userInvocable: boolean
  context: 'inline' | 'fork'
  allowedTools: string[]
  argumentHint?: string
  argumentNames: string[]
  model?: string
  effort?: string | number
  agent?: string
}
```

### 3.4 Compatibility 保留原始信息

`compatibility.rawFrontmatter` 保留外部 frontmatter，便于后续 S-2 / S-3 做导入和展示。

第一版不解释所有厂商字段，但不能丢。

## 4. 非目标

- 不读取 `SKILL.md`。
- 不扫描目录。
- 不转换 command。
- 不接入 SkillTool。
- 不写测试 fixture 之外的真实用户目录。

## 5. 验收标准

- `CcrSkillPackage` schema 能校验合法对象。
- 缺失 `name` / `description` 时产生明确校验错误。
- 非法 source / vendor 被拒绝。
- `invocation.modelInvocable` 和 `userInvocable` 有明确默认值。
- `resources` 支持空数组默认值。
- 类型文件没有依赖 `Command`。

## 6. 建议测试

新增单测覆盖：

- 最小标准 skill package。
- 带 resources 的 package。
- Codex origin + imported source。
- OpenClaw raw frontmatter 保留。
- 非法 source 报错。

