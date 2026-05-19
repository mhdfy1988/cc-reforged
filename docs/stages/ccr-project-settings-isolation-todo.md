# CCR 项目级 Settings 隔离 Todo

## 目标

把 CCR 的项目级 settings 从 `.claude/settings*.json` 迁到 `.ccr/settings*.json`。当前项目只有个人使用，不保留旧 `.claude` settings 的运行时兼容读取；CLI、TUI、Desktop、App Server、安全保护、worktree 和 settings sync 统一只以 `.ccr` 为 settings 主路径。

参考设计：[CCR 项目级 Settings 隔离设计](../architecture/ccr-project-settings-isolation-design.md)。

## 当前任务列表（实时）

- [x] P0 扫描现有代码并形成设计文档
- [x] P1 新增项目 settings 命名空间 helper
- [x] P2 安全保护覆盖 `.ccr` 与 `.claude`
- [x] P3 settings 读写切到 `.ccr`
- [x] P4 App Server / Desktop / TUI 展示新路径
- [x] P5 worktree、settings sync、文档和 smoke 补齐
- [x] P6 迁移体验与旧路径清理策略

## 当前指针

当前下一项：无，项目级 settings 隔离当前任务列表已完成

## 接下来安排

优先级：先完成项目级 settings 隔离，再回到安装包瘦身收口、多供应商模型接入和 App Server 主线。

- 第一段：完成 P1 到 P3，先把 settings 路径 helper、安全保护和读写切换主链路落地。
- 第二段：完成 P4，把 App Server、Desktop、TUI 的路径展示统一到 `.ccr` 口径。
- 第三段：完成 P5 到 P6，补 worktree、settings sync、文档和 smoke。

完成判定：

- `projectSettings` / `localSettings` 新写入走 `.ccr/settings*.json`。
- `projectSettings` / `localSettings` 读取也只走 `.ccr/settings*.json`。
- `.ccr/settings*` 受权限和 sandbox 保护。
- CLI、TUI、Desktop、App Server 的路径口径一致。
- `npm.cmd run typecheck -- --pretty false`、相关 settings / permission smoke 通过。

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
- [x] 明确 `.ccr` 是唯一项目级 settings 路径。
- [x] 明确安全保护必须覆盖 `.ccr/settings*`。
- [x] 明确第一版只迁 settings，不迁 skill/agent/worktree/plugin 目录体系。

## P1 新增项目 settings 命名空间 helper

目标：

把项目 settings 路径集中到一个 helper 层，后续调用点不再手写 `.claude` 或 `.ccr`。

建议改动：

- 在 [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 或同目录新文件中增加：
  - `CCR_PROJECT_SETTINGS_DIR = '.ccr'`
  - `getRelativeProjectSettingsPath(...)`
  - `getSettingsWriteFilePathForSource(...)`
  - `getSettingsReadFilePathsForSource(...)`
  - `getSettingsDisplayPathsForSource(...)`
- 保留 `getSettingsFilePathForSource(...)` 作为写入主路径兼容入口。
- 保留 `getRelativeSettingsFilePathForSource(...)`，但语义调整为返回 `.ccr/settings*.json`。

验收：

- [x] `userSettings` 仍指向 `~/.ccr/settings.json`。
- [x] `projectSettings` 写入主路径是 `<workspace>/.ccr/settings.json`。
- [x] `localSettings` 写入主路径是 `<workspace>/.ccr/settings.local.json`。
- [x] 读取路径只包含 `.ccr`。
- [x] 路径 helper 在 Windows 下不出现混乱分隔符问题。

实现记录：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 增加 `CCR_PROJECT_SETTINGS_DIR`、`getRelativeProjectSettingsPath`、`getSettingsWriteFilePathForSource`、`getSettingsReadFilePathsForSource`、`getSettingsDisplayPathsForSource`。
- 保留 `getSettingsFilePathForSource(...)` 作为主写入路径兼容入口。
- `getRelativeSettingsFilePathForSource(...)` 现在返回 `.ccr/settings*.json`。

## P2 安全保护覆盖 `.ccr`

目标：

在写入切到 `.ccr` 前，先确保 `.ccr/settings*` 不会被模型、工具或 sandbox 绕过。

建议改动：

- [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts)
  - `DANGEROUS_DIRECTORIES` 增加 `.ccr`。
  - `isClaudeSettingsPath` 内部扩展为识别 `.ccr/settings*`。
  - 可新增 `isAgentSettingsPath`，旧函数名保留兼容。
- [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts)
  - `denyWrite` 使用 settings helper。
  - 当前 cwd 不同于 original cwd 时，显式禁写当前 cwd 下 `.ccr/settings*`。
- Bash/PowerShell 路径验证
  - 补 `.ccr/settings*` 注释和测试场景。

验收：

- [x] 自动编辑模式不能静默改 `.ccr/settings.json`。
- [x] `cd .ccr; echo ... > settings.json` 这类命令不能绕过路径验证。
- [x] sandbox deny write 覆盖 `.ccr/settings*`。

实现记录：

- [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts) 已把 `.ccr` 加入危险目录，并新增 `isAgentSettingsPath(...)`。
- 旧的 `isClaudeSettingsPath(...)` 保留为兼容导出，内部识别 `.ccr/settings*`。
- [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts) 的 `denyWrite` 已使用 settings helper，并显式覆盖当前 cwd 下的 `.ccr` settings 文件。

## P3 settings 读写切到 `.ccr`

目标：

运行时和新写入都只使用 `.ccr`。

建议改动：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts)
  - `getSettingsForSourceUncached(project/local)` 读取 `.ccr`。
  - `getSettingsWithErrors()` 读取 `.ccr`。
  - `updateSettingsForSource(project/local)` 写 `.ccr`。
  - `rawSettingsContainsKey` 读取 `.ccr`。
