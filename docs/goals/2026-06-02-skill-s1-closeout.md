# Skill S-1 Closeout：基础验证与来源覆盖

## 1. 目标

S-1 closeout 用来确认“标准模型与现有运行时归一”是否可以支撑后续 S-2 / S-3。

本次 closeout 分成两个补充项：

1. `S-1-closeout-a`：给 normalizer / schema / adapter / catalog 增加正式 smoke。
2. `S-1-closeout-b`：确认 bundled / plugin / MCP 三类来源的当前接入状态，能纳入则纳入，不能纳入则明确记录为后续接入点。

## 2. S-1-closeout-a：正式 smoke

新增脚本：

```text
scripts/smoke-skill-foundation.mjs
```

新增 package script：

```text
npm.cmd run smoke:skill-foundation
```

覆盖内容：

- `normalizeSkillPackage` 保留 `description`、`allowedTools`、`argumentHint`、`argumentNames`、`whenToUse`、`model`、`effort`、`agent`。
- `disable-model-invocation` 正确归一为 `modelInvocable: false`，并经 adapter 回到 `disableModelInvocation: true`。
- `user-invocable: false` 和 `context: fork` 语义保持不变。
- Codex `agents/openai.yaml` 风格 interface 元数据能进入 `CcrSkillPackage.interface`。
- OpenClaw `metadata.openclaw` 能识别为 `origin.vendor = "openclaw"`。
- legacy command 能识别为 `source = "legacy-command"` 且 `origin.vendor = "claude"`。
- schema 拒绝资源路径逃逸。
- `SkillCatalog` 能稳定排序、按 identity 去重，并输出 duplicate identity / duplicate name 诊断。

验证命令：

```text
npm.cmd run build
npm.cmd run smoke:skill-foundation
npm.cmd run typecheck
git diff --check
```

## 3. S-1-closeout-b：来源覆盖结论

### 3.1 已纳入新模型的来源

| 来源 | 当前入口 | S-1 状态 |
| --- | --- | --- |
| 用户 / 项目 / managed `.claude/skills/<name>/SKILL.md` | `loadSkillsFromSkillsDir` | 已经通过 `normalizeSkillPackage -> toPromptCommand` 接入 |
| `--add-dir` 发现的 `.claude/skills` | `loadSkillsFromSkillsDir` | 已经通过同一条链路接入 |
| legacy `.claude/commands/*.md` | `loadSkillsFromCommandsDir` | 已经通过 `source = "legacy-command"` 接入 |

### 3.2 暂不在 S-1 硬接的来源

| 来源 | 当前真实状态 | 暂不硬接原因 | 后续落点 |
| --- | --- | --- | --- |
| bundled skill | `registerBundledSkill` 直接程序化注册 `Command`，并支持自定义 `getPromptForCommand` 和惰性解压资源 | 它不是 `SKILL.md + markdown body` 文件型输入，直接套 normalizer 会丢失自定义 prompt builder 和解压语义 | S-2 / S-3 增加 `normalizeBundledSkillDefinition`，把 definition 映射为 `CcrSkillPackage`，adapter 需支持自定义 prompt builder |
| plugin skill | 当前仓库没有独立 plugin skill loader 命中点；文档预期是 `<plugin>/skills/<name>/SKILL.md` | 需要先确认 plugin 安装目录、命名空间和启用策略，否则容易把 plugin source 与普通文件型 source 混淆 | S-2 导入兼容阶段补 `SkillSourceLoader`，明确 plugin root、`pluginName:skillName` 命名和 `origin.importedFrom` |
| MCP skill | `mcpSkills.ts` 当前是 `McpSkillsUnavailableError` stub；`mcpSkillBuilders.ts` 只注册旧 `createSkillCommand` / `parseSkillFrontmatterFields` builder | MCP skill 入口本身还未恢复，不适合在 S-1 用假链路硬接 | S-3 运行/安装管理阶段恢复 MCP skill discovery 后，统一输出 `CcrSkillPackage`，并禁止 MCP markdown shell 注入 |

### 3.3 不变式

- S-1 不把安装管理、安装记录、安全扫描和 Desktop 管理面提前塞进 loader。
- 文件型 skill 的新标准入口是 `normalizeSkillPackage -> toPromptCommand`。
- 程序化来源可以保留旧 `Command` 入口，但必须在后续 source loader 阶段显式转换，不能作为静默 fallback。
- MCP skill 在恢复前保持显式 unavailable，不伪装成已统一。

## 4. S-1 后续进入条件

S-1 现在可以进入 S-2，前提是后续 goal 继续遵守：

- 新导入来源先归一为 `CcrSkillPackage`。
- 安装 manifest / installed record 不进入 `SKILL.md`。
- 任何新来源如果不能归一，必须产生明确错误或诊断，不允许静默回到旧 command 构造。
