# CCR 防冲突迁移清单

## 1. 目标

这份文档只回答一个问题：

**为了避免 `ccr` 和本机已安装的原版 Claude 在同一台机器上互相冲突，哪些“配置目录 / 凭据文件 / 环境变量”必须改。**

本清单刻意**不**追求“全仓去 Claude 化”，只覆盖：

- 用户家目录下的配置根目录
- LLM 配置文件路径
- Codex OAuth 凭据文件路径
- 会影响登录、模型选择、认证状态提示的环境变量
- 会让 `ccr` 继续误读原版 Claude 登录态的旧认证变量

## 2. 明确不在本轮范围内

以下内容当前**不建议**因为“品牌清理”而改动：

- 上游来源说明、参考文档 URL、历史恢复文档
- 依赖名，例如 `@anthropic-ai/sdk`
- 协议头，例如 `anthropic-beta`、`anthropic-version`
- 兼容层文件名，例如 `src/services/api/claude.ts`
- 插件生态约定，例如 `.claude-plugin`

原因很简单：这些改动对“避免和本机原版 Claude 冲突”帮助很小，但会明显放大兼容风险。

## 2.1 本轮硬约束

为了真正避免和本机原版 Claude 冲突，本轮迁移采用下面这条硬约束：

- **凡是本轮迁移覆盖到的配置目录、凭据文件、环境变量，一律不保留运行时隐式回退。**

也就是说：

- 不默认回读 `CLAUDE_CONFIG_DIR`
- 不默认回读 `CLAUDE_CODE_LLM_*`
- 不默认回读 `CLAUDE_CODE_CODEX_OAUTH_*`
- 不默认回读 `CLAUDE_CODE_OAUTH_*`

如果后面确实需要导入旧数据，只能走**显式迁移**，不能继续在运行时偷偷兼容旧入口。

## 3. 第一批必须改

这一批是**本地防冲突最小闭环**。不改它们，`ccr` 仍会继续碰原版 Claude 的家目录、环境变量或凭据。

### 3.1 配置根目录

#### 当前问题

- 当前默认配置根目录仍然是 `~/.claude`
- 当前环境变量入口仍然是 `CLAUDE_CONFIG_DIR`

#### 目标

- 新环境变量：`CCR_CONFIG_DIR`
- 新默认根目录：`~/.ccr`

#### 主改点

- [src/utils/envUtils.ts](D:/agent_project/claude-code-reforged/src/utils/envUtils.ts)
  - 当前：
    - `CLAUDE_CONFIG_DIR`
    - `join(homedir(), '.claude')`

#### 跟随改点

- [src/utils/env.ts](D:/agent_project/claude-code-reforged/src/utils/env.ts)
  - 当前 home 级配置文件名仍是 `.claude*.json`
- [src/utils/secureStorage/macOsKeychainHelpers.ts](D:/agent_project/claude-code-reforged/src/utils/secureStorage/macOsKeychainHelpers.ts)
  - 当前仍通过 `CLAUDE_CONFIG_DIR` 判断默认目录
- [src/utils/swarm/spawnUtils.ts](D:/agent_project/claude-code-reforged/src/utils/swarm/spawnUtils.ts)
  - 当前会把 `CLAUDE_CONFIG_DIR` 传给子进程
- [src/utils/env.ts](D:/agent_project/claude-code-reforged/src/utils/env.ts)
- [src/services/analytics/firstPartyEventLoggingExporter.ts](D:/agent_project/claude-code-reforged/src/services/analytics/firstPartyEventLoggingExporter.ts)
- [src/utils/model/modelCapabilities.ts](D:/agent_project/claude-code-reforged/src/utils/model/modelCapabilities.ts)
- [src/utils/sessionStorage.ts](D:/agent_project/claude-code-reforged/src/utils/sessionStorage.ts)
- [src/memdir/paths.ts](D:/agent_project/claude-code-reforged/src/memdir/paths.ts)
  - 这些地方至少有注释、缓存 key 或测试说明依赖 `CLAUDE_CONFIG_DIR`

#### 建议口径

- 只认 `CCR_CONFIG_DIR`
- 默认家目录统一迁到 `~/.ccr`
- 不再运行时回读 `CLAUDE_CONFIG_DIR`

