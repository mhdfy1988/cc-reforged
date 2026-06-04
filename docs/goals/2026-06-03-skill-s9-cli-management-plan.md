# Goal S-9：Skill CLI 管理

## 1. 目标

S-9 的目标是为 Skill 安装管理补 CLI parity，让命令行可以使用已经落地的 Core / Management Service 能力。

当前 Skill 已有：

```text
src/core/skillCore.ts
src/services/skills/managementService.ts
src/app-server/handlers/skillHandlers.ts
Desktop SkillsPage
```

但 CLI 侧只有 `/skills` TUI 列表，不具备 search / import / install / status / uninstall / repair 管理入口。

S-9 完成后，应能通过 CLI 完成：

```text
ccr skill search
ccr skill import
ccr skill install
ccr skill status
ccr skill inspect
ccr skill uninstall
ccr skill repair
```

## 2. 为什么现在做

S-5 已经完成 Desktop 管理，S-6 让运行时状态生效，S-7/S-8 会补来源和 runtime catalog。CLI 管理此时接入最合适：

- 可复用已有 `skillCore`，不重复业务逻辑。
- 可复用安装计划确认 token。
- 可复用安全扫描、状态检查、修复和卸载。
- 可作为 Desktop 外的 smoke / 运维入口。

如果跳过 CLI，后续排查 Skill 安装状态会过度依赖 Desktop 页面。

## 3. 范围

本阶段做：

- 新增 `src/cli/handlers/skills.ts`。
- 在 CLI 参数入口接入 `skill` 子命令。
- `search` 展示候选、来源、状态、风险摘要。
- `import` 支持 local skill dir / codex skill dir / openclaw skill dir / claude command / local archive。
- `install` 支持从 manifest 文件或候选名生成计划。
- `status` 展示 installed / drifted / missing / disabled。
- `inspect` 展示单个 Skill 的配置、安装记录、风险和 runtime 状态。
- `uninstall` / `repair` 默认 dry-run，显式 `--yes` 后执行。
- JSON 输出模式方便 smoke 和脚本使用。

本阶段不做：

- 不做远端 registry。
- 不做交互式完整表单。
- 不替代 Desktop 管理面。
- 不让 CLI 绕过用户确认。
- 不直接执行 Skill hooks 或 shell。

## 4. 命令口径

建议第一版命令：

```powershell
ccr skill search [query] [--json]
ccr skill status [--json]
ccr skill inspect <name> [--json]
ccr skill import --kind local-skill-dir --path <path> [--yes] [--json]
ccr skill import --kind local-archive --path <archive> [--yes] [--json]
ccr skill install --manifest <manifest.json> [--yes] [--json]
ccr skill install <candidate-name> [--yes] [--json]
ccr skill uninstall <name> [--yes] [--json]
ccr skill repair <name> [--yes] [--json]
```

确认规则：

```text
没有 --yes:
  只生成 plan / dry-run 输出

带 --yes:
  必须使用 plan.confirmation.token
  调用 apply
```

不变式：

- CLI 不直接写 installed.json。
- CLI 不重复实现安全扫描。
- CLI 不自行判断 repair / uninstall 归属，必须使用 management service。
- 所有失败都显式报错，不静默 fallback。

## 5. 建议代码结构

```text
src/cli/handlers/skills.ts
scripts/smoke-skill-cli-search.mjs
scripts/smoke-skill-cli-import-install.mjs
scripts/smoke-skill-cli-status-repair-uninstall.mjs
```

现有参考：

```text
src/cli/handlers/mcp.tsx
src/core/skillCore.ts
src/services/skills/managementService.ts
```

## 6. 迭代拆分

### S-9.1 CLI 命令骨架

目标：

- 注册 `skill` 子命令。
- 支持 help、参数解析、JSON 输出基础结构。
- 输出格式和 MCP CLI 管理入口保持一致。

验收：

```powershell
npm.cmd run smoke:skill-cli-search
npm.cmd run typecheck -- --pretty false
```

### S-9.2 Search / status / inspect

目标：

- `search` 调用 `searchCoreSkillInstallCandidates`。
- `status` 调用 `listCoreSkillInstalls`。
- `inspect` 调用 `inspectCoreSkill`。

验收：

```powershell
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-management-api
```

### S-9.3 Import / install

目标：

- `import` 生成 plan，`--yes` 后 apply。
- `install` 支持 manifest 文件和 candidate name。
- 安装风险、写入目标和确认 token 在 dry-run 中可见。

验收：

```powershell
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-install-apply
```

### S-9.4 Uninstall / repair

目标：

- `uninstall` 默认 dry-run，`--yes` 后执行。
- `repair` 默认 dry-run，`--yes` 后执行。
- drifted / missing / unsupported source 明确报错。

验收：

```powershell
npm.cmd run smoke:skill-cli-status-repair-uninstall
npm.cmd run smoke:skill-install-inspector
```

### S-9.5 文档和回归

目标：

- 更新 README / Skill 文档。
- 更新 CHANGELOG。
- 固定 CLI 示例和 Windows `npm.cmd` / `npx.cmd` 边界。

验收：

```powershell
npm.cmd run build
npm.cmd run typecheck -- --pretty false
git diff --check
```

## 7. 成功标准

S-9 完成时：

- CLI 可以搜索 Skill 安装候选。
- CLI 可以导入本地 Skill / archive。
- CLI 可以从 manifest 或候选安装 Skill。
- CLI 可以查看 installed 状态和详情。
- CLI 可以 dry-run / 执行卸载和修复。
- CLI 与 Desktop 复用同一 Core / Management Service，不复制业务逻辑。

## 8. 后续入口

S-9 完成后进入 S-10：Skill / MCP closeout，做文档、smoke、构建、提交发布前清点。

## 9. 完成记录

状态：已完成。

落地内容：

- 新增 `src/cli/handlers/skills.ts`，作为 `skillCore` 的命令行薄包装，不直接读写 `installed.json`、`lock.json` 或 package 目录。
- 在 `src/main.tsx` 注册 `ccr skill search/status/inspect/import/install/uninstall/repair`。
- `search/status/inspect` 复用 `searchCoreSkillInstallCandidates`、`listCoreSkillInstalls` 和 `inspectCoreSkill`。
- `import/install` 默认只输出 dry-run plan；带 `--yes` 时使用 plan confirmation token 调用 apply。
- `install` 支持候选名和 `--manifest <manifest.json>` 两种入口。
- `uninstall/repair` 默认 dry-run；带 `--yes` 时调用现有受控卸载 / 修复 service。
- 所有命令支持 `--json`，方便 smoke 和脚本消费。

补充 smoke：

- `smoke:skill-cli-search`
- `smoke:skill-cli-import-install`
- `smoke:skill-cli-status-repair-uninstall`

验证记录：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:skill-cli-search
npm.cmd run smoke:skill-cli-import-install
npm.cmd run smoke:skill-cli-status-repair-uninstall
npm.cmd run smoke:skill-management-api
npm.cmd run smoke:skill-install-apply
npm.cmd run smoke:skill-install-inspector
```
