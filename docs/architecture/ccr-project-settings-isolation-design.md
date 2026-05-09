# CCR 项目级 Settings 隔离设计

## 1. 背景

CCR 的用户级目录已经收敛到 `~/.ccr`，代码入口是 [envUtils.ts](D:/agent_project/claude-code-reforged/src/utils/envUtils.ts)。但项目级配置仍然复用上游 Claude Code 的目录：

- `.claude/settings.json`
- `.claude/settings.local.json`

这会带来两个问题：

1. CCR Desktop 的权限设置页会显示并写入 `.claude/settings.local.json`，用户很难判断这是 CCR 配置还是原版 Claude 配置。
2. 如果直接把字符串替换成 `.ccr`，会同时影响 CLI、TUI、Desktop、App Server、sandbox、权限规则、settings watcher、worktree、settings sync、插件和 agent/skill 目录，容易形成半迁移状态。

所以本设计采用“CCR 主路径 + Claude 兼容读取”的渐进方案，而不是一次性全仓替换。

## 2. 目标

- 新的 CCR 项目级 settings 默认写入 `.ccr/settings.json` 和 `.ccr/settings.local.json`。
- 继续兼容读取已有 `.claude/settings.json` 和 `.claude/settings.local.json`，避免旧项目、旧权限、旧 hooks 立刻失效。
- 对外仍保留 `userSettings / projectSettings / localSettings / flagSettings / policySettings` 这套语义，不新增用户可见的 setting source。
- 所有安全边界同时覆盖 `.claude` 和 `.ccr`，包括自动编辑保护、sandbox 禁写、Bash/PowerShell 路径验证和权限提示。
- Desktop/App Server 展示“写入路径”和“兼容读取路径”，避免用户再看到 `.claude` 后误以为 CCR 仍在污染原版配置。

## 3. 非目标

第一版不迁移下面这些目录或协议：

- `.claude/skills`
- `.claude/agents`
- `.claude/commands`
- `.claude/worktrees`
- `.claude/plugins`
- `.claude/teams`
- `.claude/tasks`
- `.claude-plugin`
- `CLAUDE.md` / `CLAUDE.local.md` 记忆文件

这些属于项目能力生态迁移，不是这次“项目级 settings 路径隔离”的最小闭环。第一版只处理 settings。

## 4. 扫描结果

| 模块 | 关键位置 | 当前行为 | 迁移要求 |
| --- | --- | --- | --- |
| settings 路径 | [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) | `projectSettings/localSettings` 写死 `.claude/settings*.json` | 引入项目 settings 命名空间 helper，区分读路径和写路径 |
| source 顺序 | [constants.ts](D:/agent_project/claude-code-reforged/src/utils/settings/constants.ts) | source 顺序是 `user -> project -> local -> flag -> policy` | source 顺序保持不变，source 内部合并 legacy 和 primary |
| settings watcher | [changeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/settings/changeDetector.ts) | 只 watch `getSettingsFilePathForSource(source)` | 同时 watch `.ccr` 和 `.claude` 候选路径 |
| settings 写入 | [settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts) | `updateSettingsForSource` 写当前 source 单一路径，local 自动加入 `.gitignore` | 写 `.ccr` 主路径，local 自动加入 `.ccr/settings.local.json` |
| 权限读写 | [permissionsLoader.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/permissionsLoader.ts), [PermissionUpdate.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/PermissionUpdate.ts) | 通过 settings API 读写 | 不应各自改路径，只依赖 settings API |
| Desktop 权限设置 | [permissionSettingsCore.ts](D:/agent_project/claude-code-reforged/src/core/permissionSettingsCore.ts) | `path` 来自 `getSettingsFilePathForSource`，默认源是 `localSettings` | `path` 表示写入路径，可补 `readPaths/legacyPaths`；默认编辑源建议先改为 `userSettings` |
| sandbox 禁写 | [sandbox-adapter.ts](D:/agent_project/claude-code-reforged/src/utils/sandbox/sandbox-adapter.ts) | 禁写当前 settings 文件，并额外禁写当前 cwd 的 `.claude/settings*` | 禁写所有候选 settings 路径，当前 cwd 也覆盖 `.ccr/settings*` |
| 自动编辑保护 | [filesystem.ts](D:/agent_project/claude-code-reforged/src/utils/permissions/filesystem.ts) | `isClaudeSettingsPath` 和危险目录只覆盖 `.claude` | 扩展为 agent settings 保护，`.ccr/settings*` 与 `.ccr` 目录也要保护 |
| Bash/PowerShell 校验 | [BashTool/pathValidation.ts](D:/agent_project/claude-code-reforged/src/tools/BashTool/pathValidation.ts), [PowerShellTool/pathValidation.ts](D:/agent_project/claude-code-reforged/src/tools/PowerShellTool/pathValidation.ts) | 注释和验证案例以 `.claude/settings*` 为主 | 依赖 `filesystem.ts` 统一保护，并补 `.ccr` 测试/注释 |
| worktree | [worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts) | worktree 根仍是 `.claude/worktrees`，并复制 `settings.local.json` | 第一版不迁 worktree 根，但复制 local settings 时应复制 `.ccr/settings.local.json` 主路径，必要时兼容旧文件 |
| settings sync | [settingsSync/types.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/types.ts), [settingsSync/index.ts](D:/agent_project/claude-code-reforged/src/services/settingsSync/index.ts) | sync key 仍写 `~/.claude/settings.json` 和 `projects/.../.claude/settings.local.json` | 若 CCR 继续启用 sync，key 应切到 `.ccr`；旧 key 只做读取迁移 |
| TrustDialog 文案 | [TrustDialog/utils.ts](D:/agent_project/claude-code-reforged/src/components/TrustDialog/utils.ts) | 展示 `.claude/settings*` | 用 settings helper 返回展示路径，能说明兼容来源 |
| TUI 权限保存选项 | [AddPermissionRules.tsx](D:/agent_project/claude-code-reforged/src/components/permissions/rules/AddPermissionRules.tsx) | user 文案仍是 `~/.claude/settings.json`，project/local 走 relative helper | user 改为 `~/.ccr/settings.json`，project/local 由新 helper 输出 `.ccr` |
| hooks 展示 | [hooksSettings.ts](D:/agent_project/claude-code-reforged/src/utils/hooks/hooksSettings.ts) | 展示 `User settings (~/.claude/settings.json)` 等 | 展示写入路径，兼容读取另列说明 |
| skill/agent 目录 | [loadSkillsDir.ts](D:/agent_project/claude-code-reforged/src/skills/loadSkillsDir.ts), [agentFileUtils.ts](D:/agent_project/claude-code-reforged/src/components/agents/agentFileUtils.ts) | project skill/agent 仍在 `.claude` | 本轮不迁，但安全保护必须考虑未来 `.ccr` 目录 |