### 3.2 Home 级 OAuth 配置文件

#### 当前问题

当前仍会在 home 下读取 `.claude${suffix}.json` 这类旧命名文件。

#### 主改点

- [src/utils/env.ts](D:/agent_project/claude-code-reforged/src/utils/env.ts)
  - 当前：
    - `.claude${fileSuffixForOauthConfig()}.json`
    - `process.env.CLAUDE_CONFIG_DIR || homedir()`

#### 目标

- 文件命名迁到 `ccr` 命名空间
- 不再运行时回读旧 `.claude*.json`

#### 建议口径

- 新文件建议改成 `.ccr${suffix}.json`
- 运行时只读新文件
- 如果未来需要迁老文件，只能做显式迁移脚本或导入命令

### 3.3 LLM 配置路径与模型选择环境变量

#### 当前问题

LLM 选择和配置文件路径仍然使用原版 Claude 的环境变量命名空间。

#### 主改点

- [src/services/llm/llmConfig.ts](D:/agent_project/claude-code-reforged/src/services/llm/llmConfig.ts)
  - 当前：
    - `CLAUDE_CODE_LLM_CONFIG_PATH`
    - `CLAUDE_CODE_LLM_PROVIDER`
    - `CLAUDE_CODE_LLM_MODEL`
    - 默认文件：`~/.claude/data/llm.config.local.json`

#### 目标

- `CCR_LLM_CONFIG_PATH`
- `CCR_LLM_PROVIDER`
- `CCR_LLM_MODEL`
- 默认文件迁到：`~/.ccr/data/llm.config.local.json`

#### 跟随改点

- [src/commands/model/model.tsx](D:/agent_project/claude-code-reforged/src/commands/model/model.tsx)
  - 当前 `/model` 仍提示：
    - `CLAUDE_CODE_LLM_MODEL`

#### 建议口径

- 只认 `CCR_LLM_*`
- `/model`、`auth status`、帮助文案都同步显示新变量名
- 不再运行时回读 `CLAUDE_CODE_LLM_*`

### 3.4 Codex OAuth 凭据文件与环境变量

#### 当前问题

Codex OAuth 明明是我们自己新增的 provider，但默认凭据文件和环境变量名字仍然挂在 `CLAUDE_CODE_*` 下。

#### 主改点

- [src/services/llm/sessions/CodexOAuthSession.ts](D:/agent_project/claude-code-reforged/src/services/llm/sessions/CodexOAuthSession.ts)
  - 当前默认凭据文件：
    - `~/.claude/data/codex-oauth.json`
  - 当前环境变量：
    - `CLAUDE_CODE_CODEX_OAUTH_BASE_URL`
    - `CLAUDE_CODE_CODEX_OAUTH_AUTHORIZE_URL`
    - `CLAUDE_CODE_CODEX_OAUTH_TOKEN_URL`
    - `CLAUDE_CODE_CODEX_OAUTH_REDIRECT_URI`
    - `CLAUDE_CODE_CODEX_OAUTH_SCOPE`
    - `CLAUDE_CODE_CODEX_OAUTH_CLIENT_ID`
    - `CLAUDE_CODE_CODEX_OAUTH_CREDENTIAL_FILE`
    - `CLAUDE_CODE_CODEX_OAUTH_ACCESS_TOKEN`
    - `CLAUDE_CODE_CODEX_OAUTH_REFRESH_TOKEN`
    - `CLAUDE_CODE_CODEX_OAUTH_EXPIRES_AT`
    - `CLAUDE_CODE_CODEX_OAUTH_ACCOUNT_ID`

#### 目标

- 默认凭据文件：`~/.ccr/data/codex-oauth.json`
- 新环境变量统一迁到：
  - `CCR_CODEX_OAUTH_BASE_URL`
  - `CCR_CODEX_OAUTH_AUTHORIZE_URL`
  - `CCR_CODEX_OAUTH_TOKEN_URL`
  - `CCR_CODEX_OAUTH_REDIRECT_URI`
  - `CCR_CODEX_OAUTH_SCOPE`
  - `CCR_CODEX_OAUTH_CLIENT_ID`
  - `CCR_CODEX_OAUTH_CREDENTIAL_FILE`
  - `CCR_CODEX_OAUTH_ACCESS_TOKEN`
  - `CCR_CODEX_OAUTH_REFRESH_TOKEN`
  - `CCR_CODEX_OAUTH_EXPIRES_AT`
  - `CCR_CODEX_OAUTH_ACCOUNT_ID`