- [changeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/settings/changeDetector.ts)
  - watch `.ccr` settings 文件。
  - path 到 source 的反查支持 `.ccr`。
- `.gitignore`
  - local 写入后自动加入 `.ccr/settings.local.json`。

验收：

- [x] 只有 `.claude/settings.local.json` 时，CCR 不再读取旧权限。
- [x] 同时有 `.claude` 和 `.ccr` 时，只读取 `.ccr`。
- [x] Desktop 或 TUI 保存 local settings 后只写 `.ccr/settings.local.json`。
- [x] 第一次保存只写 `.ccr`，不合并旧 `.claude`。

实现记录：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 已把 `projectSettings/localSettings` 的读写统一到 `.ccr`。
- [changeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/settings/changeDetector.ts) 已支持 `.ccr` 路径 watcher 和 path 反查。
- [permissionsLoader.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/permissionsLoader.ts) 的 lenient 编辑读取已使用 `.ccr` 路径。
- 新增 [smoke-settings-isolation.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-settings-isolation.mjs) 与 `npm.cmd run smoke:settings-isolation`。

验证：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:settings-isolation
npm.cmd run smoke:permissions
```

## P4 App Server / Desktop / TUI 展示新路径

目标：

用户看到的路径不再误导为 CCR 写 `.claude`。

建议改动：

- [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts)
  - `path` 保持为写入路径。
  - 可增加 `readPaths`。
  - `defaultSource` 建议从 `localSettings` 改为 `userSettings`。
- App Server protocol
  - 更新 permission settings source schema。
- Desktop renderer
  - 设置入口切换为应用级页面，不再嵌入聊天工作区。
  - 设置页左侧显示分类导航，左上角返回进入设置前的页面。
  - 设置页显示“写入路径”。
  - 文案统一为 CCR 配置，不再把 `.claude` 当主路径展示。
- TUI
  - [AddPermissionRules.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/AddPermissionRules.tsx) user 文案改 `~/.ccr/settings.json`。
  - [hooksSettings.ts](D:/agent_project/claude-code-reforged/src/utils/hooks/hooksSettings.ts) 展示路径同步。
  - [TrustDialog/utils.ts](D:/agent_project/claude-code-reforged/src/components/TrustDialog/utils.ts) 用 helper 输出来源。

验收：

- [x] Desktop 设置页不再把 `.claude/settings.local.json` 显示为写入路径。
- [x] 用户看不到旧 `.claude` settings 兼容来源。
- [x] CLI/TUI 权限保存选项显示 `.ccr`。
- [x] App Server protocol typecheck 通过。

实现记录：

- [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts) 的权限设置快照已扩展 `readPaths`，`path` 保持为写入路径，默认保存源切到 `userSettings`。
- [protocol.ts](D:/agent_project/claude-code-reforged/src/app-server/protocol.ts) 的 permission settings get/update 结果收紧为 `CorePermissionSettingsSnapshot`。
- [SettingsPage.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/pages/SettingsPage.tsx) 已显示“写入”，旧 `.claude` 不再作为 settings 路径展示。
- TUI 权限保存选项、hooks 来源、TrustDialog、init/insights/plugin/sandbox/statusline/SDK 文案已同步为 `.ccr` 主路径口径。
- [smoke-settings-isolation.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-settings-isolation.mjs) 已增加 Core 快照展示字段断言。

验证：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:settings-isolation
npm.cmd run smoke:permissions
npm.cmd run smoke:app-server
```

## P5 worktree、settings sync、文档和 smoke 补齐

目标：

补上容易被忽略的周边链路，避免只有主流程迁了。

建议改动：

- [worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts)
  - post creation setup 复制 `.ccr/settings.local.json`。
- [settingsSync/types.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/types.ts)
  - sync key 切到 `.ccr`。
