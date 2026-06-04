# Goal S-1.5：Loader 最小接入与回归验证

## 1. 目标

把 S-1.1 到 S-1.4 的模型、归一、adapter、catalog 最小侵入接入现有 skill loader。

这一阶段才允许改 `loadSkillsDir.ts` 的主路径，但必须保持用户行为不变。

## 2. 接入顺序

建议分三步：

### 2.1 `.claude/skills` 文件型 skill

先接最普通路径：

```text
load markdown
  -> parse frontmatter
  -> parseSkillFrontmatterFields
  -> normalizeSkillPackage
  -> toPromptCommand
```

### 2.2 legacy `.claude/commands`

保留旧 commands 行为，但内部可以标记为：

```text
source = legacy-command
origin.vendor = claude
```

注意：S-1.5 不做 command 转标准 skill 的文件复制转换。

### 2.3 plugin / bundled / MCP

如果风险可控，再逐个接入：

- bundled skill
- plugin skill
- MCP skill

如果某类来源接入风险过高，可以记录为 S-1 后续补充，但不能半改导致行为不一致。

## 3. 改动边界

允许：

- 在现有 `createSkillCommand` 前后插入 normalizer / adapter。
- 增加 debug diagnostics。
- 增加测试 fixture。
- 小范围抽 helper。

不允许：

- 重写整个 `loadSkillsDir.ts`。
- 删除 legacy commands。
- 改 `SkillTool` 调用协议。
- 改 Desktop UI。
- 改安装目录。
- 引入远端 skill search。

## 4. 回归路径

必须验证：

- `.claude/skills/foo/SKILL.md` 能加载。
- model-invocable skill 会出现在 SkillTool 可用摘要里。
- `disable-model-invocation` 不出现在模型可调用列表。
- `user-invocable: false` 用户 slash 调用被拒绝。
- `context: fork` 仍走 fork agent。
- `allowed-tools` 仍传入命令结果。

## 5. 建议验证命令

按仓库实际测试脚本选择：

```powershell
npm.cmd run typecheck
npm.cmd test -- --runInBand skill
npm.cmd run smoke:app-server
```

如果没有现成 skill 测试，应新增最小单测或 smoke fixture，不用靠人工 Desktop 点击验收。

## 6. 验收标准

- `git diff` 中 `loadSkillsDir.ts` 改动范围可解释，未变成大重写。
- 现有 skill 行为不变。
- 新增模型 / normalizer / adapter / catalog 测试通过。
- `SkillTool` 摘要仍不包含完整正文。
- 没有安装管理副作用。
- 文档中 S-1 状态可标为完成，S-2 可以开始。

