# CCR 用户目录与安装布局

CCR 的用户级默认目录是 `~/.ccr`，也就是 Windows 当前用户下的 `C:\Users\<user>\.ccr`。代码层默认由 `CCR_CONFIG_DIR` 覆盖，否则使用 `~/.ccr`。

这个目录是 CCR 自己的用户级家目录，用于放长期配置、用户安装的扩展能力、运行时状态和缓存。第三方 npm 包通过 `npx` 或全局安装被 CCR 配置引用时，不算 CCR 自己的安装目录。

## 1. 目录总览

建议布局：

```text
~/.ccr/
  settings.json
  mcp.json
  data/
    llm.config.local.json
    codex-oauth.json
  mcp/
    installed.json
    lock.json
    packages/
    servers/
    presets/
    cache/
  skills/
  plugins/
  rules/
  projects/
  sessions/
  logs/
  debug/
  cache/
  tmp/
```

## 2. 配置类

| 路径 | 用途 | 是否可提交 |
| --- | --- | --- |
| `~/.ccr/settings.json` | 用户级总配置 | 否 |
| `~/.ccr/mcp.json` | 用户级长期 MCP 配置，`ccr mcp add-playwright` 默认写入这里 | 否 |
| `~/.ccr/data/llm.config.local.json` | LLM provider/model 本地配置 | 否 |
| `~/.ccr/data/codex-oauth.json` | Codex OAuth 登录态 | 否 |

项目级共享 MCP 配置仍放项目根目录 `.mcp.json`。项目级 settings 已迁到项目 `.ccr/` 下：

| 路径 | 用途 | 是否可提交 |
| --- | --- | --- |
| `<project>/.ccr/settings.json` | 项目共享 settings，例如团队权限、hooks、插件启用状态 | 是 |
| `<project>/.ccr/settings.local.json` | 项目个人私有 settings，例如个人权限覆盖 | 否 |

`<project>/.claude/settings.json` 和 `<project>/.claude/settings.local.json` 不再作为 CCR settings 读取来源。CCR 新写入、运行时读取、Desktop 展示、App Server 快照和 settings sync 都以 `.ccr/settings*.json` 为唯一项目级 settings 路径。

当前 MCP 实现已经把 `user` scope 的主读写文件切到 `~/.ccr/mcp.json`。旧全局 settings 里的 `mcpServers` 只做迁移期只读兼容；同名 server 同时存在时，`~/.ccr/mcp.json` 优先。

## 3. 安装类

| 路径 | 用途 | 说明 |
| --- | --- | --- |
| `~/.ccr/mcp/servers/` | CCR 自研或手动安装的 MCP server | 放 CCR 管理的本地 server 包或入口 |
| `~/.ccr/mcp/installed.json` | CCR 受控 MCP 安装清单 | Desktop / App Server install 入口记录 installer-owned MCP |
| `~/.ccr/mcp/lock.json` | CCR 受控 MCP 锁文件 | 记录安装来源、版本、包缓存、checksum 和 dataBoundary |
| `~/.ccr/mcp/packages/` | CCR installer-owned 包缓存 | 通过 owner marker 保护，卸载时只清理确认归属的目录 |
| `~/.ccr/mcp/presets/` | 用户自定义 MCP 预设 | 例如自定义 browser/db/search preset |
| `~/.ccr/skills/` | 用户安装的 skill | 类似 Codex skill，但归 CCR 管理 |
| `~/.ccr/plugins/` | 用户安装的 plugin | 插件包、manifest、版本目录 |

第三方 MCP 如果通过 npm 临时执行，例如 `npx.cmd -y @playwright/mcp@latest`，不复制到 `~/.ccr/mcp/servers/`。它只是配置引用的外部执行源。

Playwright MCP 后续明确支持两种来源：

- `npx` 快速模式：`~/.ccr/mcp.json` 直接引用 `npx.cmd`，适合快速验证和轻量使用；首次启动时由 npm/npx 获取和缓存包。
- `.ccr` 管理式安装模式：`ccr mcp add-playwright --mode managed` 把固定版本放入 `~/.ccr/mcp/servers/playwright/`，`~/.ccr/mcp.json` 指向本地入口，适合发布版、弱网和可控升级。
- Desktop 受控安装模式：先生成安装计划并要求用户确认，默认写入用户全局 `~/.ccr/mcp.json`，同步记录 `installed.json`、`lock.json` 和 `packages/` owner marker；stdio npm 包仍可由 `npx` 在运行时获取。

Playwright MCP 管理式安装目录结构：

```text
~/.ccr/mcp/servers/playwright/
  package.json
  package-lock.json
  manifest.json
  node_modules/
    @playwright/
      mcp/
        cli.js
        package.json
```

其中 `manifest.json` 记录 `requestedVersion`、`installedVersion`、`entryPath`、`binName`、`nodeCommand` 等信息。它用于排查和后续升级/修复，不是用户手写配置入口。

如果后续想避免每次 `npx` 拉包，可以有两种方式：

- 用户自行全局安装，然后 `~/.ccr/mcp.json` 指向全局命令。
- CCR 提供安装器，把特定 MCP 包下载/展开到 `~/.ccr/mcp/servers/<name>/`，再由配置引用本地入口。

## 4. 运行态与缓存

| 路径 | 用途 |
| --- | --- |
| `~/.ccr/projects/` | 项目索引、项目级状态 |
| `~/.ccr/sessions/` | 会话记录和并发会话状态 |
| `~/.ccr/logs/` | 普通日志 |
| `~/.ccr/debug/` | debug 日志 |
| `~/.ccr/cache/` | 可删除缓存 |
| `~/.ccr/tmp/` | 临时文件 |

缓存和临时文件必须可重建，不应存放唯一凭据或不可恢复用户数据。

## 5. 优先级

MCP 配置建议按这个顺序合并：

1. CLI `--mcp-config`
2. 项目本地私有 local 配置
3. 项目共享 `.mcp.json`
4. 用户级 `~/.ccr/mcp.json`
5. 旧全局 settings 中的 user MCP 兼容配置
6. CCR 内置预设 / plugin MCP

更靠前的配置只应覆盖同名 server，不应无条件清空后续全部配置，除非用户显式使用 strict 模式。

## 6. 不变式

- CCR 自己的新配置、新安装、新缓存默认不写 `.claude`。
- `CCR_CONFIG_DIR` 是用户目录的唯一主覆盖入口。
- `~/.ccr` 下的 token、cookie、OAuth、私有路径不能提交。
- 示例配置放仓库 `docs/examples/`，真实用户配置放 `~/.ccr` 或项目私有 `.ccr/`。
- 项目 `.claude/settings*.json` 不再作为 CCR settings 读取或写入路径。
- 自研 MCP server 的源码在仓库内，用户安装后的产物在 `~/.ccr/mcp/servers/`。