#### 跟随改点

- [src/cli/handlers/auth.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/auth.ts)
  - 当前未登录提示仍然写：
    - `CLAUDE_CODE_CODEX_OAUTH_*`

#### 建议口径

- 只认 `CCR_CODEX_OAUTH_*`
- `ccr auth login --provider codex-oauth` / `auth status` / 报错提示统一只展示新变量名
- 不再运行时回读 `CLAUDE_CODE_CODEX_OAUTH_*`

### 3.5 原版 Claude OAuth 环境变量

#### 当前问题

即使我们把 `LLM` 和 `Codex OAuth` 迁走了，只要 `ccr` 还继续读取 `CLAUDE_CODE_OAUTH_*`，它就仍可能误吃原版 Claude 的登录态。

这也是“环境变量冲突”里最容易被忽略的一块。

#### 关键变量

- `CLAUDE_CODE_OAUTH_TOKEN`
- `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`
- `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`
- `CLAUDE_CODE_OAUTH_SCOPES`
- `CLAUDE_CODE_OAUTH_CLIENT_ID`
- `CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`

#### 主要落点

- [src/cli/handlers/auth.ts](D:/agent_project/claude-code-reforged/src/cli/handlers/auth.ts)
- [src/utils/auth.ts](D:/agent_project/claude-code-reforged/src/utils/auth.ts)
- [src/utils/authFileDescriptor.ts](D:/agent_project/claude-code-reforged/src/utils/authFileDescriptor.ts)
- [src/constants/oauth.ts](D:/agent_project/claude-code-reforged/src/constants/oauth.ts)
- [src/utils/managedEnv.ts](D:/agent_project/claude-code-reforged/src/utils/managedEnv.ts)
- [src/utils/managedEnvConstants.ts](D:/agent_project/claude-code-reforged/src/utils/managedEnvConstants.ts)
- [src/utils/subprocessEnv.ts](D:/agent_project/claude-code-reforged/src/utils/subprocessEnv.ts)
- [src/bridge/bridgeEnabled.ts](D:/agent_project/claude-code-reforged/src/bridge/bridgeEnabled.ts)
- [src/bridge/sessionRunner.ts](D:/agent_project/claude-code-reforged/src/bridge/sessionRunner.ts)
- [src/services/oauth/client.ts](D:/agent_project/claude-code-reforged/src/services/oauth/client.ts)

#### 目标

- `CCR_OAUTH_TOKEN`
- `CCR_OAUTH_TOKEN_FILE_DESCRIPTOR`
- `CCR_OAUTH_REFRESH_TOKEN`
- `CCR_OAUTH_SCOPES`
- `CCR_OAUTH_CLIENT_ID`
- `CCR_API_KEY_FILE_DESCRIPTOR`

#### 建议口径

- 只认 `CCR_OAUTH_*` / `CCR_API_KEY_FILE_DESCRIPTOR`
- 不再运行时回读 `CLAUDE_CODE_OAUTH_*`
- 这样 `ccr` 才不会误吃原版 Claude 的登录态

#### 备注

这一批虽然比 `LLM` / `Codex OAuth` 更广，但仍然属于“环境变量防冲突”的正范围，不属于品牌清理扩散。

### 3.6 Remote 文件描述符默认路径

#### 当前问题

Remote / bridge 认证文件描述符路径仍然写死在：

- `/home/claude/.claude/remote/.oauth_token`
- `/home/claude/.claude/remote/.api_key`
- `/home/claude/.claude/remote/.session_ingress_token`

#### 主改点

- [src/utils/authFileDescriptor.ts](D:/agent_project/claude-code-reforged/src/utils/authFileDescriptor.ts)

#### 目标

建议迁到：

- `/home/claude/.ccr/remote/.oauth_token`
- `/home/claude/.ccr/remote/.api_key`
- `/home/claude/.ccr/remote/.session_ingress_token`

#### 备注

这不是 Windows 本机直接冲突点，但属于 `ccr` 自己的认证目录口径，应该和 `~/.ccr` 保持一致。

