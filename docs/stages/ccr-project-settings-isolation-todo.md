# CCR 项目级 Settings 隔离 Todo

## 目标

把 CCR 的项目级 settings 从 `.claude/settings*.json` 迁到 `.ccr/settings*.json`，同时保留对旧 `.claude` settings 的兼容读取，并确保 CLI、TUI、Desktop、App Server、安全保护、worktree 和 settings sync 不出现半迁移状态。

参考设计：[CCR 项目级 Settings 隔离设计](../architecture/ccr-project-settings-isolation-design.md)。

## 当前任务列表（实时）

- [x] P0 扫描现有代码并形成设计文档
- [ ] P1 新增项目 settings 命名空间 helper
- [ ] P2 安全保护覆盖 `.ccr` 与 `.claude`
- [ ] P3 settings 读取兼容旧路径，写入切到 `.ccr`
- [ ] P4 App Server / Desktop / TUI 展示新路径与兼容来源
- [ ] P5 worktree、settings sync、文档和 smoke 补齐
- [ ] P6 迁移体验与旧路径清理策略

## 当前指针

当前下一项：P1 新增项目 settings 命名空间 helper。

## P0 扫描现有代码并形成设计文档

状态：已完成。

主要扫描到的入口：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts)
- [changeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/settings/changeDetector.ts)
- [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts)
- [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts)
- [permissionsLoader.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/permissionsLoader.ts)
- [PermissionUpdate.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/PermissionUpdate.ts)
- [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts)
- [TrustDialog/utils.ts](D:/agent_project/claude-code-reforged/src/components/TrustDialog/utils.ts)
- [worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts)
- [settingsSync/types.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/types.ts)
- [hooksSettings.ts](D:/agent_project/claude-code-reforged/src/utils/hooks/hooksSettings.ts)
- [AddPermissionRules.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/AddPermissionRules.tsx)
- [loadSkillsDir.ts](D:/agent_project/claude-code-reforged/src/skills/loadSkillsDir.ts)
- [agentFileUtils.ts](D:/agent_project/claude-code-reforged/src/components/agents/agentFileUtils.ts)

验收：

- [x] 明确不能直接字符串替换。
- [x] 明确 `.ccr` 主路径、`.claude` 兼容读取。
- [x] 明确安全保护必须覆盖新旧路径。
- [x] 明确第一版只迁 settings，不迁 skill/agent/worktree/plugin 目录体系。

## P1 新增项目 settings 命名空间 helper

目标：

把项目 settings 路径集中到一个 helper 层，后续调用点不再手写 `.claude` 或 `.ccr`。

建议改动：

- 在 [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 或同目录新文件中增加：
  - `CCR_PROJECT_SETTINGS_DIR = '.ccr'`
  - `LEGACY_PROJECT_SETTINGS_DIR = '.claude'`
  - `getRelativeProjectSettingsPath(...)`
  - `getSettingsWriteFilePathForSource(...)`
  - `getSettingsReadFilePathsForSource(...)`
  - `getSettingsDisplayPathsForSource(...)`
- 保留 `getSettingsFilePathForSource(...)` 作为写入主路径兼容入口。
- 保留 `getRelativeSettingsFilePathForSource(...)`，但语义调整为返回 `.ccr/settings*.json`。

验收：

- `userSettings` 仍指向 `~/.ccr/settings.json`。
- `projectSettings` 写入主路径是 `<workspace>/.ccr/settings.json`。
- `localSettings` 写入主路径是 `<workspace>/.ccr/settings.local.json`。
- 读取候选路径包含 `.claude` 和 `.ccr`。
- 路径 helper 在 Windows 下不出现混乱分隔符问题。

## P2 安全保护覆盖 `.ccr` 与 `.claude`

目标：

在写入切到 `.ccr` 前，先确保 `.ccr/settings*` 不会被模型、工具或 sandbox 绕过。

建议改动：

- [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts)
  - `DANGEROUS_DIRECTORIES` 增加 `.ccr`。
  - `isClaudeSettingsPath` 内部扩展为识别 `.claude/settings*` 和 `.ccr/settings*`。
  - 可新增 `isAgentSettingsPath`，旧函数名保留兼容。
- [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts)
  - `denyWrite` 使用 settings 多路径 helper。
  - 当前 cwd 不同于 original cwd 时，显式禁写当前 cwd 下 `.claude/settings*` 和 `.ccr/settings*`。
- Bash/PowerShell 路径验证
  - 补 `.ccr/settings*` 注释和测试场景。

验收：

- 自动编辑模式不能静默改 `.ccr/settings.json`。
- `cd .ccr; echo ... > settings.json` 这类命令不能绕过路径验证。
- sandbox deny write 同时覆盖 `.claude/settings*` 和 `.ccr/settings*`。
- `.claude/settings*` 在兼容期仍然保持受保护。

## P3 settings 读取兼容旧路径，写入切到 `.ccr`

目标：

让运行时读到旧配置，但所有新写入落到 `.ccr`。

建议改动：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts)
  - `getSettingsForSourceUncached(project/local)` 合并 legacy 和 primary。
  - `getSettingsWithErrors()` 逐个读取候选文件并去重错误。
  - `updateSettingsForSource(project/local)` 写 primary。
  - `rawSettingsContainsKey` 读取候选路径。
