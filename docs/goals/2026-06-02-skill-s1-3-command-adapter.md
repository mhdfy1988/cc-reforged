# Goal S-1.3：Command Adapter 等价适配

## 1. 目标

实现 `CcrSkillPackage -> PromptCommand` 适配器，让新领域模型能继续走现有 `SkillTool`、slash command、权限、hooks 和 telemetry 链路。

这一阶段必须以“行为等价”为核心，不做运行时大改。

## 2. 范围

新增建议文件：

```text
src/skills/skillCommandAdapter.ts
```

实现：

```ts
toPromptCommand(skillPackage, options): Command
```

可选保留现有 `createSkillCommand`，但新路径应通过 adapter 调用或逐步被 adapter 包装。

## 3. 映射规则

| CcrSkillPackage | PromptCommand |
| --- | --- |
| `name` | `name` |
| `displayName` | `userFacingName` 或等价展示字段 |
| `description` | `description` |
| `invocation.allowedTools` | `allowedTools` |
| `invocation.argumentHint` | `argumentHint` |
| `invocation.argumentNames` | `argumentNames` |
| `invocation.modelInvocable` | `disableModelInvocation = !modelInvocable` |
| `invocation.userInvocable` | `userInvocable` / `isHidden` |
| `invocation.context` | `context` |
| `invocation.model` | `model` |
| `invocation.effort` | `effort` |
| `source` | 现有 command source |
| `origin` / compatibility | 保留在扩展字段或 debug metadata |

## 4. Prompt 生成

`getPromptForCommand` 必须保持当前行为：

- 文件型 skill 正文前加 `Base directory for this skill: <baseDir>`。
- 支持 `${CLAUDE_SKILL_DIR}` 替换。
- 支持 `${CLAUDE_SESSION_ID}` 替换。
- MCP skill 保留“不执行 shell injection”的现有语义。
- shell frontmatter 行为不变。

## 5. 关键约束

- Adapter 不读安装记录。
- Adapter 不处理导入。
- Adapter 不安全扫描。
- Adapter 不远端下载。
- Adapter 不直接访问 Desktop / app-server。
- Adapter 是唯一允许依赖 `Command` 类型的新 skill 模块。

## 6. 等价测试

需要用测试锁住旧 `createSkillCommand` 与新 adapter 的关键输出一致：

- `name`
- `description`
- `allowedTools`
- `argumentHint`
- `argumentNames`
- `disableModelInvocation`
- `userInvocable`
- `isHidden`
- `context`
- `model`
- `effort`
- `loadedFrom`
- `source`

## 7. 验收标准

- adapter 生成的 command 能被现有 `SkillTool` 找到。
- adapter 生成的 command 能被 `/skill-name` 调用。
- `Base directory for this skill` 行为不变。
- `disable-model-invocation` 不进入 SkillTool 可调用列表。
- `user-invocable: false` 不能被用户 slash 调用。
- fork skill 仍走 fork agent。

