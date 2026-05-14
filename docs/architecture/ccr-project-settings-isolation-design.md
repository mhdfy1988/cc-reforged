# CCR 项目级 Settings 隔离设计

## 1. 当前结论

CCR 的项目级 settings 只使用 `.ccr/settings*.json`：

- 项目共享 settings：`<workspace>/.ccr/settings.json`
- 项目个人 settings：`<workspace>/.ccr/settings.local.json`

当前项目只有个人使用，不保留旧 `.claude/settings.json` / `.claude/settings.local.json` 的运行时兼容读取。旧文件即使存在，也不再参与 CCR settings 合并、Desktop 设置页展示、App Server 快照、settings sync 或 worktree 复制。

## 2. 目标

- `projectSettings` 读写 `<workspace>/.ccr/settings.json`。
- `localSettings` 读写 `<workspace>/.ccr/settings.local.json`。
- `userSettings` 继续读写 `~/.ccr/settings.json`。
- App Server、Desktop、TUI、CLI 文案统一展示 `.ccr`。
- 自动编辑保护和 sandbox 禁写覆盖 `.ccr/settings*`。
- settings sync 使用 `.ccr` key。
- worktree 只复制 `.ccr/settings.local.json`。

## 3. 非目标

本轮只迁项目级 settings，不迁下面这些项目生态目录或协议：

- `.claude/skills`
- `.claude/agents`
- `.claude/commands`
- `.claude/worktrees`
- `.claude/plugins`
- `.claude/teams`
- `.claude/tasks`
- `.claude-plugin`
- `CLAUDE.md` / `CLAUDE.local.md`

这些目录仍属于上游 Claude Code 生态或后续独立迁移主题。

## 4. 路径模型

settings 路径由 [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) 统一生成：

```ts
export const CCR_PROJECT_SETTINGS_DIR = '.ccr'

getRelativeProjectSettingsPath('projectSettings') // .ccr/settings.json
getRelativeProjectSettingsPath('localSettings') // .ccr/settings.local.json
getSettingsWriteFilePathForSource(source)
getSettingsReadFilePathsForSource(source)
getSettingsDisplayPathsForSource(source)
```

`getSettingsFilePathForSource(...)` 保留为兼容调用入口，但语义已经等同于主写入路径。

## 5. 读取与写入

`projectSettings` / `localSettings` 的读取和写入都只走 `.ccr`：

```text
projectSettings -> <workspace>/.ccr/settings.json
localSettings   -> <workspace>/.ccr/settings.local.json
```

旧 `.claude/settings*.json` 不再读取。若需要保留旧内容，手动复制到 `.ccr/settings*.json`，运行时不会自动合并或迁移。

## 6. 安全边界

- [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts) 把 `.ccr` 纳入危险目录，并识别 `.ccr/settings.json` 与 `.ccr/settings.local.json`。
- [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts) 的 `denyWrite` 使用 settings helper，当前 cwd 与 original cwd 不同时也显式禁写当前 cwd 下 `.ccr/settings*`。
- `.claude` 目录仍保留为危险目录，是为了保护 skill / agent / command 等现存生态目录，不代表 `.claude/settings*` 仍作为 CCR settings 来源。

## 7. 对外展示

- Core 权限设置快照中的 `path` 表示 `.ccr` 写入路径。
- `readPaths` 表示实际读取路径，目前 project/local 只有 `.ccr`。
- Desktop 设置页只展示“写入”路径。
- TUI 权限保存选项、hooks 来源、TrustDialog、init/insights/plugin/sandbox/statusline/SDK 文案统一到 `.ccr`。

## 8. 周边链路

- worktree post creation setup 只复制 `.ccr/settings.local.json`。
- settings sync 上传和下载都使用 `.ccr` key：
  - `~/.ccr/settings.json`
  - `projects/<projectId>/.ccr/settings.local.json`
- `smoke:settings-isolation` 覆盖 `.ccr` 读写、App Server/Core 快照字段、settings sync key、权限保护和 sandbox deny write。

## 9. 验收

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run smoke:settings-isolation
npm.cmd run smoke:permissions
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
```

`typecheck:desktop` 当前会被仓库既有的 `MACRO`、`Bun` 和可选 native 包类型问题阻断；Desktop 侧用 `desktop:build` 做当前有效验证。