- 文档
  - 更新 [CCR 用户目录与安装布局](../architecture/ccr-home-layout.md) 的项目级私有配置说明。
  - 更新 [CCR 防冲突迁移清单](../architecture/ccr-conflict-isolation-migration.md) 第三轮状态。

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

状态：已完成。

实现记录：

- [worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts) 的 post creation setup 已只复制 `.ccr/settings.local.json`。
- [settingsSync/types.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/types.ts) 的 sync key 已切到 `.ccr`。
- [settingsSync/index.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/index.ts) 上传和下载都只使用 `.ccr` key。
- [CCR 用户目录与安装布局](../architecture/ccr-home-layout.md) 已补项目 `.ccr/settings*.json` 目录口径。
- [CCR 防冲突迁移清单](../architecture/ccr-conflict-isolation-migration.md) 已补第 3 轮项目级 settings 迁移进展。
- [smoke-settings-isolation.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-settings-isolation.mjs) 已覆盖 settings sync `.ccr` key 断言。

验证：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run smoke:settings-isolation
npm.cmd run smoke:permissions
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run desktop:build
```

备注：

- `npm.cmd run typecheck:desktop -- --pretty false` 当前会被仓库既有的 `MACRO`、`Bun` 和可选 native 包类型问题阻断；本轮用 `desktop:build` 验证 Desktop 构建链路。

## P6 迁移体验与旧路径清理策略

目标：

不提供运行时迁移兼容。旧 `.claude/settings*.json` 不再影响 CCR，用户如需保留内容可手动复制到 `.ccr/settings*.json`。

建议改动：

- 不增加运行时迁移入口。
- 不自动读取、合并或复制 `.claude/settings*.json`。
- 文档说明：
  - `.claude/settings*.json` 不再读取。
  - `.ccr` 是 CCR 新主路径。
  - `.claude-plugin` 不属于本迁移范围。

验收：

- [x] 用户知道旧 `.claude` settings 不再影响 CCR。
- [x] 用户能按文档手动迁移到 `.ccr`。
- [x] 迁移不会由运行时自动覆盖已有 `.ccr`。

状态：已完成。

实现记录：

- [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 已移除 project/local 对 `.claude/settings*.json` 的兼容读取。
- [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts) 不再输出 migration 兼容状态。
- [SettingsPage.tsx](D:/agent_project/claude-code-reforged/apps/desktop/src/renderer/src/components/pages/SettingsPage.tsx) 不再显示旧 `.claude` settings 迁移提示。
- [smoke-settings-isolation.mjs](D:/agent_project/claude-code-reforged/scripts/smoke-settings-isolation.mjs) 已覆盖只读写 `.ccr` 的断言。

验证：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run smoke:settings-isolation
npm.cmd run smoke:permissions
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
```

## 后续记录（追加）

### 第 1 轮：扫描和方案收敛

已完成代码扫描和方案文档。初始方案曾考虑 `.claude` 兼容读取，后因当前项目只有个人使用，最终收敛为项目级 settings 只认 `.ccr`。下一步从 P1 路径 helper 开始，先建立统一入口，再动 settings 读写行为。

### 第 2 轮：第一阶段 P1-P3 完成

已完成项目 settings 路径 helper、安全保护和读写切换主链路。当前行为是：读写都走 `.ccr/settings*.json`；自动编辑保护与 sandbox 禁写覆盖 `.ccr` settings 文件。下一步进入 P4，把 App Server、Desktop 和 TUI 的展示口径同步到新路径。

### 第 3 轮：P4 展示口径完成

已完成 App Server、Desktop 和 TUI 的路径展示统一。当前行为是：对外 `path` 表示 `.ccr/settings*.json` 写入路径，`readPaths` 表示实际读取路径；Desktop 设置页显示“写入”，CLI/TUI 权限和 hooks 文案同步到 `.ccr` 口径。验证通过 `typecheck`、`build`、`smoke:settings-isolation`、`smoke:permissions`、`smoke:app-server`。下一步进入 P5，补 worktree、settings sync、文档和周边 smoke。

### 第 4 轮：P5 周边链路补齐

已完成 worktree、settings sync、文档和 smoke 补齐。当前行为是：worktree 只复制 `.ccr/settings.local.json`；settings sync 上传和下载都使用 `.ccr` key；目录布局和迁移文档已同步。验证通过 `typecheck`、`build`、`smoke:settings-isolation`、`smoke:permissions`、`smoke:app-server`、`smoke:app-server-client`、`desktop:build`。下一步进入 P6，补旧路径清理策略。

### 第 5 轮：P6 迁移提示完成

已完成旧路径清理策略。Core 不再检测或读取 `.claude/settings*.json`，Desktop 不再展示旧路径迁移提示；如需保留旧内容，由用户手动复制到 `.ccr/settings*.json`。项目级 settings 隔离当前任务列表已完成。