- [changeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/settings/changeDetector.ts)
  - watch 所有候选 settings 文件。
  - path 到 source 的反查支持 legacy 和 primary。
- `.gitignore`
  - local 写入后自动加入 `.ccr/settings.local.json`。

验收：

- 只有 `.claude/settings.local.json` 时，CCR 能读旧权限。
- 同时有 `.claude` 和 `.ccr` 时，`.ccr` 覆盖同 source 内同名字段。
- Desktop 或 TUI 保存 local settings 后只写 `.ccr/settings.local.json`。
- 第一次保存不会丢失 legacy 中仍有效的同 source 配置。

## P4 App Server / Desktop / TUI 展示新路径与兼容来源

目标：

用户看到的路径不再误导为 CCR 写 `.claude`，同时能知道旧 `.claude` 是否仍参与合并。

建议改动：

- [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts)
  - `path` 保持为写入路径。
  - 可增加 `readPaths` / `legacyPaths`。
  - `defaultSource` 建议从 `localSettings` 改为 `userSettings`。
- App Server protocol
  - 更新 permission settings source schema。
- Desktop renderer
  - 设置入口切换为应用级页面，不再嵌入聊天工作区。
  - 设置页左侧显示分类导航，左上角返回进入设置前的页面。
  - 设置页显示“写入路径”和“兼容读取路径”。
  - 文案统一为 CCR 配置，不再把 `.claude` 当主路径展示。
- TUI
  - [AddPermissionRules.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/AddPermissionRules.tsx) user 文案改 `~/.ccr/settings.json`。
  - [hooksSettings.ts](D:/agent_project/claude-code-reforged/src/utils/hooks/hooksSettings.ts) 展示路径同步。
  - [TrustDialog/utils.ts](D:/agent_project/claude-code-reforged/src/components/TrustDialog/utils.ts) 用 helper 输出来源。

验收：

- Desktop 设置页不再把 `.claude/settings.local.json` 显示为写入路径。
- 用户能看到旧 `.claude` 只是兼容读取来源。
- CLI/TUI 权限保存选项显示 `.ccr`。
- App Server protocol typecheck 通过。

## P5 worktree、settings sync、文档和 smoke 补齐

目标：

补上容易被忽略的周边链路，避免只有主流程迁了。

建议改动：

- [worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts)
  - post creation setup 优先复制 `.ccr/settings.local.json`。
  - 如果只有 legacy local settings，可兼容复制到 `.ccr/settings.local.json` 或保留读取兼容，具体按实现风险选择。
- [settingsSync/types.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/types.ts)
  - sync key 切到 `.ccr`。
  - 旧 `.claude` sync key 作为一次性导入或只读兼容来源。
- 文档
  - 更新 [ccr-home-layout.md](D:/agent_project/claude-code-reforged/docs/ccr-home-layout.md) 的项目级私有配置说明。
  - 更新 [ccr-conflict-isolation-migration.md](D:/agent_project/claude-code-reforged/docs/stages/ccr-conflict-isolation-migration.md) 第三轮状态。

验收命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop -- --pretty false
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run smoke:permissions
```

## P6 迁移体验与旧路径清理策略

目标：

让用户能明确看到旧 `.claude` 配置的来源，并可选择迁移，而不是运行时永久偷偷兼容。

建议改动：

- 增加只读检测：
  - 当前 workspace 是否存在 `.claude/settings*.json`。
  - 当前 workspace 是否存在 `.ccr/settings*.json`。
  - 是否有同名字段冲突。
- 增加显式迁移入口：
  - 可以是 CLI 命令、Desktop 设置页按钮或 App Server method。
  - 迁移动作只复制 settings，不迁 skill/agent/commands。
- 文档说明：
  - `.claude` 是兼容读取。
  - `.ccr` 是 CCR 新主路径。
  - `.claude-plugin` 不属于本迁移范围。

验收：

- 用户能知道旧 `.claude` 仍在影响配置。
- 用户能一键或按文档迁移到 `.ccr`。
- 迁移不会覆盖已有 `.ccr`，冲突字段必须提示。

## 后续记录（追加）

### 第 1 轮：扫描和方案收敛

已完成代码扫描和方案文档。关键结论是：项目级 settings 可以迁到 `.ccr`，但必须采用 `.ccr` 主路径、`.claude` 兼容读取、安全保护同时覆盖新旧路径的方案。下一步从 P1 路径 helper 开始，先建立统一入口，再动 settings 读写行为。