## 4. 第二批可后置，但要提前记账

这一批不是当前最小防冲突闭环，但如果以后要实现“`ccr` 在项目层也完全不和原版 Claude 混用”，就要继续推进。

### 4.1 项目级 `.claude/*` 目录体系

代表位置：

- [src/utils/settings/settings.ts](D:/agent_project/claude-code-reforged/src/utils/settings/settings.ts)
- [src/utils/skills/skillChangeDetector.ts](D:/agent_project/claude-code-reforged/src/utils/skills/skillChangeDetector.ts)
- [src/utils/worktree.ts](D:/agent_project/claude-code-reforged/src/utils/worktree.ts)
- [src/utils/plugins/pluginDirectories.ts](D:/agent_project/claude-code-reforged/src/utils/plugins/pluginDirectories.ts)
- [src/utils/swarm/permissionSync.ts](D:/agent_project/claude-code-reforged/src/utils/swarm/permissionSync.ts)
- [src/utils/teamDiscovery.ts](D:/agent_project/claude-code-reforged/src/utils/teamDiscovery.ts)

涉及目录：

- `.claude/settings.json`
- `.claude/settings.local.json`
- `.claude/skills`
- `.claude/agents`
- `.claude/worktrees`
- `.claude/plugins`
- `.claude/teams`
- `.claude/tasks`

#### 为什么后置

这一批改动面太大，已经不只是“本机家目录冲突”，而是项目内配置生态迁移。

#### 当前进展

项目级 settings 已进入单独迁移主线：

- 新写入主路径：`.ccr/settings.json`、`.ccr/settings.local.json`
- 读取主路径：`.ccr/settings.json`、`.ccr/settings.local.json`
- 安全保护：`.ccr/settings*` 纳入自动编辑保护和 sandbox 禁写
- 对外展示：Desktop、App Server、CLI/TUI 权限保存选项均以 `.ccr` 为主路径
- settings sync：上传和下载都使用 `.ccr` key
- worktree：只复制 `.ccr/settings.local.json`

这一轮只迁 settings，不迁 `.claude/skills`、`.claude/agents`、`.claude/worktrees`、`.claude/plugins` 等项目生态目录。

## 5. 实施顺序建议

### 第 1 轮

只做 home 级和环境变量最小闭环：

1. `CCR_CONFIG_DIR` + `~/.ccr`
2. `CCR_LLM_*`
3. `CCR_CODEX_OAUTH_*`
4. `CCR_OAUTH_*` / `CCR_API_KEY_FILE_DESCRIPTOR`
5. 对应 CLI 提示文字改新名

### 第 2 轮

补 remote 认证路径：

1. `/home/claude/.ccr/remote/*`
2. 子进程 / bridge / auth FD 传递

### 第 3 轮

项目级 settings 先行隔离：

1. settings 主写入路径切到 `.ccr/settings*.json`
2. settings 读取路径也只使用 `.ccr/settings*.json`
3. App Server、Desktop、TUI、worktree、settings sync 同步展示和流转口径
4. 旧 `.claude/settings*.json` 不再作为 CCR settings 来源

## 6. 验收清单

完成第一批后，至少应满足：

- `ccr` 默认不再读取 `~/.claude`
- `ccr` 默认把配置和凭据写到 `~/.ccr`
- `ccr auth login --provider codex-oauth` 不再提示 `CLAUDE_CODE_CODEX_OAUTH_*`
- `/model` 不再提示 `CLAUDE_CODE_LLM_MODEL`
- 设置了原版 Claude 的旧环境变量时，`ccr` 不会误读旧值
- `ccr` 不再把原版 Claude 的 home 配置当成自己的主配置源

## 7. 一句话结论

如果只从“避免和本机原版 Claude 冲突”出发，本轮真正该改的不是全仓所有 `claude` 字样，而是这三层：

1. `~/.claude` -> `~/.ccr`
2. `CLAUDE_* / CLAUDE_CODE_*` 的配置与认证环境变量 -> `CCR_*`
3. 会把旧变量名和旧目录暴露给用户的 CLI 提示与状态文案

其它像网址、依赖、协议头、兼容文件名，当前都不应因为这次防冲突迁移而顺手扩散改动。