## 5. 路径模型

新增一个项目 settings 命名空间层，不再让调用点手写 `.claude` 或 `.ccr`。

建议核心常量：

```ts
const CCR_PROJECT_SETTINGS_DIR = '.ccr'
const LEGACY_PROJECT_SETTINGS_DIR = '.claude'
```

建议核心 helper：

```ts
type ProjectSettingsVariant = 'primary' | 'legacy'

function getRelativeProjectSettingsPath(
  source: 'projectSettings' | 'localSettings',
  variant: ProjectSettingsVariant,
): string

function getSettingsWriteFilePathForSource(source: SettingSource): string | undefined

function getSettingsReadFilePathsForSource(source: SettingSource): string[]

function getSettingsDisplayPathsForSource(source: SettingSource): {
  writePath?: string
  readPaths: string[]
  legacyPaths: string[]
}
```

兼容策略：

- `getSettingsFilePathForSource(source)` 可以先保留，语义改成“写入路径 / 主路径”，减少调用点改动。
- 需要读多个文件、watch 多个文件、安全禁写多个文件的地方，必须使用新的多路径 helper。
- `getRelativeSettingsFilePathForSource(source)` 可以保留，但返回 `.ccr/settings*.json`。需要旧路径时用 explicit legacy helper，不能再靠字符串拼接。

## 6. 读取与合并规则

对外 source 顺序保持不变：

```text
userSettings -> projectSettings -> localSettings -> flagSettings -> policySettings
```

source 内部新增兼容合并：

```text
projectSettings = merge(.claude/settings.json, .ccr/settings.json)
localSettings   = merge(.claude/settings.local.json, .ccr/settings.local.json)
```

同一个 source 内：

1. `.claude` 是低优先级兼容来源。
2. `.ccr` 是高优先级主来源。
3. 两者都不存在时返回 `null`。
4. 两者都有内容时，`.ccr` 覆盖 `.claude` 的同名字段。
5. schema 错误要按文件分别上报，不能因为 `.ccr` 有效就吞掉 `.claude` 的错误。

这样旧项目不需要立即迁移，新项目也不会继续把 CCR 配置写到 `.claude`。

## 7. 写入规则

所有新写入都写主路径：

| Source | 写入路径 |
| --- | --- |
| `userSettings` | `~/.ccr/settings.json` |
| `projectSettings` | `<workspace>/.ccr/settings.json` |
| `localSettings` | `<workspace>/.ccr/settings.local.json` |

写入前的 existing settings 建议使用“该 source 的兼容合并结果”，即：

```text
existing = merge(legacy, primary)
updated = merge(existing, patch)
write primary
```

这会让第一次写 `.ccr` 时自然带上旧 `.claude` 中仍有效的配置，避免用户点一次保存后丢掉旧权限或 hooks。

`localSettings` 写入后自动加入 `.gitignore`：

```text
.ccr/settings.local.json
```

