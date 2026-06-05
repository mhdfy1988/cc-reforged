# Goal B5：SkillRuntimeAdapter 抽出

## 1. 目标

把 installed package / `CcrSkillPackage` 到运行时 `Command` 的转换逻辑抽成 `SkillRuntimeAdapter`，让 `installedSkillLoader.ts` 和 `loadSkillsDir.ts` 不再各自拼运行时字段。

## 2. 范围

本阶段做：

- 新增 `src/skills/skillRuntimeAdapter.ts`。
- 迁移 managed package -> prompt command 的转换。
- 统一 invocation、origin、warnings、skillRoot、paths 处理。
- 保持 SkillTool 和 slash command 行为不变。

本阶段不做：

- 不改变 `Command` 类型。
- 不改变 SkillTool prompt 正文加载策略。
- 不改变 activation policy。

## 3. 验收

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
git diff --check
```

## 4. 成功标准

- installed package -> Command 转换只有一个适配层。
- runtime loader 更薄。
- SkillTool / slash command smoke 通过。

## 5. 完成记录

2026-06-05 已完成：

- 新增 `src/skills/skillRuntimeAdapter.ts`。
- managed installed package 到 runtime `Command` 的转换已从 `loadSkillsDir.ts` 迁出。
- 验证通过：`npm.cmd run smoke:skill-runtime-installed-loader`、`npm.cmd run smoke:skill-runtime-tool-context`、`npm.cmd run smoke:skill-runtime-slash-command`。
