# CCR MCP 文档入口

本目录用于沉淀 CCR 的通用 MCP 接入设计、安装使用流程、验证方法、风险边界和具体 MCP 服务方案。原则是：核心运行时保持通用，具体 MCP 服务通过配置、预设、受控安装计划和文档进入，不把单个 MCP 硬编码进主循环。

## 目录职责

| 路径 | 职责 | 是否放真实用户配置 |
| --- | --- | --- |
| `src/services/mcp/` | 通用 MCP 运行时：配置解析、连接、工具发现、调用、状态同步 | 否 |
| `docs/mcp/` | MCP 设计、规范、验证手册、专项方案 | 否 |
| `docs/examples/mcp/` | 可复制的示例配置 | 否 |
| 项目根目录 `.mcp.json` | 当前项目实际启用的 MCP 配置 | 是，按项目需要 |
| `~/.ccr/mcp.json` | 用户级长期 MCP 配置 | 是，用户本机状态 |
| `~/.ccr/mcp/installed.json` | CCR 受控安装记录 | 是，用户本机状态 |
| `~/.ccr/mcp/lock.json` | CCR 受控安装锁定记录 | 是，用户本机状态 |
| `~/.ccr/mcp/packages/` | CCR installer-owned MCP 包缓存与 owner marker | 是，用户本机状态 |
| `~/.ccr/mcp/servers/` | CLI managed 模式安装的本地 MCP server 入口，例如 Playwright managed | 是，用户本机状态 |
| `~/.ccr/logs/mcp/` | MCP 安装、连接和诊断日志落点 | 是，用户本机状态 |
| `~/.ccr/skills/` | CCR 管理的用户 skill 安装目录 | 是，用户本机状态 |
| `~/.ccr/plugins/` | CCR 管理的用户 plugin 安装目录 | 是，用户本机状态 |

## 当前文档

- [通用 MCP 接入规范](./integration-standard.md)：后续接入任何 MCP 前先看这里。
- [MCP 模块化路线图](./modularization-roadmap.md)：当前权威路线，包含已完成 C 系列和后续 D 系列 goal。
- [MCP 模块化 Goal C-1 设计](./modularization-goal-c1.md)：历史滚动记录，保留 C 系列背景和执行结果。
- [MCP 验证与排查手册](./verification-runbook.md)：按命令验证配置、连接、工具发现和只读 smoke。
- [Playwright MCP 接入设计](./playwright-integration-design.md)：浏览器 MCP 的第一条正式接入路线。
- [MCP 示例配置](../examples/mcp/README.md)：当前可直接复制的 JSON 配置。
- [CCR 用户目录与安装布局](../architecture/ccr-home-layout.md)：`~/.ccr` 下 MCP、skill、plugin、配置、缓存的默认落点。

## 接入原则

- 新 MCP 默认先走通用 `mcpServers` 配置，不新增核心代码。
- 如果要加快捷命令，只写成预设或配置生成器，不改变通用 MCP 运行时语义。
- 高风险 MCP 必须先有风险边界和 smoke，不允许只靠“能连上”就进入默认配置。
- 专有、缺失、不可公开验证的 MCP 不做假恢复；要么显式禁用，要么换成公开生态方案。
- 示例配置不等于启用配置，仓库根目录不默认放 `.mcp.json`，避免开发者启动 CCR 时被迫拉起外部服务。
- CCR 自己管理的 MCP、skill、plugin 默认安装到 `~/.ccr`；通过 npm/npx 引用的第三方 MCP 只是外部执行源，不算 CCR 安装目录。

## 当前权威状态

当前 MCP 模块化与安装管理以 [MCP 模块化路线图](./modularization-roadmap.md) 为权威入口；`modularization-goal-c1.md` 只保留 C 系列历史滚动记录，不再作为继续实现的唯一入口。

内置安装候选当前包括：

- Playwright MCP：stdio npm package，适合浏览器自动化、截图和本地页面验证。
- Context7 MCP：stdio npm package，适合按库名检索最新 API 文档和代码示例。
- Sentry MCP：hosted remote HTTP MCP，入口 `https://mcp.sentry.dev/mcp`，首次连接由远端 OAuth 授权。

## 当前路线

第一阶段已经从“示例验证”推进到“用户级默认入口 + Desktop 管理面”。当前版本线调整为：MCP 动态工具治理和基础管理面提前进入 `0.5.x` 收尾；Skill / Plugin 扩展包治理留到 `0.6.0`。

已完成：

