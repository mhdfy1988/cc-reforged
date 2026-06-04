# Skill hooks / shell 运行时等价与安全收口

## 1. 目标

通过 CCR 安装后的 managed Skill，应尽量保持和直接放在 `.claude/skills/<name>/SKILL.md` 的文件型 Skill 一致。当前 installed managed Skill 已能进入运行时，并已让 `enabled`、`modelInvocable`、`userInvocable`、`paths` 等状态生效，但 `hooks`、`shell` 和部分展示元数据还没有完整透传回 `PromptCommand`。

本 goal 负责补齐这条等价链路，同时补上 hook 风险扫描，避免“运行时能执行 hook，但安装计划没有提示风险”。

完成状态：已完成。实现已覆盖 managed installed Skill 的 `hooks` / `shell` / `version` / `paths` 运行时透传，并把 hook command / HTTP / env 风险纳入安全扫描和 smoke。

## 2. 范围

本 goal 做：

- managed installed Skill 转 `PromptCommand` 时透传 `hooks`。
- managed installed Skill 执行正文内联 shell 命令时尊重 `shell` frontmatter。
- managed installed Skill 透传 `version` 等已解析元数据。
- 安全扫描识别 `hooks` 中的 command / http / env 风险。
- 补 runtime smoke 和 security smoke。
- 更新 Skill 文档和 CHANGELOG。

本 goal 不做：

- 不做远端 registry。
- 不做 `local-archive` 导入。
- 不做 `builtin-preset` 候选提供器。
- 不做 CLI `ccr skill install/search/...` 管理命令。
- 不改 hook 执行机制本身。
- 不自动执行 OpenClaw installer metadata。

## 3. 迭代拆分

### H-1：运行时元数据透传

目标：

- 从 installed package 的 `rawFrontmatter` 重新解析 `hooks`、`shell`、`version`。
- 将解析结果传给 `toPromptCommand(...)`。
- 保持 managed skill 的 `skillRoot` 仍指向 installed package 目录。

验收：

- installed managed Skill 的 `PromptCommand.hooks` 不丢失。
- installed managed Skill 正文内联 shell 命令能使用 `shell: powershell`。
- `paths` 原有行为不回退。

### H-2：hook 安全扫描

目标：

- 扫描 `hooks` frontmatter。
- command hook 复用正文扫描规则识别 shell / package install / secret / filesystem / network 风险。
- http hook 识别外部 URL、headers 中的环境变量引用和 `allowedEnvVars`。

验收：

- 高风险 command hook 进入安装候选风险摘要。
- http hook 至少产生 network-access 风险。
- 无 hook 的普通 Skill 不误报。

### H-3：smoke 覆盖

目标：

- 新增 runtime smoke，覆盖 installed managed Skill 的 `hooks` / `shell` / `version` 等价字段。
- 扩展 security smoke，覆盖 hook command 和 http hook 风险。

验收：

- `smoke:skill-runtime-installed-metadata` 通过。
- `smoke:skill-security-scanner` 覆盖 hook 风险并通过。

### H-4：文档收口

目标：

- 更新 Skill 文档入口和设计文档。
- 更新 CHANGELOG。

验收：

- 文档不再把 `hooks/shell` 等价性列为未完成。
- 文档明确后续仍不包含 registry / archive / builtin preset / CLI 管理。

## 4. 成功标准

```text
安装后的 managed Skill：
- enabled / modelInvocable / userInvocable 生效
- allowed-tools 生效
- paths 生效
- hooks 生效
- shell 生效
- version / display metadata 生效
- 安全扫描能提示 hooks 中的命令 / HTTP / env 风险
- smoke 覆盖 direct skill 与 managed skill 的关键等价字段
```

## 5. 验证记录

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-runtime-installed-metadata
npm.cmd run smoke:skill-security-scanner
git diff --check -- src/skills/loadSkillsDir.ts src/services/skills/securityRules.ts scripts/smoke-skill-runtime-helpers.mjs scripts/smoke-skill-runtime-installed-metadata.mjs scripts/smoke-skill-security-scanner.mjs package.json docs/goals/README.md docs/goals/2026-06-03-skill-hooks-shell-runtime-security-plan.md docs/skills/README.md docs/skills/skill-standard-and-install-management-design.md CHANGELOG.md
```
