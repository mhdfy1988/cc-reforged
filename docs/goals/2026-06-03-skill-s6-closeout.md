# Goal S-6：Skill 运行时启用治理与 installed package 接入收口

## 1. 结论

S-6 已完成。

安装到 `~/.ccr/skills/packages/<name>/` 的 CCR-managed skill 现在可以进入运行时；`installed.json` 里的 `enabled`、`modelInvocable`、`userInvocable` 会影响模型 SkillTool prompt 和用户 slash command 列表。

## 2. 完成内容

- 新增 `src/skills/installedSkillLoader.ts`，读取 `installed.json`、`lock.json`、owner marker 和 `SKILL.md`，只加载 CCR installer-owned package。
- 新增 `src/skills/skillActivationPolicy.ts`，集中处理 `enabled`、`modelInvocable`、`userInvocable` gating。
- 新增 `src/skills/skillRuntimeCatalog.ts`，统一 skill 运行时同名冲突优先级和 diagnostics。
- 将 installed managed skill 接入 `src/skills/loadSkillsDir.ts`，输出 `loadedFrom: 'managed'` 的 prompt command。
- 将 runtime catalog 接入 `src/commands.ts`，使 project/user/managed/plugin/bundled/MCP/legacy 的优先级稳定。
- `getSkillToolCommands(cwd)` 已纳入 managed skill，并尊重 `modelInvocable=false`。
- `getSlashCommandToolSkills(cwd)` 已纳入 managed skill，并尊重 `userInvocable=false`。
- Skill 管理服务在安装、修复、卸载、启用/禁用和 invocation 状态变更后刷新 runtime cache。
- 将 frontmatter 解析抽到 `src/skills/skillFrontmatter.ts`，避免 installed runtime loader 绕回 `loadSkillsDir.ts` 形成循环依赖。

## 3. 验证

已通过：

```text
npm.cmd run build
npm.cmd run smoke:skill-runtime-installed-loader
npm.cmd run smoke:skill-runtime-activation-policy
npm.cmd run smoke:skill-runtime-catalog
npm.cmd run smoke:skill-runtime-tool-context
npm.cmd run smoke:skill-runtime-slash-command
npm.cmd run typecheck
npm.cmd run smoke:skill-foundation
npm.cmd run smoke:skill-install-inspector
npm.cmd run smoke:skill-management-service
```

## 4. 行为确认

- installed package 正常进入运行时，归一后 `CcrSkillPackage.source = 'managed'`。
- `enabled=false` 的 skill 不进入 SkillTool prompt，也不进入 slash command。
- `modelInvocable=false` 的 skill 不进入 SkillTool prompt，但 `userInvocable=true` 时仍可进入 slash command。
- `userInvocable=false` 的 skill 不进入 slash command，但 `modelInvocable=true` 时仍可进入 SkillTool prompt。
- drifted package 不进入 runtime catalog。
- 同名冲突按 runtime priority 处理，并输出 duplicate diagnostics。
- 运行时不回退到 imported source 或旧 package。

## 5. 后续

Skill 第一版闭环已经成立：

```text
标准化 -> 导入 -> 安装 -> 安全扫描 -> Desktop 管理 -> 运行时生效
```

后续可以进入 S-7：远端 registry / 常用安装配置市场；或进入 S-8：企业策略 / trust policy。