- 用户级 MCP 配置默认落到 `~/.ccr/mcp.json`。
- Desktop 已有一级 MCP 页面，可查看 server、启用/禁用、重启、检测、搜索安装候选、选择安装 scope、确认安装、查看安装记录、修复漂移/缺失配置和卸载 CCR installer-owned MCP。
- Desktop 安装可选择用户全局、项目共享或本地项目 scope。
- 当前内置安装候选提供 Playwright、Context7 和 Sentry remote MCP。
- 安装计划必须经用户确认后才写配置、记录安装清单和锁文件；模型不能绕过宿主确认自行下载或改配置。
- `ccr mcp add-playwright` 会把官方 Playwright MCP 写入用户级配置。
- `ccr mcp add-playwright --mode npx` 保持快速模式，Windows 使用 `npx.cmd -y @playwright/mcp@<version>`。
- `ccr mcp add-playwright --mode managed` 会把 Playwright MCP 安装到 `~/.ccr/mcp/servers/playwright/`，并把 `~/.ccr/mcp.json` 指向本地入口。
- `ccr mcp list/get` 和 TUI 默认 MCP 启动链路都会读取 `~/.ccr/mcp.json`。
- 旧 settings 中的 user MCP 只作为迁移期只读兼容来源，新写入不再进入旧配置文件。

## 使用入口

### Desktop 推荐流程

日常用户优先走 Desktop：

1. 打开 CCR Desktop，进入左侧 `MCP` 页面。
2. 在安装区搜索 `playwright`、`context7` 或 `sentry`。
3. 点击 `安装`，查看确认弹窗里的写入位置、启动方式、数据边界和风险提示。
4. 点击 `确认安装` 后，CCR 会写入 `~/.ccr/mcp.json`，并记录 `~/.ccr/mcp/installed.json` 和 `~/.ccr/mcp/lock.json`。
5. 安装后在 MCP 页面点击 `检测`，确认能发现工具。
6. 会话里需要对应能力时，明确说“用浏览器打开/查询/操作”“查某个库文档”或“查 Sentry issue”。成功调用时，聊天流会出现对应 MCP 工具卡。

如果候选已显示“已安装”，不要重复安装；直接在左侧 server 列表里点 `检测`、`重启` 或 `禁用/启用`。

### CLI 快速安装

Playwright MCP 的用户级快捷安装：

```powershell
ccr mcp add-playwright
```

常用变体：

```powershell
ccr mcp add-playwright --headless
ccr mcp add-playwright --version 0.0.71
ccr mcp add-playwright --mode managed
```

`npx` 快速模式不会把 `@playwright/mcp` 复制进 `~/.ccr/mcp/servers/`；它会在启动时由 npm/npx 获取并缓存。`managed` 模式会把指定版本安装到 `~/.ccr/mcp/servers/playwright/`，适合需要固定入口和弱网环境的场景。

### 手动配置

如果要接入其它 stdio / HTTP / SSE MCP，可以用通用命令：

```powershell
ccr mcp add --scope user playwright -- npx.cmd -y @playwright/mcp@latest
ccr mcp add --scope user --transport http sentry https://mcp.sentry.dev/mcp
```

也可以手写 `~/.ccr/mcp.json` 或项目 `.mcp.json`：

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx.cmd",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

手写配置不会自动进入 `installed.json`，因此 Desktop 的“已安装”记录里不会把它当成 CCR installer-owned 项；但 server 列表仍会展示和管理配置状态。

## 安装与运行边界

- `~/.ccr/mcp.json` 是用户全局 MCP 主配置，适合“所有项目都能用”的浏览器、搜索、文档类工具。
- 项目根目录 `.mcp.json` 适合团队共享的项目级 MCP，但不要提交 token、cookie、私有路径或个人浏览器 profile。
- `~/.ccr/mcp/installed.json` 和 `~/.ccr/mcp/lock.json` 只记录 CCR 受控安装，不代表所有手写 MCP。
- `~/.ccr/mcp/packages/` 由 owner marker 保护，卸载时只清理 CCR 确认归属的目录。
- `npx` 来源首次运行可能访问 npm 网络并启动本地 stdio 进程；这也是安装确认里会提示 `requires_user_confirmation`、`starts_local_process` 和 `may_access_network` 的原因。
- 模型可以建议需要某类 MCP 能力，但真实安装、写配置、卸载、启停都必须由宿主执行并经过用户确认。

后续再继续做：

- MCP 连接失败诊断和 availability 原因继续细化。
- 浏览器工具风险分类和权限提示继续细化。
- CLI 侧补更完整的 `install/uninstall/repair/status` 管理命令。
- Skill / Plugin 复用 MCP installer-owned、registry、availability 和 Desktop 管理页模式。