不建议第一版直接 gitignore 整个 `.ccr/`，因为 `.ccr/settings.json` 未来可能承载团队共享配置。

## 8. 安全不变式

迁移路径时，安全保护必须先于或同步于写入行为落地。

不变式：

- 模型不能在自动编辑模式下静默修改 `.ccr/settings.json` 或 `.ccr/settings.local.json`。
- Bash/PowerShell 通过 `cd .ccr` 再写 `settings.json` 也不能绕过保护。
- sandbox 必须 deny write 到所有 settings 候选路径，包括原始 cwd 和当前 cwd。
- `.claude/settings*` 仍然是受保护文件，因为兼容读取期间它仍能影响运行时。
- `.ccr` 应加入危险目录保护，至少覆盖 settings 文件；如果未来迁 skill/agent，再扩展 skill scoped allow。

建议保留旧函数名 `isClaudeSettingsPath` 做兼容导出，但内部改为同时识别 `.claude` 和 `.ccr`。后续再新增更准确的 `isAgentSettingsPath`。

## 9. Desktop 与 App Server 展示

Desktop 权限设置需要明确两类路径：

- 写入路径：用户点击保存后会写到哪里。
- 兼容读取路径：当前 effective 权限还从哪些旧文件合并而来。

建议 `permission/settings/get` 的 source 项增加可选字段：

```ts
{
  path?: string
  readPaths?: string[]
  legacyPaths?: string[]
}
```

第一版 UI 可以只展示：

- `写入：<workspace>/.ccr/settings.local.json`
- `兼容读取：<workspace>/.claude/settings.local.json`

Desktop 设置页的默认编辑源建议改成 `userSettings`，原因是设置页更像全局配置入口；工具权限弹窗里的“保存到本项目”仍然可以继续使用 `localSettings`。

Desktop 设置页的承载方式采用应用级页面，而不是聊天工作区里的内嵌面板：

1. 用户在左侧导航点击“设置”后，主界面切换为完整设置界面。
2. 设置界面左侧显示设置分类，右侧显示当前分类内容。
3. 设置界面左上角提供返回箭头，返回进入设置前的页面，例如聊天、MCP 或日志。
4. 进入设置后不渲染聊天工作区、Topbar、Composer 和运行状态页脚，避免设置页和当前会话状态混在一起。

## 10. 分轮实施

### 第 1 轮：路径 helper

- 增加 `.ccr/.claude` 项目 settings helper。
- 保持旧行为不变，先让调用点有统一入口。
- 补最小单测或 smoke，确认 helper 在 Windows 路径下输出稳定。

### 第 2 轮：安全覆盖

- 自动编辑保护覆盖 `.ccr/settings*`。
- sandbox deny write 覆盖 `.ccr/settings*`。
- Bash/PowerShell 路径验证补 `.ccr` 场景。

### 第 3 轮：读写切换

- `projectSettings/localSettings` 读取 `.claude + .ccr`。
- 写入切到 `.ccr`。
- watcher 同时监听新旧路径。
- `rawSettingsContainsKey`、`getSettingsWithSources` 等读取入口同步改多路径。

### 第 4 轮：UI 与协议

- App Server permission settings snapshot 展示 write/read/legacy paths。
- Desktop 设置页展示 `.ccr` 写入路径。
- TUI 权限保存、hooks、TrustDialog、debug skill 的路径文案统一。

### 第 5 轮：周边能力

- worktree 复制 `.ccr/settings.local.json`，兼容旧 `.claude/settings.local.json`。
- settings sync key 切到 `.ccr`，旧 key 只读迁移。
- 文档和 smoke 补齐。

## 11. 验证清单

至少覆盖这些场景：

1. 只有 `.claude/settings.local.json`：CCR 能读到旧权限，Desktop 显示兼容读取来源。
2. 只有 `.ccr/settings.local.json`：CCR 能读到新权限，Desktop 写入仍在 `.ccr`。
3. 两者同时存在：同一字段 `.ccr` 覆盖 `.claude`。
4. Desktop 权限设置保存：生成或更新 `.ccr/settings.local.json`，不写 `.claude/settings.local.json`。
5. `.gitignore` 自动加入 `.ccr/settings.local.json`。
6. Bash/PowerShell 尝试写 `.ccr/settings.json`：不会被自动允许。
7. sandbox 模式下工具写 `.ccr/settings.json`：被 deny write 拦截。
8. worktree 创建后，本地项目权限在新 worktree 中可用。

建议命令：

```powershell
npm.cmd run typecheck -- --pretty false
npm.cmd run typecheck:desktop -- --pretty false
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-client
npm.cmd run smoke:permissions
```

## 12. 一句话结论

项目级 settings 应该迁到 `.ccr`，但不能硬替换。正确做法是：`.ccr` 作为新写入主路径，`.claude` 作为兼容读取来源，所有安全保护同时覆盖新旧路径，再逐步更新 Desktop/TUI/App Server 的展示和周边同步链路。
